# 另一个你 · 三国人格 Demo

## 当前状态（2026-09-13，以本节为准）

通过 GitHub 搬到另一台 Mac：见 [GitHub 迁移说明](GITHUB-MIGRATION.md)。源码可直接克隆，含凭据和历史数据的完整包以加密 Release 附件提供。

- 已上线 GLM 优先的 JSON 报告管线，失败由算法兜底；8 位人物肖像、故事背景和随机配乐已内置。
- 18 道题中随机抽取 3 道故事题；使用 `/sanguo/:sessionId` 专属链接，不需要登录。
- 会话以服务端内存及 `/var/lib/another-you/projects/sanguo/sessions/` 的文件为准；浏览器 sessionStorage 仅暂存未提交草稿。
- 每链接累计 3 次成功 AI 报告；失败不扣次数，重新探索不恢复额度。已移除 IP 限流和公开创建链接入口。
- 自动保存、冲突处理、断网草稿恢复和生成响应丢失恢复已覆盖，当前 41 项测试通过。
- 迁移工具位于 `tools/migration/`；连接服务器使用 `tools/server-connect.sh`。完整迁移包根目录的 `迁移说明.md` 提供新 Mac 的启动步骤。
- 下文为开发历史记录，旧 API、每日配额、纯算法或无 LLM 等描述不代表当前行为。当前实现以 `server.mjs`、`services/` 和 `src/` 为准。

入口：http://115.29.221.43

## 当前可用
- 青绿山水风格的响应式落地页
- 18 道情境题，8 个三国人物原型，6 个偏好维度
- 浏览器暂存答案，刷新恢复答题与结果；回退修改、重新测试
- 确定性计分、前三原型组合、完整预写报告
- PNG 分享卡下载与分享文案复制（含 HTTP 回退）
- Fastify 服务端校验与计分，匿名事件记录，限流与响应安全头

娱乐与自我探索用途，分数不是心理测量。没有真实支付、没有 LLM 请求、没有用户账号。

## 本地开发
Node >=22.12。

```sh
npm ci
npm run build
npm test
npm start
```
打开 http://127.0.0.1:3000 。前端开发运行 `npm run dev`；生产服务同源提供静态资源与 API。

## 服务器
- 实例：i-bp1d8o6u6htjltdnfxxh，杭州，Alibaba Cloud Linux 4
- 应用：/opt/another-you
- 服务：another-you.service，使用专用非登录系统用户 another-you
- 系统 Node 22；systemd 开机启动、失败重启
- 数据：/var/lib/another-you/events.jsonl（仅事件名、时间、题号；没有原始答案/身份）
- 只开放 TCP 80；未增加 SSH 规则
- GET /api/health
- POST /api/v1/quiz/sanguo/submit {"answers":[0,1,...]}，恰好18个0..3整数
- POST /api/v1/events

查看状态和日志：
```sh
systemctl status another-you
journalctl -u another-you -n 50
```
停止：`systemctl stop another-you`。

## 计分
各维度选中次数 / 该维度在题目中的出现次数，得到0..100偏好分。
将偏好向量按最大值归一后，与人物向量计算欧氏距离。
前三距离经 exp(-distance/20) 转换为归一权重，整数占比合计100%。
这些是可解释的娱乐规则，未经心理学效度验证；原型和题库集中在 shared/engine.mjs。

## 后续
1. 域名、HTTPS。
2. 正规支付渠道、签名回调、幂等订单与退款流程。
3. PostgreSQL 持久化结果/会话/订单，按会话统计转化漏斗（目前只有匿名事件）。
4. 外部 LLM 结构化解读；固定算法仍决定人物，配置预算、超时和规则回退。
5. Theme Pack 配置拆分、后台与主题扩展。
6. 正式部署可迁入原会话的 Docker Compose + Caddy + PostgreSQL 架构；demo 暂用 systemd，减少启动依赖。

