function cycleDetected(): never {
    throw new Error("Cycle detected");
}

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

function startBatch() {
    batchDepth++;
}

function endBatch() {
    if (batchDepth > 1) {
        batchDepth--;
        return;
    }

    let error: unknown;
    let hasError = false;

    while (batchedEffect !== undefined) {
        let effect: any | undefined = batchedEffect;
        batchedEffect = undefined;

        batchIteration++;

        while (effect !== undefined) {
            const next: any | undefined = effect._nextBatchedEffect;
            effect._nextBatchedEffect = undefined;
            effect._flags &= ~NOTIFIED;

            if (!(effect._flags & DISPOSED) && needsToRecompute(effect)) {
                try {
                    effect._callback();
                } catch (err) {
                    if (!hasError) {
                        error = err;
                        hasError = true;
                    }
                }
            }
            effect = next;
        }
    }
    batchIteration = 0;
    batchDepth--;

    if (hasError) {
        throw error;
    }
}

function batch<T>(callback: () => T): T {
    if (batchDepth > 0) {
        return callback();
    }
    /*@__INLINE__**/ startBatch();
    try {
        return callback();
    } finally {
        endBatch();
    }
}

let evalContext: any | undefined = undefined;

// Effects collected into a batch.
let batchedEffect: any | undefined = undefined;
let batchDepth = 0;
let batchIteration = 0;

let globalVersion = 0;

const RUNNING = 1 << 0;
const NOTIFIED = 1 << 1;
const OUTDATED = 1 << 2;
const DISPOSED = 1 << 3;
const HAS_ERROR = 1 << 4;
const TRACKING = 1 << 5;

function addDependency(signal: Signal): MyNode | undefined {
    if (evalContext === undefined) {
        return undefined;
    }

    let node = signal._node;
    if (node === undefined || node._target !== evalContext) {
        node = {
            _version: 0,
            _source: signal,
            _prevSource: evalContext._sources,
            _nextSource: undefined,
            _target: evalContext,
            _prevTarget: undefined,
            _nextTarget: undefined,
            _rollbackNode: node,
        };

        if (evalContext._sources !== undefined) {
            evalContext._sources._nextSource = node;
        }
        evalContext._sources = node;
        signal._node = node;

        if (evalContext._flags & TRACKING) {
            signal._subscribe(node);
        }
        return node;
    } else if (node._version === -1) {
        node._version = 0;

        if (node._nextSource !== undefined) {
            node._nextSource._prevSource = node._prevSource;

            if (node._prevSource !== undefined) {
                node._prevSource._nextSource = node._nextSource;
            }

            node._prevSource = evalContext._sources;
            node._nextSource = undefined;

            evalContext._sources!._nextSource = node;
            evalContext._sources = node;
        }

        return node;
    }
    return undefined;
}

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

function Signal(this: Signal, value?: unknown) {
    this._value = value;
    this._version = 0;
    this._node = undefined;
    this._targets = undefined;
}

Signal.prototype._refresh = function () {
    return true;
};

Signal.prototype._subscribe = function (node) {
    if (this._targets !== node && node._prevTarget === undefined) {
        node._nextTarget = this._targets;
        if (this._targets !== undefined) {
            this._targets._prevTarget = node;
        }
        this._targets = node;
    }
};

Signal.prototype._unsubscribe = function (node) {
    if (this._targets !== undefined) {
        const prev = node._prevTarget;
        const next = node._nextTarget;
        if (prev !== undefined) {
            prev._nextTarget = next;
            node._prevTarget = undefined;
        }
        if (next !== undefined) {
            next._prevTarget = prev;
            node._nextTarget = undefined;
        }
        if (node === this._targets) {
            this._targets = next;
        }
    }
};

Signal.prototype.subscribe = function (fn) {
    const signal = this;
    // @ts-ignore
    return effect(function (this: any) {
        const value = signal.value;
        const flag = this._flags & TRACKING;
        this._flags &= ~TRACKING;
        try {
            fn(value);
        } finally {
            this._flags |= flag;
        }
    });
};

Signal.prototype.valueOf = function () {
    return this.value;
};

Signal.prototype.toString = function () {
    return this.value + "";
};

Signal.prototype.toJSON = function () {
    return this.value;
};

Signal.prototype.peek = function () {
    return this._value;
};

Object.defineProperty(Signal.prototype, "value", {
    get() {
        const node = addDependency(this);
        if (node !== undefined) {
            node._version = this._version;
        }
        return this._value;
    },
    set(this: Signal, value) {
        if (value !== this._value) {
            if (batchIteration > 100) {
                cycleDetected();
            }

            this._value = value;
            this._version++;
            globalVersion++;

            startBatch();
            try {
                for (
                    let node = this._targets as MyNode;
                    node !== undefined;
                    node = node._nextTarget as MyNode
                ) {
                    node._target._notify();
                }
            } finally {
                endBatch();
            }
        }
    },
});

function signal<T>(value: T) {
    return new Signal(value);
}

function needsToRecompute(target: any): boolean {
    for (
        let node = target._sources;
        node !== undefined;
        node = node._nextSource
    ) {
        if (
            node._source._version !== node._version ||
            !node._source._refresh() ||
            node._source._version !== node._version
        ) {
            return true;
        }
    }
    return false;
}