const { loadCodexOpenAIConfig, loadConfig } = require("./src/config");
const { JobApplicationAgentTeam } = require("./src/agents/agentTeam");
const { createJobAssistant } = require("./src/llm/openaiClient");
const { createPlatformRegistry } = require("./src/platforms");
const { ResumeStore } = require("./src/resumeStore");
const { createGuiServer } = require("./src/gui/server");

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

  const registry = createPlatformRegistry({ browser: config.browser, filters: config.filters });
  const llm = createJobAssistant({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model,
  });
  console.log(`OpenAI config: apiKey=${config.apiKey ? "loaded" : "missing"}, baseURL=${config.baseURL}`);
  const resumeStore = new ResumeStore({ resumePath: config.resumePath });

  const team = new JobApplicationAgentTeam({
    platforms: registry.all(),
    resumeStore,
    llm,
    config,
    eventSink: gui ? (event) => gui.applyEvent(event) : undefined,
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

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parsePlatformArgs,
};
