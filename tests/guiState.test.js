const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialGuiState,
  applyAgentEvent,
  renderDashboardHtml,
} = require("../src/gui/state");

test("GUI state records active platform, computer-use target, operation, and logs", () => {
  const state = createInitialGuiState();

  applyAgentEvent(state, {
    type: "platform:active",
    platform: "boss",
    url: "https://www.zhipin.com/web/geek/job-recommend",
  });
  applyAgentEvent(state, {
    type: "agent:operation",
    agent: "job-filter-agent",
    operation: "过滤岗位 前端开发",
  });
  applyAgentEvent(state, {
    type: "log",
    level: "info",
    message: "准备投递",
  });

  assert.equal(state.activePlatform, "boss");
  assert.equal(state.computerUseTarget, "https://www.zhipin.com/web/geek/job-recommend");
  assert.deepEqual(state.currentOperation, {
    agent: "job-filter-agent",
    operation: "过滤岗位 前端开发",
  });
  assert.equal(state.logs.length, 1);
  assert.equal(state.logs[0].message, "准备投递");
});

test("GUI state records computer-use executor queue events", () => {
  const state = createInitialGuiState();

  applyAgentEvent(state, {
    type: "gui:task:started",
    at: "2026-05-21T00:00:00.000Z",
    task: {
      id: "task-1",
      platform: "boss",
      operation: "submitApplication",
    },
  });

  assert.deepEqual(state.currentOperation, {
    agent: "computer-use-executor",
    operation: "submitApplication",
  });
  assert.equal(state.guiTasks[0].status, "started");
  assert.equal(state.guiTasks[0].platform, "boss");
});

test("dashboard HTML includes command input, active window, operation, and log areas", () => {
  const state = createInitialGuiState();
  applyAgentEvent(state, {
    type: "platform:active",
    platform: "nowcoder",
    url: "https://www.nowcoder.com/jobs/recommend",
  });
  applyAgentEvent(state, {
    type: "agent:operation",
    agent: "computer-use-agent",
    operation: "读取牛客岗位",
  });
  applyAgentEvent(state, {
    type: "computer-use:request",
    request: {
      id: "computer-use-1",
      platform: "nowcoder",
      action: "read-next-job",
      targetUrl: "https://www.nowcoder.com/jobs/recommend",
    },
  });
  applyAgentEvent(state, {
    type: "computer-use:result",
    requestId: "computer-use-1",
    status: "completed",
  });
  applyAgentEvent(state, {
    type: "log",
    level: "warn",
    message: "牛客选择器需要校准",
  });

  const html = renderDashboardHtml(state);

  assert.match(html, /<form method="POST" action="\/command">/);
  assert.match(html, /name="command"/);
  assert.match(html, /nowcoder/);
  assert.match(html, /https:\/\/www\.nowcoder\.com\/jobs\/recommend/);
  assert.match(html, /computer-use-agent/);
  assert.match(html, /read-next-job/);
  assert.match(html, /completed/);
  assert.match(html, /读取牛客岗位/);
  assert.match(html, /GUI 队列/);
  assert.match(html, /牛客选择器需要校准/);
});
