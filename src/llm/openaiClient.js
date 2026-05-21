class OpenAIJobAssistant {
  constructor({ apiKey, baseURL, model, client } = {}) {
    this.model = model || "gpt-4o-mini";
    this.client = client || createOpenAIClient({ apiKey, baseURL });
  }

  async generateResumePatch({ resume, job }) {
    const content = await this.#complete([
      {
        role: "system",
        content:
          "你是简历优化 Agent。只基于用户提供的简历和岗位描述，输出适配该岗位的简历内容，不编造经历、教育、公司、项目、技能或量化结果，不泄露无关隐私。",
      },
      {
        role: "user",
        content:
          `原始简历：\n${resume}\n\n岗位：\n${formatJob(job)}\n\n` +
          "请输出 JSON，字段为 summary、highlights、skills、projects。summary 120 字以内；highlights 最多 5 条；skills 只保留原简历能支持且岗位相关的技能；projects 最多 3 个，每个含 name、role、period、tech、description、bullets。无法从原简历确认的内容留空或省略。",
      },
    ]);

    return parseResumePatch(content, resume, job);
  }

  async generateGreeting({ resume, resumePatch, job }) {
    return this.#complete([
      {
        role: "system",
        content:
          "你是求职沟通 Agent。生成可直接发送给 HR 的中文打招呼消息，礼貌、具体、80 字左右，不输出解释。",
      },
      {
        role: "user",
        content: `简历：\n${resume}\n\n简历优化摘要：\n${resumePatch.summary}\n\n岗位：\n${formatJob(job)}`,
      },
    ]);
  }

  async generateChatReply({ resume, message }) {
    return this.#complete([
      {
        role: "system",
        content:
          "你是招聘聊天 Agent。对 HR 的消息给出简洁、礼貌、真实的中文回复；涉及薪资、面试时间、入职时间等关键决策时提醒用户确认。",
      },
      {
        role: "user",
        content: `简历：\n${resume}\n\nHR 消息：\n${message.text}`,
      },
    ]);
  }

  async summarizeMarket({ jobs }) {
    return this.#complete([
      {
        role: "system",
        content:
          "你是求职市场分析 Agent。根据浏览到的岗位，总结技能趋势、薪资信号和简历优化建议，输出中文要点。",
      },
      {
        role: "user",
        content: JSON.stringify(jobs, null, 2),
      },
    ]);
  }

  async generateLinkedInProfilePatch({ resume }) {
    const content = await this.#complete([
      {
        role: "system",
        content:
          "你是 LinkedIn 个人资料维护 Agent。只基于用户本地简历生成真实、专业、可公开展示的资料草稿，不编造经历，不包含手机号、邮箱、证件号或住址。",
      },
      {
        role: "user",
        content:
          `本地简历：\n${resume}\n\n` +
          "请输出 JSON，字段为 headline、about、skills。headline 120 字以内；about 650 字以内；skills 为最多 10 个技能字符串。",
      },
    ]);

    return parseLinkedInProfilePatch(content, resume);
  }

  async #complete(messages) {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });

    return completion.choices[0].message.content.replace(/\s+/g, " ").trim();
  }
}

class TemplateJobAssistant {
  async generateResumePatch({ resume, job }) {
    const resumeHint = String(resume || "").replace(/\s+/g, " ").trim().slice(0, 80);
    return {
      summary: `基于原始简历提炼与岗位相关经历，不编造经历。${resumeHint}`,
      resumeText: resumeHint,
      jobTitle: job.title || "",
      highlights: [`根据原始简历中已有经历匹配 ${job.title || "目标岗位"}。`],
      skills: inferSkillsFromText(`${resumeHint} ${job.description || ""}`),
      projects: [],
    };
  }

  async generateGreeting({ resumePatch, job }) {
    const title = job.title || "实习岗位";
    const company = job.company ? `${job.company}的` : "";
    return [
      "您好，",
      `我想投递${company}${title}，`,
      "可在2026年6月开始实习。",
      "我的经历与岗位要求较匹配，期待进一步沟通，谢谢。",
    ].join("");
  }

  async generateChatReply({ message }) {
    return `您好，关于“${message.text}”，我需要确认后再回复您，谢谢。`;
  }

  async summarizeMarket({ jobs }) {
    return `本次浏览到 ${jobs.length} 个岗位。`;
  }

