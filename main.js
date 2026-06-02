const { loadCodexOpenAIConfig, loadConfig } = require("./src/config");
const { JobApplicationAgentTeam } = require("./src/agents/agentTeam");
const { createJobAssistant } = require("./src/llm/openaiClient");
const { createPlatformRegistry } = require("./src/platforms");
const { ResumeStore } = require("./src/resumeStore");
const { createGuiServer } = require("./src/gui/server");
const { ComputerUseExecutor } = require("./src/gui/computerUseExecutor");
const { GuiTaskQueue } = require("./src/gui/taskQueue");
const { TypstResumeRenderer } = require("./src/resume/typstResumeRenderer");
const { CvSkillResumeRenderer } = require("./src/resume/cvSkillResumeRenderer");

async function main() {
  const codexOpenAI = await loadCodexOpenAIConfig();
  const config = loadConfig({
    apiKey: process.env.OPENAI_API_KEY || codexOpenAI.apiKey || "",
    baseURL: process.env.OPENAI_BASE_URL || codexOpenAI.baseURL || undefined,
  });
  const args = process.argv.slice(2);
  const platformNames = parsePlatformArgs(args);
  const gui = args.includes("--gui") ? createGuiServer() : null;

  if (gui) {
    const url = await gui.listen(Number(process.env.GUI_PORT || 3210));
    console.log(`GUI console: ${url}`);
  }

  const registry = createPlatformRegistry({
    browser: config.browser,
    filters: config.filters,
    linkedin: config.linkedin,
  });
  const llm = createJobAssistant({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
  });
  console.log(`OpenAI config: apiKey=${config.apiKey ? "loaded" : "missing"}, baseURL=${config.baseURL}`);
  const resumeStore = new ResumeStore({ resumePath: config.resumePath });
  const eventSink = gui ? (event) => gui.applyEvent(event) : undefined;
  const guiTaskQueue = new GuiTaskQueue({
    executor: new ComputerUseExecutor(),
    eventSink: eventSink || (() => {}),
  });
  const resumeRenderer = createResumeRenderer(config.tailoredResume);

  const team = new JobApplicationAgentTeam({
    platforms: registry.all(),
    resumeStore,
    llm,
    config,
    eventSink,
    guiExecutor: guiTaskQueue,
    resumeRenderer,
  });

  const results = await team.run(platformNames);
  for (const result of results) {
    console.log(JSON.stringify(result, null, 2));
  }
}

function parsePlatformArgs(args) {
  const platformArg = args.find((arg) => arg.startsWith("--platforms="));
  if (!platformArg) {
    return ["boss"];
  }

  return platformArg
    .replace("--platforms=", "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function createResumeRenderer(tailoredResume = {}) {
  if (!tailoredResume.enabled) {
    return null;
  }

  if (tailoredResume.renderer === "cv-skill") {
    return new CvSkillResumeRenderer({
      outputDir: tailoredResume.outputDir,
      skillRoot: tailoredResume.cvSkillRoot,
      compilePdf: tailoredResume.compilePdf,
      xelatexBin: tailoredResume.xelatexBin,
    });
  }

  return new TypstResumeRenderer({
    outputDir: tailoredResume.outputDir,
    templateDir: tailoredResume.templateDir,
    compilePdf: tailoredResume.compilePdf,
    typstBin: tailoredResume.typstBin,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  createResumeRenderer,
  main,
  parsePlatformArgs,
};
