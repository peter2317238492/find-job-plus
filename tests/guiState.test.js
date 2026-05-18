const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialGuiState,
  applyAgentEvent,
  renderDashboardHtml,
} = require("../src/gui/state");

test("GUI state records active platform, browser URL, operation, and logs", () => {
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
  assert.equal(state.browserUrl, "https://www.zhipin.com/web/geek/job-recommend");
  assert.deepEqual(state.currentOperation, {
    agent: "job-filter-agent",
    operation: "过滤岗位 前端开发",
  });
  assert.equal(state.logs.length, 1);
  assert.equal(state.logs[0].message, "准备投递");
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
    agent: "platform-agent",
    operation: "读取牛客岗位",
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
  assert.match(html, /platform-agent/);
  assert.match(html, /读取牛客岗位/);
  assert.match(html, /牛客选择器需要校准/);
});
