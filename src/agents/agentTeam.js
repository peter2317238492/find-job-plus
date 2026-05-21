const { isJobAllowed } = require("./jobFilter");
const { createInlineGuiExecutor } = require("../gui/computerUseExecutor");

class JobApplicationAgentTeam {
  constructor({
    platforms,
    resumeStore,
    llm,
    config,
    logger = console,
    eventSink = () => {},
    guiExecutor,
    resumeRenderer,
  }) {
    this.platforms = platforms;
    this.resumeStore = resumeStore;
    this.llm = llm;
    this.config = config || {};
    this.logger = logger;
    this.eventSink = eventSink;
    this.guiExecutor = guiExecutor || createInlineGuiExecutor();
    this.resumeRenderer = resumeRenderer;
    this.applicationCount = 0;
  }

  async runOnce(platformName) {
    const platform = this.#getPlatform(platformName);
    if (platform.kind === "profile-maintenance") {
      return this.maintainProfile(platformName);
    }

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
    const job = await this.#runGuiTask(platformName, {
      operation: "getNextJob",
      run: () => platform.getNextJob(),
    });
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
        await this.#runGuiTask(platformName, {
          operation: "discardCurrentJob",
          target: job.title || job.id,
          run: () => platform.discardCurrentJob(job, decision),
        });
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
    const renderedResume = await this.#renderResume({ platformName, resume, job, resumePatch });
    const greeting = await this.llm.generateGreeting({ resume, resumePatch, job });
    this.#emit({
      type: "agent:operation",
      agent: "computer-use-executor",
      operation: `提交岗位 ${job.title || job.id}`,
    });
    const application = await this.#runGuiTask(platformName, {
      operation: "submitApplication",
      target: job.title || job.id,
      priority: 10,
      run: () =>
        platform.submitApplication(job, {
          greeting,
          resumePatch,
          renderedResume,
        }),
    });

    const awaitingUserAction = application?.status === "awaiting_user_action";
    if (!awaitingUserAction) {
      this.applicationCount += 1;
    }
    this.#emit({
      type: "log",
      level: "info",
      message: awaitingUserAction
        ? `已准备 ${job.title || job.id}，等待用户确认投递`
        : `已投递 ${job.title || job.id}`,
    });

    return {
      status: awaitingUserAction ? "prepared" : "applied",
      job,
      resumePatch,
      renderedResume,
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
    const messages = await this.#runGuiTask(platformName, {
      operation: "checkMessages",
      run: () => platform.checkMessages(),
    });

    if (!messages.length) {
      return { status: "no_messages" };
    }

    const resume = await this.resumeStore.load();
    const replyDrafts = await Promise.all(
      messages.map(async (message) => {
        this.#emit({
          type: "agent:operation",
          agent: "chat-agent",
          operation: `回复会话 ${message.threadId}`,
        });
        const reply = await this.llm.generateChatReply({ resume, message });
        return { message, reply };
      })
    );

    const replies = [];
    for (const { message, reply } of replyDrafts) {
      this.#emit({
        type: "agent:operation",
        agent: "computer-use-executor",
        operation: `发送会话 ${message.threadId}`,
      });
      if (typeof platform.sendMessage === "function") {
        await this.#runGuiTask(platformName, {
          operation: "sendMessage",
          target: message.threadId,
          priority: 10,
          run: () => platform.sendMessage(message.threadId, reply),
        });
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
    const jobs = await this.#runGuiTask(platformName, {
      operation: "browseMarket",
      run: () => platform.browseMarket(),
    });
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

  async maintainProfile(platformName) {
    const platform = this.#getPlatform(platformName);
    if (typeof platform.maintainProfile !== "function") {
      throw new Error(`Platform does not support profile maintenance: ${platformName}`);
    }

    this.#emit({
      type: "platform:active",
      platform: platformName,
      url: platform.startUrl,
    });
    await this.#ensurePlatformLoggedIn(platformName, platform);

    const resume = await this.resumeStore.load();
    this.#emit({
      type: "agent:operation",
      agent: "resume-agent",
      operation: `为 ${platformName} 生成个人资料维护草稿`,
    });
    const profilePatch =
      typeof this.llm.generateLinkedInProfilePatch === "function"
        ? await this.llm.generateLinkedInProfilePatch({ resume })
        : { summary: resume };

    this.#emit({
      type: "agent:operation",
      agent: "platform-agent",
      operation: `维护 ${platformName} 个人资料`,
    });
    const maintenance = await this.#runGuiTask(platformName, {
      operation: "maintainProfile",
      target: platformName,
      priority: 10,
      run: () => platform.maintainProfile({ resume, profilePatch }),
    });
    this.#emit({
      type: "log",
      level: "info",
      message:
        maintenance.status === "unchanged"
          ? `${platformName} 个人资料无需更新`
          : `已维护 ${platformName} 个人资料`,
    });

    return {
      status: "profile_maintained",
      profilePatch,
      maintenance,
    };
  }

  async run(platformNames) {
    const results = [];
    for (const platformName of platformNames) {
      const platform = this.#getPlatform(platformName);
      if (platform.kind === "profile-maintenance") {
        results.push(await this.maintainProfile(platformName));
        continue;
      }

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
    await this.#runGuiTask(platformName, {
      operation: "login",
      target: platform.startUrl,
      priority: 20,
      run: () => platform.login(),
    });
    this.loggedInPlatforms.add(platformName);
  }

  async #runGuiTask(platformName, task) {
    return this.guiExecutor.enqueue({
      platform: platformName,
      ...task,
    });
  }

  async #renderResume({ platformName, resume, job, resumePatch }) {
    if (!this.resumeRenderer || typeof this.resumeRenderer.render !== "function") {
      return null;
    }

    this.#emit({
      type: "agent:operation",
      agent: "resume-agent",
      operation: `生成 ${job.title || job.id} 的 Typst 简历`,
    });
    const rendered = await this.resumeRenderer.render({
      platform: platformName,
      resume,
      job,
      resumePatch,
    });
    if (rendered) {
      Object.assign(resumePatch, {
        typstPath: rendered.typstPath,
        pdfPath: rendered.pdfPath,
        compileStatus: rendered.compileStatus,
      });
    }
    return rendered;
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
