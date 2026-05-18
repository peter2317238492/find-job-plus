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
