import type { RunnerQueueItem } from "./types";

export class RunnerPool {
    total: number;
    busy = 0;
    costPerMinute: number;
    queue: RunnerQueueItem[] = [];
    maxQueueSeen = 0;
    /**
     * Runners set aside so PR-lane checks always have somewhere to run, even
     * when a long Merge/Release job (e.g. a 12min E2E) is already occupying a
     * runner it can't be preempted from. Merge/Release jobs may not claim into
     * this reserve; PR-lane jobs may use it plus anything else free.
     */
    prReserved: number;

    constructor(total: number, costPerMinute: number, prReserved = 0) {
        this.total = total;
        this.costPerMinute = costPerMinute;
        this.prReserved = Math.min(prReserved, total);
    }

    get available(): number {
        return this.total - this.busy;
    }

    availableFor(isPrLane: boolean): number {
        if (isPrLane) return this.available;
        return Math.max(0, this.total - this.prReserved - this.busy);
    }

    acquire(isPrLane = true): boolean {
        if (this.availableFor(isPrLane) <= 0) return false;
        this.busy += 1;
        return true;
    }

    release(): void {
        this.busy = Math.max(0, this.busy - 1);
    }

    enqueue(item: RunnerQueueItem): void {
        this.queue.push(item);
        this.maxQueueSeen = Math.max(this.maxQueueSeen, this.queue.length);
    }

    dequeue(): RunnerQueueItem | undefined {
        return this.queue.shift();
    }

    /** Removes and returns the queued item with the lowest rank (ties broken FIFO). */
    dequeueByPriority(rank: (item: RunnerQueueItem) => number): RunnerQueueItem | undefined {
        if (this.queue.length === 0) return undefined;
        let bestIdx = 0;
        let bestRank = rank(this.queue[0]);
        for (let i = 1; i < this.queue.length; i++) {
            const r = rank(this.queue[i]);
            if (r < bestRank) {
                bestRank = r;
                bestIdx = i;
            }
        }
        return this.queue.splice(bestIdx, 1)[0];
    }

    reset(total: number, costPerMinute: number, prReserved = this.prReserved): void {
        this.total = total;
        this.costPerMinute = costPerMinute;
        this.prReserved = Math.min(prReserved, total);
        this.busy = 0;
        this.queue = [];
        this.maxQueueSeen = 0;
    }
}
