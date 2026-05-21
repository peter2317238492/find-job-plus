const test = require("node:test");
const assert = require("node:assert/strict");

const { GuiTaskQueue } = require("../src/gui/taskQueue");

test("GUI task queue serializes operations through the executor", async () => {
  let running = 0;
  let maxRunning = 0;
  const order = [];
  const queue = new GuiTaskQueue({
    executor: {
      async execute(task) {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        order.push(`start:${task.operation}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        order.push(`end:${task.operation}`);
        return task.operation;
      },
    },
  });

  const results = await Promise.all([
    queue.enqueue({ platform: "boss", operation: "login", run: async () => {} }),
    queue.enqueue({ platform: "boss", operation: "submit", run: async () => {} }),
  ]);

  assert.deepEqual(results, ["login", "submit"]);
  assert.equal(maxRunning, 1);
  assert.deepEqual(order, ["start:login", "end:login", "start:submit", "end:submit"]);
});

test("GUI task queue prioritizes higher priority tasks while keeping FIFO for ties", async () => {
  const order = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new GuiTaskQueue({
    executor: {
      async execute(task) {
        order.push(task.operation);
        if (task.operation === "first") {
          await gate;
        }
        return task.operation;
      },
    },
  });

  const first = queue.enqueue({ operation: "first", run: async () => {} });
  const low = queue.enqueue({ operation: "low", priority: 1, run: async () => {} });
  const high = queue.enqueue({ operation: "high", priority: 10, run: async () => {} });

  release();
  assert.deepEqual(await Promise.all([first, low, high]), ["first", "low", "high"]);
  assert.deepEqual(order, ["first", "high", "low"]);
});
