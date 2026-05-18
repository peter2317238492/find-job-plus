## Find Job Plus

Find Job Plus 是一个本地运行的求职 Agent Team。当前版本已把平台适配层从浏览器驱动改为 Chrome 控制抽象：代码不再创建自动化浏览器实例，而是把 Boss 直聘、牛客网、LinkedIn 的操作表达为可由 Codex Chrome 插件或人工接管执行的真实点击、输入、滚动和确认步骤。

### 架构

| 模块 | 责任 |
| --- | --- |
| `main.js` | CLI 入口，加载配置、平台注册表、LLM 和本地 GUI。 |
| `src/agents/agentTeam.js` | 协调登录、职位读取、过滤、简历优化、投递、消息回复、空闲浏览和 LinkedIn 资料维护。 |
| `src/agents/jobFilter.js` | 在 LLM 和投递前执行确定性过滤：薪资、活跃度、城市、实习、屏蔽关键词和公司黑名单。 |
| `src/platforms_chrome/baseChromeAdapter.js` | Chrome 控制抽象、人工登录/确认接管点、脚本化测试控制器。 |
| `src/platforms_chrome/bossChromeAdapter.js` | Boss 直聘登录、职位列表解析、立即沟通和消息输入流程。 |
| `src/platforms_chrome/nowcoderChromeAdapter.js` | 牛客网登录、职位列表解析、申请职位和留言流程。 |
| `src/platforms_chrome/linkedinAdapter.js` | LinkedIn 登录、个人资料草稿生成后的资料维护流程。 |
| `src/platforms/*.js` | 兼容旧导入路径，转发到 Chrome 版适配器。 |
| `src/llm/openaiClient.js` | OpenAI 兼容 LLM 封装，负责简历摘要、问候语、聊天回复、市场总结和 LinkedIn 草稿。 |
| `src/resumeStore.js` | 从 `RESUME_PATH` 读取本地文本或 PDF 简历。 |
| `src/gui/server.js` | 本地 Web 控制台，显示活跃平台、URL、当前操作、命令和日志。 |

### 安全边界

- 不绕过验证码、安全检查、登录认证或平台风控；出现这些页面时暂停，让用户在 Chrome 中手动完成。
- 不保存 LinkedIn 用户名、密码、验证码或 Cookie；LinkedIn 使用浏览器已有会话或运行时手动登录。
- 投递简历、发送消息、保存 LinkedIn 资料属于对第三方产生影响的操作，真实执行前应由用户确认。
- 职位过滤在 LLM 调用和投递前执行，减少无效沟通。
- 简历和 LinkedIn 草稿只基于本地简历生成，不编造经历，不写入手机号、证件号、住址等敏感字段。

### 安装

```bash
npm install
```

macOS 上进行真实网页操作时，需要 Chrome 和 Codex Chrome 插件。首次使用请先在 Chrome 中登录 Boss 直聘、牛客网和 LinkedIn，或在运行中按提示扫码/手动登录。

### 配置

常用环境变量：

```bash
export OPENAI_API_KEY=你的_API_Key
export OPENAI_BASE_URL=https://api.openai.com/v1
export RESUME_PATH=./简历基本信息.txt
export MIN_SALARY_K=15
export MAX_SALARY_K=35
export ACTIVE_WITHIN_DAYS=3
export BLOCKED_KEYWORDS=外包,外派,驻场
export ALLOWED_CITIES=上海,苏州
export REQUIRED_INTERNSHIP=true
export TARGET_START_MONTH=2026-06
export MAX_APPLICATIONS_PER_RUN=20
export LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/your-profile/
```

没有 `OPENAI_API_KEY` 时会使用本地模板生成问候语和 LinkedIn 草稿，便于离线测试。

### 运行

运行 Boss：

```bash
npm start -- --platforms=boss
```

运行 Boss 和牛客：

```bash
npm start -- --platforms=boss,nowcoder
```

维护 LinkedIn 个人资料：

```bash
npm start -- --platforms=linkedin
```

同时运行投递和 LinkedIn 维护：

```bash
npm start -- --platforms=boss,nowcoder,linkedin --gui
```

本地 GUI：

```bash
npm start -- --platforms=boss --gui
```

默认地址是 `http://127.0.0.1:3210`，可通过 `GUI_PORT` 修改。

### 真实执行流程

1. 启动命令后，平台适配器打开目标页面。
2. 如果未登录或出现安全验证，脚本暂停，用户在 Chrome 中完成扫码、登录或验证。
3. 适配器读取页面可见文本并解析职位卡片，`jobFilter` 先过滤不合适职位。
4. 对通过过滤的职位，LLM 生成简历摘要和问候语。
5. 平台适配器点击职位、打开沟通或投递入口、输入问候语。
6. 对真实发送、投递、LinkedIn 保存等最终动作，保留人工确认点。

### 测试

```bash
npm test
```

测试覆盖：

- 职位过滤、薪资解析和活跃度解析；
- Boss/牛客页面文本解析；
- Agent Team 过滤后才调用 LLM 和投递；
- LinkedIn 资料维护生命周期；
- LinkedIn 草稿去重和技能提取；
- GUI 状态和 HTML 渲染；
- `.codex/agents/*.toml` 必填字段。

端到端真实投递需要 macOS + Chrome + Codex 插件 + 用户登录会话，不能在纯单元测试中自动完成。
