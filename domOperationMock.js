const { createScriptedChromeController } = require("./src/platforms_chrome/baseChromeAdapter");

function createDomOperationMock(options = {}) {
  return createScriptedChromeController(options);
}

module.exports = {
  createDomOperationMock,
};
