import type { ScenarioEngine } from "../playground-runtime/types";
import type { RagAction, RagEvaluation, RagState } from "./types";
import { scenario01Definition, scenario01Engine } from "./scenarios/scenario-01";
import { scenario02Definition, scenario02Engine } from "./scenarios/scenario-02";
import { scenario03Definition, scenario03Engine } from "./scenarios/scenario-03";
import type { RagScenarioDefinition } from "./engine-factory";

export interface ScenarioRegistration {
    definition: RagScenarioDefinition;
    createEngine: () => ScenarioEngine<RagState, RagAction, RagEvaluation>;
}

export const ragScenarios: ScenarioRegistration[] = [
    { definition: scenario01Definition, createEngine: () => scenario01Engine },
    { definition: scenario02Definition, createEngine: () => scenario02Engine },
    { definition: scenario03Definition, createEngine: () => scenario03Engine },
];
