const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createTailoredResume } = require("../src/resume/resumeTailor");
const { TypstResumeRenderer } = require("../src/resume/typstResumeRenderer");

test("tailored resume only keeps skills supported by the source resume", () => {
  const tailored = createTailoredResume({
    resume: "张三\n熟悉 React、TypeScript，有前端课程项目。",
    job: { title: "AI 前端实习生", description: "要求 React、Python、LLM" },
    resumePatch: { skills: ["React", "Python", "LLM"] },
  });

  assert.deepEqual(tailored.skills, ["React"]);
  assert.match(tailored.summary, /张三|React/);
});

test("Typst resume renderer writes escaped typst source and can use an injected compiler", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-typst-"));
  const renderer = new TypstResumeRenderer({
    outputDir: dir,
    templateDir: path.join(process.cwd(), "Chinese-Resume-in-Typst-main"),
    compilePdf: true,
    now: () => new Date("2026-05-21T00:00:00Z"),
    compiler: async ({ inputPath, outputPath }) => {
      assert.match(inputPath, /20260521-boss-boss-1/);
      await fs.writeFile(outputPath, "%PDF fake", "utf8");
      return { ok: true, code: 0 };
    },
  });

  const result = await renderer.render({
    platform: "boss",
    resume: "李四\nlisi@example.com\n熟悉 React # Node.js，有自动化项目。",
    job: { id: "boss-1", title: "前端开发实习生", description: "React Node.js" },
    resumePatch: {
      summary: "突出 React # Node.js 项目经历",
      skills: ["React", "Node.js"],
      highlights: ["React # Node.js 匹配岗位"],
    },
  });

  const source = await fs.readFile(result.typstPath, "utf8");
  assert.match(source, /#import/);
  assert.match(source, /Chinese-Resume-in-Typst-main\/template\.typ/);
  assert.match(source, /React \\# Node\.js/);
  assert.equal(result.compileStatus.ok, true);
  assert.match(result.pdfPath, /\.pdf$/);
});
