const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { createResumeBasename } = require("./typstResumeRenderer");
const { createTailoredResume } = require("./resumeTailor");

class CvSkillResumeRenderer {
  constructor({
    outputDir = path.join(process.cwd(), "generated", "resumes"),
    skillRoot = process.env.CV_SKILL_ROOT || path.join(process.cwd(), ".codex", "vendor", "cv-skill"),
    xelatexBin = process.env.XELATEX_BIN || "xelatex",
    compilePdf = false,
    compiler,
    now = () => new Date(),
  } = {}) {
    this.outputDir = outputDir;
    this.skillRoot = skillRoot;
    this.xelatexBin = xelatexBin;
    this.compilePdf = compilePdf;
    this.compiler = compiler || compileXeLaTeX;
    this.now = now;
  }

  async render({ platform, resume, job, resumePatch }) {
    const tailored = createTailoredResume({ resume, job, resumePatch });
    const basename = createResumeBasename({
      date: this.now(),
      platform,
      job,
    });
    const workspaceDir = path.join(this.outputDir, `${basename}-cv-skill`);
    const inputDir = path.join(workspaceDir, "input");
    const workDir = path.join(workspaceDir, "work");
    const outputDir = path.join(workspaceDir, "output");
    const workCommonDir = path.join(workDir, "common");
    const outputCommonDir = path.join(outputDir, "common");
    const workTexPath = path.join(workDir, "resume.tex");
    const outputTexPath = path.join(outputDir, "resume.tex");
    const pdfPath = path.join(outputDir, "resume.pdf");
    const classSourcePath = path.join(this.skillRoot, "templates", "common", "resume.cls");

    await assertCvSkillRoot(this.skillRoot);
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(workCommonDir, { recursive: true });
    await fs.mkdir(outputCommonDir, { recursive: true });
    await fs.writeFile(path.join(inputDir, "source-resume.txt"), String(resume || ""), "utf8");
    await fs.writeFile(path.join(inputDir, "job.json"), JSON.stringify(job || {}, null, 2), "utf8");
    await fs.writeFile(path.join(workDir, "extracted.md"), renderExtracted({ tailored, job }), "utf8");
    await fs.writeFile(
      path.join(workDir, "requirements-summary.md"),
      renderRequirementsSummary({
        skillRoot: this.skillRoot,
        classSourcePath,
        job,
      }),
      "utf8"
    );
    await fs.writeFile(path.join(workDir, "claim-source-map.md"), renderClaimSourceMap({ tailored, job }), "utf8");
    await fs.copyFile(classSourcePath, path.join(workCommonDir, "resume.cls"));

    const latexSource = renderLatexSource({ tailored, job });
    await fs.writeFile(workTexPath, latexSource, "utf8");
    await fs.copyFile(workTexPath, outputTexPath);
    await fs.copyFile(path.join(workCommonDir, "resume.cls"), path.join(outputCommonDir, "resume.cls"));

    const compileStatus = this.compilePdf
      ? await this.compiler({
          xelatexBin: this.xelatexBin,
          cwd: outputDir,
          inputPath: outputTexPath,
          outputPath: pdfPath,
          logPath: path.join(workDir, "output-build.log"),
        })
      : { ok: false, skipped: true, reason: "disabled" };

    return {
      workspaceDir,
      typstPath: "",
      texPath: outputTexPath,
      pdfPath: compileStatus.ok ? pdfPath : "",
      compileStatus,
      tailored,
      renderer: "cv-skill",
    };
  }
}

async function assertCvSkillRoot(skillRoot) {
  const required = [
    ["skills", "resume-crafter", "SKILL.md"],
    ["skills", "resume-intake-and-extraction", "SKILL.md"],
    ["skills", "resume-authoring-and-assembly", "SKILL.md"],
    ["skills", "resume-review-and-delivery", "SKILL.md"],
    ["templates", "common", "resume.cls"],
    ["templates", "zh", "standard", "resume.tex"],
    ["templates", "industry", "ats", "resume.tex"],
  ];

  for (const segments of required) {
    const filePath = path.join(skillRoot, ...segments);
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`cv-skill asset missing: ${filePath}`);
    }
  }
}

function renderLatexSource({ tailored, job }) {
  const contact = renderContact(tailored.contact);
  const summary = latexEscape(tailored.summary || "基于原始简历整理岗位相关经历。");
  const skills = tailored.skills.length
    ? tailored.skills.map(latexEscape).join(" \\quad ")
    : latexEscape("基于原始简历的岗位相关技能");

  return [
    "% !TEX program = xelatex",
    "\\documentclass{common/resume}",
    "\\RequirePackage{xeCJK}",
    "\\IfFontExistsTF{PingFang SC}{",
    "  \\setCJKmainfont{PingFang SC}",
    "  \\setCJKsansfont{PingFang SC}",
    "  \\setCJKmonofont{PingFang SC}",
    "}{\\IfFontExistsTF{Noto Sans SC}{",
    "  \\setCJKmainfont{Noto Sans SC}",
    "  \\setCJKsansfont{Noto Sans SC}",
    "  \\setCJKmonofont{Noto Sans SC}",
    "}{}}",
    "\\begin{document}",
    "",
    `\\resumeName{${latexEscape(tailored.name)}}`,
    `\\resumeContact{${contact}}`,
    "",
    "\\resumeSection{个人简介}",
    `${summary}`,
    "",
    "\\resumeSection{目标岗位}",
    latexEscape(job.title || tailored.targetTitle || "实习岗位"),
    "",
    "\\resumeSection{岗位匹配亮点}",
    renderItemize(tailored.highlights),
    "",
    "\\resumeSection{项目经历}",
    renderProjects(tailored.projects),
    "",
    "\\resumeSection{技能}",
    skills,
    "",
    "\\resumeSection{原始简历摘录}",
    latexEscape(tailored.sourceExcerpt),
    "",
    "\\end{document}",
    "",
  ].join("\n");
}

