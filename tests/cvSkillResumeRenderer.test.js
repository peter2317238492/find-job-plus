const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  assertCvSkillRoot,
  CvSkillResumeRenderer,
  latexEscape,
} = require("../src/resume/cvSkillResumeRenderer");

test("cv-skill renderer creates a traceable LaTeX resume workspace", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-cv-skill-"));
  const renderer = new CvSkillResumeRenderer({
    outputDir: dir,
    skillRoot: path.join(process.cwd(), ".codex", "vendor", "cv-skill"),
    compilePdf: true,
    now: () => new Date("2026-05-21T00:00:00Z"),
    compiler: async ({ inputPath, outputPath, cwd }) => {
      assert.equal(path.basename(inputPath), "resume.tex");
      assert.equal(path.basename(cwd), "output");
      await fs.writeFile(outputPath, "%PDF fake", "utf8");
      return { ok: true, code: 0 };
    },
  });

  const result = await renderer.render({
    platform: "nowcoder",
    resume: "李四\nlisi@example.com\n熟悉 React # Node.js，有自动化项目。",
    job: { id: "nowcoder-1", title: "前端开发实习生", description: "React Node.js" },
    resumePatch: {
      summary: "突出 React # Node.js 项目经历",
      skills: ["React", "Node.js"],
      highlights: ["React # Node.js 匹配岗位"],
    },
  });

  assert.equal(result.renderer, "cv-skill");
  assert.match(result.workspaceDir, /20260521-nowcoder-nowcoder-1/);
  assert.match(result.texPath, /output\/resume\.tex$/);
  assert.match(result.pdfPath, /output\/resume\.pdf$/);

  const source = await fs.readFile(result.texPath, "utf8");
  const claimMap = await fs.readFile(path.join(result.workspaceDir, "work", "claim-source-map.md"), "utf8");
  const classFile = await fs.readFile(path.join(result.workspaceDir, "output", "common", "resume.cls"), "utf8");

  assert.match(source, /\\documentclass\{common\/resume\}/);
  assert.match(source, /React \\# Node\.js/);
  assert.match(claimMap, /Claim \| Source artifact \| Source locator/);
  assert.match(classFile, /ProvidesClass/);
});

test("cv-skill root validation checks required installed assets", async () => {
  await assertCvSkillRoot(path.join(process.cwd(), ".codex", "vendor", "cv-skill"));
});

test("LaTeX escaping protects special characters", () => {
  assert.equal(latexEscape("React # Node.js & 100%"), "React \\# Node.js \\& 100\\%");
});
