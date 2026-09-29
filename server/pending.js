// Tracks context.waitUntil() tasks so shutdown can let them finish before the
// MySQL pool closes (otherwise an in-flight impression or click is lost).

export class PendingTasks {
  #tasks = new Set();

  /** Start tracking a task; failures are logged, never thrown. */
  track(promise) {
    const task = Promise.resolve(promise).catch((e) => console.error('waitUntil task failed', e));
    this.#tasks.add(task);
    task.finally(() => this.#tasks.delete(task));
    return task;
  }

  get size() {
    return this.#tasks.size;
  }

  /** Resolve when every tracked task has settled, or after `timeoutMs`. Returns true if all finished. */
  async drain(timeoutMs) {
    let timer;
    const timedOut = new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
    // Tasks started while draining are picked up by looping until the set is empty.
    const all = (async () => {
      while (this.#tasks.size) await Promise.allSettled([...this.#tasks]);
      return true;
    })();
    try {
      return await Promise.race([all, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }
}
