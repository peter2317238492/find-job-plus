const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function extractTomlString(content, key) {
  const pattern = new RegExp(`^${key}\\s*=\\s*(?:"([^"]+)"|"""([\\s\\S]*?)""")`, "m");
  const match = content.match(pattern);
  return match ? match[1] || match[2] : null;
}

test("project Codex subagent files follow the OpenAI custom-agent schema", () => {
  const configPath = path.join(process.cwd(), ".codex", "config.toml");
  assert.equal(fs.existsSync(configPath), true, ".codex/config.toml is missing");
  const config = fs.readFileSync(configPath, "utf8");
  assert.match(config, /\[agents\]/);
  assert.match(config, /max_threads\s*=\s*6/);
  assert.match(config, /max_depth\s*=\s*1/);

  const agentsDir = path.join(process.cwd(), ".codex", "agents");
  const files = fs.readdirSync(agentsDir).filter((file) => file.endsWith(".toml"));
  assert.deepEqual(files.sort(), [
    "chat-agent.toml",
    "gui-agent.toml",
    "idle-market-agent.toml",
    "job-filter-agent.toml",
    "platform-agent.toml",
    "resume-agent.toml",
  ]);

  const names = new Set();
  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const name = extractTomlString(content, "name");
    const description = extractTomlString(content, "description");
    const developerInstructions = extractTomlString(content, "developer_instructions");

    assert.ok(name, `${file} must define name`);
    assert.ok(description, `${file} must define description`);
    assert.ok(developerInstructions, `${file} must define developer_instructions`);
    assert.match(content, /model_reasoning_effort\s*=/, `${file} should pin reasoning effort`);
    assert.equal(names.has(name), false, `${name} is duplicated`);
    names.add(name);
  }
});
