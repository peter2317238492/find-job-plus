const { isJobAllowed } = require("./jobFilter");

class JobApplicationAgentTeam {
  constructor({ platforms, resumeStore, llm, config, logger = console, eventSink = () => {} }) {
    this.platforms = platforms;
    this.resumeStore = resumeStore;
    this.llm = llm;
    this.config = config || {};
    this.logger = logger;
    this.eventSink = eventSink;
    this.applicationCount = 0;
  }

  async runOnce(platformName) {
    const platform = this.#getPlatform(platformName);
    this.#emit({
      type: "platform:active",
      platform: platformName,
      url: platform.startUrl,
    });
    await this.#ensurePlatformLoggedIn(platformName, platform);

    if (this.#limitReached()) {
      return { status: "limit_reached" };
    }

    this.#emit({
      type: "agent:operation",
      agent: "platform-agent",
      operation: `读取 ${platformName} 下一个岗位`,
    });
    const job = await platform.getNextJob();
    if (!job) {
      return { status: "no_job" };
    }

    this.#emit({
      type: "agent:operation",
      agent: "job-filter-agent",
      operation: `过滤岗位 ${job.title || job.id}`,
    });
    const decision = isJobAllowed(job, this.config.filters || {});
    if (!decision.allowed) {
      this.logger.info?.(`跳过岗位 ${job.title || job.id}: ${decision.reasons.join("; ")}`);
      if (typeof platform.discardCurrentJob === "function") {
        await platform.discardCurrentJob(job, decision);
      }
      return {
        status: "skipped",
        job,
        reasons: decision.reasons,
      };
    }

    const resume = await this.resumeStore.load();
    this.#emit({
      type: "agent:operation",
      agent: "resume-agent",
      operation: `为岗位 ${job.title || job.id} 定制简历和问候语`,
    });
    const resumePatch = await this.llm.generateResumePatch({ resume, job });
    const greeting = await this.llm.generateGreeting({ resume, resumePatch, job });
    this.#emit({
      type: "agent:operation",
      agent: "platform-agent",
      operation: `提交岗位 ${job.title || job.id}`,
    });
    const application = await platform.submitApplication(job, {
      greeting,
      resumePatch,
    });

    this.applicationCount += 1;
    this.#emit({
      type: "log",
      level: "info",
      message: `已投递 ${job.title || job.id}`,
    });

    return {
      status: "applied",
      job,
      resumePatch,
      greeting,
      application,
    };
  }

  async handleMessages(platformName) {
    const platform = this.#getPlatform(platformName);
    this.#emit({
      type: "agent:operation",
      agent: "chat-agent",
      operation: `检查 ${platformName} 新消息`,
    });
    const messages = await platform.checkMessages();

    if (!messages.length) {
      return { status: "no_messages" };
    }

    const resume = await this.resumeStore.load();
    const replies = [];
    for (const message of messages) {
      this.#emit({
        type: "agent:operation",
        agent: "chat-agent",
        operation: `回复会话 ${message.threadId}`,
      });
      const reply = await this.llm.generateChatReply({ resume, message });
      if (typeof platform.sendMessage === "function") {
        await platform.sendMessage(message.threadId, reply);
      }
      replies.push({ threadId: message.threadId, reply });
    }

    return {
      status: "replied",
      replies,
    };
  }

  async idleBrowse(platformName) {
    const platform = this.#getPlatform(platformName);
    if (typeof platform.browseMarket !== "function") {
      return { status: "idle_disabled" };
    }

    this.#emit({
      type: "agent:operation",
      agent: "idle-market-agent",
      operation: `浏览 ${platformName} 市场信息`,
    });
    const jobs = await platform.browseMarket();
    if (!jobs.length) {
      return { status: "no_market_data" };
    }

    const summary = await this.llm.summarizeMarket({ jobs });
    this.#emit({
      type: "log",
      level: "info",
      message: summary,
    });
    return {
      status: "researched",
      summary,
    };
  }

  async run(platformNames) {
    const results = [];
    for (const platformName of platformNames) {
      const platform = this.#getPlatform(platformName);
      this.#emit({
        type: "platform:active",
        platform: platformName,
        url: platform.startUrl,
      });
      await this.#ensurePlatformLoggedIn(platformName, platform);

      while (!this.#limitReached()) {
        const result = await this.runOnce(platformName);
        results.push(result);

        if (result.status === "no_job" || result.status === "limit_reached") {
          break;
        }
      }

      if (this.#limitReached()) {
        results.push({ status: "limit_reached" });
      }

      results.push(await this.handleMessages(platformName));
      if (this.config.idleBrowsing?.enabled) {
        results.push(await this.idleBrowse(platformName));
      }
    }
    return results;
  }

  #getPlatform(platformName) {
    const platform = this.platforms[platformName];
    if (!platform) {
      throw new Error(`Unknown platform: ${platformName}`);
    }
    return platform;
  }

  #limitReached() {
    const limit = this.config.limits?.maxApplicationsPerRun;
    return Number.isFinite(limit) && this.applicationCount >= limit;
  }

  async #ensurePlatformLoggedIn(platformName, platform) {
    this.loggedInPlatforms = this.loggedInPlatforms || new Set();
    if (this.loggedInPlatforms.has(platformName)) {
      return;
    }

    this.#emit({
      type: "agent:operation",
      agent: "platform-agent",
      operation: `登录并打开 ${platformName}`,
    });
    await platform.login();
    this.loggedInPlatforms.add(platformName);
  }

  #emit(event) {
    this.eventSink({
      at: new Date().toISOString(),
      ...event,
    });
  }
}

module.exports = {
  JobApplicationAgentTeam,
};
