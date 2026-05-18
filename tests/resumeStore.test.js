const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { ResumeStore } = require("../src/resumeStore");

test("ResumeStore loads utf8 resume text from a configured path", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-"));
  const resumePath = path.join(dir, "resume.txt");
  await fs.writeFile(resumePath, "我的 React 简历", "utf8");

  const store = new ResumeStore({ resumePath });

  assert.equal(await store.load(), "我的 React 简历");
});

test("ResumeStore reports the missing resume path in its error", async () => {
  const store = new ResumeStore({ resumePath: "missing-resume.txt" });

  await assert.rejects(() => store.load(), /Resume file not found: missing-resume.txt/);
});

test("ResumeStore extracts text from a configured PDF resume", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "find-job-plus-"));
  const resumePath = path.join(dir, "resume.pdf");
  await fs.writeFile(resumePath, Buffer.from("%PDF mocked"));

  const store = new ResumeStore({
    resumePath,
    pdfParser: async (buffer) => {
      assert.ok(Buffer.isBuffer(buffer));
      return { text: "PDF 简历内容\n\nReact 实习经历" };
    },
  });

  assert.equal(await store.load(), "PDF 简历内容\n\nReact 实习经历");
});

test("ResumeStore supports the current pdf-parse PDFParse class API", async () => {
  const pdfModule = {
    PDFParse: class {
      constructor(options) {
        assert.ok(Buffer.isBuffer(options.data));
      }

      async getText() {
        return { text: "新版 pdf-parse 简历文本" };
      }
    },
  };

  assert.equal(
    await ResumeStore.parsePdfBuffer(Buffer.from("%PDF mocked"), pdfModule),
    "新版 pdf-parse 简历文本"
  );
});
