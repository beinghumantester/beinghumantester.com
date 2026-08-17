import { createRagEngine, type RagScenarioDefinition } from "../engine-factory";
import type { DocumentChunk } from "../types";

const CHUNKS: DocumentChunk[] = [
    {
        id: "chunk-01-current-policy",
        sourceDoc: "Terms_of_Service_2026.pdf",
        version: "v2.1",
        text: "Digital software licenses are non-refundable once accessed.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "policy",
            authorityRank: 1,
        },
        retrieval: { relevanceScore: 0.94 },
    },
    {
        id: "chunk-02-billing-faq",
        sourceDoc: "FAQ_Payments_2026.pdf",
        version: "v2.0",
        text: "Billing cycles occur on the 1st of every month.",
        metadata: {
            topic: "billing",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "faq",
            authorityRank: 2,
        },
        retrieval: { relevanceScore: 0.52 },
    },
    {
        id: "chunk-03-legacy-policy",
        sourceDoc: "Legacy_Refund_Policy_2022.pdf",
        version: "v1.0",
        text: "All purchases including digital goods are eligible for a full refund within 30 days.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2022-01-01",
            effectiveTo: "2025-12-31",
            status: "outdated",
            sourceType: "policy",
            authorityRank: 1,
        },
        retrieval: { relevanceScore: 0.91 },
    },
];

function generateResponse(context: DocumentChunk[]): string {
    const hasCurrentPolicy = context.some((c) => c.id === "chunk-01-current-policy");
    const hasLegacyPolicy = context.some((c) => c.id === "chunk-03-legacy-policy");

    if (hasLegacyPolicy && hasCurrentPolicy) {
        return "Yes, all purchases including digital software are eligible for a refund within 30 days.";
    }
    if (hasCurrentPolicy && !hasLegacyPolicy) {
        return "No, digital software licenses are non-refundable once accessed.";
    }
    if (hasLegacyPolicy) {
        return "Yes, all purchases including digital software are eligible for a full refund within 30 days.";
    }
    return "I do not have sufficient information to answer this question.";
}

export const scenario01Definition: RagScenarioDefinition = {
    id: "rag-01-stale-policy",
    title: "The Stale Policy Trap",
    difficulty: "foundation",
    estimatedMinutes: 5,
    missionBrief:
        "A customer asks about a refund. The AI gives a confident answer. Something is wrong. Identify WHERE the failure happened, collect evidence, and explain WHY.",
    caveat: "You cannot inspect the underlying model.",
    userQuery: "Can I get a refund for my digital software license purchased 20 days ago?",
    systemPrompt: "Answer the customer's question using only the retrieved policy context.",
    chunks: CHUNKS,
    defaultConfig: { topK: 3, filterOutdated: false, contextBudget: 3, preferAuthoritative: false },
    relevantConfig: ["topK", "filterOutdated"],
    generateResponse,
    correctLayer: "retrieval",
    requiredEvidence: ["chunk-03-legacy-policy"],
    rootCauseExplanation:
        "Retrieval ranked purely by semantic relevance. The legacy policy scored 0.91 - almost as high as the current policy's 0.94 - so it entered the retrieved set even though it expired at the end of 2025. Retrieval never checked document status or effective dates.",
    risk: "HIGH",
    testerLesson:
        "High semantic relevance doesn't guarantee valid business context. A retrieval layer that ignores document lifecycle metadata (status, effective dates) will keep resurfacing stale content that reads as relevant.",
};

export const scenario01Engine = createRagEngine(scenario01Definition);
