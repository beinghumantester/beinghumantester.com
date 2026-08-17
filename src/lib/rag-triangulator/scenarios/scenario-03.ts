import { createRagEngine, type RagScenarioDefinition } from "../engine-factory";
import type { DocumentChunk } from "../types";

const CHUNKS: DocumentChunk[] = [
    {
        id: "chunk-c1-official-policy",
        sourceDoc: "Refund_Policy_v3.pdf",
        version: "v3.0",
        text: "Refunds must be requested within 7 days of purchase.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2026-01-01",
            status: "active",
            sourceType: "policy",
            authorityRank: 1,
        },
        retrieval: { relevanceScore: 0.82 },
    },
    {
        id: "chunk-c2-faq",
        sourceDoc: "FAQ_Payments_v2.pdf",
        version: "v2.0",
        text: "Customers can request refunds within 30 days.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2025-06-01",
            status: "active",
            sourceType: "faq",
            authorityRank: 3,
        },
        retrieval: { relevanceScore: 0.91 },
    },
    {
        id: "chunk-c3-support-article",
        sourceDoc: "Support_Article_v1.pdf",
        version: "v1.0",
        text: "Our refund window is 14 days from purchase date.",
        metadata: {
            topic: "refund",
            effectiveFrom: "2025-03-01",
            status: "active",
            sourceType: "support_article",
            authorityRank: 2,
        },
        retrieval: { relevanceScore: 0.86 },
    },
];

function generateResponse(context: DocumentChunk[], config: { preferAuthoritative: boolean }): string {
    if (context.length === 0) return "I do not have sufficient information to answer this question.";

    const winner = config.preferAuthoritative
        ? [...context].sort((a, b) => a.metadata.authorityRank - b.metadata.authorityRank)[0]
        : [...context].sort((a, b) => b.retrieval.relevanceScore - a.retrieval.relevanceScore)[0];

    return winner.text;
}

export const scenario03Definition: RagScenarioDefinition = {
    id: "rag-03-contradictory-sources",
    title: "Contradictory Sources",
    difficulty: "advanced",
    estimatedMinutes: 7,
    missionBrief:
        "A customer asks a simple question. Three documents answer it - and they disagree. Retrieval found all three. Packing sent all three. The system still gave the wrong number.",
    caveat: "Nothing was missed and nothing is stale. Every document here is current.",
    userQuery: "How long do I have to request a refund?",
    systemPrompt: "Answer the customer's question using only the packed context.",
    chunks: CHUNKS,
    // topK/contextBudget are fixed to include all three chunks - retrieval and packing are never the bottleneck here.
    defaultConfig: { topK: 3, filterOutdated: false, contextBudget: 3, preferAuthoritative: false },
    relevantConfig: ["preferAuthoritative"],
    generateResponse,
    correctLayer: "ranking",
    requiredEvidence: ["chunk-c1-official-policy", "chunk-c2-faq"],
    rootCauseExplanation:
        "All three documents were retrieved and packed into context - retrieval and packing both succeeded. The failure is in what generation trusted: it favored the FAQ page (relevance 0.91) purely because it scored highest on semantic relevance, over the official policy document (relevance 0.82) which is the actual source of truth. Ranking never accounted for source authority.",
    risk: "MEDIUM",
    testerLesson:
        "Retrieval isn't only about relevance. When sources genuinely conflict, ranking needs a notion of source authority and precedence - otherwise the most confidently-worded document wins, not the most correct one.",
};

export const scenario03Engine = createRagEngine(scenario03Definition);
