const { sleep } = require("../utils");
const { createSeleniumDriver } = require("./seleniumFactory");

const selectors = {
  loginEntry: css(".js-login, .login-btn, [data-card-click*='login']"),
  loginSuccess: css(".nowcoder-header .user-card, .user-avatar, .profile-icon"),
  jobCard: (index) =>
    xpath(`(//*[contains(@class,'job-card') or contains(@class,'recruit')])[${index}]`),
  title: css(".job-name, .job-title, [class*='jobName']"),
  company: css(".company-name, [class*='company']"),
  salary: css(".salary, [class*='salary']"),
  description: css(".job-detail, .job-desc, [class*='description']"),
  applyButton: xpath("//*[contains(text(),'投递') or contains(text(),'立即申请')]"),
  messageInput: css("textarea, [contenteditable='true']"),
};

function createNowcoderAdapter({ browser = "chrome", driverFactory = createSeleniumDriver } = {}) {
  let driver;
  let jobIndex = 1;

  return {
    name: "nowcoder",
    startUrl: "https://www.nowcoder.com/jobs/recommend",

    async login() {
      const { until } = getSelenium();
      driver = driver || (await driverFactory(browser));
      await driver.get(this.startUrl);

      try {
        const login = await driver.wait(until.elementLocated(selectors.loginEntry), 8000);
        await login.click();
      } catch (error) {
        return;
      }

      await driver.wait(until.elementLocated(selectors.loginSuccess), 60000);
    },

    async getNextJob() {
      try {
        const card = await driver.findElement(selectors.jobCard(jobIndex));
        await card.click();
        await sleep(1000);

        const job = {
          id: `nowcoder-${jobIndex}`,
          title: await optionalText(driver, selectors.title),
          company: await optionalText(driver, selectors.company),
          salary: await optionalText(driver, selectors.salary),
          recruiterActivity: "",
          description: await optionalText(driver, selectors.description),
        };

        jobIndex += 1;
        return job.title || job.description ? job : null;
      } catch (error) {
        return null;
      }
    },

    async submitApplication(job, outreach) {
      const applyButton = await driver.findElement(selectors.applyButton);
      await applyButton.click();
      await sleep(1500);

      try {
        await sendMessageToInput(driver, selectors.messageInput, outreach.greeting);
      } catch (error) {
        return {
          ok: true,
          platform: "nowcoder",
          jobId: job.id,
          sentText: "",
          note: "Nowcoder application submitted; no message input was detected.",
        };
      }

      return {
        ok: true,
        platform: "nowcoder",
        jobId: job.id,
        sentText: outreach.greeting,
      };
    },

    async checkMessages() {
      return [];
    },

    async sendMessage(threadId, text) {
      return { threadId, text, sent: false, reason: "Nowcoder message selectors not configured yet" };
    },

    async browseMarket() {
      return [];
    },
  };
}

async function sendMessageToInput(driver, inputSelector, text) {
  const { Key } = getSelenium();
  const input = await driver.findElement(inputSelector);
  await input.sendKeys(text);
  await sleep(1000);
  await input.sendKeys(Key.RETURN);
}

async function optionalText(root, selector) {
  try {
    const element = await root.findElement(selector);
    return element.getText();
  } catch (error) {
    return "";
  }
}

function getSelenium() {
  return require("selenium-webdriver");
}

function css(value) {
  return {
    using: "css selector",
    value,
  };
}

function xpath(value) {
  return {
    using: "xpath",
    value,
  };
}

module.exports = {
  createNowcoderAdapter,
  selectors,
};
