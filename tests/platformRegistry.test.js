const test = require("node:test");
const assert = require("node:assert/strict");

const { createPlatformRegistry } = require("../src/platforms");

test("platform registry exposes Boss, Nowcoder, and LinkedIn adapters through a shared contract", () => {
  const registry = createPlatformRegistry();
  const boss = registry.get("boss");
  const nowcoder = registry.get("nowcoder");
  const linkedin = registry.get("linkedin");

  assert.deepEqual(registry.names().sort(), ["boss", "linkedin", "nowcoder"]);
  assert.equal(boss.name, "boss");
  assert.equal(nowcoder.name, "nowcoder");
  assert.equal(linkedin.name, "linkedin");
  assert.equal(linkedin.kind, "profile-maintenance");

  for (const adapter of [boss, nowcoder]) {
    assert.equal(typeof adapter.startUrl, "string");
    assert.equal(typeof adapter.login, "function");
    assert.equal(typeof adapter.getNextJob, "function");
    assert.equal(typeof adapter.submitApplication, "function");
    assert.equal(typeof adapter.checkMessages, "function");
  }

  assert.equal(typeof linkedin.login, "function");
  assert.equal(typeof linkedin.maintainProfile, "function");
});

test("platform registry rejects unknown platforms with a useful error", () => {
  const registry = createPlatformRegistry();

  assert.throws(() => registry.get("unknown"), /Unknown platform: unknown/);
});

test("platform registry injects the shared computer-use gateway into adapters", async () => {
  const requests = [];
  const registry = createPlatformRegistry({
    computerUse: {
      async request(request) {
        requests.push(request);
        return {};
      },
    },
  });

  await registry.get("boss").login();
  await registry.get("nowcoder").login();

  assert.deepEqual(
    requests.map((request) => `${request.platform}:${request.action}`),
    ["boss:login", "nowcoder:login"]
  );
});
