const { BaseChromeAdapter } = require("./baseChromeAdapter");

function createLinkedInAdapter(options = {}) {
  return new LinkedInAdapter(options);
}

class LinkedInAdapter extends BaseChromeAdapter {
  constructor({ profileUrl = process.env.LINKEDIN_PROFILE_URL || "https://www.linkedin.com/in/me/", ...baseOptions } = {}) {
    super({
      name: "linkedin",
      startUrl: "https://www.linkedin.com/feed/",
      ...baseOptions,
    });
    this.profileUrl = profileUrl;
    this.kind = "profile-maintenance";
  }

  async login() {
    await this.openStartPage();
    const text = await this.pageText();
    if (isLinkedInLoggedInText(text)) {
      return { ok: true, alreadyLoggedIn: true };
    }

    await this.waitForLoggedIn({
      markers: [/Home|首页|Messaging|消息|Me|我/],
      prompt:
        "请在 Chrome 中登录 LinkedIn。可以使用邮箱、验证码、扫码或浏览器已有会话；本项目不会保存 LinkedIn 用户名或密码。",
      timeoutMs: 10 * 60 * 1000,
    });
    return { ok: true };
  }

  async maintainProfile({ resume, profilePatch }) {
    await this.controller.openPage(this.profileUrl);
    await this.waitLikeHuman();
    const beforeText = await this.pageText();
    const plan = createLinkedInProfilePlan({ resume, profilePatch, pageText: beforeText });

    if (!plan.actions.length) {
      return {
        ok: true,
        platform: "linkedin",
        status: "unchanged",
        plan,
      };
    }

    await this.promptForHuman({
      title: "LinkedIn profile update confirmation",
      platform: "linkedin",
      message:
        "即将把本地简历生成的 LinkedIn 资料草稿填入个人资料页面。请确认这些公开资料修改可以提交；需要保存时我会再次停在确认点。",
    });

    for (const action of plan.actions) {
      await this.executeProfileAction(action);
    }

    return {
      ok: true,
      platform: "linkedin",
      status: "updated",
      plan,
    };
  }

  async executeProfileAction(action) {
    if (action.type === "edit-headline") {
      await this.clickByText(["编辑简介", "Edit intro", "编辑个人资料", "Edit profile"], {
        optional: false,
      });
      await this.waitLikeHuman();
      await this.clickByText(["标题", "Headline"], { optional: true });
      await this.typeText(action.value, { multiline: false });
      await this.waitLikeHuman();
      await this.promptForHuman({
        title: "Save LinkedIn intro",
        platform: "linkedin",
        message: "请在 LinkedIn 弹窗中检查标题内容；确认无误后点击保存，完成后按 Enter 继续。",
      });
      return;
    }

    if (action.type === "add-about") {
      await this.clickByText(["添加个人简介", "Add about", "编辑个人简介", "Edit about"], {
        optional: true,
      });
      await this.waitLikeHuman();
      await this.typeText(action.value, { multiline: true });
      await this.waitLikeHuman();
      await this.promptForHuman({
        title: "Save LinkedIn about",
        platform: "linkedin",
        message: "请在 LinkedIn 弹窗中检查 About/简介内容；确认无误后点击保存，完成后按 Enter 继续。",
      });
      return;
    }

    if (action.type === "add-skills") {
      await this.clickByText(["添加技能", "Add skills", "技能"], { optional: true });
      await this.waitLikeHuman();
      for (const skill of action.skills) {
        await this.typeText(skill, { multiline: false });
        await this.pressKey(["Enter"], { optional: true });
        await this.waitLikeHuman(0.4);
      }
      await this.promptForHuman({
        title: "Save LinkedIn skills",
        platform: "linkedin",
        message: "请在 LinkedIn 技能弹窗中检查新增技能；确认无误后点击保存，完成后按 Enter 继续。",
      });
    }
  }

  async checkMessages() {
    return [];
  }

  async getNextJob() {
    return null;
  }

  async submitApplication() {
    throw new Error("LinkedIn adapter maintains profile data and does not submit jobs through agentTeam.");
  }
}

function isLinkedInLoggedInText(text) {
  return /(?:Home|首页|Messaging|消息|Notifications|通知|Me|我)/.test(String(text || ""));
}

function createLinkedInProfilePlan({ resume, profilePatch, pageText = "" } = {}) {
  const source = profilePatch?.summary || resume || "";
  const headline = normalizeLine(profilePatch?.headline || inferHeadline(source));
  const about = normalizeParagraph(profilePatch?.about || profilePatch?.summary || source, 650);
  const skills = uniqueSkills(profilePatch?.skills || inferSkills(source));
  const existing = String(pageText || "");
  const actions = [];

  if (headline && !existing.includes(headline)) {
    actions.push({ type: "edit-headline", value: headline });
  }

  if (about && !containsCondensed(existing, about.slice(0, 80))) {
    actions.push({ type: "add-about", value: about });
  }

  const missingSkills = skills.filter((skill) => !existing.toLowerCase().includes(skill.toLowerCase()));
  if (missingSkills.length) {
    actions.push({ type: "add-skills", skills: missingSkills.slice(0, 10) });
  }

  return {
    headline,
    about,
    skills,
    actions,
  };
}

function inferHeadline(text) {
  const normalized = normalizeLine(text);
  if (!normalized) {
    return "";
  }

  const frontend = /React|Vue|前端|TypeScript|JavaScript/i.test(normalized);
  const node = /Node\.?js|后端|全栈|Express|Nest/i.test(normalized);
  const ai = /AI|LLM|Agent|机器学习|深度学习|算法/i.test(normalized);

  if (frontend && node) {
    return "Full-stack Developer | React, Node.js, Automation";
  }
  if (frontend) {
    return "Frontend Developer | React, TypeScript, Web Automation";
  }
  if (ai) {
    return "AI Application Developer | LLM, Automation, Data";
  }
  return normalized.slice(0, 120);
}

function inferSkills(text) {
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
    "Chrome Extension",
    "SQL",
    "Docker",
  ];
  const source = String(text || "");
  return dictionary.filter((skill) => source.toLowerCase().includes(skill.toLowerCase()));
}

function uniqueSkills(skills) {
  return [...new Set((skills || []).map((skill) => normalizeLine(skill)).filter(Boolean))];
}

function normalizeLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeParagraph(value, limit) {
  return normalizeLine(value).slice(0, limit);
}

function containsCondensed(text, fragment) {
  const haystack = normalizeLine(text).toLowerCase();
  const needle = normalizeLine(fragment).toLowerCase();
  return Boolean(needle && haystack.includes(needle));
}

module.exports = {
  LinkedInAdapter,
  createLinkedInAdapter,
  createLinkedInProfilePlan,
  inferHeadline,
  inferSkills,
  isLinkedInLoggedInText,
};
