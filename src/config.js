const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");

const DEFAULT_CONFIG = {
  browser: "chrome",
  model: "gpt-4o-mini",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  resumePath: process.env.RESUME_PATH || resolveDefaultResumePath(),
  tailoredResume: {
    enabled: process.env.TAILORED_RESUME_ENABLED !== "false",
    outputDir: process.env.TAILORED_RESUME_DIR || path.join(process.cwd(), "generated", "resumes"),
    templateDir: process.env.TYPST_TEMPLATE_DIR || path.join(process.cwd(), "Chinese-Resume-in-Typst-main"),
    compilePdf: process.env.ENABLE_RESUME_PDF === "true",
    typstBin: process.env.TYPST_BIN || "typst",
  },
  filters: {
    minSalaryK: Number(process.env.MIN_SALARY_K || 0),
    maxSalaryK: Number(process.env.MAX_SALARY_K || 999),
    activeWithinDays: Number(process.env.ACTIVE_WITHIN_DAYS || 7),
    blockedKeywords: parseList(process.env.BLOCKED_KEYWORDS || "外包,外派,驻场"),
    blockedCompanies: parseList(process.env.BLOCKED_COMPANIES || ""),
    allowedCities: parseList(process.env.ALLOWED_CITIES || ""),
    requiredInternship: process.env.REQUIRED_INTERNSHIP === "true",
    targetStartMonth: process.env.TARGET_START_MONTH || "",
  },
  limits: {
    maxApplicationsPerRun: Number(process.env.MAX_APPLICATIONS_PER_RUN || 20),
  },
  idleBrowsing: {
    enabled: process.env.IDLE_BROWSING_ENABLED === "true",
  },
  linkedin: {
    profileUrl: process.env.LINKEDIN_PROFILE_URL || "https://www.linkedin.com/in/me/",
  },
};

function parseList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDefaultResumePath(cwd = process.cwd()) {
  const textResume = path.join(cwd, "简历基本信息.txt");
  if (fsSync.existsSync(textResume)) {
    return textResume;
  }

  const pdfResume = path.join(cwd, "在线简历.pdf");
  if (fsSync.existsSync(pdfResume)) {
    return pdfResume;
  }

  return textResume;
}

function loadConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    filters: {
      ...DEFAULT_CONFIG.filters,
      ...(overrides.filters || {}),
    },
    limits: {
      ...DEFAULT_CONFIG.limits,
      ...(overrides.limits || {}),
    },
    idleBrowsing: {
      ...DEFAULT_CONFIG.idleBrowsing,
      ...(overrides.idleBrowsing || {}),
    },
    linkedin: {
      ...DEFAULT_CONFIG.linkedin,
      ...(overrides.linkedin || {}),
    },
    tailoredResume: {
      ...DEFAULT_CONFIG.tailoredResume,
      ...(overrides.tailoredResume || {}),
    },
  };
}

async function loadCodexOpenAIConfig({
  configPath = path.join(os.homedir(), ".codex", "config.toml"),
  authPath = path.join(os.homedir(), ".codex", "auth.json"),
} = {}) {
  const result = {};

  try {
    const config = await fs.readFile(configPath, "utf8");
    const openAISection = extractTomlSection(config, "model_providers.OpenAI");
    const baseURL = extractTomlString(openAISection, "base_url");
    if (baseURL) {
      result.baseURL = baseURL;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    const auth = JSON.parse(await fs.readFile(authPath, "utf8"));
    if (auth.OPENAI_API_KEY) {
      result.apiKey = auth.OPENAI_API_KEY;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return result;
}

function extractTomlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const header = `[${sectionName}]`;
  const section = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      if (inSection) {
        break;
      }
      inSection = trimmed === header;
      continue;
    }

    if (inSection) {
      section.push(line);
    }
  }

  return section.join("\n");
}

function extractTomlString(section, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m");
  const match = section.match(pattern);
  return match ? match[1] : "";
}

module.exports = {
  DEFAULT_CONFIG,
  loadCodexOpenAIConfig,
  loadConfig,
  parseList,
  resolveDefaultResumePath,
};
