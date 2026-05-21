const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBossAdapter,
  createBossSearchUrl,
  isBossSecurityUrl,
  parseBossJobsFromPageText,
  parseBossListCardText,
  resolveBossReturnUrl,
} = require("../src/platforms/boss");
const { createScriptedChromeController } = require("../src/platforms_chrome/baseChromeAdapter");

test("Boss adapter builds a search URL for internship target cities", () => {
  assert.equal(
    createBossSearchUrl({ query: "实习 2026年6月", cityCode: "101020100" }),
    "https://www.zhipin.com/web/geek/jobs?query=%E5%AE%9E%E4%B9%A0%202026%E5%B9%B46%E6%9C%88&city=101020100&industry=&position="
  );
});

test("Boss adapter enters only through the zhipin home page", () => {
  const adapter = createBossAdapter({
    allowedCities: ["上海", "苏州"],
    targetStartMonth: "2026-06",
    requiredInternship: true,
    driverFactory: async () => {
      throw new Error("driver should not be created");
    },
  });

  assert.equal(adapter.startUrl, "https://www.zhipin.com/");
});

test("Boss adapter returns to the search page after blank login redirects", () => {
  const startUrl = "https://www.zhipin.com/web/geek/jobs?query=x&city=101020100";

  assert.equal(resolveBossReturnUrl("data:,", startUrl), startUrl);
  assert.equal(resolveBossReturnUrl("about:blank", startUrl), startUrl);
  assert.equal(resolveBossReturnUrl("https://login.example.test/callback", startUrl), startUrl);
  assert.equal(
    resolveBossReturnUrl("https://www.zhipin.com/web/geek/job-card?lid=abc", startUrl),
    "https://www.zhipin.com/web/geek/job-card?lid=abc"
  );
});

test("Boss adapter parses current list-card text into job fields", () => {
  assert.deepEqual(
    parseBossListCardText(
      [
        "PMO实习生-国际搜索",
        "",
        "300-350元/天",
        "",
        "3个月本科",
        "",
        "字节跳动",
        "",
        "上海·杨浦区·五角场",
      ].join("\n")
    ),
    {
      title: "PMO实习生-国际搜索",
      salary: "300-350元/天",
      company: "字节跳动",
      location: "上海·杨浦区·五角场",
      description: "PMO实习生-国际搜索\n300-350元/天\n3个月本科\n字节跳动\n上海·杨浦区·五角场",
    }
  );
});

test("Boss Chrome adapter parses multiple visible job cards from page text", () => {
  const jobs = parseBossJobsFromPageText(
    [
      "前端开发实习生",
      "200-300元/天",
      "3个月本科",
      "靠谱科技",
      "上海·浦东新区",
      "今日活跃",
      "",
      "Node.js 实习生",
      "20-30K",
      "经验不限本科",
      "自动化科技",
      "苏州·工业园区",
      "3日内活跃",
    ].join("\n")
  );

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, "boss-1");
  assert.equal(jobs[0].title, "前端开发实习生");
  assert.equal(jobs[0].company, "靠谱科技");
  assert.equal(jobs[1].title, "Node.js 实习生");
});

test("Boss adapter recognizes official security verification pages", () => {
  assert.equal(
    isBossSecurityUrl("https://www.zhipin.com/web/passport/zp/security.html?callbackUrl=x"),
    true
  );
  assert.equal(
    isBossSecurityUrl("https://www.zhipin.com/web/geek/jobs?query=x&city=101020100"),
    false
  );
  assert.equal(isBossSecurityUrl("data:,"), false);
});

test("Boss adapter stops before final send and asks for user confirmation", async () => {
  let prompt = null;
  const controller = createScriptedChromeController();
  const adapter = createBossAdapter({
    controller,
    promptForHuman: async (payload) => {
      prompt = payload;
    },
    humanDelayRangeMs: [0, 0],
  });

  const result = await adapter.submitApplication(
    { id: "boss-1", title: "算法实习生", url: "https://www.zhipin.com/job_detail/1.html" },
    { greeting: "您好，我可在2026年6月开始实习。", resumePatch: { summary: "算法项目经历" } }
  );

  assert.equal(result.status, "awaiting_user_action");
  assert.equal(prompt.platform, "boss");
  assert.match(prompt.message, /手动点击沟通并发送/);
  assert.deepEqual(
    controller.transcript.map((entry) => entry.action),
    ["openPage"]
  );
});
