# 名片后端接口与前端数据契约

更新：2026-10-30 · 对应空标签排版修复 `card-empty-84`。

## 1. 接入状态

当前名片编辑、标签管理、分享和 PNG 导出仍使用浏览器内的产品实现。保存名片执行 `UPDATE_PROFILE`，随后写入账号对应的浏览器状态；没有调用名片 GET/PATCH 接口。分享链接使用 `#card=<base64url JSON>`，PNG 由浏览器 Canvas 绘制。

认证、首次 Landing、私人聊天及聊天历史已有 API 调用适配。**这些适配不代表名片已具备后端持久化。** 公开仓库的 [LIVE-WEB.md](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/docs/LIVE-WEB.md) 明确记录了该缺口；已有原生 profile/groups DTO 不能直接替代当前名片 UI。

本文件第 2–4 节描述已核对的前端契约；第 5 节是供后端实施的建议接口，当前尚未接线或上线。本次改动不新增后端路由、数据库表或原生资料面板。代码核对基线为公开仓库 `f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf`；本轮另修正空标签时的前端排版。

## 2. 现有认证边界

正式 Web 构建通过 `LIVE_WEB=true` 启用同源 Cookie 认证；静态设计 Demo 的 `deployment-mode.mjs` 仍为 `false`。认证适配器请求使用 `credentials: include`、`mode: same-origin`、`redirect: error`、`cache: no-store`。需要 JSON body 时发送 `Content-Type: application/json`，所有请求接受 JSON。

| 方法与路径 | 请求 | 前端要求的成功响应 |
| --- | --- | --- |
| `POST /api/auth/entry` | `{ "username": "example" }` | `{ "username": "example", "nextAction": "login" }`；或 `nextAction: "register"` 并提供 `passwordMode: "set_password"` / `"assigned_password"` |
| `POST /api/auth/sign-in` | `{ "username": "example", "password": "用户输入" }` | `{ "user": { "id": "user_123", "username": "example" }, "nextAction": "bootstrap" }` |
| `POST /api/auth/register` | 同上 | 同上；随后读取 bootstrap，不能仅凭注册响应认定 Agent 已绑定 |
| `GET /api/auth/bootstrap` | 无 body | 下方 bootstrap 结构 |
| `POST /api/auth/logout` | 无 body，由主页面配置此路径 | 成功 JSON 或 `204`；退出后清除当前会话状态 |
| `POST /api/auth/onboarding/complete` | `{}`，另带 `X-Knok-User-Id` | `{ "onboarding": { "status": "completed" } }` 或 `not_required`；不能返回 `required` 冒充完成 |

Bootstrap 结构示例（示例值，不是线上实测回包）：

```json
{
  "user": { "id": "user_123", "username": "example" },
  "accountStatus": "registered",
  "nextAction": "open_chat",
  "agent": { "status": "bound", "agentId": "agent_123", "roomId": "room_123" },
  "memory": { "status": "not_loaded" },
  "onboarding": { "status": "completed" }
}
```

`user.id` 可为非空字符串或有限数字，`username` 必须非空。未绑定时允许 `nextAction: "setup_agent"` 与 `agent.status: "setup_required"`。`onboarding.status` 仅允许 `required` / `completed` / `not_required`；旧响应未含 onboarding 时按 `not_required` 兼容。`memory` 可缺省，前端默认 `not_loaded`。

认证错误优先读取 `{ "error": { "code": "invalid_credentials", "message": "错误说明" } }`，也兼容顶层 `code` / `message`。`401` 失效会话、`409 account_exists/account_not_found` 状态变化、`429` 限流与 `Retry-After`（秒数或 HTTP 日期）、`503` 暂不可用均有前端处理。网络中断或非法成功回包不会自动重发注册操作，会先检查 bootstrap。

`compat/web-naming/api.mjs` 中仍有旧 `/api/auth/me`、`/api/auth/login` 适配；主页面使用上表的用户名优先流程，新增名片接口不应误接到旧登录流程。`X-Knok-User-Id` 是账号一致性检查输入，后端仍必须以 Cookie 会话校验所有权。

## 3. 公共名片快照 `PublicCardSnapshot`

该对象由 `publicCardData()` 明确挑选字段，供 `cardMarkup()`、`renderCardImage()` 和分享编码共同消费。不要直接序列化整个用户、生日、聊天、Memory、标签来源日记或 Agent 凭据。

