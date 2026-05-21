const SKILL_KEYWORDS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Vue",
  "Node.js",
  "Python",
  "Java",
  "Go",
  "SQL",
  "Docker",
  "Kubernetes",
  "OpenAI API",
  "LLM",
  "Agent",
  "Automation",
  "机器学习",
  "深度学习",
  "算法",
  "前端",
  "后端",
  "全栈",
];

function createTailoredResume({ resume = "", job = {}, resumePatch = {} } = {}) {
  const source = normalizeWhitespace(resume);
  const summary = normalizeWhitespace(resumePatch.summary || resumePatch.resumeText || source).slice(0, 220);
  const skills = selectSupportedSkills({ resume: source, job, resumePatch });
  const highlights = normalizeList(resumePatch.highlights).length
    ? normalizeList(resumePatch.highlights).slice(0, 5)
    : createConservativeHighlights({ resume: source, job, skills });
  const projects = normalizeProjects(resumePatch.projects).slice(0, 3);

  return {
    name: inferName(source),
    contact: inferContact(source),
    targetTitle: job.title || resumePatch.jobTitle || "实习岗位",
    summary,
    skills,
    highlights,
    projects,
    sourceExcerpt: source.slice(0, 1000),
  };
}

function selectSupportedSkills({ resume, job, resumePatch }) {
  const source = String(resume || "");
  const jobText = `${job.title || ""} ${job.description || ""}`;
  const explicit = normalizeList(resumePatch.skills);
  const candidates = explicit.length ? explicit : SKILL_KEYWORDS;
  const supported = candidates.filter((skill) => {
    const pattern = new RegExp(escapeRegExp(skill), "i");
    return pattern.test(source) && (!jobText || pattern.test(jobText) || explicit.includes(skill));
  });

  return [...new Set(supported)].slice(0, 12);
}

function createConservativeHighlights({ resume, job, skills }) {
  const highlights = [];
  if (skills.length) {
    highlights.push(`结合原简历中的 ${skills.slice(0, 4).join("、")} 经历，匹配 ${job.title || "目标岗位"} 要求。`);
  }
  highlights.push("所有项目与技能表述均基于原始简历，不新增未提供的经历或成果。");
  if (/2026|6月|六月/.test(`${job.description || ""} ${job.title || ""}`)) {
    highlights.push("可围绕 2026 年 6 月入职/实习安排进行沟通。");
  }
  return highlights.slice(0, 5);
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .map((project) => ({
      name: normalizeWhitespace(project.name || project.title || ""),
      role: normalizeWhitespace(project.role || project.desc || ""),
      period: normalizeWhitespace(project.period || ""),
      tech: normalizeWhitespace(Array.isArray(project.tech) ? project.tech.join(", ") : project.tech || ""),
      description: normalizeWhitespace(project.description || ""),
      bullets: normalizeList(project.bullets).slice(0, 4),
    }))
    .filter((project) => project.name || project.description || project.bullets.length);
}

function inferName(resume) {
  const lines = String(resume || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.find((line) => /^[\u4e00-\u9fa5]{2,4}$/.test(line));
  return candidate || "候选人";
}

function inferContact(resume) {
  const email = String(resume || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = String(resume || "").match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/)?.[0] || "";
  return { email, phone };
}

function normalizeList(values) {
  if (Array.isArray(values)) {
    return values.map(normalizeWhitespace).filter(Boolean);
  }
  if (typeof values === "string") {
    return values
      .split(/\n|；|;/)
      .map(normalizeWhitespace)
      .filter(Boolean);
  }
  return [];
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createTailoredResume,
  inferContact,
  inferName,
  selectSupportedSkills,
};
