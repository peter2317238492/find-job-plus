class ComputerUseExecutor {
  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  async execute(task) {
    if (!task || typeof task !== "object") {
      throw new Error("ComputerUseExecutor requires a task object.");
    }
    if (typeof task.run !== "function") {
      throw new Error("ComputerUseExecutor task requires a run function.");
    }

    return task.run(task);
  }
}

function createInlineGuiExecutor() {
  return {
    async enqueue(task) {
      if (!task || typeof task.run !== "function") {
        throw new Error("Inline GUI executor task requires a run function.");
      }
      return task.run(task);
    },
  };
}

module.exports = {
  ComputerUseExecutor,
  createInlineGuiExecutor,
};
