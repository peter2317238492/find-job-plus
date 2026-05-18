const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseNowcoderJobCardText,
  parseNowcoderJobsFromPageText,
} = require("../src/platforms_chrome/nowcoderChromeAdapter");

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
