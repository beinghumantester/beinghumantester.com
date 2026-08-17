import { describe, expect, it } from "vitest";
import { PlaygroundRuntime } from "../playground-runtime/runtime";
import { retrieveChunks, packContext } from "./retrieval";
import { efficiencyScore, evidenceScore, rootCauseScore } from "./scoring";
import { scenario01Definition, scenario01Engine } from "./scenarios/scenario-01";
import { scenario02Definition, scenario02Engine } from "./scenarios/scenario-02";
import { scenario03Definition, scenario03Engine } from "./scenarios/scenario-03";

describe("PlaygroundRuntime", () => {
    it("dispatch changes state and evaluate reflects it", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        const before = runtime.getState();
        runtime.dispatch({ type: "SET_TOP_K", value: 1 });
        const after = runtime.getState();
        expect(after.config.topK).toBe(1);
        expect(after).not.toBe(before);
    });

    it("records history and does not expose the mutable internal array", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        runtime.dispatch({ type: "SET_TOP_K", value: 2 });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "retrieval" });
        const history = runtime.getHistory();
        expect(history.length).toBe(2);
        // @ts-expect-error - intentionally trying to mutate the returned array to prove it's a copy
        history.push({ type: "SUBMIT_INVESTIGATION" });
        expect(runtime.getHistory().length).toBe(2);
    });

    it("reset restores initial state and clears history", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        runtime.dispatch({ type: "SET_TOP_K", value: 1 });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "generation" });
        runtime.reset();
        expect(runtime.getHistory().length).toBe(0);
        expect(runtime.getState().config.topK).toBe(scenario01Definition.defaultConfig.topK);
        expect(runtime.getState().selectedFailureLayer).toBeNull();
    });
});

describe("retrieveChunks", () => {
    it("filters, ranks by relevance, and slices to topK", () => {
        const result = retrieveChunks(scenario01Definition.chunks, {
            topK: 2,
            filterOutdated: false,
            contextBudget: 2,
            preferAuthoritative: false,
        });
        expect(result.map((c) => c.id)).toEqual(["chunk-01-current-policy", "chunk-03-legacy-policy"]);
    });

    it("excludes outdated chunks when filterOutdated is enabled", () => {
        const result = retrieveChunks(scenario01Definition.chunks, {
            topK: 3,
            filterOutdated: true,
            contextBudget: 3,
            preferAuthoritative: false,
        });
        expect(result.map((c) => c.id)).not.toContain("chunk-03-legacy-policy");
    });
});

describe("packContext", () => {
    it("keeps only the top contextBudget chunks by relevance, independent of retrieval order", () => {
        const retrieved = scenario02Definition.chunks; // all 3, unsorted input order
        const packed = packContext(retrieved, { topK: 3, filterOutdated: false, contextBudget: 2, preferAuthoritative: false });
        expect(packed.map((c) => c.id)).toEqual(["chunk-b1-refund-policy", "chunk-b2-purchase-terms"]);
        expect(packed.map((c) => c.id)).not.toContain("chunk-b3-activation-policy");
    });
});

describe("scoring", () => {
    it("rootCauseScore is 50 for a match, 0 otherwise", () => {
        expect(rootCauseScore("retrieval", "retrieval")).toBe(50);
        expect(rootCauseScore("ranking", "retrieval")).toBe(0);
        expect(rootCauseScore(null, "retrieval")).toBe(0);
    });

    it("evidenceScore is 30 for an exact match, 20 for a superset, 0 if incomplete", () => {
        expect(evidenceScore(["a"], ["a"])).toBe(30);
        expect(evidenceScore(["a", "b"], ["a"])).toBe(20);
        expect(evidenceScore(["b"], ["a"])).toBe(0);
        expect(evidenceScore([], ["a"])).toBe(0);
    });

    it("efficiencyScore rewards fewer actions without punishing thorough investigation harshly", () => {
        expect(efficiencyScore(3)).toBe(20);
        expect(efficiencyScore(5)).toBe(20);
        expect(efficiencyScore(7)).toBe(14);
        expect(efficiencyScore(9)).toBe(8);
        expect(efficiencyScore(15)).toBe(2);
    });
});

