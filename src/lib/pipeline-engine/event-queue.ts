import type { SimEvent } from "./types";

/**
 * Simple time-ordered queue. Simulation scale here (~20 PRs, a handful of
 * stages each) never justifies a real binary heap - insertion-sort by time
 * keeps this file trivial to read and verify.
 */
export class EventQueue {
    private items: SimEvent[] = [];

    push(event: SimEvent): void {
        const idx = this.items.findIndex((e) => e.time > event.time);
        if (idx === -1) this.items.push(event);
        else this.items.splice(idx, 0, event);
    }

    pop(): SimEvent | undefined {
        return this.items.shift();
    }

    peek(): SimEvent | undefined {
        return this.items[0];
    }

    get length(): number {
        return this.items.length;
    }

    clear(): void {
        this.items = [];
    }
}
