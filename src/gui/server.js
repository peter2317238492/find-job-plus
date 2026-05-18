const http = require("node:http");
const { applyAgentEvent, createInitialGuiState, renderDashboardHtml } = require("./state");

function createGuiServer({ state = createInitialGuiState(), onCommand = () => {} } = {}) {
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderDashboardHtml(state));
      return;
    }

    if (request.method === "GET" && request.url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "POST" && request.url === "/command") {
      const body = await readBody(request);
      const command = new URLSearchParams(body).get("command") || "";
      const event = { type: "command", command };
      applyAgentEvent(state, event);
      onCommand(command);
      response.writeHead(303, { location: "/" });
      response.end();
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  return {
    state,
    server,
    applyEvent(event) {
      applyAgentEvent(state, event);
    },
    listen(port = 3210, host = "127.0.0.1") {
      return new Promise((resolve) => {
        server.listen(port, host, () => resolve(`http://${host}:${port}`));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

module.exports = {
  createGuiServer,
};
