const { sleep } = require("../utils");
const { createSeleniumDriver } = require("./seleniumFactory");

const selectors = {
  loginButton: xpath("//*[@id='header']/div[1]/div[3]/div/a"),
  wechatLogin: xpath("//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a"),
  wechatLogo: xpath("//*[@id='wrap']/div/div[2]/div[2]/div[1]/div[2]/div[1]/img"),
  loginSuccess: xpath("//*[@id='header']/div[1]/div[3]/ul/li[2]/a"),
  description: xpath("//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p"),
  title: xpath("//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[1]/h1"),
  company: xpath("//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[1]/div/a"),
  salary: xpath("//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[1]/span"),
  location: css(".job-location, .location-address, [class*='location']"),
  listCards: css("li:has(a.job-info), li:has(.job-info), .job-card-box, [class*='job-card']"),
  contactButton: xpath("//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[2]/a[2]"),
  chatInput: xpath("//*[@id='chat-input']"),
};

const bossCityCodes = {
  上海: "101020100",
  苏州: "101190400",
};

function createBossAdapter({
  browser = "chrome",
  driverFactory = createSeleniumDriver,
  allowedCities = [],
  targetStartMonth = "",
  requiredInternship = false,
} = {}) {
  let driver;
  let jobIndex = 1;
  const startUrl = "https://www.zhipin.com/";

  return {
    name: "boss",
    startUrl,

    async login() {
      const { until } = getSelenium();
      driver = driver || (await driverFactory(browser));
      await driver.get(this.startUrl);

      if (await isLoggedIn(driver)) {
        return;
      }

      await driver.wait(until.elementLocated(selectors.loginButton), 10000);

      const loginButton = await driver.findElement(selectors.loginButton);
      await loginButton.click();
      await driver.wait(until.elementLocated(selectors.wechatLogin), 10000);

      const wechatButton = await driver.findElement(selectors.wechatLogin);
      await wechatButton.click();
      await driver.wait(until.elementLocated(selectors.wechatLogo), 10000);
      await waitForBossLogin(driver, this.startUrl, 10 * 60 * 1000);
    },

    async getNextJob() {
      const { By, until } = getSelenium();
      try {
        await waitForBossSecurityCheck(driver, 10 * 60 * 1000);
        const currentJob = await getCurrentListJob(driver, jobIndex, 10 * 60 * 1000);
        if (currentJob) {
          jobIndex += 1;
          return currentJob;
        }

        const selector = By.xpath(
          `//*[@id='wrap']/div[2]/div[2]/div/div/div[1]/ul/li[${jobIndex}]`
        );
        const jobElement = await driver.findElement(selector);
        await jobElement.click();
        await driver.wait(until.elementLocated(selectors.description), 10000);

        const job = {
          id: `boss-${jobIndex}`,
          title: await optionalText(driver, selectors.title),
          company: await optionalText(driver, selectors.company),
          location: await optionalText(driver, selectors.location),
          salary: await optionalText(driver, selectors.salary),
          recruiterActivity: await optionalText(jobElement, By.css(".job-info .gray, .boss-info")),
          description: await requiredText(driver, selectors.description),
        };

        jobIndex += 1;
        return job;
      } catch (error) {
        return null;
      }
    },

    async submitApplication(job, outreach) {
      const { until } = getSelenium();
      const contactButton = await driver.findElement(selectors.contactButton);
      await contactButton.click();
      await driver.wait(until.elementLocated(selectors.chatInput), 10000);

      await sendMessageToInput(driver, selectors.chatInput, outreach.greeting);
      await goBackWithKeyboard(driver);
      await sleep(2000);

      return {
        ok: true,
        platform: "boss",
        jobId: job.id,
        sentText: outreach.greeting,
      };
    },

    async discardCurrentJob() {
      await goBackWithKeyboard(driver);
      await sleep(1000);
    },

    async checkMessages() {
      return [];
    },

    async sendMessage(threadId, text) {
      return { threadId, text, sent: false, reason: "Boss message selectors not configured yet" };
    },

    async browseMarket() {
      return [];
    },
  };
}

