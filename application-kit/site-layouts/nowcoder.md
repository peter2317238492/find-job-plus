# 牛客网 Site Layout Note

## 范围

- 站点：`nowcoder.com`
- Team preset：`.codex/teams/nowcoder-non-gui.toml`
- GUI 执行者：`computer-use-executor`
- 目标：2026 年 6 月入职，上海/苏州，实习岗位，基于 `在线简历.pdf` 匹配并生成定制简历。

## Subagent 分工

- `manager-agent`：拆分牛客岗位详情读取、弹窗探索、简历下拉框选择/上传、意向城市选择和投递停点；所有页面动作派发给 `computer-use-executor`。
- `platform-agent`：解析牛客岗位标题、公司、城市、薪资、学历、关键词、投递时间、职责、要求、招聘者反馈率和申请弹窗字段。
- `job-filter-agent`：检查实习标签、城市是否含上海/苏州、届别/入职时间是否冲突、技能是否支持、是否存在外包/外派/驻场风险。
- `resume-agent`：生成牛客专用简历 PDF，并决定在“选择投递简历”下拉框中是否上传附件简历。
- `chat-agent`：仅在牛客出现申请说明/留言框时生成文本草稿。
- `idle-market-agent`：无合格岗位时总结牛客相似岗位要求。
- `computer-use-executor`：唯一执行牛客页面点击、下拉框展开、附件上传、城市选择和最终按钮定位等 GUI 动作。

## 页面信息位置

- 求职首页：`https://www.nowcoder.com/jobs/recommend/campus`
- 校招职位页：`https://www.nowcoder.com/jobs/school/jobs?...`
- 已验证详情页示例：`https://www.nowcoder.com/jobs/detail/436509?...`
- 顶部岗位卡：岗位标题、薪资、岗位类别、城市列表、学历、收藏/申请按钮。
- 招聘者行：招聘者姓名、公司、职位、反馈率、反馈时长。
- 正文区：岗位关键词、投递时间、岗位职责、岗位要求。
- 右侧栏：公司信息、相似岗位。
- 申请入口：岗位卡右侧 `立即申请`。
- 申请弹窗：`选择投递简历`、简历下拉框、`意向城市`、最终 `投递简历`。

## 实测岗位记录

- URL：`https://www.nowcoder.com/jobs/detail/442230`
- 岗位：`AI算法/软件工程师 实习`
- 公司：上海华为技术有限公司
- 地点：上海/杭州/西安/东莞/北京
- 薪资：面议
- 学历：本科
- 关键词：大模型推理、智能体
- 投递时间：`2026年3月24日-2028年4月24日`
- 要求：2027届毕业生；Python/C++；PyTorch/TensorFlow；Transformer/BERT/GPT；模型部署经验优先。

## 简历选择/附件上传流程

用户截图确认：牛客的附件简历入口位于 `选择投递简历` 的下拉框中。

1. `computer-use-executor` 点击岗位详情页 `立即申请`，仅打开弹窗。
2. 弹窗中找到 `选择投递简历` 区域，默认显示 `在线简历`，右侧有 `预览`、`编辑`、`重命名` 和下拉箭头。
3. `computer-use-executor` 点击下拉箭头展开菜单。
4. 菜单中会显示当前 `在线简历`，并出现 `上传附件简历` 入口。
5. `manager-agent` 提供牛客专用 PDF 路径，例如 `generated/uploads/nowcoder.pdf`。
6. `computer-use-executor` 点击 `上传附件简历`，选择 PDF，等待上传结果。
7. 上传后应确认弹窗中选中的是附件简历或新上传简历。
8. `computer-use-executor` 记录弹窗中的补充必填项。实测可能包括：微信号、所在地、实习时长、志愿城市、是否调剂、期望工作地点、招聘渠道等。
9. `manager-agent` 判断哪些字段已有用户授权或可从岗位目标确定；涉及联系方式或无法确定的问题时向用户确认。
10. `computer-use-executor` 选择 `意向城市`/`志愿城市`/`期望工作地点`：优先上海，若岗位只支持苏州则选择苏州。
11. 停在 `投递简历` 前。

## 投递工作流

1. `manager-agent` 派发 `open_nowcoder_target` 给 `computer-use-executor`：打开岗位详情，报告登录/安全状态。
2. `manager-agent` 派发 `capture_nowcoder_detail` 给 `computer-use-executor`：读取岗位字段和申请入口。
3. `platform-agent` 标准化岗位字段。
4. `job-filter-agent` 判断是否符合目标。
5. `resume-agent` 生成牛客定制 PDF。
6. `manager-agent` 派发 `open_nowcoder_apply_modal` 给 `computer-use-executor`：打开申请弹窗并报告字段。
7. `manager-agent` 派发 `select_or_upload_nowcoder_resume` 给 `computer-use-executor`：展开简历下拉框，点击 `上传附件简历`，上传指定 PDF。
8. `manager-agent` 派发 `capture_nowcoder_required_fields` 给 `computer-use-executor`：读取微信号、所在地、实习时长、志愿城市、是否调剂、期望工作地点、招聘渠道等字段。
9. `manager-agent` 结合用户授权、目标规则和简历信息生成字段填写计划；不确定或敏感字段先向用户确认。
10. `manager-agent` 派发 `fill_nowcoder_confirmed_fields` 给 `computer-use-executor`：只填写已确认字段。
11. `manager-agent` 派发 `set_nowcoder_intent_city` 给 `computer-use-executor`：选择上海/苏州。
12. `manager-agent` 派发 `handoff_before_nowcoder_submit` 给 `computer-use-executor`：确认选中简历和城市，停在 `投递简历` 前。
13. 用户确认后，才可派发最终投递任务。

## Computer Use 原子任务

- `open_nowcoder_target`：打开岗位详情 URL，等待页面加载。
- `capture_nowcoder_detail`：读取岗位卡、招聘者行、正文、右侧公司信息和申请按钮。
- `open_nowcoder_apply_modal`：点击 `立即申请`，只打开弹窗。
- `select_or_upload_nowcoder_resume`：展开 `选择投递简历` 下拉框，点击 `上传附件简历`，选择指定 PDF，报告是否上传/选中成功。
- `capture_nowcoder_required_fields`：读取申请弹窗中的所有必填补充字段和当前值。
- `fill_nowcoder_confirmed_fields`：只填写 manager 已确认的补充字段，不猜测手机号、微信号等敏感联系方式。
- `set_nowcoder_intent_city`：展开 `意向城市` 下拉框并选择上海/苏州。
- `handoff_before_nowcoder_submit`：停在 `投递简历` 前并报告当前表单状态。

## 最终停点

- 弹窗中已选择简历和意向城市后，停在 `投递简历` 前。
- 不自动点击 `投递简历/确认投递`。
