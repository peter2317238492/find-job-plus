# Find Job Plus

Find Job Plus 是一个本地运行的求职 Agent Team，用来辅助筛选岗位、定制简历、生成沟通文案，并把 Boss 直聘、牛客网、LinkedIn 等平台上的高风险页面操作统一停在人工确认点。

当前实现的重点不是“无人值守自动投递”，而是一个可审计、可测试、可人工接管的求职工作流：

- 先用确定性规则过滤岗位，再调用 LLM 和简历渲染；
- 只基于本地简历生成岗位匹配内容，不编造经历；
- 浏览器点击、上传、发送、保存资料等 GUI 写操作统一进入单一队列；
- 投递、发消息、上传简历、保存 LinkedIn 公开资料前保留人工确认；
- 没有 OpenAI API Key 时会使用本地模板助手，方便离线开发和测试。

## 当前能力

| 能力 | 状态 |
| --- | --- |
| Boss 直聘岗位读取与投递准备 | 支持登录提示、搜索页打开、可见文本解析、岗位过滤、问候语生成，最终停在人工沟通/发送前 |
| 牛客网岗位读取与投递准备 | 支持登录提示、职位页解析、申请前确认，layout note 记录了简历下拉框和附件上传流程 |
| LinkedIn 资料维护 | 支持根据本地简历生成 headline、about、skills 草稿，并在保存公开资料前确认 |
| 简历读取 | 支持 UTF-8 文本简历和 PDF 简历 |
| 定制简历 | 默认生成 Typst 文件，可选调用本地 `typst` 编译 PDF；也可切换到 `cv-skill` LaTeX/XeLaTeX 工作区 |
| 本地控制台 | `--gui` 启动 Web 控制台，查看平台、URL、当前 Agent、GUI 队列和日志 |
| 测试 | 使用 Node.js 内置 test runner，覆盖过滤、平台解析、Agent 编排、GUI 队列、简历渲染和 Codex 配置 |

## 架构

| 路径 | 说明 |
| --- | --- |
| `main.js` | CLI 入口，加载配置、LLM、简历、平台注册表、GUI 队列和本地控制台 |
| `src/config.js` | 环境变量配置、默认简历路径、Codex OpenAI 配置读取 |
| `src/agents/agentTeam.js` | 主编排器：登录、取岗位、过滤、生成简历与问候语、排队执行 GUI 任务 |
| `src/agents/jobFilter.js` | 确定性过滤：薪资、城市、实习、开始时间、活跃度、屏蔽关键词、公司黑名单 |
| `src/llm/openaiClient.js` | OpenAI 兼容 LLM 封装，以及无 API Key 时的模板助手 |
| `src/resumeStore.js` | 从文本或 PDF 加载本地简历 |
| `src/resume/*` | 简历定制、Typst 转义、Typst/PDF 渲染 |
| `src/platforms_chrome/*` | Boss、牛客、LinkedIn 的 Chrome 控制抽象和可见文本解析 |
| `src/platforms/*` | 兼容旧导入路径，转发到 Chrome 版适配器 |
| `src/gui/taskQueue.js` | GUI 任务队列，默认并发为 1，支持优先级、重试和事件流 |
| `src/gui/computerUseExecutor.js` | GUI 执行边界：只执行排队任务，不做策略规划 |
| `src/gui/server.js` | 本地 Web 控制台 |
| `.codex/agents/*.toml` | 项目内 Codex subagent 定义 |
| `.codex/teams/*.toml` | Boss、牛客、LinkedIn 的非 GUI team preset |
| `.codex/skills/resume-typst` | 定制中文简历并渲染 Typst/PDF 的项目 skill |
| `.codex/skills/resume-crafter` 等 | 从 `cv-skill` 安装的 LaTeX 简历制作工作流入口 |
| `.codex/vendor/cv-skill` | `cv-skill` 完整资产根目录，包含四个 skill、LaTeX 模板和验证文档 |
| `application-kit/site-layouts/*.md` | 三个平台的页面结构、投递流程、最终停点和 GUI 原子任务记录 |

## 安装

```bash
npm install
```

PDF 简历解析依赖 `pdf-parse`，已在 `package.json` 中声明。若要把 Typst 编译为 PDF，需要本机额外安装 `typst` 命令行工具，并设置 `ENABLE_RESUME_PDF=true`。