describe("Scenario 01 - Stale Policy Trap (root cause: retrieval)", () => {
    it("derives retrievedChunks/activeContext/response from config, not hardcoded, and starts in the broken state", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        const state = runtime.getState();
        expect(state.retrievedChunks.map((c) => c.id)).toContain("chunk-03-legacy-policy");
        expect(state.simulatedResponse).toMatch(/eligible for a refund within 30 days/);
    });

    it("enabling the outdated filter removes the stale chunk and fixes the response", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        runtime.dispatch({ type: "TOGGLE_OUTDATED_FILTER", enabled: true });
        const state = runtime.getState();
        expect(state.retrievedChunks.map((c) => c.id)).not.toContain("chunk-03-legacy-policy");
        expect(state.simulatedResponse).toMatch(/non-refundable/);
    });

    it("awards full score for the correct layer and evidence", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-03-legacy-policy" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "retrieval" });
        const evaluation = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(evaluation.status).toBe("correct");
        expect(evaluation.breakdown?.rootCause).toBe(50);
        expect(evaluation.breakdown?.evidence).toBe(30);
        expect(evaluation.score).toBeGreaterThanOrEqual(80);
    });

    it("scores 0 root cause and stays incorrect for the wrong layer", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-03-legacy-policy" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "generation" });
        const evaluation = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(evaluation.status).toBe("incorrect");
        expect(evaluation.breakdown?.rootCause).toBe(0);
    });

    it("stays 'investigating' with no score until submitted", () => {
        const runtime = new PlaygroundRuntime(scenario01Engine);
        const evaluation = runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "retrieval" });
        expect(evaluation.status).toBe("investigating");
    });
});

describe("Scenario 02 - Missing Context (root cause: context_packing, NOT retrieval)", () => {
    it("retrieval finds all three relevant chunks, including the critical one - retrieval is never the bottleneck", () => {
        const runtime = new PlaygroundRuntime(scenario02Engine);
        const state = runtime.getState();
        expect(state.retrievedChunks.map((c) => c.id)).toContain("chunk-b3-activation-policy");
    });

    it("but the default context budget drops the critical chunk before generation, producing a wrong answer", () => {
        const runtime = new PlaygroundRuntime(scenario02Engine);
        const state = runtime.getState();
        expect(state.activeContext.map((c) => c.id)).not.toContain("chunk-b3-activation-policy");
        expect(state.simulatedResponse).toMatch(/Yes, refunds are available/);
    });

    it("raising the context budget lets the critical chunk through and fixes the response", () => {
        const runtime = new PlaygroundRuntime(scenario02Engine);
        runtime.dispatch({ type: "SET_CONTEXT_BUDGET", value: 3 });
        const state = runtime.getState();
        expect(state.activeContext.map((c) => c.id)).toContain("chunk-b3-activation-policy");
        expect(state.simulatedResponse).toMatch(/non-refundable/);
    });

    it("scores correct only for context_packing, not retrieval, even though retrieval also 'looks' involved", () => {
        const runtime = new PlaygroundRuntime(scenario02Engine);
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-b3-activation-policy" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "retrieval" });
        const wrongLayer = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(wrongLayer.status).toBe("incorrect");

        runtime.reset();
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-b3-activation-policy" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "context_packing" });
        const rightLayer = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(rightLayer.status).toBe("correct");
    });
});

describe("Scenario 03 - Contradictory Sources (root cause: ranking)", () => {
    it("retrieves and packs all three conflicting chunks - nothing is missing or stale", () => {
        const runtime = new PlaygroundRuntime(scenario03Engine);
        const state = runtime.getState();
        expect(state.retrievedChunks.length).toBe(3);
        expect(state.activeContext.length).toBe(3);
    });

    it("defaults to trusting raw relevance, surfacing the low-authority FAQ answer over the official policy", () => {
        const runtime = new PlaygroundRuntime(scenario03Engine);
        const state = runtime.getState();
        expect(state.simulatedResponse).toMatch(/30 days/);
    });

    it("preferring authoritative sources flips the answer to the official policy", () => {
        const runtime = new PlaygroundRuntime(scenario03Engine);
        runtime.dispatch({ type: "TOGGLE_PREFER_AUTHORITATIVE", enabled: true });
        const state = runtime.getState();
        expect(state.simulatedResponse).toMatch(/7 days/);
    });

    it("requires both the wrongly-surfaced FAQ and the overridden policy as evidence for full credit", () => {
        const runtime = new PlaygroundRuntime(scenario03Engine);
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-c2-faq" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "ranking" });
        const partial = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(partial.breakdown?.evidence).toBe(0);

        runtime.reset();
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-c2-faq" });
        runtime.dispatch({ type: "SELECT_EVIDENCE", chunkId: "chunk-c1-official-policy" });
        runtime.dispatch({ type: "SELECT_FAILURE_LAYER", layer: "ranking" });
        const full = runtime.dispatch({ type: "SUBMIT_INVESTIGATION" });
        expect(full.status).toBe("correct");
        expect(full.breakdown?.evidence).toBe(30);
    });
});

describe("Cross-scenario: each scenario's canonical answer is unambiguous", () => {
    it("scenario 01's correct layer is retrieval, not context_packing or ranking", () => {
        expect(scenario01Definition.correctLayer).toBe("retrieval");
    });

    it("scenario 02's correct layer is context_packing, not retrieval", () => {
        expect(scenario02Definition.correctLayer).toBe("context_packing");
    });

    it("scenario 03's correct layer is ranking, not retrieval or context_packing", () => {
        expect(scenario03Definition.correctLayer).toBe("ranking");
    });
});
