![WechatIMG54679 (1).png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/22ca5c6850d946d692d59f8bb74c70ef~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1373&h=788&s=308447&e=png&b=3d7ab8)

## Find Job Plus：Agent Team 自动投简历系统

本仓库已从单文件 Boss 直聘脚本重构为一个可扩展的 Agent Team 架构。新结构保留 Boss 直聘自动沟通能力，并新增牛客网适配骨架、职位过滤、简历优化、聊天管理和空闲浏览总结的模块边界。

### Agent Team 架构

核心入口是 `main.js`，实际能力拆到 `src/`：

| 模块 | 责任 |
| --- | --- |
| `src/agents/agentTeam.js` | 协调平台登录、职位获取、过滤、简历优化、投递、消息回复和空闲浏览。 |
| `src/agents/jobFilter.js` | 在调用 LLM 和投递前执行确定性过滤：薪资、招聘者活跃度、屏蔽关键词、公司黑名单。 |
| `src/platforms/boss.js` | Boss 直聘 Selenium 适配器，封装登录、职位读取和发送打招呼消息。 |
| `src/platforms/nowcoder.js` | 牛客网 Selenium 适配器骨架，封装登录、职位读取和投递入口，选择器需要按登录后页面校准。 |
| `src/llm/openaiClient.js` | OpenAI 兼容 LLM 封装，负责简历优化、打招呼、聊天回复和市场总结。 |
| `src/resumeStore.js` | 从配置路径读取本地简历文本。 |
| `src/gui/server.js` | 本地 Web 控制台，显示命令输入、活跃平台、浏览器 URL、当前 agent 操作和日志。 |
| `.codex/agents/*.toml` | 按 OpenAI Codex subagents 规范定义项目内子代理团队。 |

### Codex Subagents 配置

项目内已添加 `.codex/config.toml`：

```toml
[agents]
max_threads = 6
max_depth = 1
```

并按 OpenAI Codex custom agents 文件格式在 `.codex/agents/` 下定义 6 个子代理，每个文件都包含 `name`、`description`、`developer_instructions` 和 `model_reasoning_effort`：

| 子代理 | 文件 | 负责范围 |
| --- | --- | --- |
| `platform-agent` | `.codex/agents/platform-agent.toml` | Boss/牛客平台适配器和 DOM 选择器。 |
| `resume-agent` | `.codex/agents/resume-agent.toml` | 简历读取、简历定制和求职消息提示词。 |
| `chat-agent` | `.codex/agents/chat-agent.toml` | HR 消息处理、回复草稿和人工接管边界。 |
| `job-filter-agent` | `.codex/agents/job-filter-agent.toml` | 职位过滤规则和解释性跳过原因。 |
| `gui-agent` | `.codex/agents/gui-agent.toml` | 本地控制台、状态面板、命令输入和日志。 |
| `idle-market-agent` | `.codex/agents/idle-market-agent.toml` | 无投递/消息时的空闲浏览和市场总结。 |

### 运行方式

1. 安装依赖：

```bash
yarn install
```

2. 设置环境变量：

```bash
set OPENAI_API_KEY=你的 API Key
set OPENAI_BASE_URL=https://api.openai.com/v1
set RESUME_PATH=.\简历基本信息.txt
set MIN_SALARY_K=15
set MAX_SALARY_K=35
set ACTIVE_WITHIN_DAYS=3
set BLOCKED_KEYWORDS=外包,外派,驻场
set MAX_APPLICATIONS_PER_RUN=20
```

3. 运行 Boss 直聘：

```bash
yarn start -- --platforms=boss
```

4. 同时运行 Boss 和牛客：

```bash
yarn start -- --platforms=boss,nowcoder
```

牛客网的登录与投递流程经常变化，`src/platforms/nowcoder.js` 中的 CSS/XPath 是适配骨架。首次使用前需要在登录后的真实页面校准选择器。

5. 启动本地 GUI 控制台：

```bash
yarn start -- --platforms=boss --gui
```

