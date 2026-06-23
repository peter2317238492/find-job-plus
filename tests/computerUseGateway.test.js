const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COMPUTER_USE_AGENT,
  createComputerUseGateway,
  describeComputerUseRequest,
} = require("../src/agents/computerUseGateway");

test("computer-use gateway emits request and result events around executor calls", async () => {
  const events = [];
  const gateway = createComputerUseGateway({
    eventSink: (event) => events.push(event),
    async executor(request) {
      assert.equal(request.agent, COMPUTER_USE_AGENT);
      assert.equal(request.action, "login");
      return { status: "completed", ok: true };
    },
  });

  const result = await gateway.request({
    platform: "boss",
    action: "login",
    targetUrl: "https://www.zhipin.com/",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "completed");
  assert.deepEqual(
    events.map((event) => event.type),
    ["agent:operation", "computer-use:request", "computer-use:result"]
  );
  assert.equal(events[0].agent, COMPUTER_USE_AGENT);
  assert.equal(events[1].request.platform, "boss");
});

test("computer-use gateway fails loudly when no executor is configured", async () => {
  const gateway = createComputerUseGateway();

  await assert.rejects(
    () => gateway.request({ platform: "boss", action: "login" }),
    /Computer-use executor is not configured/
  );
});

test("computer-use request descriptions include platform and action", () => {
  assert.equal(
    describeComputerUseRequest({ platform: "boss", action: "read-next-job" }),
    "boss: read-next-job"
  );
});
