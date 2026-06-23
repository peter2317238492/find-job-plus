function createInitialGuiState() {
  return {
    activePlatform: "",
    computerUseTarget: "",
    computerUseRequests: [],
    currentOperation: null,
    guiTasks: [],
    commands: [],
    logs: [],
  };
}

function applyAgentEvent(state, event) {
  if (event.type === "platform:active") {
    state.activePlatform = event.platform || "";
    state.computerUseTarget = event.url || "";
  }

  if (event.type === "agent:operation") {
    state.currentOperation = {
      agent: event.agent,
      operation: event.operation,
    };
  }

  if (event.type && event.type.startsWith("gui:task:")) {
    const task = {
      ...(event.task || {}),
      status: event.type.replace("gui:task:", ""),
      at: event.at || new Date().toISOString(),
    };
    state.guiTasks.unshift(task);
    state.guiTasks = state.guiTasks.slice(0, 20);
    if (task.status === "started") {
      state.currentOperation = {
        agent: "computer-use-executor",
        operation: task.operation,
      };
    }
  }

  if (event.type === "computer-use:request") {
    state.computerUseTarget = event.request?.targetUrl || state.computerUseTarget || "";
    state.computerUseRequests.unshift({
      at: event.at || new Date().toISOString(),
      id: event.request?.id || "",
      platform: event.request?.platform || "",
      action: event.request?.action || "",
      targetUrl: event.request?.targetUrl || "",
      status: "requested",
    });
    state.computerUseRequests = state.computerUseRequests.slice(0, 20);
  }

  if (event.type === "computer-use:result") {
    const request = state.computerUseRequests.find((entry) => entry.id === event.requestId);
    if (request) {
      request.status = event.status || "completed";
    }
  }

  if (event.type === "command") {
    state.commands.unshift({
      at: event.at || new Date().toISOString(),
      command: event.command,
    });
    state.commands = state.commands.slice(0, 20);
  }

  if (event.type === "log") {
    state.logs.unshift({
      at: event.at || new Date().toISOString(),
      level: event.level || "info",
      message: event.message,
    });
    state.logs = state.logs.slice(0, 100);
  }

  return state;
}

function renderDashboardHtml(state) {
  const operation = state.currentOperation || { agent: "", operation: "" };
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Find Job Plus Agent Console</title>
  <style>
    :root { color-scheme: light; font-family: Arial, "Microsoft YaHei", sans-serif; }
    body { margin: 0; background: #f6f8fb; color: #1f2937; }
    header { padding: 16px 24px; background: #ffffff; border-bottom: 1px solid #d8dee8; }
    main { display: grid; grid-template-columns: 320px 1fr; gap: 16px; padding: 16px; }
    section { background: #ffffff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 15px; margin: 0 0 12px; }
    label { display: block; font-size: 13px; margin-bottom: 6px; }
    input { box-sizing: border-box; width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid #b9c2d0; border-radius: 6px; }
    button { margin-top: 8px; min-height: 36px; padding: 8px 12px; border: 0; border-radius: 6px; background: #0f766e; color: white; cursor: pointer; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px; margin: 0; }
    dt { color: #64748b; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .log { border-top: 1px solid #e5e7eb; padding: 8px 0; }
    .muted { color: #64748b; font-size: 12px; }
    @media (max-width: 760px) { main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header><h1>Find Job Plus Agent Console</h1></header>
  <main>
    <section>
      <h2>命令</h2>
      <form method="POST" action="/command">
        <label for="command">发送给 Agent Team</label>
        <input id="command" name="command" autocomplete="off">
        <button type="submit">发送</button>
      </form>
      <h2 style="margin-top: 20px;">最近命令</h2>
      ${renderCommands(state.commands)}
    </section>
    <section>
      <h2>状态</h2>
      <dl>
        <dt>活跃平台</dt><dd>${escapeHtml(state.activePlatform || "未启动")}</dd>
        <dt>Computer Use 目标</dt><dd>${escapeHtml(state.computerUseTarget || "未请求")}</dd>
        <dt>当前 Agent</dt><dd>${escapeHtml(operation.agent || "空闲")}</dd>
        <dt>当前操作</dt><dd>${escapeHtml(operation.operation || "等待任务")}</dd>
      </dl>
      <h2 style="margin-top: 20px;">Computer Use 请求</h2>
      ${renderComputerUseRequests(state.computerUseRequests)}
      <h2 style="margin-top: 20px;">GUI 队列</h2>
      ${renderGuiTasks(state.guiTasks)}
      <h2 style="margin-top: 20px;">日志</h2>
      ${renderLogs(state.logs)}
    </section>
  </main>
</body>
</html>`;
}

function renderGuiTasks(tasks) {
  if (!tasks.length) {
    return '<p class="muted">暂无 GUI 任务</p>';
  }

  return tasks
    .map(
      (task) =>
        `<div class="log"><strong>${escapeHtml(task.status)}</strong> ${escapeHtml(task.platform || "")} ${escapeHtml(task.operation || "")}<div class="muted">${escapeHtml(task.at)}</div></div>`
    )
    .join("");
}

function renderComputerUseRequests(requests) {
  if (!requests.length) {
    return '<p class="muted">暂无请求</p>';
  }

  return requests
    .map(
      (entry) =>
        `<div class="log"><strong>${escapeHtml(entry.status)}</strong> ${escapeHtml(entry.platform)} ${escapeHtml(entry.action)}<div class="muted">${escapeHtml(entry.targetUrl || entry.id)} · ${escapeHtml(entry.at)}</div></div>`
    )
    .join("");
}

function renderCommands(commands) {
  if (!commands.length) {
    return '<p class="muted">暂无命令</p>';
  }

  return commands
    .map((entry) => `<div class="log"><div>${escapeHtml(entry.command)}</div><div class="muted">${escapeHtml(entry.at)}</div></div>`)
    .join("");
}

function renderLogs(logs) {
  if (!logs.length) {
    return '<p class="muted">暂无日志</p>';
  }

  return logs
    .map(
      (entry) =>
        `<div class="log"><strong>${escapeHtml(entry.level)}</strong> ${escapeHtml(entry.message)}<div class="muted">${escapeHtml(entry.at)}</div></div>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  applyAgentEvent,
  createInitialGuiState,
  renderDashboardHtml,
  renderComputerUseRequests,
  renderGuiTasks,
};