默认地址是 `http://127.0.0.1:3210`，可通过 `GUI_PORT` 修改端口。控制台显示当前活跃平台、浏览器 URL、正在执行的 agent 操作、日志和用户命令输入框。

### 测试

```bash
npm test
```

测试覆盖：

- 薪资和活跃度解析；
- 外包、外派、驻场、公司黑名单过滤；
- Agent Team 在过滤通过后才调用 LLM 和投递；
- 新消息自动回复流程；
- 空闲浏览市场总结流程；
- GUI 状态和 HTML 渲染；
- Boss/牛客平台适配器共享接口；
- `.codex/agents/*.toml` 是否满足 OpenAI Codex subagents 必填字段。

### 安全边界

- 不再在代码中硬编码 API Key，运行时从环境变量读取。
- 过滤规则先于 LLM 调用和投递动作执行，避免浪费每日沟通次数。
- 聊天 Agent 的职责是处理低风险常规回复；薪资谈判、证件材料、面试冲突、合同条款等需要用户确认。
- 简历优化提示词要求不编造经历、不泄露无关隐私。

## 原始操作步骤

1. 点击链接获取自己免费的 apikey：[GPT-API-free 项目](https://gitcode.com/chatanywhere/gpt_api_free/overview)
2. 全局搜索【你的 apiKey】字段，替换为你自己的 apikey
3. 修改你自己的简历基本信息.txt
4. yarn install && yarn start 启动运行

## 一、前言

最近在 GitHub 上发现了一个非常有意思的项目：[GitHub链接](https://github.com/Frrrrrrrrank/auto_job__find__chatgpt__rpa)。

该作者巧妙地结合 `GPT` 和 `RPA` 技术，打造了一个自动投简历助手。这是原作者分享的效果展示视频：[B站视频链接](https://www.bilibili.com/video/BV1UC4y1N78v/?share_source=copy_web&vd_source=b2608434484091fcc64d4eb85233122d)。

然而，由于原项目存在以下问题：

- 代码使用 **Python** 编写，对于前端开发者不够友好。
- 运行该项目需要充值 **OpenAI** 账户，而且只支持使用国外的信用卡，国内用户想充钱都没地。
- 运行该项目还需要配置代理，对一些用户而言可能不太友好。

折腾无果，遂决定使用 **Node.js** 重新实现该项目，并且完全免费、一键运行，无需设置代理：[GitHub项目地址](https://github.com/noBaldAaa/find-job)。


在这个寒冷的招聘季，这个脚本能为您提供一些帮助，为您带来一些温暖。如果您觉得这个项目有价值，希望您能帮忙点个 [star](https://github.com/noBaldAaa/find-job)，将不胜感激。

## 二、整体思路

首先，我们会使用 [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) 来模拟用户行为，该库是一个强大的自动化测试工具。它能够通过编程方式控制浏览器交互，通常用于自动化测试、网页抓取以及模拟用户交互等任务。

1. 用 [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) 模拟用户打开浏览器窗口，并导航至直聘网的主页。
2. 等待页面加载完成，找到登录按钮的 `DOM` 节点，模拟用户点击触发登录，等待用户扫码操作。
3. 在用户成功扫码登录后，进入招聘信息列表页面。
4. 遍历招聘信息列表，对每一项进行以下操作：
    - 点击招聘信息，找到该项招聘信息的职位描述信息
    - 结合上传的简历信息与招聘信息传递给 `GPT`，等待 `GPT` 的响应
    - 在 `GPT` 响应后，点击“立即沟通”按钮，进入沟通聊天界面
    - 在聊天界面中找到输入框，将 `GPT` 返回的信息填入聊天框，并触发发送事件
    - 返回招聘信息列表页面，点击下一项招聘信息
    - 重复上述步骤，遍历下一项招聘信息的职位描述信息

## 三、具体实现

### 3.1、获取免费的 API Key 并初始化 OpenAI 客户端

做过 GPT 开发的应该知道，调用 GPT 的接口是要付费的，而且充值过程异常繁琐，需要使用境外银行卡。

为了简化这个过程，我在 [GitCode 上找到了一个提供免费 API_KEY 的项目](https://gitcode.com/chatanywhere/gpt_api_free/overview)，只需使用 GitHub 账户登录即可轻松领取。

这样你就可以用免费的 `API_KEY` 来初始化 OpenAI 客户端。

```js
// 初始化OpenAI客户端
const openai = new OpenAI({
  // 代理地址，这样国内用户就可以访问了
  baseURL: "https://api.chatanywhere.com.cn",
  apiKey: "你的apiKey",
});
```

### 3.2、模拟用户打开浏览器并前往主页

在这一步中，我们要实现的是打开浏览器并导航至指定的 URL。具体操作就是调用 [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) 的 API，直接上代码：

```js
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

// 全局 WebDriver 实例
let driver;

// 使用指定的选项打开浏览器
async function openBrowserWithOptions(url, browser) {
  const options = new chrome.Options();
  options.addArguments("--detach");

  if (browser === "chrome") {
    // 初始化一个谷歌浏览器客户端
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();
    // 全屏打开浏览器
    await driver.manage().window().maximize();
  } else {
    throw new Error("不支持的浏览器类型");
  }

  await driver.get(url);

  // 等待直到页面包含登录按钮dom
  const loginDom = By.xpath("//*[@id='header']/div[1]/div[3]/div/a");
  await driver.wait(until.elementLocated(loginDom), 10000);
}

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    await openBrowserWithOptions(url, browserType);

  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}

const url =
  "https://www.zhipin.com/web/geek/job-recommend?ka=header-job-recommend";
const browserType = "chrome";

main(url, browserType);
```

### 3.3、找到登录按钮的DOM节点并点击

这一步中我们需要找到 **登录按钮** 的 DOM 节点，然后模拟点击登录。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6a0c506acc6d4441805a97b0cc1c4cda~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2636&h=978&s=791947&e=png&b=fdfcfc)

```js
// 省略上一步的代码

// 点击登录按钮，并等待登录成功
async function logIn() {
  // 点击登录
  const loginButton = await driver.findElement(
    By.xpath("//*[@id='header']/div[1]/div[3]/div/a")
  );
  await loginButton.click();

  // 等待微信登录按钮出现
  const xpathLocatorWechatLogin =
    "//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a";
  await driver.wait(
    until.elementLocated(By.xpath(xpathLocatorWechatLogin)),
    10000
  );

  const wechatButton = await driver.findElement(
    By.xpath("//*[@id='wrap']/div/div[2]/div[2]/div[2]/div[1]/div[4]/a")
  );
  // 选择微信扫码登录
  await wechatButton.click();

  const xpathLocatorWechatLogo =
    "//*[@id='wrap']/div/div[2]/div[2]/div[1]/div[2]/div[1]/img";
  await driver.wait(
    until.elementLocated(By.xpath(xpathLocatorWechatLogo)),
    10000
  );

  // 等待用户扫码，登录成功
  const xpathLocatorLoginSuccess = "//*[@id='header']/div[1]/div[3]/ul/li[2]/a";
  await driver.wait(
    until.elementLocated(By.xpath(xpathLocatorLoginSuccess)),
    60000
  );
}

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    // 点击登录按钮，并等待登录成功
+   await logIn();

  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}
```

### 3.4、遍历招聘信息列表

登录成功后进入到招聘信息列表页面，这一步中我们需要遍历招聘信息并依次点击，找到每一项招聘信息的职位描述信息，如图所示：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/815baed21b834a11b5744804c97134fd~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2358&h=1552&s=1056779&e=png&b=fdfcfc)

```js
// 省略上一步的代码

// 根据索引获取职位描述
async function getJobDescriptionByIndex(index) {
  try {
    const jobSelector = `//*[@id='wrap']/div[2]/div[2]/div/div/div[1]/ul/li[${index}]`;
    const jobElement = await driver.findElement(By.xpath(jobSelector));
    // 点击招聘信息列表中的项
    await jobElement.click();

    // 找到描述信息节点并获取文字
    const descriptionSelector =
      "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p";
    await driver.wait(
      until.elementLocated(By.xpath(descriptionSelector)),
      10000
    );
    const jobDescriptionElement = await driver.findElement(
      By.xpath(descriptionSelector)
    );
    return jobDescriptionElement.getText();
  } catch (error) {
    console.log(`在索引 ${index} 处找不到工作。`);
    return null;
  }
}

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    // 点击登录按钮，并等待登录成功
    // 开始的索引
+   let jobIndex = 1;

+   while (true) {
+     // 获取对应下标的职位描述
+     const jobDescription = await getJobDescriptionByIndex(jobIndex);
+     console.log(`职位描述信息/n：${jobDescription}`);
+     if (jobDescription) {
+        //
+     }
+     jobIndex += 1;
    }
  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}
```

接着结合上传的简历信息与招聘信息传递给 `GPT`，等待 `GPT` 的响应：

```js
// 省略上一步的代码

// 读取简历信息
const getResumeInfo = () => {
  fs.readFile("./简历基本信息.txt", "utf8", (err, data) => {
    if (err) {
      console.error("读取文件时出错:", err);
      return;
    }
    // 输出文件内容
    return data;
  });
};

// 与GPT进行聊天的函数
async function chat(jobDescription) {
  // 获取简历信息
  const resumeInfo = getResumeInfo();
  const askMessage = `你好，这是我的简历：${resumeInfo}，这是我所应聘公司的要求：${jobDescription}。我希望您能帮我直接给HR写一个礼貌专业的求职新消息，要求能够用专业的语言将简历中的技能结合应聘工作的描述，来阐述自己的优势，尽最大可能打动招聘者。并且请您始终使用中文来进行消息的编写,开头是招聘负责人。这是一封完整的求职信，不要包含求职信内容以外的东西，例如“根据您上传的求职要求和个人简历，我来帮您起草一封求职邮件：”这一类的内容，以便于我直接自动化复制粘贴发送，字数控制在80字左右为宜`;
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: askMessage,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    // 获取gpt返回的信息
    const formattedMessage = completion.choices[0].message.content.replace(
      /\n/g,
      " "
    );
    return formattedMessage;
  } catch (error) {
    console.error(`gpt返回时发生错误: ${error}`);
    const errorResponse = JSON.stringify({ error: String(error) });
    return errorResponse;
  }
}

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    // 点击登录按钮，并等待登录成功
    // 开始的索引
    while (true) {
      // 获取对应下标的职位描述
      if (jobDescription) {
        // 发送描述到聊天并打印响应
 +      const response = await chat(jobDescription);
 +      console.log("gpt给的回复", response);
      }
      jobIndex += 1;
    }
  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}