```json
{
  "name": "荣昱",
  "bio": "一起收集生活里的小发现。",
  "language": "粵語",
  "tags": ["戊土", "摩羯座"],
  "tagCategories": { "戊土": "identity", "摩羯座": "identity" }
}
```

| 字段 | 类型与上限 | 缺省与处理 |
| --- | --- | --- |
| `name` | 必填字符串，最多 40 个 Unicode 码点，清理后非空 | 公共快照校验拒绝空姓名；`publicCardData()` 从资料生成快照时可回退为“新朋友” |
| `bio` | 字符串，最多 180 个码点 | 缺省为 `""`；空白经 trim 后视为无简介；`null` 非法。当前编辑表单更窄，为 `maxlength=160` |
| `language` | 字符串，最多 24 个码点 | 缺省为 `""`，不显示空文字；`null` 非法 |
| `region` | 可选字符串，最多 60 个码点 | 只有用户启用 `shareRegion` 时才进入公共快照；空值省略。隐藏城市不等于删除账号的私有城市资料 |
| `tags` | 字符串数组，最多 7 枚，每枚最多 24 个码点 | 缺省归一为 `[]`；显式 `[]` 表示没有公开展示标签；`null` 或非数组非法 |
| `tagCategories` | 可选 `label → category` 对象 | 只保留当前 `tags` 中的键；值仅为 `identity`、`daily`、`skills`、`exploration`。非法/多余映射忽略 |
| `avatar` | 可选 PNG/JPEG/WebP 的 base64 data URL | 缺省或 `""` 使用默认头像；不接受远程 URL、SVG、HTML、`null` |
| `design` | 可选整数，`0..4294967295` | 只为旧链接兼容；当前使用统一版式与配色，不据此切换名片设计 |

快照长度按 `Array.from(value).length` 计算，不等同于 UTF-8 字节。当前 HTML 编辑表单的姓名 `maxlength=18`、简介 `maxlength=160` 是表单约束，不能误写成公共快照解码上限。

标签清理控制字符和连续空白，去掉空项，按第一次出现的顺序去重；顺序就是展示顺序，后端不要按类别或字母重新排序。严格快照校验先检查原数组是否超过 7 项、原字符串是否超过 24 个码点，再做清理。候选标签、隐藏标签及来源历史不进入此数组。旧 `labels.rhythm` / `labels.social` 会迁移追加到 `tags`，每组最多 2 项、每项 16 个码点；**新接口不要再发送 `labels`，否则 `tags: []` 也可能从旧字段恢复标签。**

头像解码后的文件不得超过 **16,384 字节**，data URL 字符串不得超过 **21,900 字符**，并校验规范 base64 与对应文件签名。当前上传 UI 接受不超过 12 MiB 的 PNG/JPEG/WebP 原文件，居中裁为 96×96，再转 WebP；生成字符串超过 16,000 字符时提示换图。这是浏览器预处理，不是已有头像上传 API。

分享编码为 UTF-8 JSON → 无 padding 的 base64url。JSON 上限 **24,576 字节**，编码字符串上限 **32,768 字符**；链接片段是可读快照，不是身份凭据、加密数据或服务器签名。`decodeCard()` 对非法输入返回 `null`；`encodeCard()` 抛 `TypeError`，`cardMarkup()` 对非法快照返回空字符串。

## 4. 空标签与无简介的展示契约

合法的最小名片如下；`tags` 缺省在快照读取时也归一为 `[]`。

```json
{ "name": "荣昱", "bio": "", "language": "粵語", "tags": [] }
```

- `tags: []` 只移除标签行，不切换到“大头像居中、姓名置底”的版式，不补“新朋友”等假标签。
- Avatar、姓名、语言的位置和尺寸与有标签时一致；Logo、简介、标签行沿头像外缘左对齐。
- `bio: ""` 或只有空白时，不预留简介空段；卡片按实际内容缩短。
- Logo 与简介共用深褐色 `#5d4033`。页面和 PNG 共享 `cardArtwork()` 几何与颜色，不由后端返回坐标、字号或样式分支。
- 用户明确清空展示标签后，持久化层应保留“已编辑”的选择，映射到当前 `cardTagsEdited=true` 的语义；再次读取/登录不能重新执行初始标签填充。收起全部标签也不应删除私有日记、候选记录或标签历史。

## 5. 建议后端接口（待实现、待前端接线）

以下路径与错误码是本次联调建议，**不是现有服务能力声明**。上线前由后端与前端共同确认路由、存储和验证；当前 Web 不会调用它们。采用同源 Cookie，与既有账号隔离方式一致，账号 ID 从会话确定。

