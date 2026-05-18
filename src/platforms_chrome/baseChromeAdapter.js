const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { sleep } = require("../utils");

class BaseChromeAdapter {
  constructor({
    name,
    startUrl,
    controller,
    logger = console,
    humanDelayRangeMs = [700, 2200],
    promptForHuman,
  } = {}) {
    if (!name) {
      throw new Error("Chrome adapter requires a name");
    }
    if (!startUrl) {
      throw new Error(`Chrome adapter ${name} requires a startUrl`);
    }

    this.name = name;
    this.startUrl = startUrl;
    this.controller = controller || new ManualChromeController({ logger });
    this.logger = logger;
    this.humanDelayRangeMs = humanDelayRangeMs;
    this.promptForHuman = promptForHuman || defaultPromptForHuman;
  }

  async openStartPage() {
    await this.controller.openPage(this.startUrl);
    await this.waitLikeHuman();
  }

  async waitLikeHuman(multiplier = 1) {
    const [min, max] = this.humanDelayRangeMs;
    const delay = randomBetween(min, max) * multiplier;
    await sleep(delay);
  }

  async pageText() {
    if (typeof this.controller.getPageText !== "function") {
      return "";
    }
    return this.controller.getPageText();
  }

  async pageUrl() {
    if (typeof this.controller.getCurrentUrl !== "function") {
      return "";
    }
    return this.controller.getCurrentUrl();
  }

  async waitForText(patterns, { timeoutMs = 120000, intervalMs = 2000 } = {}) {
    const expected = Array.isArray(patterns) ? patterns : [patterns];
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const text = await this.pageText();
      const matched = expected.find((pattern) => matchesPattern(text, pattern));
      if (matched) {
        return { matched, text };
      }
      await sleep(intervalMs);
    }

    throw new Error(`${this.name} timed out waiting for page text: ${expected.join(", ")}`);
  }

  async waitForLoggedIn({ markers, prompt, timeoutMs = 10 * 60 * 1000 } = {}) {
    this.logger.info?.(prompt);
    await this.promptForHuman({
      title: `${this.name} login required`,
      message: prompt,
      platform: this.name,
    });
    return this.waitForText(markers, { timeoutMs, intervalMs: 3000 });
  }

  async clickByText(labels, options = {}) {
    return this.controller.clickByText(Array.isArray(labels) ? labels : [labels], options);
  }

  async typeText(text, options = {}) {
    return this.controller.typeText(text, options);
  }

  async pressKey(keys, options = {}) {
    return this.controller.pressKey(keys, options);
  }

  async scroll(deltaY = 600, options = {}) {
    return this.controller.scroll(deltaY, options);
  }

  async goBack() {
    if (typeof this.controller.goBack === "function") {
      await this.controller.goBack();
    } else {
      await this.pressKey(["Alt", "Left"]);
    }
    await this.waitLikeHuman();
  }
}

class ManualChromeController {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.currentUrl = "";
    this.transcript = [];
  }

  async openPage(url) {
    this.currentUrl = url;
    this.#record("openPage", { url });
    this.logger.info?.(`[manual-browser] Open in Chrome: ${url}`);
  }

  async getCurrentUrl() {
    return this.currentUrl;
  }

  async getPageText() {
    return "";
  }

  async clickByText(labels) {
    this.#record("clickByText", { labels });
    this.logger.info?.(`[manual-browser] Click visible text: ${labels.join(" / ")}`);
  }

  async typeText(text) {
    this.#record("typeText", { text });
    this.logger.info?.(`[manual-browser] Type ${String(text).length} chars`);
  }

  async pressKey(keys) {
    this.#record("pressKey", { keys });
    this.logger.info?.(`[manual-browser] Press key: ${Array.isArray(keys) ? keys.join("+") : keys}`);
  }

  async scroll(deltaY) {
    this.#record("scroll", { deltaY });
    this.logger.info?.(`[manual-browser] Scroll ${deltaY}`);
  }

  async goBack() {
    this.#record("goBack", {});
    this.logger.info?.("[manual-browser] Go back");
  }

  #record(action, payload) {
    this.transcript.push({
      at: new Date().toISOString(),
      action,
      ...payload,
    });
  }
}

function createScriptedChromeController({ pageTexts = [], currentUrl = "", logger = console } = {}) {
  const transcript = [];
  let textIndex = 0;
  let url = currentUrl;

  return {
    transcript,
    async openPage(nextUrl) {
      url = nextUrl;
      transcript.push({ action: "openPage", url: nextUrl });
    },
    async getCurrentUrl() {
      return url;
    },
    async getPageText() {
      const value = pageTexts[Math.min(textIndex, Math.max(pageTexts.length - 1, 0))] || "";
      if (textIndex < pageTexts.length - 1) {
        textIndex += 1;
      }
      transcript.push({ action: "getPageText", text: value });
      return value;
    },
    async clickByText(labels, options) {
      transcript.push({ action: "clickByText", labels, options });
    },
    async typeText(text, options) {
      transcript.push({ action: "typeText", text, options });
    },
    async pressKey(keys, options) {
      transcript.push({ action: "pressKey", keys, options });
    },
    async scroll(deltaY, options) {
      transcript.push({ action: "scroll", deltaY, options });
    },
    async goBack() {
      transcript.push({ action: "goBack" });
    },
    logger,
  };
}

async function defaultPromptForHuman({ message }) {
  if (!process.stdin.isTTY || process.env.CI === "true") {
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(`${message}\n完成后按 Enter 继续...`);
  } finally {
    rl.close();
  }
}

function matchesPattern(text, pattern) {
  if (pattern instanceof RegExp) {
    return pattern.test(text);
  }
  return String(text).includes(String(pattern));
}

function randomBetween(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return Number.isFinite(min) ? min : 1000;
  }
  return Math.round(min + Math.random() * (max - min));
}

module.exports = {
  BaseChromeAdapter,
  ManualChromeController,
  createScriptedChromeController,
  matchesPattern,
  randomBetween,
};
