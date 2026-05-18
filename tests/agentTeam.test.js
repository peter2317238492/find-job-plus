const test = require("node:test");
const assert = require("node:assert/strict");

const { JobApplicationAgentTeam } = require("../src/agents/agentTeam");

test("agent team filters jobs before resume optimization and application sending", async () => {
  const events = [];
  const agentEvents = [];
  const platform = {
    name: "boss",
    startUrl: "https://www.zhipin.com/web/geek/job-recommend",
    async login() {
      events.push("login");
    },
    async getNextJob() {
      events.push("getNextJob");
      return {
        id: "boss-1",
        title: "前端开发",
        company: "靠谱科技",
        description: "React Node.js",
        salary: "20-30K",
        recruiterActivity: "今日活跃",
      };
    },
    async submitApplication(job, outreach) {
      events.push(`submit:${job.id}:${outreach.greeting}`);
      return { ok: true, applicationId: "app-1" };
    },
    async checkMessages() {
      events.push("checkMessages");
      return [];
    },
  };

  const team = new JobApplicationAgentTeam({
    platforms: { boss: platform },
    resumeStore: { async load() { return "React 和 Node.js 简历"; } },
    llm: {
      async generateResumePatch({ job }) {
        events.push(`resume:${job.id}`);
        return { summary: "突出 React 项目", resumeText: "定制简历" };
      },
      async generateGreeting({ job }) {
        events.push(`greeting:${job.id}`);
        return "您好，我对前端开发岗位很感兴趣。";
      },
    },
    config: {
      filters: {
        minSalaryK: 15,
        maxSalaryK: 35,
        activeWithinDays: 3,
        blockedKeywords: ["外包", "外派", "驻场"],
        blockedCompanies: [],
      },
      limits: { maxApplicationsPerRun: 1 },
    },
    eventSink: (event) => agentEvents.push(event),
  });

  const result = await team.runOnce("boss");

  assert.equal(result.status, "applied");
  assert.equal(result.application.applicationId, "app-1");
  assert.deepEqual(
    agentEvents.map((event) => event.type),
    [
      "platform:active",
      "agent:operation",
      "agent:operation",
      "agent:operation",
      "agent:operation",
      "agent:operation",
      "log",
    ]
  );
  assert.deepEqual(events, [
    "login",
    "getNextJob",
    "resume:boss-1",
    "greeting:boss-1",
    "submit:boss-1:您好，我对前端开发岗位很感兴趣。",
  ]);
});

test("agent team skips rejected jobs without calling the LLM", async () => {
  let llmCalls = 0;
  let discarded = 0;
  const team = new JobApplicationAgentTeam({
    platforms: {
      boss: {
        name: "boss",
        startUrl: "url",
        async login() {},
        async getNextJob() {
          return {
            id: "boss-2",
            title: "前端驻场开发",
            company: "外包公司",
            description: "驻场外派",
            salary: "20-30K",
            recruiterActivity: "今日活跃",
          };
        },
        async submitApplication() {
          throw new Error("should not submit");
        },
        async discardCurrentJob() {
          discarded += 1;
        },
        async checkMessages() {
          return [];
        },
      },
    },
    resumeStore: { async load() { return "resume"; } },
    llm: {
      async generateResumePatch() {
        llmCalls += 1;
      },
      async generateGreeting() {
        llmCalls += 1;
      },
    },
    config: {
      filters: {
        minSalaryK: 10,
        maxSalaryK: 40,
        activeWithinDays: 3,
        blockedKeywords: ["驻场"],
        blockedCompanies: [],
      },
      limits: { maxApplicationsPerRun: 1 },
    },
  });

  const result = await team.runOnce("boss");

  assert.equal(result.status, "skipped");
  assert.deepEqual(result.reasons, ["包含屏蔽关键词: 驻场"]);
  assert.equal(llmCalls, 0);
  assert.equal(discarded, 1);
});

