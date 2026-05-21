const { BaseChromeAdapter } = require("./baseChromeAdapter");

function createNowcoderChromeAdapter(options = {}) {
  return new NowcoderChromeAdapter(options);
}

class NowcoderChromeAdapter extends BaseChromeAdapter {
  constructor({ maxJobsPerFetch = 20, ...baseOptions } = {}) {
    super({
      name: "nowcoder",
      startUrl: "https://www.nowcoder.com/jobs/recommend",
      ...baseOptions,
    });
    this.maxJobsPerFetch = maxJobsPerFetch;
    this.jobs = [];
    this.jobIndex = 0;
  }

  async login() {
    await this.openStartPage();
    const text = await this.pageText();
    if (isNowcoderLoggedInText(text)) {
      return { ok: true, alreadyLoggedIn: true };
    }

    await this.clickByText(["登录", "扫码登录"], { optional: true });
    await this.waitForLoggedIn({
      markers: [/消息|我的|简历|投递|职位/],
      prompt: "请在 Chrome 中完成牛客网登录或扫码；登录后停留在职位页面继续。",
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
    await this.controller.openPage(this.startUrl);
    await this.waitLikeHuman();
    let text = await this.pageText();
    this.jobs = parseNowcoderJobsFromPageText(text, { limit: this.maxJobsPerFetch });
    this.jobIndex = 0;

    if (!this.jobs.length) {
      await this.scroll(700);
      text = await this.pageText();
      this.jobs = parseNowcoderJobsFromPageText(text, { limit: this.maxJobsPerFetch });
    }

    return this.jobs;
  }

  async submitApplication(job, outreach) {
    await this.openJob(job);
    await this.promptForHuman({
      title: "Nowcoder application confirmation required",
      message:
        `已为该牛客岗位准备好问候语，请在 Chrome 中人工核对岗位、简历摘要和申请内容后手动点击申请/投递。\n\n${outreach.greeting}`,
      platform: this.name,
      job,
      outreach,
    });

    return {
      ok: true,
      platform: "nowcoder",
      jobId: job.id,
      sentText: outreach.greeting,
      status: "awaiting_user_action",
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

  async checkMessages() {
    return [];
  }

  async sendMessage(threadId, text) {
    return { threadId, text, sent: false, reason: "Nowcoder Chrome message polling is not calibrated yet" };
  }

  async browseMarket() {
    const text = await this.pageText();
    return parseNowcoderJobsFromPageText(text, { limit: 10 });
  }
}

function isNowcoderLoggedInText(text) {
  return /消息|我的|简历|投递|职位/.test(String(text || ""));
}

function parseNowcoderJobsFromPageText(text, { limit = 20 } = {}) {
  const normalized = String(text || "").replace(/\r/g, "");
  const chunks = normalized
    .split(/\n{2,}|(?=\n[^\n]{2,50}(?:实习|工程师|开发|算法|产品|运营|测试|数据)[^\n]{0,40}\n)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const jobs = [];

  for (const chunk of chunks) {
    if (!looksLikeNowcoderJobCard(chunk)) {
      continue;
    }
    const parsed = parseNowcoderJobCardText(chunk);
    if (!parsed.title || jobs.some((job) => job.title === parsed.title && job.company === parsed.company)) {
      continue;
    }
    jobs.push({
      id: `nowcoder-${jobs.length + 1}`,
      platform: "nowcoder",
      ...parsed,
      recruiterActivity: "",
    });
    if (jobs.length >= limit) {
      break;
    }
  }

  if (!jobs.length && looksLikeNowcoderJobCard(normalized)) {
    const parsed = parseNowcoderJobCardText(normalized);
    if (parsed.title) {
      jobs.push({
        id: "nowcoder-1",
        platform: "nowcoder",
        ...parsed,
        recruiterActivity: "",
      });
    }
  }

  return jobs;
}

function looksLikeNowcoderJobCard(text) {
  return Boolean(
    text &&
      /(?:投递|申请|急招|校招|社招|实习|元\/天|\d+\s*[-~－]\s*\d+\s*[kK]|薪|面议)/.test(text) &&
      /(?:上海|苏州|北京|深圳|广州|杭州|成都|南京|武汉|远程|全国)/.test(text)
  );
}

function parseNowcoderJobCardText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(立即申请|投递|申请职位|收藏)$/.test(line));
  const salaryIndex = lines.findIndex((line) => /元\/天|\d+\s*[-~－]\s*\d+\s*[kK]|薪|面议/.test(line));
  const locationIndex = lines.findIndex((line) =>
    /(?:上海|苏州|北京|深圳|广州|杭州|成都|南京|武汉|远程|全国)(?:[·\s-]|$)/.test(line)
  );
  const title = lines.find((line) => /实习|工程师|开发|算法|产品|运营|测试|数据/.test(line)) || lines[0] || "";
  const salary = salaryIndex >= 0 ? lines[salaryIndex] : "";
  const location = locationIndex >= 0 ? lines[locationIndex] : "";
  const company = findCompany(lines, title, salaryIndex, locationIndex);

  return {
    title,
    salary,
    company,
    location,
    description: lines.join("\n"),
  };
}

function findCompany(lines, title, salaryIndex, locationIndex) {
  const candidates = lines.filter(
    (line) =>
      line !== title &&
      !/元\/天|\d+\s*[-~－]\s*\d+\s*[kK]|薪|面议/.test(line) &&
      !/(?:上海|苏州|北京|深圳|广州|杭州|成都|南京|武汉|远程|全国)(?:[·\s-]|$)/.test(line) &&
      !/实习|工程师|开发|算法|产品|运营|测试|数据|经验|学历/.test(line)
  );

  if (candidates.length) {
    return candidates[0];
  }

  if (locationIndex > 0) {
    return lines[locationIndex - 1] || "";
  }
  if (salaryIndex >= 0) {
    return lines[salaryIndex + 1] || "";
  }
  return "";
}

module.exports = {
  NowcoderChromeAdapter,
  createNowcoderAdapter: createNowcoderChromeAdapter,
  createNowcoderChromeAdapter,
  isNowcoderLoggedInText,
  looksLikeNowcoderJobCard,
  parseNowcoderJobCardText,
  parseNowcoderJobsFromPageText,
};
