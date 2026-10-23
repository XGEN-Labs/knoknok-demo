# Landing 信息交接修复

正式 Web 的 landing 原来只在浏览器内保存用户输入。当前修复在用户完成 landing、进入首页之前，把整段流程的实际填写信息组成一次普通用户会话，调用现有 Cookie 认证的 `/api/web/chat`。现有 BFF 将这条完整用户消息交给该账号原有的 Agent，沿用它已有的会话与 Memory 链路。

Prompt 只交接用户称呼、给伙伴取的称呼、出生资料、性别、出生地和当时的自由回答。未填写保持 null，不从演示默认值推断；它明确要求按现有资料／记忆规则处理，不重新引导、不追问、不启动其他任务、不改变之后的流程。回复只作为交接确认，不写进 Web 首页聊天列表或其后续 `messages` 请求。

当前测试阶段，每次成功登录都会重置本次 landing 进度、签约状态及交接回执，从第一步重新填写；不会清除该账号已有聊天或其他资料。刷新页面或恢复已有登录会话仍继续当前进度，不重复重置。收到 `provider=knok-agent, source=model` 的成功响应后，浏览器在当前账号原有数据键下保存本次资料摘要回执；同一次登录内刷新及后续正常聊天复用回执。失败保留资料，留在当前步骤供用户重试；Gemini fallback 不能证明原生 Agent 已收到，因此不记录成功。对于上线时仍保持登录、且已在旧版完成 landing 的用户，在第一次正式聊天前补交一次，成功后正常发出原先那条聊天输入。账号切换取消等待并丢弃旧账号的迟到回执。

这份回执仅证明聊天接口返回了原生 Agent 的确认，不等于 Memory 已完成异步提取。未增加 Memory 写入接口、绕过提取规则或修复 Memory 服务。本次按用户最终要求只交付该 Web bug，不部署 Agent 昵称热修、Memory、iOS 或统一账号改动。

## 构建与部署

- 从最终 Web main 提交的完整 Git checkout 执行 `npm ci`（测试依赖）与 `npm run build`；生产构建本身只需 Node >=22.19、Git、tar，不需要运行 npm 安装。
- 部署 `dist/web/`，不要部署 main 根目录静态文件。脚本 `scripts/build-naming-release.mjs` 固定当前实际页面基线 `9c28e0a9c0d3e1210ef3339ad28bc08ac3e0a45c`，验证原 manifest，再应用仓内 `compat/web-naming/` 文件；不会混入 main 后续其他页面变更。
- 输出 `build-manifest.json` 记录 sourceCommit、dirty、页面基线和全部输出哈希。正式产物必须来自干净受检提交。Git checkout 须包含上述历史基线。
- 只切换 Web 静态目录。沿用当前 `/api/auth/*`、`/api/web/chat` 路由、BFF `web-4946d6ec698d`、Agent `e0372956`、Cookie、账号和房间绑定，不新增服务、环境变量、凭据或数据库迁移。
- 运维保留当前静态版本以便回退；回退仅切 Web 文件，不还原用户数据库或 Memory。

## 验证

`npm test`：9 项定向测试，覆盖完整资料、现有 API 契约、摘要去重、账号切换、并发点击、失败重试与 fallback 不冒充原生确认。

`npm run test:browser`：实际构建页面与 Chrome，使用明确标注的本地 BFF／模型替身，检查 landing 完成、失败留存、每次登录重新填写与交接、正常聊天不夹带交接 prompt、刷新续填和 A-B-A 重登重新开始。需要本机 Chrome；也可通过 `PLAYWRIGHT_MODULE` 指向工作区已安装的 Playwright。结果位于 `dist/landing-evidence/`，不放入公开 Web 目录。

浏览器替身测试不代表线上模型效果或 Memory 已生成记录。按本轮范围，不扩大到 Agent／Memory 的独立诊断或部署。
