const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isJobAllowed,
  parseActivityDays,
  parseSalaryRange,
} = require("../src/agents/jobFilter");

test("parseSalaryRange normalizes common Chinese salary ranges to monthly k values", () => {
  assert.deepEqual(parseSalaryRange("15-25K·14薪"), {
    minK: 15,
    maxK: 25,
    months: 14,
    yearlyMinK: 210,
    yearlyMaxK: 350,
  });

  assert.deepEqual(parseSalaryRange("2-3万/月"), {
    minK: 20,
    maxK: 30,
    months: 12,
    yearlyMinK: 240,
    yearlyMaxK: 360,
  });
});

test("parseActivityDays recognizes active recruiter text", () => {
  assert.equal(parseActivityDays("刚刚活跃"), 0);
  assert.equal(parseActivityDays("今日活跃"), 0);
  assert.equal(parseActivityDays("3日内活跃"), 3);
  assert.equal(parseActivityDays("2周内活跃"), 14);
});

test("isJobAllowed rejects inactive, underpaid, and blocked-keyword jobs", () => {
  const rules = {
    minSalaryK: 15,
    maxSalaryK: 35,
    activeWithinDays: 3,
    blockedKeywords: ["外包", "外派", "驻场"],
    blockedCompanies: ["黑名单公司"],
  };

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发",
        company: "靠谱科技",
        description: "React、Node.js、AI Agent 方向",
        salary: "18-28K·14薪",
        recruiterActivity: "3日内活跃",
      },
      rules
    ),
    { allowed: true, reasons: [] }
  );

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端驻场开发",
        company: "靠谱科技",
        description: "客户现场办公",
        salary: "18-28K",
        recruiterActivity: "刚刚活跃",
      },
      rules
    ),
    { allowed: false, reasons: ["包含屏蔽关键词: 驻场"] }
  );

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发",
        company: "黑名单公司",
        description: "React",
        salary: "8-10K",
        recruiterActivity: "10日内活跃",
      },
      rules
    ),
    {
      allowed: false,
      reasons: [
        "公司在黑名单中: 黑名单公司",
        "薪资低于期望下限: 8-10K",
        "招聘者活跃度超过阈值: 10天",
      ],
    }
  );
});

test("isJobAllowed requires internship jobs in Shanghai or Suzhou starting in June 2026", () => {
  const rules = {
    allowedCities: ["上海", "苏州"],
    requiredInternship: true,
    targetStartMonth: "2026-06",
  };

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发实习生",
        company: "靠谱科技",
        location: "上海·徐汇区",
        description: "2026年6月可到岗，连续实习3个月以上。",
      },
      rules
    ),
    { allowed: true, reasons: [] }
  );

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发",
        company: "靠谱科技",
        location: "上海",
        description: "2026年6月可入职。",
      },
      rules
    ),
    { allowed: false, reasons: ["不是实习岗位"] }
  );

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发实习生",
        company: "靠谱科技",
        location: "杭州",
        description: "2026年6月可开始实习。",
      },
      rules
    ),
    { allowed: false, reasons: ["不在目标城市: 上海,苏州"] }
  );

  assert.deepEqual(
    isJobAllowed(
      {
        title: "前端开发实习生",
        company: "靠谱科技",
        location: "苏州工业园区",
        description: "尽快到岗，连续实习3个月以上。",
      },
      rules
    ),
    { allowed: false, reasons: ["不匹配目标开始时间: 2026-06"] }
  );
});