## 配置

常用环境变量：

```bash
export OPENAI_API_KEY=你的_API_Key
export OPENAI_BASE_URL=https://api.openai.com/v1

export RESUME_PATH=./在线简历.pdf
export TAILORED_RESUME_ENABLED=true
export RESUME_RENDERER=typst
export TAILORED_RESUME_DIR=./generated/resumes
export TYPST_TEMPLATE_DIR=./Chinese-Resume-in-Typst-main
export CV_SKILL_ROOT=./.codex/vendor/cv-skill
export ENABLE_RESUME_PDF=false
export TYPST_BIN=typst
export XELATEX_BIN=xelatex

export MIN_SALARY_K=15
export MAX_SALARY_K=35
export ACTIVE_WITHIN_DAYS=3
export BLOCKED_KEYWORDS=外包,外派,驻场
export BLOCKED_COMPANIES=
export ALLOWED_CITIES=上海,苏州
export REQUIRED_INTERNSHIP=true
export TARGET_START_MONTH=2026-06
export MAX_APPLICATIONS_PER_RUN=20

export LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-profile/
export GUI_PORT=3210
```

配置说明：

- `RESUME_PATH` 未设置时，优先读取项目根目录下的 `简历基本信息.txt`，否则读取 `在线简历.pdf`。
- `OPENAI_API_KEY` 未设置时，会使用模板助手生成简历摘要、问候语和 LinkedIn 草稿。
- `loadCodexOpenAIConfig()` 会尝试读取 `~/.codex/config.toml` 的 OpenAI base URL 和 `~/.codex/auth.json` 的 API Key，命令行环境变量优先级更高。
- `TAILORED_RESUME_ENABLED=false` 可关闭岗位定制 Typst 简历生成。
- `RESUME_RENDERER=typst` 是默认投递路径，生成轻量 Typst 文件；`RESUME_RENDERER=cv-skill` 会使用 `.codex/vendor/cv-skill` 的 LaTeX 模板，为每个岗位创建 `resume-workspace` 风格目录，包含 `input/`、`work/`、`output/resume.tex` 和可选 `output/resume.pdf`。
- `CV_SKILL_ROOT` 必须指向完整的 `cv-skill` checkout；本项目已下载到 `.codex/vendor/cv-skill`，四个入口 skill 已安装到 `.codex/skills`。当前 Codex 会话可能需要重启后才能在技能列表里直接显示这些新 skill。
- `RESUME_RENDERER=cv-skill` 且 `ENABLE_RESUME_PDF=true` 时需要本机 `xelatex`。当前机器已检测到 `/Library/TeX/texbin/xelatex`。

## 运行

默认运行 Boss：

```bash
npm start
```

指定平台：

```bash
npm start -- --platforms=boss
npm start -- --platforms=nowcoder
npm start -- --platforms=boss,nowcoder
npm start -- --platforms=linkedin
```

启动本地控制台：

```bash
npm start -- --platforms=boss --gui
```

控制台默认地址：

```text
http://127.0.0.1:3210
```

## 运行流程

1. `main.js` 读取配置、简历、LLM、平台注册表和 GUI 队列。
2. `JobApplicationAgentTeam` 按平台顺序运行。
3. 平台适配器打开起始页；如果未登录或遇到安全验证，提示用户在 Chrome 中手动完成。
4. 适配器读取页面可见文本并解析岗位卡片。
5. `jobFilter` 在 LLM 调用和投递准备前过滤不匹配岗位。
6. 通过过滤后，系统读取本地简历，生成岗位简历 patch 和问候语。
7. 启用简历渲染时，生成定制 `.typ`；若 `ENABLE_RESUME_PDF=true`，再调用 `typst compile` 输出 PDF。
8. 平台提交动作会作为 GUI 任务进入 `GuiTaskQueue`。
9. Boss、牛客的真实投递/发送动作返回 `awaiting_user_action`，最终由用户在页面上确认。
10. 每个平台结束后会检查消息；开启 `IDLE_BROWSING_ENABLED=true` 时，可做市场浏览摘要。

## `cv-skill` 接入点

我把 `cv-skill` 接在两层：

