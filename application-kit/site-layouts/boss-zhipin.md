# Boss 直聘 Site Layout Note

## 范围

- 站点：`zhipin.com`
- Team preset：`.codex/teams/boss-non-gui.toml`
- GUI 执行者：`computer-use-executor`
- 目标：2026 年 6 月入职，上海/苏州，实习岗位，基于 `在线简历.pdf` 匹配并生成定制简历。

## Subagent 分工

- `manager-agent`：拆分 Boss 搜索、筛选、简历生成、附件上传和沟通停点；所有页面动作派发给 `computer-use-executor`。
- `platform-agent`：从 Boss 页面可见文本提取岗位标题、薪资、城市、公司、招聘者、周出勤、实习周期、岗位描述和按钮标签。
- `job-filter-agent`：过滤非实习、非上海/苏州、明确入职时间冲突、外包/外派/驻场、招聘者不活跃、薪资/地点不匹配岗位。
- `resume-agent`：按岗位要求生成 Boss 专用简历 patch 和短文件名 PDF，不新增原简历不支持的信息。
- `chat-agent`：生成“立即沟通”后的首条问候语；当标题品牌和展示公司不一致时，加入确认直招/合作/外包性质的问题。
- `computer-use-executor`：唯一执行 Boss 页面点击、滚动、上传、定位按钮等 GUI 动作。

## 页面信息位置

- 职位列表页入口：`https://www.zhipin.com/web/geek/jobs?ka=open_joblist`。
- 简历页入口：`https://www.zhipin.com/web/geek/resume`。
- 列表/详情布局：职位列表在左侧，选中职位后详情在右侧。
- 详情页主区域：岗位标题、薪资、地点、学历/经验、实习天数和周期。
- 右侧/公司区域：招聘者姓名和在线状态，公司名称、融资阶段、规模、行业。
- 岗位正文：职责、要求、团队/业务说明、风险关键词。
- 简历入口：顶部导航 `简历 new` 悬浮菜单中有 `附件上传 快速投递心仪职位`；简历页下方有 `附件管理`。
- 附件状态：2026-05-21 实测简历页 `附件管理` 已显示 `boss.pdf`，文件数 `1/3`。
- 最终动作：`立即沟通`、`继续沟通`、`开聊`，这些按钮会向招聘方发起沟通，必须停住确认。

## 实测岗位记录

- URL：`https://www.zhipin.com/job_detail/81f3f76913ea8d1b0nZ429S9F1BZ.html`
- 岗位：`Python开发实习生（拼多多2026暑期实习）`
- 薪资：`300-600元/天`
- 地点：上海
- 实习要求：`5天/周 3个月`
- 学历：本科
- 招聘者：白剑飞，在线
- 展示公司：上海从鲸信息技术
- 风险点：标题引用拼多多，页面公司不是拼多多集团；描述中出现拼多多集团-PDD，需要沟通确认直招/合作/外包性质。

## 附件简历流程

1. `computer-use-executor` 打开 Boss 岗位列表/详情页并读取页面字段。
2. `manager-agent` 汇总字段并交给 `job-filter-agent` 判断是否继续。
3. `resume-agent` 生成定制 PDF，使用短文件名，例如 `generated/uploads/boss.pdf`。
4. `computer-use-executor` 打开顶部 `简历 new` 菜单或简历页 `附件管理`，确认当前附件状态。
5. 如附件不存在或需替换，`computer-use-executor` 点击 `附件上传`/`上传附件简历`。
6. `computer-use-executor` 在文件选择器中选择短文件名 PDF。
7. 页面出现附件预览后，`computer-use-executor` 点击 `确定添加`。
8. 页面提示 `上传成功` 或附件管理显示新文件后停止。

## 实测限制

- Boss 会拒绝过长文件名，提示“文件名称过长，请缩短至中文30字以内或英文60字以内”。
- 后续附件统一使用短文件名，例如 `boss.pdf`。

## 投递工作流

1. `manager-agent` 派发 `open_boss_target` 给 `computer-use-executor`：打开 Boss 标签或 URL，报告登录/安全验证状态。
2. `manager-agent` 派发 `capture_boss_visible_job` 给 `computer-use-executor`：读取岗位详情、公司卡片、招聘者状态、上传/沟通按钮。
3. `platform-agent` 标准化岗位字段。
4. `job-filter-agent` 判断是否符合目标。
5. `resume-agent` 生成 Boss 专用 Typst/PDF。
6. `chat-agent` 生成首条问候语草稿。
7. `manager-agent` 派发 `check_boss_attachment_state` 给 `computer-use-executor`：打开 `简历 new` 菜单或简历页，确认附件管理中是否已有目标 PDF。
8. 必要时，`manager-agent` 派发 `upload_boss_attachment` 给 `computer-use-executor`：上传 PDF 并停在成功状态。
9. `manager-agent` 派发 `handoff_before_boss_chat` 给 `computer-use-executor`：定位到 `立即沟通`，但不点击。
10. 用户确认后，才可派发最终沟通任务。

## Computer Use 原子任务

- `open_boss_target`：打开目标 URL，等待页面加载，报告安全验证/登录阻塞。
- `capture_boss_visible_job`：读取岗位字段和按钮，不点击最终沟通。
- `check_boss_attachment_state`：打开顶部 `简历 new` 菜单或 `web/geek/resume`，读取附件管理状态和文件数。
- `upload_boss_attachment`：点击上传入口，选择指定 PDF，确认添加附件，报告上传结果。
- `handoff_before_boss_chat`：滚动/定位到最终沟通按钮，报告当前停点。

## 最终停点

- 已上传附件后，停在 `立即沟通/继续沟通/开聊` 前。
- 不自动发送问候语，不自动点击最终沟通。