| 方法与建议路径 | 作用 |
| --- | --- |
| `GET /api/profile/card` | 获取当前账号的名片编辑配置及经过公开字段筛选的快照 |
| `PATCH /api/profile/card` | 更新用户明确提交的名片字段；保存成功后返回规范化结果 |

GET / PATCH 成功响应建议共用：

```json
{
  "card": { "name": "荣昱", "bio": "", "language": "粵語", "tags": [] },
  "preferences": { "shareRegion": false }
}
```

`card` 严格遵循上节快照白名单。`preferences` 只给本人编辑使用，不能塞入匿名分享链接。`shareRegion=false` 时 `card.region` 必须省略；城市的私有存储继续归属账号资料。此接口不改变用户的登录名 `username`、Agent 名字、绑定或首次 Landing 状态。

PATCH 示例：清空简介和全部展示标签、恢复默认头像，并关闭公开城市：

```json
{
  "bio": "",
  "tags": [],
  "tagCategories": {},
  "avatar": "",
  "shareRegion": false
}
```

PATCH 语义：

| 输入 | 处理 |
| --- | --- |
| 未提供某字段 | 保留已有值；不能像读取快照一样，把缺省 `tags` 自动当作清空 |
| `tags: []` | 清空展示选择，记录用户已编辑；保留隐藏标签和历史 |
| `bio: ""`、`avatar: ""` | 分别清空简介、恢复默认头像 |
| 字符串字段或 `tags` 为 `null` | 返回字段校验错误，不能静默转成 `"null"` 或空数组 |
| 超出上限、无效头像或不支持的更新字段 | 拒绝整次更新，避免部分字段先落库；返回可定位字段的错误 |
| 修改 `tags` 而未提交 `tagCategories` | 保留仍存在标签的已知类别，移除已不存在标签的映射；未知标签按前端既有规则兜底 |

允许的更新字段建议为 `name`、`bio`、`language`、`tags`、`tagCategories`、`avatar`、`shareRegion`。`name` 对应资料显示名；`avatar` 映射当前私有状态的 `cardAvatar`；`tags` 映射公开可见选择，而不是覆盖整份社交标签账本。城市修改走既有资料编辑流程，其公开开关由此接口保存。

建议错误响应：

```json
{
  "error": {
    "code": "invalid_card",
    "message": "名片资料需要调整。",
    "fields": { "tags": "最多展示 7 枚标签。" }
  }
}
```

建议使用 `401 unauthenticated`（重新认证）、`409 card_conflict`（如后端采用版本检查，先重读再保存）、`422 invalid_card`（字段错误）、`429` 加 `Retry-After`、`503`（服务暂不可用）。新适配器需要读取这些字段；当前名片尚无 HTTP 错误处理链，不能只部署后端就声称接入完成。保存失败保留编辑草稿，不提示成功；账号切换取消旧请求并丢弃迟到回包。

联调验收至少覆盖：无标签无简介、无标签有简介、有标签无简介、隐藏/恢复全部标签、顺序保存、头像移除、账号切换及刷新、超限/非法/null 输入、保存失败草稿保留、页面与 PNG 一致。验证服务保存与跨设备读取后，才可把“浏览器本地保存”状态改为“后端持久化”。

## 6. 实现依据

核对的公开基线：`f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf`。下面链接指向此次核对版本的源码；本次空标签视觉修复只改绘制排版，不改变快照协议。

- [public-card.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/public-card.mjs)：公开字段挑选、严格校验、分享链接、DOM / PNG。
- [card-labels.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/card-labels.mjs)：标签限制、旧标签迁移、头像校验。
- [social-tags.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/social-tags.mjs)：展示顺序、隐藏/恢复、用户已编辑状态。
- [avatar-upload.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/avatar-upload.mjs)：本地头像预处理。
- [app.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/app.mjs) / [model.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/model.mjs)：`UPDATE_PROFILE`、浏览器保存与名片 UI。
- [auth-entry.mjs](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/auth-entry.mjs)：当前主页面的认证与 onboarding 协议。
- [LIVE-WEB.md](https://github.com/XGEN-Labs/knoknok-demo/blob/f20800cdc7b53ff1f38c5f45bb44b98d0d17a8cf/docs/LIVE-WEB.md)：正式 Web 适配范围、当前产品接口缺口与部署边界。

私有项目中的对应运行源码位于 `output/knokknok-prototype/`；公开运行仓库中的文档副本发布为 `docs/BUSINESS-CARD-API.md`。
