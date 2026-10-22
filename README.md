# Knoknok · Klin Demo

Meet Klin, explore the cloud realm, and try the interactive frontend prototype.

[Open the Demo](https://xgen-labs.github.io/knoknok-demo/)

## Sign in

Normal sessions use an account from the shared `vouch-client` backend, the same backend used by iOS. Klin chat calls `/api/web/chat`, which uses the existing knok-agent service, server-owned account bindings, bounded retries, and Gemini fallback for transient availability failures. Authorization and policy denials do not fall back.

Onboarding, visits and friend interactions remain demonstrations. Browser progress and chat bubbles are stored separately for each backend user ID. Agent memory remains on the server; clearing browser progress does not erase it. Logging in on another browser does not synchronize local chat bubbles.

For the original local simulation, open `?offline=1`. Only in that mode, the prefilled account is `knoknok.demo` and password is `Knoknok2026`.

## Try the experience

Complete the first conversation, choose a birthday and optional birth period, sign the encounter contract, and watch Klin grow. At home, tap the message field to chat with Klin. Tap the scene to return to the room; the visit entrance appears beside the message field. Search the relationship network, view all card tags, and edit or share your paper card. Swipe down or tap outside a bottom panel to close it.

## Local preview

Use Node.js 22 or later. In the sibling `vouch-client` repository, configure and start the existing backend following its [iOS setup](../vouch-client/docs/mobile/IOS_LOCAL.md). That backend must include the `/api/web/chat` route from this change. For local HTTP, set `VOUCH_SECURE_COOKIE=0` on the backend.

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