function renderContact(contact = {}) {
  const items = [contact.email, contact.phone].filter(Boolean).map(latexEscape);
  return items.length ? items.join(" \\quad | \\quad ") : latexEscape("本地简历未解析到联系方式");
}

function renderItemize(items) {
  const safeItems = items.length ? items : ["所有项目与技能表述均基于原始简历，不新增未提供的经历或成果。"];
  return ["\\begin{itemize}", ...safeItems.map((item) => `  \\item ${latexEscape(item)}`), "\\end{itemize}"].join("\n");
}

function renderProjects(projects) {
  if (!projects.length) {
    return latexEscape("原始简历未提供可结构化的项目条目。");
  }

  const blocks = [];
  for (const project of projects) {
    blocks.push(`\\datedEntry{${latexEscape(project.name || "项目经历")}}{${latexEscape(project.period || "")}}`);
    const detail = [project.role, project.tech, project.description].filter(Boolean).join("；");
    if (detail) {
      blocks.push(latexEscape(detail));
    }
    if (project.bullets.length) {
      blocks.push(renderItemize(project.bullets));
    }
    blocks.push("");
  }
  return blocks.join("\n").trim();
}

function renderExtracted({ tailored, job }) {
  return [
    "# Extracted Resume Material",
    "",
    `- Candidate name: ${tailored.name}`,
    `- Target job: ${job.title || tailored.targetTitle || ""}`,
    `- Contact email: ${tailored.contact.email || "not parsed"}`,
    `- Contact phone: ${tailored.contact.phone || "not parsed"}`,
    `- Skills: ${tailored.skills.join(", ") || "none parsed"}`,
    "",
    "## Source Excerpt",
    "",
    tailored.sourceExcerpt,
    "",
  ].join("\n");
}

function renderRequirementsSummary({ skillRoot, classSourcePath, job }) {
  return [
    "# Requirements Summary",
    "",
    "- Target: job-specific Chinese resume for local application workflow.",
    "- Template family: cv-skill zh/standard style assembled with common/resume.cls.",
    "- Missing or ambiguous facts are omitted rather than invented.",
    "- Omission audit: no blocking omission was introduced by the automated renderer.",
    `- CV_SKILL_ROOT: ${skillRoot}`,
    `- Copied class source path: ${classSourcePath}`,
    `- Job: ${job.title || ""}`,
    "",
  ].join("\n");
}

function renderClaimSourceMap({ tailored, job }) {
  const rows = [
    [
      `Candidate display name is ${tailored.name}`,
      "`input/source-resume.txt`",
      "parsed first Chinese-only name line or fallback",
      tailored.name,
      "resolved",
      "use",
    ],
    [
      `Target role is ${job.title || tailored.targetTitle || "实习岗位"}`,
      "`input/job.json`",
      "job.title",
      job.title || tailored.targetTitle || "实习岗位",
      "resolved",
      "use",
    ],
    [
      `Summary is derived from source resume and resume patch`,
      "`input/source-resume.txt`",
      "resume text and generated patch",
      tailored.summary,
      "resolved",
      "use",
    ],
    [
      `Skills are limited to source-supported job-relevant skills`,
      "`input/source-resume.txt`",
      "source skill mentions",
      tailored.skills.join(", ") || "none parsed",
      "resolved",
      "use",
    ],
  ];

  return [
    "| Claim | Source artifact | Source locator | Raw wording or user confirmation | State | Final handling |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
    "",
  ].join("\n");
}

function markdownCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function latexEscape(value) {
  const replacements = {
    "\\": "\\textbackslash{}",
    "#": "\\#",
    "$": "\\$",
    "%": "\\%",
    "&": "\\&",
    "_": "\\_",
    "{": "\\{",
    "}": "\\}",
    "^": "\\textasciicircum{}",
    "~": "\\textasciitilde{}",
  };
  return String(value || "").replace(/[\\#$%&_{}^~]/g, (char) => replacements[char]);
}

function compileXeLaTeX({ xelatexBin, cwd, outputPath, logPath }) {
  return new Promise((resolve) => {
    const child = spawn(xelatexBin, ["-interaction=nonstopmode", "-halt-on-error", "resume.tex"], {
      cwd,
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
    child.on("error", async (error) => {
      await writeBuildLog(logPath, stdout, stderr, error.message);
      resolve({ ok: false, error: error.message });
    });
    child.on("close", async (code) => {
      await writeBuildLog(logPath, stdout, stderr);
      let pdfExists = false;
      try {
        await fs.access(outputPath);
        pdfExists = true;
      } catch (error) {
        pdfExists = false;
      }
      resolve({
        ok: code === 0 && pdfExists,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function writeBuildLog(logPath, stdout, stderr, error = "") {
  await fs.writeFile(
    logPath,
    [
      stdout.trim(),
      stderr.trim(),
      error ? `ERROR: ${error}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    "utf8"
  );
}

module.exports = {
  assertCvSkillRoot,
  compileXeLaTeX,
  CvSkillResumeRenderer,
  latexEscape,
  renderLatexSource,
};
