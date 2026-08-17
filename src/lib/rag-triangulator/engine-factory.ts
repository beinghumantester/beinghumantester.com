import type { ScenarioEngine } from "../playground-runtime/types";
import { packContext, retrieveChunks } from "./retrieval";
import { computeScore } from "./scoring";
import type { DocumentChunk, FailureLayer, RagAction, RagConfig, RagConfigField, RagEvaluation, RagState } from "./types";

export interface RagScenarioDefinition {
    id: string;
    title: string;
    difficulty: "foundation" | "intermediate" | "advanced";
    estimatedMinutes: number;
    missionBrief: string;
    caveat: string;
    userQuery: string;
    systemPrompt: string;
    chunks: DocumentChunk[];
    defaultConfig: RagConfig;
    /** Which config controls the workspace should render for this scenario - the rest stay fixed. */
    relevantConfig: RagConfigField[];
    generateResponse: (activeContext: DocumentChunk[], config: RagConfig) => string;
    correctLayer: FailureLayer;
    requiredEvidence: string[];
    rootCauseExplanation: string;
    risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    testerLesson: string;
}

function deriveDerivedState(def: RagScenarioDefinition, config: RagConfig) {
    const retrievedChunks = retrieveChunks(def.chunks, config);
    const activeContext = packContext(retrievedChunks, config);
    const simulatedResponse = def.generateResponse(activeContext, config);
    return { retrievedChunks, activeContext, simulatedResponse };
}

export function createRagEngine(def: RagScenarioDefinition): ScenarioEngine<RagState, RagAction, RagEvaluation> {
    return {
        initialState(): RagState {
            const config = { ...def.defaultConfig };
            return {
                scenarioId: def.id,
                userQuery: def.userQuery,
                systemPrompt: def.systemPrompt,
                availableChunks: def.chunks,
                config,
                ...deriveDerivedState(def, config),
                selectedFailureLayer: null,
                submittedEvidenceIds: [],
                isSubmitted: false,
            };
        },

        reduce(state: RagState, action: RagAction): RagState {
            switch (action.type) {
                case "SET_TOP_K": {
                    const config = { ...state.config, topK: action.value };
                    return { ...state, config, ...deriveDerivedState(def, config) };
                }
                case "TOGGLE_OUTDATED_FILTER": {
                    const config = { ...state.config, filterOutdated: action.enabled };
                    return { ...state, config, ...deriveDerivedState(def, config) };
                }
                case "SET_CONTEXT_BUDGET": {
                    const config = { ...state.config, contextBudget: action.value };
                    return { ...state, config, ...deriveDerivedState(def, config) };
                }
                case "TOGGLE_PREFER_AUTHORITATIVE": {
                    const config = { ...state.config, preferAuthoritative: action.enabled };
                    return { ...state, config, ...deriveDerivedState(def, config) };
                }
                case "SELECT_EVIDENCE": {
                    if (state.submittedEvidenceIds.includes(action.chunkId)) return state;
                    return { ...state, submittedEvidenceIds: [...state.submittedEvidenceIds, action.chunkId] };
                }
                case "REMOVE_EVIDENCE": {
                    return {
                        ...state,
                        submittedEvidenceIds: state.submittedEvidenceIds.filter((id) => id !== action.chunkId),
                    };
                }
                case "SELECT_FAILURE_LAYER":
                    return { ...state, selectedFailureLayer: action.layer };
                case "SUBMIT_INVESTIGATION":
                    return { ...state, isSubmitted: true };
                default:
                    return state;
            }
        },

        evaluate(state: RagState, history: readonly RagAction[]): RagEvaluation {
            if (!state.isSubmitted) {
                return { status: "investigating", score: 0, maxScore: 100 };
            }

            const breakdown = computeScore(state, history, def.correctLayer, def.requiredEvidence);
            const rootCauseCorrect = state.selectedFailureLayer === def.correctLayer;
            const status = rootCauseCorrect && breakdown.evidence >= 20 ? "correct" : "incorrect";

            const evidenceEvaluation =
                breakdown.evidence === 30
                    ? "You selected exactly the right evidence."
                    : breakdown.evidence === 20
                        ? "You found the key evidence, but included some unrelated chunks too."
                        : "You missed the evidence that actually explains the failure.";

            return {
                status,
                score: breakdown.total,
                maxScore: 100,
                feedback: {
                    rootCause: def.rootCauseExplanation,
                    evidenceEvaluation,
                    risk: def.risk,
                    testerLesson: def.testerLesson,
                },
                breakdown: {
                    rootCause: breakdown.rootCause,
                    evidence: breakdown.evidence,
                    efficiency: breakdown.efficiency,
                },
            };
        },
    };
}
