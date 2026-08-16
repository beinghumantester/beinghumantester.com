import { EventQueue } from "./event-queue";
import { RunnerPool } from "./runner-pool";
import { prLaneGroupCount, resolveGroups } from "./scheduler";
import { checkDefectCaught, hasIntegrationDefectCoverage, isFlakyRoll, pickDefectCarrier } from "./defect-engine";
import { computeAvgPrCycleMs, computeDevExperience, emptyMetrics } from "./metrics";
import { createSeededRandom } from "./random";
import { MISSION_01_PR_COUNT, RUNNER_TIERS } from "./missions/mission-01";
import type {
    PRRecord,
    RunnerTierId,
    SimEvent,
    StageConfig,
    StageId,
    SystemState,
} from "./types";

type Listener = (state: SystemState) => void;

export interface RunOptions {
    /** If provided, flaky decisions auto-resolve with this policy instead of pausing the run (used by tests/terminal). */
    autoResolvePolicy?: "retry" | "quarantine";
}

export class PipelineEngine {
    private pipeline: StageConfig[];
    private seed: number;
    private runnerTierId: RunnerTierId;
    private rng: () => number;
    private pool: RunnerPool;
    private queue: EventQueue;
    private prs: PRRecord[] = [];
    private events: SimEvent[] = [];
    private clock = 0;
    private status: SystemState["status"] = "idle";
    private pendingDecision: SystemState["pendingDecision"] = null;
    private defectCarrierId = -1;
    private listeners: Listener[] = [];
    private totalCost = 0;
    private totalRuns = 0;