  async generateLinkedInProfilePatch({ resume }) {
    const resumeHint = String(resume || "").replace(/\s+/g, " ").trim();
    const skills = [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "OpenAI API",
      "Automation",
    ].filter((skill) => resumeHint.toLowerCase().includes(skill.toLowerCase()));

    return {
      headline: inferTemplateHeadline(resumeHint),
      about: resumeHint.slice(0, 650),
      skills,
      summary: resumeHint.slice(0, 650),
    };
  }
}

function createJobAssistant(options = {}) {
  if (options.apiKey) {
    return new OpenAIJobAssistant(options);
  }

  return new TemplateJobAssistant();
}

function createOpenAIClient({ apiKey, baseURL } = {}) {
  const { OpenAI } = require("openai");
  return new OpenAI({
    apiKey,
    baseURL,
  });
}

function formatJob(job) {
  return [
    `标题：${job.title || ""}`,
    `公司：${job.company || ""}`,
    `薪资：${job.salary || ""}`,
    `活跃度：${job.recruiterActivity || ""}`,
    `描述：${job.description || ""}`,
  ].join("\n");
}

function parseLinkedInProfilePatch(content, fallbackResume = "") {
  try {
    const parsed = JSON.parse(extractJson(content));
    return normalizeLinkedInProfilePatch(parsed, fallbackResume);
  } catch (error) {
    return normalizeLinkedInProfilePatch({ about: content }, fallbackResume);
  }
}

function parseResumePatch(content, fallbackResume = "", job = {}) {
  try {
    const parsed = JSON.parse(extractJson(content));
    return normalizeResumePatch(parsed, fallbackResume, job);
  } catch (error) {
    return normalizeResumePatch({ summary: content }, fallbackResume, job);
  }
}

function extractJson(content) {
  const text = String(content || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function normalizeLinkedInProfilePatch(value, fallbackResume = "") {
  const about = String(value.about || value.summary || fallbackResume || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 650);
  const headline = String(value.headline || inferTemplateHeadline(about))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const skills = Array.isArray(value.skills)
    ? value.skills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    headline,
    about,
    skills,
    summary: about,
  };
}

function normalizeResumePatch(value, fallbackResume = "", job = {}) {
  const summary = String(value.summary || value.resumeText || fallbackResume || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  const highlights = Array.isArray(value.highlights)
    ? value.highlights.map(normalizeText).filter(Boolean).slice(0, 5)
    : [];
  const skills = Array.isArray(value.skills)
    ? value.skills.map(normalizeText).filter(Boolean).slice(0, 12)
    : [];
  const projects = Array.isArray(value.projects)
    ? value.projects.map(normalizeProject).filter(Boolean).slice(0, 3)
    : [];

  return {
    summary,
    resumeText: summary,
    jobTitle: job.title || value.jobTitle || "",
    highlights,
    skills,
    projects,
  };
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    return null;
  }

  const normalized = {
    name: normalizeText(project.name || project.title),
    role: normalizeText(project.role || project.desc),
    period: normalizeText(project.period),
    tech: normalizeText(Array.isArray(project.tech) ? project.tech.join(", ") : project.tech),
    description: normalizeText(project.description),
    bullets: Array.isArray(project.bullets)
      ? project.bullets.map(normalizeText).filter(Boolean).slice(0, 4)
      : [],
  };

  return normalized.name || normalized.description || normalized.bullets.length ? normalized : null;
}

function inferSkillsFromText(text) {
  const dictionary = [
    "JavaScript",
    "TypeScript",
    "React",
    "Vue",
    "Node.js",
    "Python",
    "OpenAI API",
    "LLM",
    "Automation",
  ];
  const source = String(text || "").toLowerCase();
  return dictionary.filter((skill) => source.includes(skill.toLowerCase()));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferTemplateHeadline(text) {
  if (/React|Vue|前端|TypeScript|JavaScript/i.test(text)) {
    return "Frontend Developer | React, TypeScript, Web Automation";
  }
  if (/AI|LLM|Agent|机器学习|算法/i.test(text)) {
    return "AI Application Developer | LLM, Automation, Data";
  }
  return "Software Developer";
}

module.exports = {
  createJobAssistant,
  createOpenAIClient,
  extractJson,
  OpenAIJobAssistant,
  parseResumePatch,
  parseLinkedInProfilePatch,
  TemplateJobAssistant,
  formatJob,
  normalizeLinkedInProfilePatch,
  normalizeResumePatch,
};
