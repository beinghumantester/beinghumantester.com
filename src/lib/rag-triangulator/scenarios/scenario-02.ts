import { createRagEngine, type RagScenarioDefinition } from "../engine-factory";
import type { DocumentChunk } from "../types";

const CHUNKS: DocumentChunk[] = [
    {
        id: "chunk-b1-refund-policy",
        sourceDoc: "Refund_Policy_2026.pdf",
        version: "v1.4",
        text: "Refunds are available within 7 days of purchase.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "policy",
            authorityRank: 1,
        },
        retrieval: { relevanceScore: 0.9 },
    },
    {
        id: "chunk-b2-purchase-terms",
        sourceDoc: "Purchase_Terms_2026.pdf",
        version: "v1.1",
        text: "All purchases are subject to standard commerce terms and applicable tax.",
        metadata: {
            topic: "purchase",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "policy",
            authorityRank: 2,
        },
        retrieval: { relevanceScore: 0.83 },
    },
    {
        id: "chunk-b3-activation-policy",
        sourceDoc: "Activation_Policy_2026.pdf",
        version: "v1.2",
        text: "Once a digital license is activated, it becomes non-refundable regardless of purchase date.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "policy",
            authorityRank: 1,
        },
        retrieval: { relevanceScore: 0.78 },
    },
];

function generateResponse(context: DocumentChunk[]): string {
    const hasActivationPolicy = context.some((c) => c.id === "chunk-b3-activation-policy");
    const hasRefundPolicy = context.some((c) => c.id === "chunk-b1-refund-policy");

    if (hasActivationPolicy) {
        return "No - once your digital license is activated, it becomes non-refundable regardless of purchase date.";
    }
    if (hasRefundPolicy) {
        return "Yes, refunds are available within 7 days of purchase.";
    }
    return "I do not have sufficient information to answer this question.";
}

export const scenario02Definition: RagScenarioDefinition = {
    id: "rag-02-missing-context",
    title: "Missing Context",
    difficulty: "intermediate",
    estimatedMinutes: 6,
    missionBrief:
        "A customer asks about a refund on an activated license. The AI answers confidently - and misses a critical exception. Retrieval found every relevant document. Something else dropped one before it reached generation.",
    caveat: "All three relevant documents were successfully retrieved. Look at what actually made it into the model's context.",
    userQuery: "Can I get a refund if the software was purchased 5 days ago but already activated?",
    systemPrompt: "Answer the customer's question using only the packed context.",
    chunks: CHUNKS,
    // topK is fixed at 3 for this scenario on purpose - retrieval is never the bottleneck here.
    defaultConfig: { topK: 3, filterOutdated: false, contextBudget: 2, preferAuthoritative: false },
    relevantConfig: ["contextBudget"],
    generateResponse,
    correctLayer: "context_packing",
    requiredEvidence: ["chunk-b3-activation-policy"],
    rootCauseExplanation:
        "Retrieval worked correctly - all three relevant documents (refund policy, purchase terms, activation policy) were found. But the context packer only had budget for the top 2 by relevance, and the Activation Policy ranked third (0.78) behind Purchase Terms (0.83). It was retrieved, then silently dropped before generation ever saw it.",
    risk: "MEDIUM",
    testerLesson:
        "Retrieval succeeding doesn't mean the model saw everything relevant. Context packing has its own budget and its own failure mode - a chunk can be found and still never reach generation.",
};

export const scenario02Engine = createRagEngine(scenario02Definition);
