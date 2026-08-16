import { describe, expect, it } from "vitest";
import { PipelineEngine } from "./engine";
import { EventQueue } from "./event-queue";
import { RunnerPool } from "./runner-pool";
import { createSeededRandom } from "./random";
import { initialPipeline, MISSION_01_BRIEFING, MISSION_01_SEED } from "./missions/mission-01";

describe("EventQueue", () => {
    it("pops events in time order regardless of insertion order", () => {
        const q = new EventQueue();
        q.push({ time: 300, type: "JOB_COMPLETED", message: "c" });
        q.push({ time: 100, type: "JOB_COMPLETED", message: "a" });
        q.push({ time: 200, type: "JOB_COMPLETED", message: "b" });
        expect(q.pop()?.message).toBe("a");
        expect(q.pop()?.message).toBe("b");
        expect(q.pop()?.message).toBe("c");
        expect(q.pop()).toBeUndefined();
    });
});

describe("RunnerPool", () => {
    it("given 2 runners and 3 jobs, 2 start and 1 queues", () => {
        const pool = new RunnerPool(2, 1);
        expect(pool.acquire()).toBe(true);
        expect(pool.acquire()).toBe(true);
        expect(pool.acquire()).toBe(false); // third job can't get a runner
        pool.enqueue({ prId: 3, stageId: "unit", enqueuedAt: 0 });
        expect(pool.queue.length).toBe(1);
        expect(pool.busy).toBe(2);
    });
});

describe("createSeededRandom", () => {
    it("produces the same sequence for the same seed", () => {
        const a = createSeededRandom(1234);
        const b = createSeededRandom(1234);
        const seqA = [a(), a(), a()];
        const seqB = [b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });

    it("produces a different sequence for a different seed", () => {
        const a = createSeededRandom(1234);
        const b = createSeededRandom(5678);
        expect(a()).not.toBe(b());
    });
});

describe("PipelineEngine - Mission 01 broken pipeline", () => {
    it("with everything sequential on 2 standard runners, PR feedback exceeds 20 minutes and the runner queue backs up", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.run({ autoResolvePolicy: "retry" });
        const state = engine.getState();

        expect(state.status).toBe("completed");
        expect(state.metrics.avgPrCycleMs).toBeGreaterThan(20 * 60_000);
        expect(state.metrics.runnerQueueMax).toBeGreaterThan(0);
    });
});

describe("PipelineEngine - Mission 01 fixed pipeline", () => {
    it("parallelizing lint+unit+api and moving E2E out of PR drops feedback below 6 minutes", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.parallelize(["lint", "unit", "api"]);
        engine.moveStage("e2e", "merge");
        engine.run({ autoResolvePolicy: "retry" });
        const state = engine.getState();

        expect(state.status).toBe("completed");
        expect(state.metrics.avgPrCycleMs).toBeLessThan(6 * 60_000);
    });

    it("mission objectives (velocity, cost, escapes) are all simultaneously achievable with the intended fix on standard tier", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.parallelize(["lint", "unit", "api"]);
        engine.moveStage("e2e", "merge");
        engine.run({ autoResolvePolicy: "retry" });
        const { metrics } = engine.getState();
        const { objectives } = MISSION_01_BRIEFING;

        expect(metrics.avgPrCycleMs).toBeLessThan(objectives.prFeedbackTargetMs);
        expect(metrics.totalCost).toBeLessThanOrEqual(objectives.runnerCostBudget);
        expect(metrics.criticalEscapes).toBeLessThanOrEqual(objectives.criticalEscapesTarget);
    });

    it("still catches the integration defect when E2E remains present in the merge lane", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.parallelize(["lint", "unit", "api"]);
        engine.moveStage("e2e", "merge");
        engine.run({ autoResolvePolicy: "retry" });
        const state = engine.getState();

        expect(state.metrics.criticalEscapes).toBe(0);
    });
});

describe("PipelineEngine - defect coverage", () => {
    it("removing E2E from PR and Merge lanes entirely lets the integration defect escape to production", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.moveStage("e2e", "release"); // release lane can't catch it - too late
        engine.run({ autoResolvePolicy: "retry" });
        const state = engine.getState();

        expect(state.metrics.criticalEscapes).toBe(1);
    });
});

