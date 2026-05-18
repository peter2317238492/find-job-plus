const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBossAdapter,
  createBossSearchUrl,
  isBossSecurityUrl,
  parseBossListCardText,
  resolveBossReturnUrl,
} = require("../src/platforms/boss");

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
