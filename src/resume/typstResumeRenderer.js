const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { bracket, escapeTypst } = require("./typstEscape");
const { createTailoredResume } = require("./resumeTailor");

class TypstResumeRenderer {
  constructor({
    outputDir = path.join(process.cwd(), "generated", "resumes"),
    templateDir = path.join(process.cwd(), "Chinese-Resume-in-Typst-main"),
    typstBin = process.env.TYPST_BIN || "typst",
    rootDir = process.cwd(),
    compilePdf = false,
    compiler,
    now = () => new Date(),
  } = {}) {
    this.outputDir = outputDir;
    this.templateDir = templateDir;
    this.typstBin = typstBin;
    this.rootDir = rootDir;
    this.compilePdf = compilePdf;
    this.compiler = compiler || compileTypst;
    this.now = now;
  }

  async render({ platform, resume, job, resumePatch }) {
    const tailored = createTailoredResume({ resume, job, resumePatch });
    const basename = createResumeBasename({
      date: this.now(),
      platform,
      job,
    });
    const typstPath = path.join(this.outputDir, `${basename}.typ`);
    const pdfPath = path.join(this.outputDir, `${basename}.pdf`);
    const typstSource = renderTypstSource({
      tailored,
      job,
      templateDir: this.templateDir,
      outputDir: this.outputDir,
    });

    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.writeFile(typstPath, typstSource, "utf8");

    const compileStatus = this.compilePdf
      ? await this.compiler({
          typstBin: this.typstBin,
          rootDir: this.rootDir,
          inputPath: typstPath,
          outputPath: pdfPath,
        })
      : { ok: false, skipped: true, reason: "disabled" };

    return {
      typstPath,
      pdfPath: compileStatus.ok ? pdfPath : "",
      compileStatus,
      tailored,
    };
  }
}

function renderTypstSource({ tailored, job, templateDir, outputDir = process.cwd() }) {
  const templateImport = relativeTypstPath(outputDir, path.join(templateDir, "template.typ"));
  const iconsDir = "icons";
  const theme = '#let theme-color = rgb("#26267d")';
  const skills = tailored.skills.length ? tailored.skills.join(" · ") : "基于原始简历的岗位相关技能";

  return [
    `#import "${templateImport}": *`,
    "",
    theme,
    "#let icon = icon.with(fill: theme-color)",
    `#let fa-code = icon("${iconsDir}/fa-code.svg")`,
    `#let fa-envelope = icon("${iconsDir}/fa-envelope.svg")`,
    `#let fa-graduation-cap = icon("${iconsDir}/fa-graduation-cap.svg")`,
    `#let fa-phone = icon("${iconsDir}/fa-phone.svg")`,
    `#let fa-wrench = icon("${iconsDir}/fa-wrench.svg")`,
    "",
    "#show: resume.with(",
    "  size: 10pt,",
    "  theme-color: theme-color,",
    "  margin: (top: 1.2cm, bottom: 1.5cm, left: 1.7cm, right: 1.7cm),",
    "  header-center: true,",
    ")[",
    `  = ${escapeTypst(tailored.name)}`,
    "",
    "  #info(",
    "    color: theme-color,",
    ...renderContactItems(tailored.contact),
    "  )",
    "][",
    `  *目标岗位：${escapeTypst(job.title || tailored.targetTitle)}*`,
    "",
    `  ${escapeTypst(tailored.summary)}`,
    "]",
    "",
    "== #fa-wrench 专业技能",
    "",
    escapeTypst(skills),
    "",
    "== #fa-code 岗位匹配亮点",
    "",
    renderBullets(tailored.highlights),
    "",
    renderProjects(tailored.projects),
    "",
    "== #fa-graduation-cap 原始简历摘录",
    "",
    escapeTypst(tailored.sourceExcerpt),
    "",
  ].join("\n");
}

function renderContactItems(contact) {
  const items = [];
  if (contact.phone) {
    items.push("    (");
    items.push("      icon: fa-phone,");
    items.push(`      content: ${bracket(contact.phone)},`);
    items.push("    ),");
  }
  if (contact.email) {
    items.push("    (");
    items.push("      icon: fa-envelope,");
    items.push(`      content: ${bracket(contact.email)},`);
    items.push(`      link: "mailto:${contact.email}",`);
    items.push("    ),");
  }
  if (!items.length) {
    items.push("    (content: [本地简历未解析到联系方式]),");
  }
  return items;
}

function renderBullets(items) {
  return items.map((item) => `- ${escapeTypst(item)}`).join("\n");
}

function renderProjects(projects) {
  if (!projects.length) {
    return "";
  }

  const blocks = ["== #fa-code 项目经历"];
  for (const project of projects) {
    blocks.push("");
    blocks.push("#item(");
    blocks.push(`  [ *${escapeTypst(project.name || "项目经历")}* ],`);
    blocks.push(`  ${bracket(project.role || project.description || "相关项目")},`);
    blocks.push(`  date[ ${escapeTypst(project.period || "")} ],`);
    blocks.push(")");
    if (project.tech) {
      blocks.push("");
      blocks.push(`#tech[ ${escapeTypst(project.tech)} ]`);
    }
    if (project.description) {
      blocks.push("");
      blocks.push(escapeTypst(project.description));
    }
    if (project.bullets.length) {
      blocks.push("");
      blocks.push(renderBullets(project.bullets));
    }
  }
  return blocks.join("\n");
}

function createResumeBasename({ date = new Date(), platform = "job", job = {} } = {}) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const id = slug(job.id || hash(`${job.company || ""}-${job.title || ""}`));
  const title = slug(job.title || "resume");
  return `${day}-${slug(platform)}-${id}-${title}`.slice(0, 120);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

function hash(value) {
  let result = 0;
  for (const char of String(value || "")) {
    result = (result * 31 + char.charCodeAt(0)) >>> 0;
  }
  return result.toString(16);
}

function relativeTypstPath(fromDir, toPath) {
  const relative = path.relative(fromDir, toPath).replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function compileTypst({ typstBin, rootDir = process.cwd(), inputPath, outputPath }) {
  return new Promise((resolve) => {
    const child = spawn(typstBin, ["compile", "--root", rootDir, inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

module.exports = {
  compileTypst,
  createResumeBasename,
  relativeTypstPath,
  renderTypstSource,
  TypstResumeRenderer,
};
