async function createSeleniumDriver(browser = "chrome") {
  if (browser !== "chrome") {
    throw new Error(`Unsupported browser type: ${browser}`);
  }

  const { Builder } = require("selenium-webdriver");
  const chrome = require("selenium-webdriver/chrome");
  const options = new chrome.Options();
  options.addArguments("--detach");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  await driver.manage().window().maximize();
  return driver;
}

module.exports = {
  createSeleniumDriver,
};