- Codex skill 层：`.codex/skills/resume-crafter`、`resume-intake-and-extraction`、`resume-authoring-and-assembly`、`resume-review-and-delivery` 已安装，用于用户明确要求“重新制作/转换一份可投递简历”时走完整的事实提取、claim map、LaTeX 和 PDF 交付流程。
- 项目运行时层：`RESUME_RENDERER=cv-skill` 时，`main.js` 会使用 `src/resume/cvSkillResumeRenderer.js`，把每个通过过滤的岗位渲染到 `generated/resumes/*-cv-skill/output/resume.tex`，并在 `ENABLE_RESUME_PDF=true` 时调用 `xelatex` 输出 PDF。

默认仍保留 `RESUME_RENDERER=typst`，因为自动投递循环里每个岗位都走完整 `resume-crafter` 交互式确认会明显拖慢流程；`cv-skill` 更适合高价值岗位、人工确认较多的简历重写/转换场景。

## Chrome 与 GUI 边界

`src/platforms_chrome/baseChromeAdapter.js` 定义了 Chrome 控制抽象。默认 `ManualChromeController` 只记录并提示应执行的页面动作，测试中使用 `createScriptedChromeController()` 注入页面文本和操作记录。

真正会影响第三方平台的动作必须通过 `computer-use-executor` 边界执行，包括：

- 点击申请、立即沟通、继续沟通、开聊、Submit application；
- 上传简历或选择附件简历；
- 输入或发送 recruiter 消息；
- 填写手机号、微信号、地址、签证状态等个人信息；
- 保存 LinkedIn headline、about、skills 等公开资料。

这些动作默认应停在确认点，不绕过验证码、安全检查、登录认证或平台风控。

## 平台备注

Boss 直聘：

- 起始页为 `https://www.zhipin.com/`。
- 搜索 URL 会根据实习、目标开始时间和单一城市生成。
- 附件简历和最终沟通流程见 `application-kit/site-layouts/boss-zhipin.md`。
- 当前提交实现会打开岗位页并提示用户人工核对后发送。

牛客网：

- 起始页为 `https://www.nowcoder.com/jobs/recommend`。
- 可解析职位卡中的标题、公司、地点、薪资和描述。
- 附件简历入口记录在 `选择投递简历` 下拉框中，详见 `application-kit/site-layouts/nowcoder.md`。
- 当前提交实现会打开岗位页并提示用户人工核对后投递。

LinkedIn：

- 当前注册为 `profile-maintenance` 平台，不通过 `agentTeam` 自动投递岗位。
- 会根据本地简历生成公开资料草稿，并检查页面现有文本，避免重复添加。
- 资料保存前必须人工确认。

## 安全原则

- 不保存平台密码、验证码、Cookie 或浏览器凭据。
- 不绕过验证码、安全验证、风控页或登录流程。
- 不自动执行最终投递、发送消息、上传私有简历、保存公开资料。
- 不在简历、问候语、LinkedIn 草稿中编造学历、公司、项目、技能、证书、指标或日期。
- 涉及联系方式、个人身份信息、地址、签证状态等字段时，必须由用户确认后再填写。
- 定制简历和生成 PDF 属于私人数据，默认只保存在本地。

## 测试

```bash
npm test
```

测试覆盖：

- 薪资、活跃度、城市、实习和目标开始时间过滤；
- Boss/牛客可见文本解析；
- LinkedIn profile patch 规划和去重；
- LLM 缺省模板助手；
- 本地文本/PDF 简历读取；
- Typst 简历渲染和转义；
- Agent Team 编排、投递上限、消息回复、市场摘要、LinkedIn 资料维护；
- GUI 任务队列串行化、优先级和状态事件；
- `.codex/agents`、`.codex/teams`、layout notes 和 `resume-typst` skill 的结构。

## 开发提示

- 新增平台时，优先实现 `login()`、`getNextJob()`、`submitApplication()`、`checkMessages()`，并接入 `createPlatformRegistry()`。
- 页面解析尽量基于可见文本和可测试的纯函数，便于用 scripted controller 单测。
- 任何真实 GUI 写操作都应排入 `GuiTaskQueue`，不要在非 GUI worker 中直接操作页面。
- 修改简历生成逻辑时，保持“只使用源简历可支持信息”的约束，并补充测试。