async function sendMessageToInput(driver, inputSelector, text) {
  const { Key } = getSelenium();
  const chatBox = await driver.findElement(inputSelector);
  await chatBox.clear();
  await typeSlowly(chatBox, text);
  await sleep(1000);
  await chatBox.sendKeys(Key.RETURN);
  await sleep(2000);
}

async function typeSlowly(element, text) {
  for (const char of String(text)) {
    await element.sendKeys(char);
    await sleep(35);
  }
}

async function goBackWithKeyboard(driver) {
  const { Key } = getSelenium();
  await driver.actions().keyDown(Key.ALT).sendKeys(Key.ARROW_LEFT).keyUp(Key.ALT).perform();
}

async function requiredText(root, selector) {
  const element = await root.findElement(selector);
  return element.getText();
}

async function optionalText(root, selector) {
  try {
    const element = await root.findElement(selector);
    return element.getText();
  } catch (error) {
    return "";
  }
}

async function isLoggedIn(driver) {
  try {
    await driver.findElement(selectors.loginSuccess);
    return true;
  } catch (error) {
    return false;
  }
}

async function waitForBossLogin(driver, startUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await switchToBossWindow(driver, startUrl);

    if (await isLoggedIn(driver)) {
      return;
    }

    await sleep(2000);
  }

  throw new Error("Boss login timed out. Complete the QR login in the opened Chrome window.");
}

async function waitForBossSecurityCheck(driver, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const currentUrl = await driver.getCurrentUrl();
    if (!isBossSecurityUrl(currentUrl)) {
      return;
    }

    await sleep(2000);
  }

  throw new Error("Boss security verification is still pending. Complete it in Chrome before continuing.");
}

async function switchToBossWindow(driver, startUrl) {
  const handles = await driver.getAllWindowHandles();
  for (const handle of handles) {
    await driver.switchTo().window(handle);
    const currentUrl = await driver.getCurrentUrl();
    if (resolveBossReturnUrl(currentUrl, startUrl) === currentUrl) {
      return;
    }
  }
}

function getSelenium() {
  return require("selenium-webdriver");
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

async function getCurrentListJob(driver, jobIndex, timeoutMs) {
  const { By } = getSelenium();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const elements = await driver.findElements(selectors.listCards);
    const candidates = [];
    for (const element of elements) {
      const text = await element.getText();
      if (looksLikeBossJobCard(text)) {
        candidates.push({ element, text });
      }
    }

    const candidate = candidates[jobIndex - 1];
    if (candidate) {
      const parsed = parseBossListCardText(candidate.text);
      if (!parsed.title) {
        return null;
      }

      return {
        id: `boss-${jobIndex}`,
        ...parsed,
        recruiterActivity: "",
        element: candidate.element,
      };
    }

    await sleep(2000);
  }

  return null;
}

function looksLikeBossJobCard(text) {
  return Boolean(text && /(?:元\/天|\d+\s*-\s*\d+\s*[kK]|实习)/.test(text) && /(?:上海|苏州)/.test(text));
}

function parseBossListCardText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const salaryIndex = lines.findIndex((line) => /元\/天|\d+\s*-\s*\d+\s*[kK]|薪/.test(line));
  const locationIndex = lines.findIndex((line) => /(?:上海|苏州)[·\s-]/.test(line));
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

function isBossSecurityUrl(currentUrl) {
  try {
    const url = new URL(currentUrl);
    return url.hostname.endsWith("zhipin.com") && url.pathname.includes("/security.html");
  } catch (error) {
    return false;
  }
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
  createBossAdapter,
  createBossQuery,
  createBossSearchUrl,
  isBossSecurityUrl,
  parseBossListCardText,
  resolveBossReturnUrl,
  selectors,
};
