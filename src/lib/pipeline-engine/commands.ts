import type { PipelineEngine } from "./engine";
import { resolveGroups } from "./scheduler";
import type { LaneId, RunnerTierId, StageId } from "./types";

const STAGE_IDS: StageId[] = ["lint", "unit", "api", "e2e", "build", "security", "staging", "production"];
const LANE_IDS: LaneId[] = ["pr", "merge", "release"];

function fmtTime(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
}

export function runCommand(engine: PipelineEngine, raw: string): string[] {
    const parts = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return [];
    const [cmd, ...args] = parts;
    const state = engine.getState();

    switch (cmd) {
        case "help":
            return [
                "Commands:",
                "  status                        - current metrics",
                "  inspect runners               - runner pool detail",
                "  inspect pipeline              - stage layout by lane",
                "  inspect metrics               - full metrics dump",
                "  move <stage> <pr|merge|release> - relocate a stage",
                "  parallelize <stage> <stage>   - run two stages concurrently",
                "  tier <standard|turbo>         - change runner tier",
                "  run                           - run the simulation",
                "  reset                         - reset the run (keeps config)",
            ];

        case "status":
            return [
                `Status: ${state.status}`,
                `PR feedback: ${state.metrics.avgPrCycleMs ? fmtTime(state.metrics.avgPrCycleMs) : "-"}`,
                `Estimated Runner Cost: $${state.metrics.totalCost}`,
                `Critical escapes: ${state.metrics.criticalEscapes}`,
                `Dev experience: ${state.metrics.devExperience}%`,
            ];

        case "inspect": {
            const target = args[0];
            if (target === "runners") {
                const longestWait = state.runnerQueue.length
                    ? Math.max(...state.runnerQueue.map((q) => state.clock - q.enqueuedAt))
                    : 0;
                return [
                    "RUNNER POOL",
                    `Total:       ${state.runnerTotal}`,
                    `Busy:        ${state.runnerBusy}`,
                    `Available:   ${state.runnerTotal - state.runnerBusy}`,
                    `Queued jobs: ${state.runnerQueue.length}`,
                    `Longest wait: ${fmtTime(longestWait)}`,
                ];
            }
            if (target === "pipeline") {
                const groups = resolveGroups(state.pipeline);
                const lines = ["PIPELINE LAYOUT"];
                for (const lane of LANE_IDS) {
                    lines.push(`${lane.toUpperCase()}:`);
                    const laneGroups = groups.filter((g) => g.lane === lane);
                    if (laneGroups.length === 0) lines.push("  (empty)");
                    laneGroups.forEach((g) => {
                        lines.push(`  ${g.stages.map((s) => s.name).join(" + ")}`);
                    });
                }
                return lines;
            }
            if (target === "metrics") {
                return [
                    "METRICS",
                    `PR feedback:      ${state.metrics.avgPrCycleMs ? fmtTime(state.metrics.avgPrCycleMs) : "-"}`,
                    `Est. runner cost: $${state.metrics.totalCost}`,
                    `Critical escapes: ${state.metrics.criticalEscapes}`,
                    `Dev experience:   ${state.metrics.devExperience}%`,
                    `Max runner queue: ${state.metrics.runnerQueueMax}`,
                    `Total runs:       ${state.metrics.totalRuns}`,
                ];
            }
            return [`Unknown inspect target: ${target ?? ""}. Try: inspect runners | pipeline | metrics`];
        }

        case "move": {
            const stageId = args[0] as StageId;
            const lane = args[1] as LaneId;
            if (!STAGE_IDS.includes(stageId)) return [`Unknown stage: ${args[0]}`];
            if (!LANE_IDS.includes(lane)) return [`Unknown lane: ${args[1]}. Use pr, merge, or release.`];
            engine.moveStage(stageId, lane);
            return [`Moved ${stageId} to ${lane} lane.`];
        }

        case "parallelize": {
            const ids = args as StageId[];
            const invalid = ids.filter((id) => !STAGE_IDS.includes(id));
            if (invalid.length > 0) return [`Unknown stage(s): ${invalid.join(", ")}`];
            if (ids.length < 2) return ["Need at least two stages to parallelize."];
            engine.parallelize(ids);
            return [`Parallelized: ${ids.join(" + ")}`];
        }

        case "tier": {
            const tier = args[0] as RunnerTierId;
            if (tier !== "standard" && tier !== "turbo") return ["Usage: tier standard | turbo"];
            engine.setRunnerTier(tier);
            return [`Runner tier set to ${tier}.`];
        }

        case "run":
            engine.run();
            return ["Simulation started."];

        case "reset":
            engine.reset();
            return ["Reset complete."];

        default:
            return [`Unknown command: ${cmd}. Type "help" for a list.`];
    }
}
