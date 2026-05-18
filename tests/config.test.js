const test = require("node:test");
const assert = require("node:assert/strict");

test("loadConfig reads internship target filters from environment", () => {
  const previous = {
    ALLOWED_CITIES: process.env.ALLOWED_CITIES,
    REQUIRED_INTERNSHIP: process.env.REQUIRED_INTERNSHIP,
    TARGET_START_MONTH: process.env.TARGET_START_MONTH,
    MAX_APPLICATIONS_PER_RUN: process.env.MAX_APPLICATIONS_PER_RUN,
  };

  process.env.ALLOWED_CITIES = "上海,苏州";
  process.env.REQUIRED_INTERNSHIP = "true";
  process.env.TARGET_START_MONTH = "2026-06";
  process.env.MAX_APPLICATIONS_PER_RUN = "500";

  delete require.cache[require.resolve("../src/config")];
  const { loadConfig } = require("../src/config");
  const config = loadConfig();

  assert.deepEqual(config.filters.allowedCities, ["上海", "苏州"]);
  assert.equal(config.filters.requiredInternship, true);
  assert.equal(config.filters.targetStartMonth, "2026-06");
  assert.equal(config.limits.maxApplicationsPerRun, 500);

  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  delete require.cache[require.resolve("../src/config")];
});

test("loadCodexOpenAIConfig reads OpenAI base URL and API key without logging secrets", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { loadCodexOpenAIConfig } = require("../src/config");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-codex-"));
  const configPath = path.join(dir, "config.toml");
  const authPath = path.join(dir, "auth.json");

  await fs.writeFile(
    configPath,
    [
      "[model_providers.OpenAI]",
      'name = "OpenAI"',
      'base_url = "https://example.test/v1"',
      'wire_api = "responses"',
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(authPath, JSON.stringify({ OPENAI_API_KEY: "sk-test" }), "utf8");

  assert.deepEqual(await loadCodexOpenAIConfig({ configPath, authPath }), {
    baseURL: "https://example.test/v1",
    apiKey: "sk-test",
  });
});
