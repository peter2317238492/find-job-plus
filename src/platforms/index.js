const { createBossAdapter } = require("./boss");
const { createNowcoderAdapter } = require("./nowcoder");
const { createLinkedInAdapter } = require("../platforms_chrome/linkedinAdapter");

function createPlatformRegistry(options = {}) {
  const filters = options.filters || {};
  const adapters = {
    boss: createBossAdapter({ ...options, ...filters, ...(options.boss || {}) }),
    nowcoder: createNowcoderAdapter({ ...options, ...filters, ...(options.nowcoder || {}) }),
    linkedin: createLinkedInAdapter({ ...options, ...(options.linkedin || {}) }),
  };

  return {
    names() {
      return Object.keys(adapters);
    },
    get(name) {
      const adapter = adapters[name];
      if (!adapter) {
        throw new Error(`Unknown platform: ${name}`);
      }
      return adapter;
    },
    all() {
      return adapters;
    },
  };
}

module.exports = {
  createPlatformRegistry,
};
