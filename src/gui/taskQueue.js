const { ComputerUseExecutor } = require("./computerUseExecutor");

class GuiTaskQueue {
  constructor({ executor = new ComputerUseExecutor(), eventSink = () => {}, concurrency = 1 } = {}) {
    this.executor = executor;
    this.eventSink = eventSink;
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.pending = [];
    this.running = 0;
    this.sequence = 0;
  }

  enqueue(task) {
    const queuedTask = this.#normalizeTask(task);
    this.#emit("gui:task:queued", queuedTask);

    return new Promise((resolve, reject) => {
      queuedTask.resolve = resolve;
      queuedTask.reject = reject;
      this.pending.push(queuedTask);
      this.#sortPending();
      this.#drain();
    });
  }

  snapshot() {
    return {
      pending: this.pending.map((task) => serializeTask(task)),
      running: this.running,
      concurrency: this.concurrency,
    };
  }

  #normalizeTask(task = {}) {
    if (typeof task.run !== "function") {
      throw new Error("GUI task requires a run function.");
    }

    const sequence = ++this.sequence;
    return {
      id: task.id || `gui-task-${sequence}`,
      platform: task.platform || "",
      operation: task.operation || "GUI operation",
      target: task.target || "",
      priority: Number(task.priority || 0),
      retries: Math.max(0, Number(task.retries || 0)),
      attempts: 0,
      sequence,
      metadata: task.metadata || {},
      run: task.run,
    };
  }

  #sortPending() {
    this.pending.sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.sequence - right.sequence;
    });
  }

  #drain() {
    while (this.running < this.concurrency && this.pending.length) {
      const task = this.pending.shift();
      this.#runTask(task);
    }
  }

  async #runTask(task) {
    this.running += 1;
    task.attempts += 1;
    this.#emit("gui:task:started", task);

    try {
      const result = await this.executor.execute(task);
      this.#emit("gui:task:completed", task, { result });
      task.resolve(result);
    } catch (error) {
      if (task.attempts <= task.retries) {
        this.#emit("gui:task:retry", task, { error });
        this.pending.push(task);
        this.#sortPending();
      } else {
        this.#emit("gui:task:failed", task, { error });
        task.reject(error);
      }
    } finally {
      this.running -= 1;
      this.#drain();
    }
  }

  #emit(type, task, extra = {}) {
    this.eventSink({
      type,
      at: new Date().toISOString(),
      task: serializeTask(task),
      ...serializeExtra(extra),
    });
  }
}

function serializeTask(task) {
  return {
    id: task.id,
    platform: task.platform,
    operation: task.operation,
    target: task.target,
    priority: task.priority,
    retries: task.retries,
    attempts: task.attempts,
    metadata: task.metadata,
  };
}

function serializeExtra(extra) {
  if (!extra.error) {
    return extra;
  }

  return {
    ...extra,
    error: {
      message: extra.error.message,
      name: extra.error.name,
    },
  };
}

module.exports = {
  GuiTaskQueue,
  serializeTask,
};
