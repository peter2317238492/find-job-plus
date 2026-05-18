const { OpenAI } = require("openai");

class OpenAIJobAssistant {
  constructor({ apiKey, baseURL, model, client } = {}) {
    this.model = model || "gpt-4o-mini";
    this.client =
      client ||
      new OpenAI({
        apiKey,
        baseURL,
      });
  }

  async generateResumePatch({ resume, job }) {
    const content = await this.#complete([
      {
        role: "system",
        content:
          "你是简历优化 Agent。只基于用户提供的简历和岗位描述，输出适配该岗位的简历摘要，不编造经历，不泄露无关隐私。",
      },
      {
        role: "user",
        content: `原始简历：\n${resume}\n\n岗位：\n${formatJob(job)}\n\n请输出 120 字以内的中文定制摘要。`,
      },
    ]);

    return {
      summary: content,
      resumeText: content,
    };
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
}

function createJobAssistant(options = {}) {
  if (options.apiKey) {
    return new OpenAIJobAssistant(options);
  }

  return new TemplateJobAssistant();
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

module.exports = {
  createJobAssistant,
  OpenAIJobAssistant,
  TemplateJobAssistant,
  formatJob,
};
