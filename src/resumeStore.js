const fs = require("node:fs/promises");
const path = require("node:path");

class ResumeStore {
  constructor({ resumePath, pdfParser } = {}) {
    this.resumePath = resumePath;
    this.pdfParser = pdfParser || parsePdfResume;
  }

  async load() {
    try {
      const extension = path.extname(this.resumePath).toLowerCase();
      if (extension === ".pdf") {
        const buffer = await fs.readFile(this.resumePath);
        const parsed = await this.pdfParser(buffer);
        const text = typeof parsed === "string" ? parsed : parsed?.text;
        return String(text || "").trim();
      }

      const content = await fs.readFile(this.resumePath, "utf8");
      return content.trim();
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Resume file not found: ${this.resumePath}`);
      }
      throw error;
    }
  }
}

async function parsePdfResume(buffer) {
  try {
    return ResumeStore.parsePdfBuffer(buffer, require("pdf-parse"));
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error("PDF resume parsing requires the pdf-parse package. Run `npm install pdf-parse`.");
    }
    throw error;
  }
}

ResumeStore.parsePdfBuffer = async function parsePdfBuffer(buffer, pdfModule) {
  if (typeof pdfModule === "function") {
    const parsed = await pdfModule(buffer);
    return String(parsed?.text || parsed || "").trim();
  }

  if (typeof pdfModule?.PDFParse === "function") {
    const parser = new pdfModule.PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return String(parsed?.text || parsed || "").trim();
  }

  throw new Error("Unsupported pdf-parse API.");
};

module.exports = {
  parsePdfResume,
  ResumeStore,
};
