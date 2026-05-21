# LinkedIn Site Layout Note

## 范围

- 站点：`linkedin.com`
- Team preset：`.codex/teams/linkedin-non-gui.toml`
- GUI 执行者：`computer-use-executor`
- 目标：2026 年 6 月入职，上海/苏州实习；若只有中国远程实习，需用户确认是否接受。

## Subagent 分工

- `manager-agent`：规划 LinkedIn 搜索、筛选、Easy Apply 弹窗探索、简历上传和最终提交停点；所有页面动作派发给 `computer-use-executor`。
- `platform-agent`：解析搜索结果、岗位详情、地点、工作模式、岗位类型、Easy Apply/公司站外申请按钮、岗位描述和弹窗字段。
- `job-filter-agent`：过滤非实习、全职-only、地点不符、届别/入职时间冲突、技能不匹配岗位；中国远程岗位需要标记为待确认。
- `resume-agent`：生成 LinkedIn/Easy Apply 专用 PDF，严禁新增简历不支持的技术或经历。
- `chat-agent`：仅在申请流程出现可选 recruiter note/cover letter 文本框时生成草稿。
- `computer-use-executor`：唯一执行 LinkedIn 搜索、结果点击、Easy Apply 弹窗、文件上传、页面滚动和最终停点定位等 GUI 动作。

## 页面信息位置

- 顶部搜索栏：关键词、地点、搜索按钮。
- 筛选条：发布日期、经验资历、快速申请、公司、远程办公、全部筛选条件。
- 左侧结果列表：岗位标题、公司、地点、发布时间、快速申请标签。
- 右侧详情面板：岗位标题、公司、地点、发布时间、申请人数、工作模式、岗位类型、`快速申请` 或 `申请` 按钮、职位简介、公司简介。
- Easy Apply 弹窗：联系方式、手机号、简历选择/上传、附加问题、复核页、最终 `Submit application`。

## 实测搜索记录

- 初始页面：`软件工程师 - 新加坡`，不符合上海/苏州实习目标。
- 实测搜索 URL：`https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer%20Intern%202026&location=Shanghai%2C%20China&f_TPR=r604800&f_E=1%2C2&f_AL=true&sortBy=R`
- 搜索结果：`Software Engineer Intern 2026 - 中国 上海市 上海市`，2 条结果。
- 候选岗位：Bybit Fintech Limited `Golang Development Engineer Intern`
- 实际地点：第一条显示中国远程办公；第二条显示亚太地区远程办公。
- 标签：`远程办公`、`实习`、`快速申请`
- 要求：2026 或 2027 届，本科及以上；Go 后端、高并发微服务、系统优化、计算机网络、操作系统、数据结构与算法、SQL/MySQL/Redis、中英文沟通；至少 6 个月、每周 5 天实习。
- 待确认：不是明确上海/苏州线下或混合岗位，属于中国/亚太远程，需要用户确认是否接受。

## Easy Apply 流程

1. `computer-use-executor` 运行 LinkedIn 搜索 URL，读取结果数和候选列表。
2. `platform-agent` 解析候选岗位字段，`job-filter-agent` 标记是否符合或待确认。
3. `resume-agent` 生成专用 PDF，例如 `generated/uploads/linkedin-bybit.pdf`。
4. `computer-use-executor` 点击候选岗位的 `快速申请`，仅打开申请弹窗。
5. 第一屏为联系方式：邮箱可能预填，国家区号和手机号可能必填。
6. 手机号属于个人联系方式外发。若为空，必须向用户确认后才能填写。
7. Resume 步骤：实测存在已选 PDF、下载按钮、单选选择状态，以及 `Upload resume` 按钮。
8. `Upload resume` 支持 DOC/DOCX/PDF，大小限制 2MB。
9. 后续步骤可能出现附加问题、复核页面。
10. 上传 PDF 后停在最终 `Submit application` 或中文等价按钮前。

## 投递工作流

1. `manager-agent` 派发 `run_linkedin_search` 给 `computer-use-executor`：打开搜索 URL，报告结果。
2. `manager-agent` 派发 `capture_linkedin_job_detail` 给 `computer-use-executor`：选中候选并读取详情面板。
3. `platform-agent` 标准化岗位字段。
4. `job-filter-agent` 判断是否合格；远程/非上海苏州明确标记待确认。
5. `resume-agent` 生成 LinkedIn 专用 PDF。
6. `manager-agent` 派发 `open_linkedin_easy_apply` 给 `computer-use-executor`：打开弹窗并报告必填字段。
7. 若弹窗要求手机号、地址、签证状态等敏感/高影响字段，`manager-agent` 先向用户确认，确认后才派发填写任务。
8. `manager-agent` 派发 `advance_to_linkedin_resume_step` 给 `computer-use-executor`：在已确认联系方式后进入 Resume 页并读取当前简历选择。
9. `manager-agent` 派发 `upload_linkedin_resume` 给 `computer-use-executor`：上传指定 PDF，并确认文件小于 2MB。
10. `manager-agent` 派发 `capture_linkedin_additional_questions` 给 `computer-use-executor`：读取后续必填问题，不猜测答案。
11. `manager-agent` 派发 `handoff_before_linkedin_submit` 给 `computer-use-executor`：到最终复核页，报告所有答案和附件，不提交。
12. 用户确认后，才可派发最终提交任务。

## Computer Use 原子任务

- `run_linkedin_search`：打开关键词/地点/筛选 URL，读取结果数和首屏岗位。
- `capture_linkedin_job_detail`：点击候选并读取右侧详情。
- `open_linkedin_easy_apply`：点击 `快速申请`，只打开弹窗。
- `fill_linkedin_confirmed_contact`：在用户确认后填写手机号/区号等联系方式。
- `advance_to_linkedin_resume_step`：进入 Resume 页，读取已选简历、下载按钮、单选状态和 `Upload resume` 控件。
- `upload_linkedin_resume`：上传指定 PDF。
- `capture_linkedin_additional_questions`：读取 Easy Apply 后续问题和当前值，不填写未确认答案。
- `handoff_before_linkedin_submit`：停在最终提交按钮前并报告表单状态。

## 最终停点

- 停在 `Submit application`/最终提交按钮前。
- 不自动提交申请，不自动发送 recruiter note，不自动保存公开资料。
