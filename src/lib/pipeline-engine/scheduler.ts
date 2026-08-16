import type { LaneId, StageConfig } from "./types";

export interface StageGroup {
    lane: LaneId;
    stages: StageConfig[];
}

const LANE_ORDER: LaneId[] = ["pr", "merge", "release"];

/**
 * Turns the flat, player-editable stage list into an ordered sequence of
 * groups (PR lane groups, then Merge lane groups, then Release lane groups).
 * Stages sharing a `group` id within the same lane run in parallel; distinct
 * groups within a lane run one after another, in the order they first appear.
 */
export function resolveGroups(pipeline: StageConfig[]): StageGroup[] {
    const groups: StageGroup[] = [];

    for (const lane of LANE_ORDER) {
        const stagesInLane = pipeline.filter((s) => s.lane === lane && s.enabled !== false);
        const seenGroups: string[] = [];
        const byGroup = new Map<string, StageConfig[]>();

        for (const stage of stagesInLane) {
            if (!byGroup.has(stage.group)) {
                byGroup.set(stage.group, []);
                seenGroups.push(stage.group);
            }
            byGroup.get(stage.group)!.push(stage);
        }

        for (const groupId of seenGroups) {
            groups.push({ lane, stages: byGroup.get(groupId)! });
        }
    }

    return groups;
}

export function prLaneGroupCount(pipeline: StageConfig[]): number {
    return resolveGroups(pipeline).filter((g) => g.lane === "pr").length;
}
