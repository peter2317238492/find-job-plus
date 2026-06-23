const {
  bossCityCodes,
  createBossQuery,
  createBossSearchUrl,
  isBossSecurityUrl,
  looksLikeBossJobCard,
  parseBossJobsFromPageText,
  parseBossListCardText,
  resolveBossReturnUrl,
} = require("../platforms_chrome/bossChromeAdapter");

function createBossAdapter({
  computerUse,
  allowedCities = [],
  targetStartMonth = "",
  requiredInternship = false,
} = {}) {
  let jobIndex = 1;
  const startUrl = createBossSearchUrl({
    query: createBossQuery({ requiredInternship, targetStartMonth }),
    cityCode: resolveBossCityCode(allowedCities),
  });

  return {
    name: "boss",
    startUrl,

    async login() {
      return requireComputerUse(computerUse).request({
        platform: "boss",
        action: "login",
        targetUrl: this.startUrl,
        instructions:
          "Open Boss Zhipin in the user's browser, complete QR/security login if needed, and stop on a job list page.",
        expect: "Return once the Boss account is logged in and the job list is visible.",
      });
    },

    async getNextJob() {
      const result = await requireComputerUse(computerUse).request({
        platform: "boss",
        action: "read-next-job",
        targetUrl: this.startUrl,
        input: {
          index: jobIndex,
          allowedCities,
          targetStartMonth,
          requiredInternship,
        },
        instructions:
          "Inspect the next Boss job card in the visible browser. Return a normalized job object with id, title, company, location, salary, recruiterActivity, and description. Do not submit or message.",
        expect: "Return { job } when a job is found, or { job: null } when no more jobs are visible.",
      });

      const job = normalizeComputerUseJob(result.job, "boss", jobIndex);
      if (job) {
        jobIndex += 1;
      }
      return job;
    },

    async submitApplication(job, outreach) {
      return requireComputerUse(computerUse).request({
        platform: "boss",
        action: "submit-application",
        targetUrl: this.startUrl,
        input: {
          job,
          greeting: outreach.greeting,
          resumeSummary: outreach.resumePatch?.summary || "",
          renderedResume: outreach.renderedResume || null,
        },
        instructions:
          "Using the existing browser session, open the selected Boss job, click the communicate/apply control, paste the approved greeting exactly, send it, and return to the job list.",
        expect: "Return { ok: true, platform: 'boss', jobId, sentText } after the message is sent.",
      });
    },

    async discardCurrentJob(job, decision) {
      return requireComputerUse(computerUse).request({
        platform: "boss",
        action: "discard-current-job",
        targetUrl: this.startUrl,
        input: { job, reasons: decision?.reasons || [] },
        instructions:
          "Move past the current Boss job without applying. Keep the browser on the job list and ready for the next card.",
        expect: "Return after the current job has been skipped.",
      });
    },

    async checkMessages() {
      const result = await requireComputerUse(computerUse).request({
        platform: "boss",
        action: "check-messages",
        targetUrl: this.startUrl,
        instructions:
          "Check Boss messages in the browser without sending replies. Return new low-risk HR messages as threadId/text pairs.",
        expect: "Return { messages: [] } when there are no new messages.",
      });
      return Array.isArray(result.messages) ? result.messages : [];
    },

    async sendMessage(threadId, text) {
      return requireComputerUse(computerUse).request({
        platform: "boss",
        action: "send-message",
        targetUrl: this.startUrl,
        input: { threadId, text },
        instructions:
          "Open the requested Boss message thread, paste the approved reply exactly, and send it.",
        expect: "Return { threadId, text, sent: true } after sending.",
      });
    },

    async browseMarket() {
      const result = await requireComputerUse(computerUse).request({
        platform: "boss",
        action: "browse-market",
        targetUrl: this.startUrl,
        input: { allowedCities, targetStartMonth, requiredInternship },
        instructions:
          "Browse Boss job listings without applying or messaging. Extract representative market jobs for trend summary.",
        expect: "Return { jobs: [] } if no market data is available.",
      });
      return Array.isArray(result.jobs) ? result.jobs : [];
    },
  };
}

function normalizeComputerUseJob(job, platform, index) {
  if (!job || typeof job !== "object") {
    return null;
  }

  return {
    id: job.id || `${platform}-${index}`,
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    salary: job.salary || "",
    recruiterActivity: job.recruiterActivity || "",
    description: job.description || "",
    url: job.url || "",
  };
}

function requireComputerUse(computerUse) {
  if (!computerUse || typeof computerUse.request !== "function") {
    throw new Error("Platform computer operation must be routed through computer-use-agent.");
  }
  return computerUse;
}

function resolveBossCityCode(allowedCities = []) {
  const city = allowedCities.find((name) => bossCityCodes[name]);
  return city ? bossCityCodes[city] : "";
}

module.exports = {
  bossCityCodes,
  createBossAdapter,
  createBossQuery,
  createBossSearchUrl,
  isBossSecurityUrl,
  looksLikeBossJobCard,
  parseBossJobsFromPageText,
  parseBossListCardText,
  resolveBossReturnUrl,
};
