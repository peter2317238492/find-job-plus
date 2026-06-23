const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FORBIDDEN_AUTOMATION_PATTERNS = [
  /selenium/i,
  /webdriver/i,
  /playwright/i,
  /puppeteer/i,
  /browser-use/i,
  /control-chrome/i,
  /control-in-app-browser/i,
  /browser-control/i,
];

test("runtime code and package manifests do not include non-computer-use automation tools", () => {
  const files = [
    ...listFiles(path.join(process.cwd(), "src")),
    path.join(process.cwd(), "main.js"),
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "package-lock.json"),
    path.join(process.cwd(), "yarn.lock"),
  ];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_AUTOMATION_PATTERNS) {
      assert.doesNotMatch(content, pattern, `${relative} must not contain ${pattern}`);
    }
  }
});

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(filePath));
    } else {
      files.push(filePath);
    }
  }

  return files;
}
