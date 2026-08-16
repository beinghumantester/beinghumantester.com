import type { RunnerTierConfig, StageConfig } from "../types";

export const MISSION_01_SEED = 847291;
export const MISSION_01_PR_COUNT = 20;

export const RUNNER_TIERS: Record<string, RunnerTierConfig & { fixedCost: number; prReserved: number }> = {
    standard: { id: "standard", label: "Standard", count: 2, costPerMinute: 1, fixedCost: 80, prReserved: 1 },
    turbo: { id: "turbo", label: "Turbo", count: 6, costPerMinute: 1, fixedCost: 280, prReserved: 2 },
};

/** The broken pipeline the player inherits: everything sequential, E2E gates every PR. */
export function initialPipeline(): StageConfig[] {
    return [
        { id: "lint", name: "Lint", lane: "pr", durationMs: 30_000, costPerMinute: 0.15, group: "lint", triggerScope: "pr", enabled: true },
        { id: "unit", name: "Unit Tests", lane: "pr", durationMs: 120_000, costPerMinute: 0.2, group: "unit", triggerScope: "pr", enabled: true },
        { id: "api", name: "API Tests", lane: "pr", durationMs: 180_000, costPerMinute: 0.25, group: "api", triggerScope: "pr", enabled: true },
        {
            id: "e2e",
            name: "E2E (Selenium)",
            lane: "pr",
            durationMs: 720_000,
            costPerMinute: 0.6,
            group: "e2e",
            triggerScope: "pr",
            catchesIntegrationDefect: true,
            flakyProne: true,
            enabled: true,
        },
        { id: "build", name: "Build", lane: "merge", durationMs: 300_000, costPerMinute: 0.3, group: "build", triggerScope: "post-merge", enabled: true },
        { id: "security", name: "Security Scan", lane: "merge", durationMs: 120_000, costPerMinute: 0.25, group: "security", triggerScope: "post-merge", enabled: true },
        { id: "staging", name: "Staging Deploy", lane: "release", durationMs: 60_000, costPerMinute: 0.15, group: "staging", triggerScope: "post-merge", enabled: true },
        { id: "production", name: "Production Deploy", lane: "release", durationMs: 60_000, costPerMinute: 0.15, group: "production", triggerScope: "post-merge", enabled: true },
    ];
}

export const MISSION_01_BRIEFING = {
    company: "FinBank",
    team: "5 developers",
    application: "Banking API",
    releaseFrequency: "10 PRs/day",
    objectives: {
        prFeedbackTargetMs: 6 * 60_000,
        /** Estimated Runner Cost budget - see engine.ts / ENGINE.md for what this metric does and doesn't model. */
        runnerCostBudget: 400,
        criticalEscapesTarget: 0,
    },
};
