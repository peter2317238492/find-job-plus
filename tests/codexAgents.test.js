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
    "computer-use-executor-agent.toml",
    "gui-agent.toml",
    "idle-market-agent.toml",
    "job-filter-agent.toml",
    "manager-agent.toml",
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

test("project Codex team presets reference known non-GUI workers", () => {
  const agentsDir = path.join(process.cwd(), ".codex", "agents");
  const agentNames = new Set(
    fs
      .readdirSync(agentsDir)
      .filter((file) => file.endsWith(".toml"))
      .map((file) => extractTomlString(fs.readFileSync(path.join(agentsDir, file), "utf8"), "name"))
  );
  const teamsDir = path.join(process.cwd(), ".codex", "teams");
  const files = fs.readdirSync(teamsDir).filter((file) => file.endsWith(".toml"));

  assert.deepEqual(files.sort(), [
    "boss-non-gui.toml",
    "linkedin-non-gui.toml",
    "nowcoder-non-gui.toml",
  ]);

  for (const file of files) {
    const content = fs.readFileSync(path.join(teamsDir, file), "utf8");
    assert.ok(extractTomlString(content, "name"), `${file} must define name`);
    assert.ok(extractTomlString(content, "description"), `${file} must define description`);
    assert.match(content, /gui\s*=\s*false/, `${file} should be non-GUI`);
    const platforms = extractTomlArray(content, "platforms");
    const agents = extractTomlArray(content, "agents");

    assert.ok(platforms.length, `${file} must define platforms`);
    assert.ok(agents.length, `${file} must define agents`);
    for (const platform of platforms) {
      assert.ok(["boss", "nowcoder", "linkedin"].includes(platform), `${file} has unknown platform ${platform}`);
    }
    for (const agent of agents) {
      assert.ok(agentNames.has(agent), `${file} references unknown agent ${agent}`);
      assert.notEqual(agent, "computer-use-executor", `${file} should not run GUI executor as a non-GUI worker`);
    }
    assert.match(content, /executor\s*=\s*"computer-use-executor"/);
    assert.match(content, /layout_note\s*=/, `${file} must point to a site layout note`);
    assert.match(content, /\[\[workflow\.roles\]\]/, `${file} must define subagent responsibilities`);
    assert.match(content, /\[\[workflow\.gui_tasks\]\]/, `${file} must define executor GUI tasks`);

    const layoutNote = extractTomlString(content, "layout_note");
    assert.ok(layoutNote, `${file} must define workflow.layout_note`);
    assert.equal(fs.existsSync(path.join(process.cwd(), layoutNote)), true, `${layoutNote} is missing`);
  }
});

test("site layout notes capture platform-specific application flows", () => {
  const layoutsDir = path.join(process.cwd(), "application-kit", "site-layouts");
  const expected = {
    "boss-zhipin.md": [/computer-use-executor/, /附件管理/, /立即沟通/],
    "nowcoder.md": [/computer-use-executor/, /选择投递简历/, /上传附件简历/, /投递简历/],
    "linkedin.md": [/computer-use-executor/, /快速申请/, /Upload resume/, /Submit application/],
  };

  assert.deepEqual(fs.readdirSync(layoutsDir).filter((file) => file.endsWith(".md")).sort(), Object.keys(expected).sort());

  for (const [file, patterns] of Object.entries(expected)) {
    const content = fs.readFileSync(path.join(layoutsDir, file), "utf8");
    for (const pattern of patterns) {
      assert.match(content, pattern, `${file} should mention ${pattern}`);
    }
  }
});

test("resume Typst skill is discoverable and points to the project template", () => {
  const skillPath = path.join(process.cwd(), ".codex", "skills", "resume-typst", "SKILL.md");
  assert.equal(fs.existsSync(skillPath), true, "resume-typst skill is missing");
  const content = fs.readFileSync(skillPath, "utf8");

  assert.match(content, /name:\s*resume-typst/);
  assert.match(content, /Chinese-Resume-in-Typst-main/);
  assert.match(content, /src\/resume\/typstResumeRenderer\.js/);
  assert.match(content, /Never invent/);
});

function extractTomlArray(content, key) {
  const inlinePattern = new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m");
  const inline = content.match(inlinePattern);
  if (inline) {
    return inline[1]
      .split(",")
      .map((item) => item.replace(/["\s]/g, ""))
      .filter(Boolean);
  }

  const blockPattern = new RegExp(`^${key}\\s*=\\s*\\[\\s*([\\s\\S]*?)\\s*\\]`, "m");
  const block = content.match(blockPattern);
  if (!block) {
    return [];
  }
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}