```

GPT 响应完成后，找到 **立即沟通按钮** 并模拟点击，此时进入沟通聊天界面，如图所示：

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b7627949cc6f4cfdbabd25e9ced25a56~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2520&h=1198&s=866326&e=png&b=fdfcfc)

```js
// 省略上一步的代码

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    // 点击登录按钮，并等待登录成功
    // 开始的索引
    while (true) {
      // 获取对应下标的职位描述
      if (jobDescription) {
        // 发送描述到聊天并打印响应
        // 点击沟通按钮
+       const contactButton = await driver.findElement(
+         By.xpath(
+           "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[1]/div[2]/a[2]"
+         )
+       );
+       await contactButton.click();
      }
      jobIndex += 1;
    }
  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}
```

此时进入到聊天界面，将 GPT 的返回信息填入到输入框中，触发发送事件。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0d6fc2bb7ca24947b29fd1ce4f1fc42b~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2408&h=1738&s=477876&e=png&b=fefdfd)

```js
// 省略上一步的代码

// 发送响应到聊天框
async function sendResponseToChatBox(driver, response) {
  try {
    // 请找到聊天输入框
    const chatBox = await driver.findElement(By.xpath("//*[@id='chat-input']"));

    // 清除输入框中可能存在的任何文本
    await chatBox.clear();

    // 将响应粘贴到输入框
    await chatBox.sendKeys(response);
    await sleep(1000);

    // 模拟按下回车键来发送消息
    await chatBox.sendKeys(Key.RETURN);
    await sleep(2000); // 模拟等待2秒
  } catch (error) {
    console.error(`发送响应到聊天框时发生错误: ${error}`);
  }
}