验证：TypeScript/Vite 构建，3组计分测试（100组确定性样本、非法输入、原型多样性），API状态码检查；浏览器完成18题、报告展开、PNG下载。

## v0.2：LLM 优先的三国故事报告

当前实现以用户答案、三国情境和候选人物为输入，调用服务端 GLM，输出 JSON，再由工程校验并生成报告。固定算法仅用于输入验证与异常兜底，不向模型提供算法人物或分数。

- PE：`prompts/sanguo-persona.md`，与部署包一起上传，未放入静态目录。
- GLM 通用 Chat Completions 接口；`response_format: json_object`；最多2400输出token，45秒超时，无自动重试。
- 校验：3个不同合法人物、降序整数占比合计100、6个0..100维度、长度受限的正文、3个不同合法题号。
- 兜底：服务端异常 / 超时 / 非法JSON / 不完整结构 / 配额不足 → 算法报告；前端请求或校验异常 → 本地算法；渲染异常 → 基础报告边界。
- 缓存：答案、PE、模型及schema版本的hash；同一在途请求合并。每日生成次数记到磁盘，默认20次（UTC日），重启保留计数；最多2个并行模型请求。
- API 现在返回 `{ report, source: 'llm' | 'algorithm', reason?, cached? }`。
- 报告含“你的选择”及对应解读。刷新后保留原报告，不会重跑模型。
- 8个三国故事情境，注明演义灵感 / 假设改编；题库版本已升级，旧答案不映射到新题。
- 原创配乐《江上春风》：16小节、100 BPM、五声音阶拨弦合成，Web Audio本地生成循环。用户点击开启/暂停；切后台暂停。没有使用影视游戏录音。
- 视觉：汉末城楼、战旗、东吴船队与赤壁江岸，沿用轻量SVG。

### 模型启用

Coding Plan 套餐不覆盖自建网站 API 调用；需使用通用 API 和相应费用授权。默认 `LLM_ENABLED=false`，不发起真实请求。
参考 `infra/llm.env.example`，由 root 写入 `/etc/another-you.env`，权限0600，systemd 用 `EnvironmentFile=/etc/another-you.env` 加载。确认授权和可用key后设置 `LLM_ENABLED=true`，重启 `another-you`。不要把 key 写入源代码或前端环境变量。

真实付费调用尚未验证；已有8组单元/集成测试通过，含模拟模型成功、缓存、并发合并、每日预算持久化，以及各种异常兜底。`tests/preview-server.mjs` 仅供本地浏览器模拟正常模型路径，不部署到服务器。

### 随机故事与 IP 频率控制
每轮通过 `/api/v1/quiz/sanguo/session` 随机无放回抽 3 个故事，保留总共 18 题。浏览器保存 storyIds，提交时服务器重建同一份问卷；LLM、算法和报告证据均使用本轮题目，报告缓存包含问卷内容。
IP 缓存为当前单 Node 进程内的 10000 条 LRU，按分钟过期，重启后重置。默认 120 次访问/分钟，开卷 10 次/分钟，报告提交 3 次/分钟。白名单通过 `/etc/another-you.env` 的 `IP_WHITELIST` 配置，匹配真实 socket 来源，不信任转发头。当前测试出口变更后需更新白名单；没有每日生成总量上限。

### 优势报告与历史人物肖像
报告契约升级为 sanguo-report-3：spark 表达优势发挥场景，不再使用 shadow 字段。LLM 和算法兜底均聚焦有选择依据的正向解读。浏览器存储升级为 v5，旧版报告不会套用新版字段。首页主按钮文案居中；证据卡用独立底色与加粗文本标记实际选择；优势、气质分别展示。
人物图库为 8 位固定原型各一张 AI 艺术肖像，结果按核心人物匹配，原始 PNG 与提示词保存于 output/portraits，网站采用 public/portraits 内的 WebP。容貌不是已知真实相貌复原，资料与艺术边界见图库 README。
