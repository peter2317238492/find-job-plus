const test = require("node:test");
const assert = require("node:assert/strict");

const { createJobAssistant } = require("../src/llm/openaiClient");

test("createJobAssistant uses a truthful template assistant when no API key is configured", async () => {
  const assistant = createJobAssistant({ apiKey: "" });
  const job = {
    title: "前端开发实习生",
    company: "靠谱科技",
    location: "上海",
    description: "2026年6月可开始实习，参与 React 项目。",
  };

  const resumePatch = await assistant.generateResumePatch({
    resume: "熟悉 React，有课程项目和科研项目经历。",
    job,
  });
  const greeting = await assistant.generateGreeting({
    resume: "熟悉 React，有课程项目和科研项目经历。",
    resumePatch,
    job,
  });

  assert.match(resumePatch.summary, /不编造/);
  assert.match(greeting, /前端开发实习生/);
  assert.match(greeting, /2026年6月/);
  assert.doesNotMatch(greeting, /undefined|null/);
});

test("template assistant generates LinkedIn profile patch without credentials or private fields", async () => {
  const assistant = createJobAssistant({ apiKey: "" });
  const patch = await assistant.generateLinkedInProfilePatch({
    resume: "熟悉 React、TypeScript、Node.js 和 OpenAI API，有自动化项目经历。",
  });

  assert.match(patch.headline, /Frontend Developer/);
  assert.match(patch.about, /React/);
  assert.deepEqual(patch.skills, ["TypeScript", "React", "Node.js", "OpenAI API"]);
  assert.doesNotMatch(JSON.stringify(patch), /password|LINKEDIN_PASSWORD|手机号|身份证/i);
});