    constructor(pipeline: StageConfig[], seed: number, runnerTierId: RunnerTierId = "standard") {
        this.pipeline = pipeline.map((s) => ({ ...s }));
        this.seed = seed;
        this.runnerTierId = runnerTierId;
        this.rng = createSeededRandom(seed);
        const tier = RUNNER_TIERS[runnerTierId];
        this.pool = new RunnerPool(tier.count, tier.costPerMinute, tier.prReserved);
        this.queue = new EventQueue();
        this.generatePRs();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        listener(this.getState());
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notify(): void {
        const state = this.getState();
        this.listeners.forEach((l) => l(state));
    }

    getState(): SystemState {
        const tier = RUNNER_TIERS[this.runnerTierId];
        return {
            clock: this.clock,
            seed: this.seed,
            runnerTier: this.runnerTierId,
            runnerTotal: this.pool.total,
            runnerBusy: this.pool.busy,
            runnerQueue: [...this.pool.queue],
            pipeline: this.pipeline.map((s) => ({ ...s })),
            prs: this.prs.map((p) => ({ ...p, pendingInGroup: new Set(p.pendingInGroup), retriedStages: new Set(p.retriedStages) })),
            events: [...this.events],
            metrics: {
                avgPrCycleMs: computeAvgPrCycleMs(this.prs),
                totalCost: Math.round((this.totalCost + tier.fixedCost) * 100) / 100,
                criticalEscapes: this.prs.filter((p) => p.status === "escaped").length,
                devExperience: computeDevExperience(computeAvgPrCycleMs(this.prs)),
                runnerQueueMax: this.pool.maxQueueSeen,
                totalRuns: this.totalRuns,
            },
            status: this.status,
            pendingDecision: this.pendingDecision,
        };
    }

    // ---- Configuration actions (available between runs) ----

    moveStage(stageId: StageId, targetLane: StageConfig["lane"]): void {
        const stage = this.pipeline.find((s) => s.id === stageId);
        if (!stage) return;
        stage.lane = targetLane;
        stage.triggerScope = targetLane === "pr" ? "pr" : "post-merge";
        stage.group = `${stageId}-solo-${Math.round(this.rng() * 1e9)}`;
        this.notify();
    }

    parallelize(stageIds: StageId[]): void {
        if (stageIds.length < 2) return;
        const stages = this.pipeline.filter((s) => stageIds.includes(s.id));
        const lanes = new Set(stages.map((s) => s.lane));
        if (lanes.size !== 1) return; // must be in the same lane
        const groupId = `parallel-${stageIds.join("-")}`;
        stages.forEach((s) => (s.group = groupId));
        this.notify();
    }

    setRunnerTier(tierId: RunnerTierId): void {
        this.runnerTierId = tierId;
        const tier = RUNNER_TIERS[tierId];
        this.pool.reset(tier.count, tier.costPerMinute, tier.prReserved);
        this.notify();
    }

    getPipeline(): StageConfig[] {
        return this.pipeline.map((s) => ({ ...s }));
    }

    // ---- Simulation lifecycle ----

    private generatePRs(): void {
        this.rng = createSeededRandom(this.seed);
        this.defectCarrierId = pickDefectCarrier(MISSION_01_PR_COUNT, this.rng);
        this.prs = [];
        let t = 0;
        for (let i = 0; i < MISSION_01_PR_COUNT; i++) {
            t += 210_000 + this.rng() * 240_000;
            this.prs.push({
                id: i + 1,
                arrivalTime: Math.round(t),
                kind: i === this.defectCarrierId ? "integration_defect" : "clean",
                status: "queued",
                currentGroupIndex: -1,
                pendingInGroup: new Set(),
                stageResults: {},
                retriedStages: new Set(),
                detected: false,
            });
        }
    }

    reset(): void {
        const tier = RUNNER_TIERS[this.runnerTierId];
        this.pool.reset(tier.count, tier.costPerMinute, tier.prReserved);
        this.queue.clear();
        this.events = [];
        this.clock = 0;
        this.totalCost = 0;
        this.status = "idle";
        this.pendingDecision = null;
        this.generatePRs();
        this.notify();
    }

    run(options: RunOptions = {}): void {
        // Only an in-progress paused run (awaiting a flaky decision) should be
        // "continued" rather than started fresh - idle AND completed both need a reset,
        // otherwise a second "Run Pipeline" click on the same engine instance is a no-op.
        if (this.status !== "awaiting_decision") {
            this.reset();
            this.totalRuns += 1;
            for (const pr of this.prs) {
                this.queue.push({ time: pr.arrivalTime, type: "PR_ARRIVAL", prId: pr.id, message: `PR #${pr.id} arrived` });
            }
        }
        this.status = "running";
        this.pendingDecision = null;

        while (this.queue.length > 0) {
            const event = this.queue.pop()!;
            this.clock = event.time;
            this.handleEvent(event, options);
            if (this.status === "awaiting_decision") {
                this.notify();
                return;
            }
        }

        this.status = "completed";
        this.log(this.clock, "SIMULATION_COMPLETE", undefined, undefined, "Simulation complete.");
        this.notify();
    }

    resolveFlaky(decision: "retry" | "quarantine"): void {
        if (!this.pendingDecision) return;
        const { prId, stageId, time } = this.pendingDecision;
        this.pendingDecision = null;
        this.applyFlakyDecision(prId, stageId, time, decision);
        this.run();
    }

    private log(time: number, type: SimEvent["type"], prId: number | undefined, stageId: StageId | undefined, message: string): void {
        this.events.push({ time, type, prId, stageId, message });
    }

    private groups() {
        return resolveGroups(this.pipeline);
    }

    private findPR(prId: number): PRRecord {
        return this.prs.find((p) => p.id === prId)!;
    }

    private handleEvent(event: SimEvent, options: RunOptions): void {
        if (event.type === "PR_ARRIVAL") {
            const pr = this.findPR(event.prId!);
            pr.status = "running";
            pr.currentGroupIndex = 0;
            this.startGroup(pr, event.time, options);
            return;
        }

        if (event.type === "JOB_COMPLETED") {
            this.completeJob(event.prId!, event.stageId!, event.time, options);
        }
    }

    private startGroup(pr: PRRecord, time: number, options: RunOptions): void {
        const allGroups = this.groups();

        if (pr.prFeedbackAt === undefined && pr.currentGroupIndex >= prLaneGroupCount(this.pipeline)) {
            pr.prFeedbackAt = time;
        }

        const group = allGroups[pr.currentGroupIndex];
        if (!group) {
            if (pr.prFeedbackAt === undefined) pr.prFeedbackAt = time;
            this.completePR(pr, time);
            return;
        }
        pr.pendingInGroup = new Set(group.stages.map((s) => s.id));
        // When a group has more stages than free runners, start the longest ones
        // first so shorter stages can fill the gap later without extending the
        // group's overall completion time past the longest stage's own finish.
        const byLongestFirst = [...group.stages].sort((a, b) => b.durationMs - a.durationMs);
        for (const stage of byLongestFirst) {
            this.attemptStart(pr, stage, time, options);
        }
    }

    private attemptStart(pr: PRRecord, stage: StageConfig, time: number, options: RunOptions, isRetry = false): void {
        if (this.pool.acquire(stage.lane === "pr")) {
            pr.stageResults[stage.id] = "running";
            const duration = stage.durationMs;
            this.queue.push({ time: time + duration, type: "JOB_COMPLETED", prId: pr.id, stageId: stage.id, message: `${stage.name} running for PR #${pr.id}` });
            this.log(time, "JOB_STARTED", pr.id, stage.id, `${isRetry ? "Retry: " : ""}${stage.name} started for PR #${pr.id}`);
        } else {
            this.pool.enqueue({ prId: pr.id, stageId: stage.id, enqueuedAt: time });
        }
    }

    private completeJob(prId: number, stageId: StageId, time: number, options: RunOptions): void {
        const pr = this.findPR(prId);
        const stage = this.pipeline.find((s) => s.id === stageId)!;
        this.pool.release();
        this.totalCost += (stage.durationMs / 60000) * stage.costPerMinute;

        const flaky = isFlakyRoll(stage, this.rng);
        if (flaky && !pr.retriedStages.has(stage.id)) {
            if (options.autoResolvePolicy) {
                this.applyFlakyDecision(prId, stageId, time, options.autoResolvePolicy, options);
                this.pullNextQueued(time, options);
                return;
            }
            pr.status = "running";
            this.pendingDecision = { prId, stageId, time };
            this.status = "awaiting_decision";
            this.log(time, "FLAKY_DETECTED", prId, stageId, `Flaky result on ${stage.name} for PR #${prId}`);
            this.pullNextQueued(time, options);
            return;
        }

        this.finishStage(pr, stage, time, "passed");
        this.pullNextQueued(time, options);
        this.advanceIfGroupDone(pr, time, options);
    }

    private applyFlakyDecision(prId: number, stageId: StageId, time: number, decision: "retry" | "quarantine", options: RunOptions = {}): void {
        const pr = this.findPR(prId);
        const stage = this.pipeline.find((s) => s.id === stageId)!;

        if (decision === "retry") {
            pr.retriedStages.add(stage.id);
            this.attemptStart(pr, stage, time, options, true);
            return;
        }

        this.finishStage(pr, stage, time, "quarantined");
        this.advanceIfGroupDone(pr, time, options);
    }

    private finishStage(pr: PRRecord, stage: StageConfig, time: number, outcome: "passed" | "quarantined"): void {
        pr.stageResults[stage.id] = outcome;
        pr.pendingInGroup.delete(stage.id);
        if (checkDefectCaught(pr, stage, outcome)) {
            pr.detected = true;
        }
    }

    private laneRank(stageId: StageId): number {
        const lane = this.pipeline.find((s) => s.id === stageId)?.lane;
        return lane === "pr" ? 0 : lane === "merge" ? 1 : 2;
    }

    private pullNextQueued(time: number, options: RunOptions): void {
        // PR-lane jobs get scheduling priority over Merge/Release lane jobs - fast
        // developer feedback shouldn't wait behind an already-approved deploy pipeline.
        // Skip past any higher-priority item that can't actually acquire yet (e.g. a
        // Merge-lane job blocked by the PR reservation) rather than blocking on it.
        const sorted = [...this.pool.queue].sort((a, b) => this.laneRank(a.stageId) - this.laneRank(b.stageId));
        for (const item of sorted) {
            const stage = this.pipeline.find((s) => s.id === item.stageId)!;
            if (!this.pool.acquire(stage.lane === "pr")) continue;
            const idx = this.pool.queue.indexOf(item);
            this.pool.queue.splice(idx, 1);
            const pr = this.findPR(item.prId);
            pr.stageResults[stage.id] = "running";
            this.queue.push({ time: time + stage.durationMs, type: "JOB_COMPLETED", prId: pr.id, stageId: stage.id, message: `${stage.name} started for PR #${pr.id}` });
            this.log(time, "JOB_STARTED", pr.id, stage.id, `${stage.name} started for PR #${pr.id} (from queue)`);
            return;
        }
    }

    private advanceIfGroupDone(pr: PRRecord, time: number, options: RunOptions): void {
        if (pr.pendingInGroup.size > 0) return;
        pr.currentGroupIndex += 1;
        this.startGroup(pr, time, options);
    }

    private completePR(pr: PRRecord, time: number): void {
        pr.completedAt = time;
        const coverage = hasIntegrationDefectCoverage(this.pipeline);
        if (pr.kind === "integration_defect") {
            if (pr.detected) {
                pr.status = "passed";
            } else {
                pr.status = "escaped";
                this.log(time, "DEFECT_ESCAPED", pr.id, undefined, `PR #${pr.id} shipped an undetected integration defect${coverage ? "" : " (no coverage in PR/Merge lanes)"}.`);
            }
        } else {
            pr.status = "deployed";
        }
    }
}
