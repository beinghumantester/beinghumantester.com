import type { RagAction, RagState } from "./types";

const TARGET_ACTIONS = 5;

export function efficiencyScore(actionCount: number): number {
    if (actionCount <= TARGET_ACTIONS) return 20;
    if (actionCount <= TARGET_ACTIONS + 2) return 14;
    if (actionCount <= TARGET_ACTIONS + 4) return 8;
    return 2;
}

/**
 * 30 for an exact match against the required evidence set, 20 if the player
 * found all the required evidence but also included unrelated chunks, 0 if
 * any required evidence is missing.
 */
export function evidenceScore(selected: string[], required: string[]): number {
    const selectedSet = new Set(selected);
    const hasAllRequired = required.every((id) => selectedSet.has(id));
    if (!hasAllRequired) return 0;
    return selected.length === required.length ? 30 : 20;
}

export function rootCauseScore(selectedLayer: string | null, correctLayer: string): number {
    return selectedLayer === correctLayer ? 50 : 0;
}

export interface ScoreBreakdown {
    rootCause: number;
    evidence: number;
    efficiency: number;
    total: number;
}

export function computeScore(
    state: RagState,
    history: readonly RagAction[],
    correctLayer: string,
    requiredEvidence: string[]
): ScoreBreakdown {
    const rc = rootCauseScore(state.selectedFailureLayer, correctLayer);
    const ev = evidenceScore(state.submittedEvidenceIds, requiredEvidence);
    const eff = efficiencyScore(history.length);
    return { rootCause: rc, evidence: ev, efficiency: eff, total: rc + ev + eff };
}
