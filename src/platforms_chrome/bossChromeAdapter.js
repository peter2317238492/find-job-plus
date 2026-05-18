const { BaseChromeAdapter } = require("./baseChromeAdapter");

const bossCityCodes = {
  上海: "101020100",
  苏州: "101190400",
};

function createBossChromeAdapter(options = {}) {
  return new BossChromeAdapter(options);
}

class BossChromeAdapter extends BaseChromeAdapter {
  constructor({
    allowedCities = [],
    targetStartMonth = "",
    requiredInternship = false,
    maxJobsPerFetch = 20,
    ...baseOptions
  } = {}) {
    super({
      name: "boss",
      startUrl: "https://www.zhipin.com/",
      ...baseOptions,
    });

    this.allowedCities = allowedCities;
    this.targetStartMonth = targetStartMonth;
    this.requiredInternship = requiredInternship;
    this.maxJobsPerFetch = maxJobsPerFetch;
    this.jobIndex = 0;
    this.jobs = [];
  }

  async login() {
    await this.openStartPage();
    const text = await this.pageText();
    if (isBossLoggedInText(text)) {
      return { ok: true, alreadyLoggedIn: true };
    }

    await this.clickByText(["登录", "扫码登录", "微信登录"], { optional: true });
    await this.waitForLoggedIn({
      markers: [/消息|沟通|推荐职位|我的简历|上传简历/],
      prompt: "请在 Chrome 中完成 Boss 直聘登录或扫码；如出现安全验证，请手动完成验证后继续。",
    });

    return { ok: true };
  }

  async getNextJob() {
    if (!this.jobs.length || this.jobIndex >= this.jobs.length) {
      await this.fetchJobList();
    }

    const job = this.jobs[this.jobIndex] || null;
    this.jobIndex += 1;
    return job;
  }

  async fetchJobList() {
    await this.openSearchPage();
    const text = await this.pageText();
    this.jobs = parseBossJobsFromPageText(text, { limit: this.maxJobsPerFetch });
    this.jobIndex = 0;

    if (!this.jobs.length) {
      await this.scroll(700);
      const scrolledText = await this.pageText();
      this.jobs = parseBossJobsFromPageText(scrolledText, { limit: this.maxJobsPerFetch });
    }

    return this.jobs;
  }

  async openSearchPage() {
    const query = createBossQuery({
      requiredInternship: this.requiredInternship,
      targetStartMonth: this.targetStartMonth,
    });
    const cityCode = this.allowedCities.length === 1 ? bossCityCodes[this.allowedCities[0]] : "";
    const url = createBossSearchUrl({ query, cityCode });

    await this.controller.openPage(url);
    await this.waitLikeHuman();
  }

  async submitApplication(job, outreach) {
    await this.openJob(job);
    await this.clickByText(["立即沟通", "继续沟通", "开聊", "沟通"], { optional: false });
    await this.waitLikeHuman();
    await this.typeText(outreach.greeting, { multiline: false });
    await this.waitLikeHuman();
    await this.clickByText(["发送", "Send"], { optional: true });

    return {
      ok: true,
      platform: "boss",
      jobId: job.id,
      sentText: outreach.greeting,
    };
  }

  async openJob(job) {
    if (job.url) {
      await this.controller.openPage(job.url);
      await this.waitLikeHuman();
      return;
    }

    if (job.title) {
      await this.clickByText(job.title, { optional: false });
      await this.waitLikeHuman();
    }
  }

  async discardCurrentJob() {
    await this.waitLikeHuman(0.5);
  }

  async checkMessages() {
    return [];
  }

  async sendMessage(threadId, text) {
    return { threadId, text, sent: false, reason: "Boss Chrome message polling is not calibrated yet" };
  }

  async browseMarket() {
    const text = await this.pageText();
    return parseBossJobsFromPageText(text, { limit: 10 });
  }
}

function createBossSearchUrl({ query = "", cityCode } = {}) {
  if (!query && !cityCode) {
    return "https://www.zhipin.com/web/geek/job-recommend?ka=header-job-recommend";
  }

  const params = [];
  if (query) {
    params.push(`query=${encodeURIComponent(query)}`);
  }
  if (cityCode) {
    params.push(`city=${encodeURIComponent(cityCode)}`);
  }

  params.push("industry=");
  params.push("position=");

  return `https://www.zhipin.com/web/geek/jobs?${params.join("&")}`;
}

