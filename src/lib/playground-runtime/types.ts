export interface ScenarioMeta {
    id: string;
    title: string;
    category: string;
    difficulty: "foundation" | "intermediate" | "advanced";
    estimatedMinutes: number;
}

export interface ScenarioResult {
    completed: boolean;
    score: number;
    maxScore: number;
}

export interface ScenarioEngine<TState, TAction, TEvaluation> {
    initialState(): TState;
    reduce(state: TState, action: TAction): TState;
    evaluate(state: TState, history: readonly TAction[]): TEvaluation;
}
