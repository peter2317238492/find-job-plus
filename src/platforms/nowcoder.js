const {
  isNowcoderLoggedInText,
  looksLikeNowcoderJobCard,
  parseNowcoderJobCardText,
  parseNowcoderJobsFromPageText,
} = require("../platforms_chrome/nowcoderChromeAdapter");

function createNowcoderAdapter({ computerUse } = {}) {
  let jobIndex = 1;
  const startUrl = "https://www.nowcoder.com/jobs/recommend";

  return {
    name: "nowcoder",
    startUrl,

    async login() {
      return requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "login",
        targetUrl: this.startUrl,
        instructions:
          "Open Nowcoder jobs in the user's browser, complete login if needed, and stop on the recommended jobs page.",
        expect: "Return once the account is logged in or the jobs page is accessible.",
      });
    },

    async getNextJob() {
      const result = await requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "read-next-job",
        targetUrl: this.startUrl,
        input: { index: jobIndex },
        instructions:
          "Inspect the next Nowcoder job card in the visible browser. Return a normalized job object with id, title, company, location, salary, recruiterActivity, and description. Do not submit or message.",
        expect: "Return { job } when a job is found, or { job: null } when no more jobs are visible.",
      });

      const job = normalizeComputerUseJob(result.job, "nowcoder", jobIndex);
      if (job) {
        jobIndex += 1;
      }
      return job;
    },

    async submitApplication(job, outreach) {
      return requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "submit-application",
        targetUrl: this.startUrl,
        input: {
          job,
          greeting: outreach.greeting,
          resumeSummary: outreach.resumePatch?.summary || "",
          renderedResume: outreach.renderedResume || null,
        },
        instructions:
          "Using the existing browser session, open the selected Nowcoder job, submit/apply, paste the approved greeting exactly if a message field is shown, and return to the job list.",
        expect: "Return { ok: true, platform: 'nowcoder', jobId, sentText } after submission.",
      });
    },

    async checkMessages() {
      const result = await requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "check-messages",
        targetUrl: this.startUrl,
        instructions:
          "Check Nowcoder messages in the browser without sending replies. Return new low-risk HR messages as threadId/text pairs.",
        expect: "Return { messages: [] } when there are no new messages.",
      });
      return Array.isArray(result.messages) ? result.messages : [];
    },

    async sendMessage(threadId, text) {
      return requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "send-message",
        targetUrl: this.startUrl,
        input: { threadId, text },
        instructions:
          "Open the requested Nowcoder message thread, paste the approved reply exactly, and send it.",
        expect: "Return { threadId, text, sent: true } after sending.",
      });
    },

    async browseMarket() {
      const result = await requireComputerUse(computerUse).request({
        platform: "nowcoder",
        action: "browse-market",
        targetUrl: this.startUrl,
        instructions:
          "Browse Nowcoder job listings without applying or messaging. Extract representative market jobs for trend summary.",
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

module.exports = {
  createNowcoderAdapter,
  isNowcoderLoggedInText,
  looksLikeNowcoderJobCard,
  parseNowcoderJobCardText,
  parseNowcoderJobsFromPageText,
};