function createBossQuery({ requiredInternship = false, targetStartMonth = "" } = {}) {
  const parts = [];
  if (requiredInternship) {
    parts.push("实习");
  }
  if (targetStartMonth === "2026-06") {
    parts.push("2026年6月");
  } else if (targetStartMonth) {
    parts.push(targetStartMonth);
  }

  return parts.join(" ");
}

function isBossLoggedInText(text) {
  return /消息|沟通|我的简历|推荐职位|上传简历/.test(String(text || ""));
}

function isBossSecurityUrl(currentUrl) {
  try {
    const url = new URL(currentUrl);
    return url.hostname.endsWith("zhipin.com") && url.pathname.includes("/security.html");
  } catch (error) {
    return false;
  }
}

function resolveBossReturnUrl(currentUrl, startUrl) {
  try {
    const url = new URL(currentUrl);
    if (url.hostname.endsWith("zhipin.com")) {
      return currentUrl;
    }
  } catch (error) {
    return startUrl;
  }

  return startUrl;
}

function parseBossJobsFromPageText(text, { limit = 20 } = {}) {
  const normalized = String(text || "").replace(/\r/g, "");
  const chunks = normalized
    .split(/\n{2,}|(?=\n[^\n]{2,40}(?:实习|工程师|开发|算法|产品|运营|测试|数据)[^\n]{0,40}\n)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const jobs = [];

  for (const chunk of chunks) {
    if (!looksLikeBossJobCard(chunk)) {
      continue;
    }
    const parsed = parseBossListCardText(chunk);
    if (!parsed.title || jobs.some((job) => job.title === parsed.title && job.company === parsed.company)) {
      continue;
    }
    jobs.push({
      id: `boss-${jobs.length + 1}`,
      platform: "boss",
      ...parsed,
      recruiterActivity: parseRecruiterActivity(chunk),
    });
    if (jobs.length >= limit) {
      break;
    }
  }

  if (!jobs.length && looksLikeBossJobCard(normalized)) {
    const parsed = parseBossListCardText(normalized);
    if (parsed.title) {
      jobs.push({
        id: "boss-1",
        platform: "boss",
        ...parsed,
        recruiterActivity: parseRecruiterActivity(normalized),
      });
    }
  }

  return jobs;
}

function looksLikeBossJobCard(text) {
  return Boolean(
    text &&
      /(?:元\/天|\d+\s*[-~－]\s*\d+\s*[kK]|薪|面议)/.test(text) &&
      /(?:上海|苏州|北京|深圳|广州|杭州|成都|南京|武汉|远程)/.test(text)
  );
}

function parseBossListCardText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(立即沟通|继续沟通|收藏|反馈)$/.test(line));

  const salaryIndex = lines.findIndex((line) => /元\/天|\d+\s*[-~－]\s*\d+\s*[kK]|薪|面议/.test(line));
  const locationIndex = lines.findIndex((line) =>
    /(?:上海|苏州|北京|深圳|广州|杭州|成都|南京|武汉|远程)(?:[·\s-]|$)/.test(line)
  );
  const title = lines[0] || "";
  const salary = salaryIndex >= 0 ? lines[salaryIndex] : "";
  const location = locationIndex >= 0 ? lines[locationIndex] : "";
  const company =
    locationIndex > 0
      ? lines[locationIndex - 1]
      : salaryIndex >= 0 && lines.length > salaryIndex + 2
        ? lines[salaryIndex + 2]
        : "";

  return {
    title,
    salary,
    company,
    location,
    description: lines.join("\n"),
  };
}

function parseRecruiterActivity(text) {
  const match = String(text || "").match(/(?:今日|今天|刚刚|在线|活跃|\d+\s*(?:日|天|周|月)内?活跃)/);
  return match ? match[0] : "";
}

module.exports = {
  BossChromeAdapter,
  bossCityCodes,
  createBossAdapter: createBossChromeAdapter,
  createBossChromeAdapter,
  createBossQuery,
  createBossSearchUrl,
  isBossLoggedInText,
  isBossSecurityUrl,
  looksLikeBossJobCard,
  parseBossJobsFromPageText,
  parseBossListCardText,
  resolveBossReturnUrl,
};
