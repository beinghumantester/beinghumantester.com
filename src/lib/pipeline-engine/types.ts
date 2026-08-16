export type LaneId = "pr" | "merge" | "release";

/**
 * How often this stage's compute is triggered, conceptually - "pr" work
 * would re-run on every push in a model with push history; "post-merge"
 * work runs once per PR regardless. Not yet used by the cost calculation
 * (the MVP engine only executes each stage once per PR, full stop), but
 * kept as a first-class field so a future execution-frequency layer can
 * hang off it without changing the StageConfig shape again.
 */
export type TriggerScope = "pr" | "post-merge";

export type StageId =
    | "lint"
    | "unit"
    | "api"
    | "e2e"
    | "build"
    | "security"
    | "staging"
    | "production";

export interface StageConfig {
    id: StageId;
    name: string;
    lane: LaneId;
    durationMs: number;
    costPerMinute: number;
    /** Stages sharing the same group (and lane) run in parallel. Order of first appearance determines sequence. */
    group: string;
    triggerScope: TriggerScope;
    /** True for the stage type capable of catching the seeded integration defect. */
    catchesIntegrationDefect?: boolean;
    /** True for the stage type that can occasionally be flaky. */
    flakyProne?: boolean;
    enabled: boolean;
}

export type PRStatus = "queued" | "running" | "passed" | "failed" | "deployed" | "escaped";

export type StageRunStatus = "pending" | "running" | "passed" | "failed" | "quarantined" | "retried";

export interface PRRecord {
    id: number;
    arrivalTime: number;
    kind: "clean" | "integration_defect";
    status: PRStatus;
    currentGroupIndex: number;
    pendingInGroup: Set<StageId>;
    stageResults: Partial<Record<StageId, StageRunStatus>>;
    retriedStages: Set<StageId>;
    /** When the PR-lane groups finished - this is what "PR feedback time" measures. */
    prFeedbackAt?: number;
    completedAt?: number;
    detected: boolean;
}

export interface RunnerQueueItem {
    prId: number;
    stageId: StageId;
    enqueuedAt: number;
}

export type EventType =
    | "PR_ARRIVAL"
    | "JOB_STARTED"
    | "JOB_COMPLETED"
    | "FLAKY_DETECTED"
    | "DEFECT_ESCAPED"
    | "SIMULATION_COMPLETE";

export interface SimEvent {
    time: number;
    type: EventType;
    prId?: number;
    stageId?: StageId;
    message: string;
}

export interface Metrics {
    avgPrCycleMs: number;
    totalCost: number;
    criticalEscapes: number;
    devExperience: number;
    runnerQueueMax: number;
    totalRuns: number;
}

export type RunnerTierId = "standard" | "turbo";

export interface RunnerTierConfig {
    id: RunnerTierId;
    label: string;
    count: number;
    costPerMinute: number;
}

export type SimStatus = "idle" | "running" | "awaiting_decision" | "completed";

export interface FlakyDecisionContext {
    prId: number;
    stageId: StageId;
    time: number;
}

export interface SystemState {
    clock: number;
    seed: number;
    runnerTier: RunnerTierId;
    runnerTotal: number;
    runnerBusy: number;
    runnerQueue: RunnerQueueItem[];
    pipeline: StageConfig[];
    prs: PRRecord[];
    events: SimEvent[];
    metrics: Metrics;
    status: SimStatus;
    pendingDecision: FlakyDecisionContext | null;
}
