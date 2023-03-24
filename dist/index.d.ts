declare function cycleDetected(): never;
declare function mutationDetected(): never;
type MyNode = {
    _source: Signal;
    _prevSource?: MyNode;
    _nextSource?: MyNode;
    _target: any;
    _prevTarget?: MyNode;
    _nextTarget?: MyNode;
    _version: number;
    _rollbackNode?: MyNode;
};
declare function startBatch(): void;
declare function endBatch(): void;
declare function batch<T>(callback: () => T): T;
declare let evalContext: any | undefined;
declare let batchedEffect: any | undefined;
declare let batchDepth: number;
declare let batchIteration: number;
declare let globalVersion: number;
declare const RUNNING: number;
declare const NOTIFIED: number;
declare const OUTDATED: number;
declare const DISPOSED: number;
declare const HAS_ERROR: number;
declare const TRACKING: number;
declare function addDependency(signal: Signal): MyNode | undefined;
declare class Signal<T = any> {
    _value: unknown;
    _version: number;
    _node?: MyNode;
    _targets?: MyNode;
    constructor(value?: T);
    _refresh(): boolean;
    _subscribe(node: MyNode): void;
    _unsubscribe(node: MyNode): void;
    subscribe(fn: (value: T) => void): () => void;
    valueOf(): T;
    toString(): string;
    toJSON(): T;
    peek(): T;
    get value(): T;
    set value(value: T);
}
declare function Signal(this: Signal, value?: unknown): void;
declare function signal<T>(value: T): Signal<T>;
declare function needsToRecompute(target: any): boolean;