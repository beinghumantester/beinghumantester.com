export type FailureLayer =
    | "query_transform"
    | "retrieval"
    | "ranking"
    | "context_packing"
    | "generation";

export type SourceType = "policy" | "faq" | "support_article" | "other";

export interface DocumentChunk {
    id: string;
    sourceDoc: string;
    version: string;
    text: string;
    metadata: {
        topic: string;
        effectiveFrom: string;
        effectiveTo?: string;
        status: "active" | "outdated";
        sourceType: SourceType;
        /** 1 = highest authority. Only meaningful where source precedence is the point of the scenario. */
        authorityRank: number;
    };
    retrieval: {
        relevanceScore: number;
    };
}

export interface RagConfig {
    /** How many chunks retrieval is allowed to return, ranked by relevance. */
    topK: number;
    /** Drop chunks whose status is 'outdated' before ranking/slicing. */
    filterOutdated: boolean;
    /**
     * How many of the *retrieved* chunks actually get packed into context sent
     * to generation. Deliberately separate from topK: retrieval can succeed
     * (find the right documents) while packing still drops one under budget.
     */
    contextBudget: number;
    /**
     * When true, generation prefers the chunk with the best (lowest)
     * authorityRank among the active context instead of the one with the
     * highest raw relevanceScore.
     */
    preferAuthoritative: boolean;
}

export interface RagState {
    scenarioId: string;
    userQuery: string;
    systemPrompt: string;
    availableChunks: DocumentChunk[];
    config: RagConfig;
    retrievedChunks: DocumentChunk[];
    activeContext: DocumentChunk[];
    simulatedResponse: string;
    selectedFailureLayer: FailureLayer | null;
    submittedEvidenceIds: string[];
    isSubmitted: boolean;
}

export type RagAction =
    | { type: "SET_TOP_K"; value: number }
    | { type: "TOGGLE_OUTDATED_FILTER"; enabled: boolean }
    | { type: "SET_CONTEXT_BUDGET"; value: number }
    | { type: "TOGGLE_PREFER_AUTHORITATIVE"; enabled: boolean }
    | { type: "SELECT_EVIDENCE"; chunkId: string }
    | { type: "REMOVE_EVIDENCE"; chunkId: string }
    | { type: "SELECT_FAILURE_LAYER"; layer: FailureLayer }
    | { type: "SUBMIT_INVESTIGATION" };

export interface RagEvaluation {
    status: "investigating" | "correct" | "incorrect";
    score: number;
    maxScore: number;
    feedback?: {
        rootCause: string;
        evidenceEvaluation: string;
        risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        testerLesson: string;
    };
    breakdown?: {
        rootCause: number;
        evidence: number;
        efficiency: number;
    };
}

/** Which config controls are relevant to show for a given scenario - the rest stay fixed/hidden. */
export type RagConfigField = keyof RagConfig;
