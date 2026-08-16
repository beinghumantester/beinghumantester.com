import type { PRRecord, StageConfig, StageId } from "./types";

/** Only one PR in the run secretly carries the integration defect. */
export function pickDefectCarrier(prCount: number, rng: () => number): number {
    return Math.floor(rng() * prCount);
}

/** True if any enabled PR-lane or Merge-lane stage in the current pipeline can catch the integration defect. */
export function hasIntegrationDefectCoverage(pipeline: StageConfig[]): boolean {
    return pipeline.some(
        (s) => s.enabled !== false && s.lane !== "release" && s.catchesIntegrationDefect
    );
}

/**
 * Called whenever a stage capable of catching the integration defect
 * completes for the carrier PR. Quarantining that stage counts as not
 * having actually run the check, even though the stage is nominally present.
 */
export function checkDefectCaught(
    pr: PRRecord,
    stage: StageConfig,
    outcome: "passed" | "quarantined"
): boolean {
    if (pr.kind !== "integration_defect") return false;
    if (!stage.catchesIntegrationDefect) return false;
    if (stage.lane === "release") return false; // by the release lane it's already shipping - too late to "catch"
    return outcome === "passed";
}

export function isFlakyRoll(stage: StageConfig, rng: () => number, flakeRate = 0.15): boolean {
    if (!stage.flakyProne) return false;
    return rng() < flakeRate;
}

export function stageCatalog(): Record<StageId, { name: string }> {
    return {
        lint: { name: "Lint" },
        unit: { name: "Unit Tests" },
        api: { name: "API Tests" },
        e2e: { name: "E2E (Selenium)" },
        build: { name: "Build" },
        security: { name: "Security Scan" },
        staging: { name: "Staging Deploy" },
        production: { name: "Production Deploy" },
    };
}
