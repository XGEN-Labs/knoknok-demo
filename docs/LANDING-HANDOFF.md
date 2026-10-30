# Landing 出生资料与信息交接

正式 live Web 在用户确认并签署 Landing 后，先通过 `/api/web/birth-profile` 保存结构化资料，再沿用 `/api/web/chat` 发送已有的一次信息交接，最后确认账号 onboarding 完成。资料保存失败时保留表单，不确认交接或进入首页。浏览页面、恢复会话和切换账号本身不会提交出生资料。

## 结构化资料

GET `/api/web/birth-profile` 返回当前账号绑定的 `agentId`、`roomId`、`version`、`profile`、`profileConsent` 和 `updatedAt`。PATCH 只提交 `{ expectedVersion, profile, profileConsent }`。请求复用 `liveSession.request` 的同源 Cookie、`X-Knok-User-Id`、超时和账号切换取消；浏览器不接触原生凭据。

Landing 将实际填写的称呼映射为 `nickname`，生日、时刻、出生地分别映射为 `birthDate`、`birthTime`、`birthplace`；已知男/女选项映射为 `birthSex`。日期选择器使用公历，因此已填写生日的 `calendar` 为 `solar`。未填字段保持缺省，不将浏览器演示默认值、出生地或设备时区当作答案，不推断 `birthTimezone` 或 `birthTimezoneConfirmed`。签署后保存使用 `profileConsent: true`。

现有出生资料表单仍使用原界面。打开表单读取当前原生版本，提交时保留其他原生资料字段，并使用所读版本进行条件更新。用户明确保存成功后才更新本地资料和离开表单；冲突、失败或切换账号不将旧表单写入新账号。出生草稿明确记录当前账号归属；切换账号或重载后仅保留同一账号的草稿，无归属的旧 UI 缓存需重新读取当前账号资料。选择时区不会自动产生 `birthTimezoneConfirmed: true`。日期、时刻、地点或历法变化会清除旧确认；完全未改变的保存保留确认，并接受后端返回原版本。

## 旧账号补写与聊天兼容

浏览器中已经完成 Landing 的用户，下次主动发送私聊时可补写结构化资料。只有原生 `profile` 为 `null` 且 `version` 为 `0` 才初始化；已有资料或非零版本的清空记录均保持不变。并发初始化冲突后只重新读取赢家，不覆盖它。未完成的本地草稿不自动同意保存。补写失败保留待发送文字，供用户主动重试；补写本身不调用模型，也不发送 Landing 聊天消息。

原有聊天交接回执只证明聊天接口返回了原生 Agent 确认，不能证明结构化资料已存储。已有有效回执时仍可补齐缺失资料，但不会再次发送交接聊天；普通聊天只发送原来的用户输入。旧兼容构建未传入结构化请求能力，保持既有聊天行为。

聊天确认仍要求 `provider=knok-agent, source=model`；fallback 不能充当确认。完整回答以用户消息沿用既有聊天协议，既不修改系统提示词，也不创建 Agent。此修复不增加通用 Memory 写入口，聊天回执也不代表异步 Memory 提取完成。

## 验证与交付边界

- `npm test`：覆盖资料映射、缺省值、存储失败、旧回执补写、已有/清空资料保护、并发版本冲突、账号切换、聊天去重和同源请求。
- `node scripts/verify-birth-profile-browser.mjs`：真实 root app、认证、表单、资料和聊天代码运行于 Chrome，BFF 与影音/世界展示使用明确的本地替身；覆盖旧资料显式补写、失败文字保留、未完成草稿保护、Landing 完成顺序、回执重试、现有出生表单保存、跨标签账号切换，以及同账号/无归属草稿重载。该检查支持不含大型资产的源码 checkout，不证明正式影片、渲染资产或生产服务可用。
- `npm run test:live-browser`：完整 live 构建与原始影音资产的已有检查继续保留，其 BFF fixture 现提供同一出生资料契约。

正式发布需完整 checkout 执行 `npm run build:live`，并部署匹配的 Auth BFF/原生出生资料路由。本轮稀疏 checkout 不含根 `build-manifest.json`、`assets/` 和 `vendor/`；标准 live 构建因缺少 manifest 失败，不能据此生成或验收正式发布产物。页面、服务、数据库及生产环境部署均不在此前端提交内。

2026-10-30 本地证据：基于 `66bc7d3` 的工作差异，在 macOS arm64 / Node v24.17.0 上 `npm test` 48/48 通过；专项 Chrome 检查 10 项通过。标准 `npm run build:live` 因稀疏 checkout 缺少根 manifest 失败，未将替身检查冒称为正式构建或生产验收。
