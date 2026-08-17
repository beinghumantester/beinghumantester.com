import type { DocumentChunk, RagConfig } from "./types";

/** Simulated retrieval step: filter, rank by relevance, take the top K. */
export function retrieveChunks(chunks: DocumentChunk[], config: RagConfig): DocumentChunk[] {
    return chunks
        .filter((chunk) => (config.filterOutdated ? chunk.metadata.status !== "outdated" : true))
        .sort((a, b) => b.retrieval.relevanceScore - a.retrieval.relevanceScore)
        .slice(0, config.topK);
}

/**
 * Simulated context-packing step: of the chunks retrieval actually found,
 * only the top `contextBudget` (by relevance) make it into the context sent
 * to generation. This is intentionally a distinct step from retrieval - a
 * chunk can be retrieved and still never reach the model.
 */
export function packContext(retrievedChunks: DocumentChunk[], config: RagConfig): DocumentChunk[] {
    return [...retrievedChunks]
        .sort((a, b) => b.retrieval.relevanceScore - a.retrieval.relevanceScore)
        .slice(0, config.contextBudget);
}
