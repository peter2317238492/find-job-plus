const test = require("node:test");
const assert = require("node:assert/strict");

test("loadConfig reads internship target filters from environment", () => {
  const previous = {
    ALLOWED_CITIES: process.env.ALLOWED_CITIES,
    REQUIRED_INTERNSHIP: process.env.REQUIRED_INTERNSHIP,
    TARGET_START_MONTH: process.env.TARGET_START_MONTH,
    MAX_APPLICATIONS_PER_RUN: process.env.MAX_APPLICATIONS_PER_RUN,
    LINKEDIN_PROFILE_URL: process.env.LINKEDIN_PROFILE_URL,
    TAILORED_RESUME_DIR: process.env.TAILORED_RESUME_DIR,
    TYPST_TEMPLATE_DIR: process.env.TYPST_TEMPLATE_DIR,
    ENABLE_RESUME_PDF: process.env.ENABLE_RESUME_PDF,
    TYPST_BIN: process.env.TYPST_BIN,
  };

  process.env.ALLOWED_CITIES = "上海,苏州";
  process.env.REQUIRED_INTERNSHIP = "true";
  process.env.TARGET_START_MONTH = "2026-06";
  process.env.MAX_APPLICATIONS_PER_RUN = "500";
  process.env.LINKEDIN_PROFILE_URL = "https://www.linkedin.com/in/example/";
  process.env.TAILORED_RESUME_DIR = "/tmp/resumes";
  process.env.TYPST_TEMPLATE_DIR = "/tmp/template";
  process.env.ENABLE_RESUME_PDF = "true";
  process.env.TYPST_BIN = "typst-test";

  delete require.cache[require.resolve("../src/config")];
  const { loadConfig } = require("../src/config");
  const config = loadConfig();

  assert.deepEqual(config.filters.allowedCities, ["上海", "苏州"]);
  assert.equal(config.filters.requiredInternship, true);
  assert.equal(config.filters.targetStartMonth, "2026-06");
  assert.equal(config.limits.maxApplicationsPerRun, 500);
  assert.equal(config.linkedin.profileUrl, "https://www.linkedin.com/in/example/");
  assert.equal(config.tailoredResume.outputDir, "/tmp/resumes");
  assert.equal(config.tailoredResume.templateDir, "/tmp/template");
  assert.equal(config.tailoredResume.compilePdf, true);
  assert.equal(config.tailoredResume.typstBin, "typst-test");

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

test("resolveDefaultResumePath falls back to the checked-in PDF resume", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { resolveDefaultResumePath } = require("../src/config");

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-resume-"));
  const pdfPath = path.join(dir, "在线简历.pdf");
  await fs.writeFile(pdfPath, Buffer.from("%PDF mocked"));

  assert.equal(resolveDefaultResumePath(dir), pdfPath);
});