test("agent team keeps scanning jobs until the application limit is reached", async () => {
  const submitted = [];
  let loginCount = 0;
  const jobs = [
    {
      id: "boss-1",
      title: "前端开发实习生",
      company: "靠谱科技",
      location: "杭州",
      description: "2026年6月可到岗。",
      salary: "200-300元/天",
      recruiterActivity: "今日活跃",
    },
    {
      id: "boss-2",
      title: "前端开发实习生",
      company: "靠谱科技",
      location: "上海",
      description: "2026年6月可开始实习。",
      salary: "200-300元/天",
      recruiterActivity: "今日活跃",
    },
    {
      id: "boss-3",
      title: "Node.js 实习生",
      company: "靠谱科技",
      location: "苏州",
      description: "2026年6月入职，参与自动化工具研发。",
      salary: "200-300元/天",
      recruiterActivity: "今日活跃",
    },
    {
      id: "boss-4",
      title: "测试实习生",
      company: "靠谱科技",
      location: "上海",
      description: "2026年6月可到岗。",
      salary: "200-300元/天",
      recruiterActivity: "今日活跃",
    },
  ];

  const team = new JobApplicationAgentTeam({
    platforms: {
      boss: {
        name: "boss",
        startUrl: "url",
        async login() {
          loginCount += 1;
        },
        async getNextJob() {
          return jobs.shift() || null;
        },
        async submitApplication(job) {
          submitted.push(job.id);
          return { ok: true, applicationId: `app-${job.id}` };
        },
        async checkMessages() {
          return [];
        },
      },
    },
    resumeStore: { async load() { return "resume"; } },
    llm: {
      async generateResumePatch({ job }) {
        return { summary: `summary:${job.id}`, resumeText: "resume" };
      },
      async generateGreeting({ job }) {
        return `greeting:${job.id}`;
      },
    },
    config: {
      filters: {
        allowedCities: ["上海", "苏州"],
        requiredInternship: true,
        targetStartMonth: "2026-06",
      },
      limits: { maxApplicationsPerRun: 2 },
    },
  });

  const results = await team.run(["boss"]);

  assert.deepEqual(
    results.map((result) => result.status),
    ["skipped", "applied", "applied", "limit_reached", "no_messages"]
  );
  assert.deepEqual(submitted, ["boss-2", "boss-3"]);
  assert.equal(loginCount, 1);
});

test("agent team routes new messages to the chat agent", async () => {
  const sentReplies = [];
  const team = new JobApplicationAgentTeam({
    platforms: {
      boss: {
        name: "boss",
        startUrl: "url",
        async login() {},
        async getNextJob() {
          return null;
        },
        async submitApplication() {},
        async checkMessages() {
          return [{ threadId: "t-1", text: "方便发简历吗？" }];
        },
        async sendMessage(threadId, text) {
          sentReplies.push({ threadId, text });
        },
      },
    },
    resumeStore: { async load() { return "resume"; } },
    llm: {
      async generateChatReply({ message }) {
        return `可以的，针对「${message.text}」我稍后补充。`;
      },
    },
    config: { filters: {}, limits: { maxApplicationsPerRun: 1 } },
  });

  const result = await team.handleMessages("boss");

  assert.equal(result.status, "replied");
  assert.deepEqual(sentReplies, [
    {
      threadId: "t-1",
      text: "可以的，针对「方便发简历吗？」我稍后补充。",
    },
  ]);
});

test("agent team produces idle market research when no jobs or messages exist", async () => {
  const team = new JobApplicationAgentTeam({
    platforms: {
      nowcoder: {
        name: "nowcoder",
        startUrl: "url",
        async login() {},
        async getNextJob() {
          return null;
        },
        async submitApplication() {},
        async checkMessages() {
          return [];
        },
        async browseMarket() {
          return [
            { title: "AI 前端工程师", description: "React Agent" },
            { title: "Node.js 工程师", description: "自动化工具" },
          ];
        },
      },
    },
    resumeStore: { async load() { return "resume"; } },
    llm: {
      async summarizeMarket({ jobs }) {
        return `发现 ${jobs.length} 个岗位，React 和自动化工具出现频繁。`;
      },
    },
    config: { filters: {}, limits: { maxApplicationsPerRun: 1 } },
  });

  const result = await team.idleBrowse("nowcoder");

  assert.deepEqual(result, {
    status: "researched",
    summary: "发现 2 个岗位，React 和自动化工具出现频繁。",
  });
});

test("agent team routes LinkedIn to profile maintenance instead of job application", async () => {
  const calls = [];
  const team = new JobApplicationAgentTeam({
    platforms: {
      linkedin: {
        name: "linkedin",
        kind: "profile-maintenance",
        startUrl: "https://www.linkedin.com/feed/",
        async login() {
          calls.push("login");
        },
        async maintainProfile({ resume, profilePatch }) {
          calls.push(`maintain:${profilePatch.headline}:${resume}`);
          return { ok: true, status: "updated" };
        },
      },
    },
    resumeStore: { async load() { return "React Node.js resume"; } },
    llm: {
      async generateLinkedInProfilePatch({ resume }) {
        calls.push(`patch:${resume}`);
        return { headline: "Frontend Developer", about: resume, skills: ["React"] };
      },
    },
    config: { filters: {}, limits: { maxApplicationsPerRun: 1 } },
  });

  const result = await team.runOnce("linkedin");

  assert.equal(result.status, "profile_maintained");
  assert.deepEqual(calls, [
    "login",
    "patch:React Node.js resume",
    "maintain:Frontend Developer:React Node.js resume",
  ]);
});
