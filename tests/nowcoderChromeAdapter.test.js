const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createNowcoderChromeAdapter,
  parseNowcoderJobCardText,
  parseNowcoderJobsFromPageText,
} = require("../src/platforms_chrome/nowcoderChromeAdapter");
const { createScriptedChromeController } = require("../src/platforms_chrome/baseChromeAdapter");

test("Nowcoder Chrome adapter parses visible job cards from page text", () => {
  const jobs = parseNowcoderJobsFromPageText(
    [
      "前端开发实习生",
      "靠谱科技",
      "上海",
      "200-300元/天",
      "立即申请",
      "",
      "算法工程师实习",
      "智能科技",
      "苏州",
      "20-30K",
      "投递",
    ].join("\n")
  );

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, "前端开发实习生");
  assert.equal(jobs[0].company, "靠谱科技");
  assert.equal(jobs[1].title, "算法工程师实习");
});

test("Nowcoder Chrome adapter extracts company, location, salary, and description", () => {
  assert.deepEqual(
    parseNowcoderJobCardText(
      ["全栈开发实习生", "20-30K", "靠谱科技", "上海·浦东新区", "React Node.js"].join("\n")
    ),
    {
      title: "全栈开发实习生",
      salary: "20-30K",
      company: "靠谱科技",
      location: "上海·浦东新区",
      description: "全栈开发实习生\n20-30K\n靠谱科技\n上海·浦东新区\nReact Node.js",
    }
  );
});

test("Nowcoder adapter stops before final application and asks for user confirmation", async () => {
  let prompt = null;
  const controller = createScriptedChromeController();
  const adapter = createNowcoderChromeAdapter({
    controller,
    promptForHuman: async (payload) => {
      prompt = payload;
    },
    humanDelayRangeMs: [0, 0],
  });

  const result = await adapter.submitApplication(
    { id: "nowcoder-1", title: "机器学习实习生", url: "https://www.nowcoder.com/jobs/1" },
    { greeting: "您好，我可在2026年6月开始实习。", resumePatch: { summary: "机器学习项目经历" } }
  );

  assert.equal(result.status, "awaiting_user_action");
  assert.equal(prompt.platform, "nowcoder");
  assert.match(prompt.message, /手动点击申请\/投递/);
  assert.deepEqual(
    controller.transcript.map((entry) => entry.action),
    ["openPage"]
  );
});
