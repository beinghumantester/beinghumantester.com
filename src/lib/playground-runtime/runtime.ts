import type { ScenarioEngine } from "./types";

export class PlaygroundRuntime<TState, TAction, TEvaluation> {
    private state: TState;
    private history: TAction[] = [];

    constructor(private readonly engine: ScenarioEngine<TState, TAction, TEvaluation>) {
        this.state = engine.initialState();
    }

    dispatch(action: TAction): TEvaluation {
        this.state = this.engine.reduce(this.state, action);
        this.history.push(action);
        return this.engine.evaluate(this.state, this.history);
    }

    getState(): TState {
        return this.state;
    }

    getHistory(): readonly TAction[] {
        return [...this.history];
    }

    reset(): void {
        this.state = this.engine.initialState();
        this.history = [];
    }
}
