function cycleDetected() {
  throw new Error("Cycle detected");
}
function startBatch() {
  batchDepth++;
}
function endBatch() {
  if (batchDepth > 1) {
    batchDepth--;
    return;
  }
  let error;
  let hasError = false;
  while (batchedEffect !== undefined) {
    let effect = batchedEffect;
    batchedEffect = undefined;
    batchIteration++;
    while (effect !== undefined) {
      const next = effect._nextBatchedEffect;
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
// Effects collected into a batch.
let batchedEffect = undefined;
let batchDepth = 0;
let batchIteration = 0;
const NOTIFIED = 1 << 1;
const DISPOSED = 1 << 3;
const TRACKING = 1 << 5;
function addDependency(signal) {
  {
    return undefined;
  }
}
function Signal(value) {
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
  return effect(function () {
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
    const node = addDependency();
    if (node !== undefined) {
      node._version = this._version;
    }
    return this._value;
  },
  set(value) {
    if (value !== this._value) {
      if (batchIteration > 100) {
        cycleDetected();
      }
      this._value = value;
      this._version++;
      startBatch();
      try {
        for (let node = this._targets; node !== undefined; node = node._nextTarget) {
          node._target._notify();
        }
      } finally {
        endBatch();
      }
    }
  }
});
function needsToRecompute(target) {
  for (let node = target._sources; node !== undefined; node = node._nextSource) {
    if (node._source._version !== node._version || !node._source._refresh() || node._source._version !== node._version) {
      return true;
    }
  }
  return false;
}