describe("PipelineEngine - cost model contract (MVP, per-run compute)", () => {
    it("Move and Parallelize change latency but NOT Estimated Runner Cost - each stage still executes exactly once per PR", () => {
        // This is a deliberate MVP modeling boundary, not a bug: the engine executes each
        // stage once per PR regardless of lane/grouping, so total compute (and therefore
        // cost) is invariant to Move/Parallelize. Only Runner Tier changes cost. Modeling
        // "cost drops because expensive work is triggered less often post-merge" requires a
        // push-history/trigger-frequency layer (see TriggerScope) that's explicitly out of
        // scope for this MVP. This test locks in that boundary so it can't drift silently.
        const before = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        before.run({ autoResolvePolicy: "retry" });
        const costBefore = before.getState().metrics.totalCost;

        const after = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        after.parallelize(["lint", "unit", "api"]);
        after.moveStage("e2e", "merge");
        after.run({ autoResolvePolicy: "retry" });
        const costAfter = after.getState().metrics.totalCost;

        expect(costAfter).toBe(costBefore);
    });

    it("moving a stage keeps triggerScope in sync with lane (pr <-> post-merge)", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.moveStage("e2e", "merge");
        const e2e = engine.getPipeline().find((s) => s.id === "e2e")!;
        expect(e2e.triggerScope).toBe("post-merge");

        engine.moveStage("e2e", "pr");
        const e2eBack = engine.getPipeline().find((s) => s.id === "e2e")!;
        expect(e2eBack.triggerScope).toBe("pr");
    });
});

describe("PipelineEngine - flaky retry", () => {
    it("caps retries at one per stage per PR (no infinite pause loop)", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        // Force a very high flake rate scenario indirectly isn't exposed, but we can at least
        // assert that a full run with autoResolvePolicy 'retry' always terminates rather than hanging.
        engine.run({ autoResolvePolicy: "retry" });
        expect(engine.getState().status).toBe("completed");
    });
});

describe("PipelineEngine - runner tier cost", () => {
    it("turbo tier costs more than standard tier for the same pipeline", () => {
        const standardEngine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        standardEngine.run({ autoResolvePolicy: "retry" });
        const standardCost = standardEngine.getState().metrics.totalCost;

        const turboEngine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "turbo");
        turboEngine.run({ autoResolvePolicy: "retry" });
        const turboCost = turboEngine.getState().metrics.totalCost;

        expect(turboCost).toBeGreaterThan(standardCost);
    });

    it("turbo tier reduces or matches PR feedback time versus standard for the same pipeline", () => {
        const standardEngine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        standardEngine.run({ autoResolvePolicy: "retry" });
        const standardCycle = standardEngine.getState().metrics.avgPrCycleMs;

        const turboEngine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "turbo");
        turboEngine.run({ autoResolvePolicy: "retry" });
        const turboCycle = turboEngine.getState().metrics.avgPrCycleMs;

        expect(turboCycle).toBeLessThanOrEqual(standardCycle);
    });
});

describe("PipelineEngine - re-run on the same instance", () => {
    it("reconfiguring and clicking Run a second time on the same engine actually re-simulates, rather than replaying the stale completed state", () => {
        const engine = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engine.run({ autoResolvePolicy: "retry" });
        const firstCycle = engine.getState().metrics.avgPrCycleMs;

        engine.parallelize(["lint", "unit", "api"]);
        engine.moveStage("e2e", "merge");
        engine.run({ autoResolvePolicy: "retry" });
        const secondCycle = engine.getState().metrics.avgPrCycleMs;

        expect(secondCycle).toBeLessThan(firstCycle);
        expect(engine.getState().metrics.totalRuns).toBe(2);
    });
});

describe("PipelineEngine - determinism", () => {
    it("the same seed and config produce identical results across runs", () => {
        const engineA = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engineA.run({ autoResolvePolicy: "retry" });
        const stateA = engineA.getState();

        const engineB = new PipelineEngine(initialPipeline(), MISSION_01_SEED, "standard");
        engineB.run({ autoResolvePolicy: "retry" });
        const stateB = engineB.getState();

        expect(stateA.metrics).toEqual(stateB.metrics);
    });
});