// 主函数
async function main(url, browserType) {
  try {
    // 打开浏览器
    // 点击登录按钮，并等待登录成功
    // 开始的索引
    while (true) {
      // 获取对应下标的职位描述
      if (jobDescription) {
        // 发送描述到聊天并打印响应
        // 点击沟通按钮
        // 等待回复框出现
+       const chatBox = await driver.wait(
+         until.elementLocated(By.xpath("//*[@id='chat-input']")),
+         10000
+       );

+       // 调用函数发送响应
+       await sendResponseToChatBox(driver, response);

+       // 返回到上一个页面
+       await driver.navigate().back();
+       await sleep(2000); // 模拟等待3秒
      }
      jobIndex += 1;
    }
  } catch (error) {
    console.error(`发生错误: ${error}`);
  }
}
```

发送完成后返回招聘列表页面，以此往复。

## 四、最后

该项目只是简单的将简历信息结合职位信息发送给 GPT，然后用 GPT 的回复发送给招聘者，实际上并没有什么难度，意在抛砖引玉。

这里其实还有更优雅的做法，比如将个人简历传给 GPT，让 GPT 去提炼有效信息（原作者就是这么做的）。但由于 [GPT-API-free 项目](https://gitcode.com/chatanywhere/gpt_api_free/overview) 并没有提供 [assistant](https://platform.openai.com/docs/assistants/overview) 服务，实现这一点需要付费，有充值渠道的朋友可以尝试一下。

此外，对于有兴趣的朋友，还可以进一步深挖，例如：

- 根据职位详情进行分词权重分析，生成岗位热点词汇云图，帮助分析简历匹配度
- 自动过滤掉最近未活跃的 Boss 发布的信息，以免浪费每天的 100 次机会
- 设置过滤薪资范围，防止无效投递
- 自动检测上下文，排除【外包、外派、驻场】等字眼的职位信息
- ...


> 最后，这里重申原作者的观点：
> 
> 希望不要有人拿着我的脚本割韭菜，都已经被逼到用这种脚本投简历的地步了，还有啥油水可去榨，当个人吧。

## 五、推荐阅读
1. [从零到亿系统性的建立前端构建知识体系✨](https://juejin.cn/post/7145855619096903717)
2. [我是如何带领团队从零到一建立前端规范的？🎉🎉🎉](https://juejin.cn/post/7085257325165936648)
3. [二十张图片彻底讲明白Webpack设计理念，以看懂为目的](https://juejin.cn/post/7170852747749621791)
4. [【中级/高级前端】为什么我建议你一定要读一读 Tapable 源码？](https://juejin.cn/post/7164175171358556173)
5. [前端工程化基石 -- AST（抽象语法树）以及AST的广泛应用](https://juejin.cn/post/7155151377013047304)
6. [线上崩了？一招教你快速定位问题！](https://juejin.cn/post/7166031357418668040)
7. [【Webpack Plugin】写了个插件跟喜欢的女生表白，结果.....](https://juejin.cn/post/7160467329334607908)
8. [从构建产物洞悉模块化原理](https://juejin.cn/post/7147365025047379981)
9. [Webpack深度进阶：两张图彻底讲明白热更新原理！](https://juejin.cn/post/7176963906844246074)
10. [Esbuild深度调研：吹了三年，能上生产了吗？](https://juejin.cn/post/7310168607342624808)

