# Knoknok interactive demo

Current release: `20261022-video-30b` (2026-10-22).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261022-video-30b)

The new 30-second landing film pauses at 2 seconds while all seven profile questions are answered. After the final answer, the encounter and contract reveal play continuously to 19.75 seconds. Signing becomes available after that reveal. Signing then continues the film through growth and arrival at 29.958 seconds, before the room controls appear. Skip finishes the active film interval. There is no back button in the film or information entry phase.

Normal sessions use an account from the shared `vouch-client` backend, the same backend used by iOS. Landing completes only after `/api/companion` persists that account’s own Agent and pinned character/worldbook release. Klin chat calls `/api/web/chat` with server-owned bindings and bounded retries. Failures return an error without switching to Gemini or another character.

Onboarding questions, visits and friend interactions remain local demonstrations; the final companion binding and subsequent Agent chat use the authenticated backend. Browser progress and chat bubbles are stored separately for each backend user ID. Agent memory remains on the server; clearing browser progress does not erase it. Logging in on another browser does not synchronize local chat bubbles.

For the original local simulation, open `?offline=1`. Only in that mode, the prefilled account is `knoknok.demo` and password is `Knoknok2026`.

## Try the experience

Complete the first conversation, choose a birthday and optional birth period, sign the encounter contract, and watch Klin grow. At home, tap the message field to chat with Klin. Tap the scene to return to the room; the visit entrance appears beside the message field. Search the relationship network, view all card tags, and edit or share your paper card. Swipe down or tap outside a bottom panel to close it.

## Local preview

Use Node.js 22 or later. In the sibling `vouch-client` repository, configure and start the existing backend following its [iOS setup](../vouch-client/docs/mobile/IOS_LOCAL.md). That backend must include the `/api/companion`, `/api/companion/characters` and `/api/web/chat` routes from this change. For local HTTP, set `VOUCH_SECURE_COOKIE=0` on the backend.

Then run in this repository:

```sh
VOUCH_BACKEND_URL=http://127.0.0.1:8787 npm start
```

Open [the local Demo](http://127.0.0.1:8769/). The preview serves the frontend and proxies cookie authentication and chat to the backend. `PORT` defaults to `8769`. Keep Agent credentials, account bindings and model keys in the backend environment; the frontend needs only the backend origin.

Run `npm test` for API, chat-state and proxy regression checks.

## 页面流程画布

在 `flow-studio/` 运行 `npm install` 和 `npm run dev`，然后打开 http://127.0.0.1:8770/ 。可以拖动真实页面预览、查看跳转条件、连接新流程草稿，以及直接操作页面记录实际路径。预览使用独立本地演示状态。新增页面与跳转的登记方式见 [画布说明](flow-studio/README.md)。

GitHub Pages serves static files only and cannot host these API routes. An online deployment needs an HTTPS frontend with same-origin `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`, and `/api/web/chat` routed to the shared backend. Until that is deployed, use `?offline=1` for a static-only preview. This change does not deploy either repository.

## Version

`20261020-agent-1`. GitHub Pages publishes the `main` branch from the repository root.

The welcome screen uses the existing static fluffy portrait. The room connects to the film with cream surfaces, sage hills and champagne-gold lighting, arch trim and ornaments. The older app-generated particle growth animation is removed from the flow. The native adult room character and card handoff remain.

Input glass uses a held video frame and precomposed blur. All information stages reuse the same held frame. Conversation content retains natural height, with whole-page scrolling on smaller screens.

Validation: 271 automated tests passed. The build contains 238 files including its manifest and 151 assets, with no missing assets. Browser checks recorded 1,660 onboarding frames and 1,003 signing/arrival frames, with no premature input, room controls or duplicate growth animation. No physical-device verification is claimed.

This public repository contains only the deployable web build and required notices. Development history, references, source model packages and private handoff documents remain in the private development repository. Video seeks require an HTTP server supporting byte-range requests; the hosted demo supports this.


### 账号自己的 Agent

在线 landing 完成时调用 `/api/companion`；后台确认 ready 后才进入主页。登录恢复从后台读取同一份绑定，浏览器缓存不代表创建成功。当前页面呈现 Klin，因此只能选择唯一的已发布 Klin；多个同名发布版本时明确拒绝，部署需给出无歧义的可选目录。绑定包含固定 character/世界观发布版本，昵称不改变角色模板。

需要与支持 companion 接口的平台 API 和 Agent 服务配套部署。预览代理与生产反代均须放行 `/api/companion`（GET/POST）及 `/api/companion/characters`（GET），保留 Cookie 和 `X-Knok-User-Id`；静态发布需包含 `api.mjs` 与 `companion-state.mjs`。旧账号若收到迁移提示，保留原 Agent 和历史，由受控宿主迁移后重试，不在前端替换成默认 Agent。
