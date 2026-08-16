import type { Metrics, PRRecord } from "./types";

/** "PR feedback time" - how long a developer waits for the PR-lane gate to finish, not full deployment. */
export function computeAvgPrCycleMs(prs: PRRecord[]): number {
    const withFeedback = prs.filter((p) => p.prFeedbackAt !== undefined);
    if (withFeedback.length === 0) return 0;
    const total = withFeedback.reduce((sum, p) => sum + (p.prFeedbackAt! - p.arrivalTime), 0);
    return total / withFeedback.length;
}

/**
 * Rough fit against the reference points in the mission brief:
 * ~28min avg cycle -> ~42% dev experience, ~4.2min -> ~91%.
 */
export function computeDevExperience(avgPrCycleMs: number): number {
    const minutes = avgPrCycleMs / 60000;
    const raw = 100.4 - 2.08 * minutes;
    return Math.max(5, Math.min(98, Math.round(raw)));
}

export function emptyMetrics(): Metrics {
    return {
        avgPrCycleMs: 0,
        totalCost: 0,
        criticalEscapes: 0,
        devExperience: 98,
        runnerQueueMax: 0,
        totalRuns: 0,
    };
}
