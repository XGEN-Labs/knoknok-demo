# Latest Web with real accounts and chat

`npm run build:live` writes `dist/web-live/` from the current root visuals and runtime allowlist. Only that artifact switches `deployment-mode.mjs` to `LIVE_WEB = true`. Root static Pages remains a local design demo. `npm run build` still produces the previous compatibility page; do not deploy that artifact when intending to publish the latest visuals.

## Supported behavior

- Existing Cookie auth: account entry, sign-in, registration, bootstrap and logout. Credentials stay in the form/server; no native Agent token reaches the browser.
- Backend onboarding state is authoritative. Existing/completed users skip Landing, including on another browser. Newly registered, unfinished users complete the existing questionnaire and signed encounter.
- One normal native chat turn delivers the full Landing intake. Native acceptance precedes the onboarding completion write. On failure, entered answers remain; retrying the completion write reuses this account/intake's accepted receipt. This acknowledges Agent receipt, not proof of Memory extraction.
- Normal conversation uses POST `/api/web/chat`. History comes only from GET `/api/web/chat/history`, with pagination, event-ID upserts, redaction/scrub handling, expired-cursor recovery and account-bound request cancellation. Unknown sends are never automatically retried. Fallback replies are explicitly identified and cannot be recovered from native history.
- Login/account switching clears in-flight display data. History and Memory bodies are not persisted in the new browser cache. Existing browser data is preserved; the old account-specific compatibility cache is read only to retain Landing drafts/names. No database, account or binding migration.

The raw Memory panel and all live home/settings entries were removed at the user's request. The Web no longer lists, corrects or deletes native Memory records. Backend memory data and Agent memory behavior are unchanged.

Native profile reads and single-field preferred-name/timezone/home-city edits are supported, preserving other fields and existing visibility. Companion nickname edits send expectedRevision. Existing group rooms can be listed, opened and posted to; full visible history is read before applying redactions. Scrubbed redactions conservatively hide bodies. Group sends use a stable clientMsgId until acknowledged. All responses are discarded after account switch or panel closure.

Group creation/invitations, public cards, social tags, journals and unexposed native console features remain unavailable in live mode. Demo mutations/sample replies are disabled. The root design demo and old compatibility artifact remain available separately; their local data is not deleted.

Landing is currently an ordinary native message without a reliable purpose marker. Restored history can include its intake/acknowledgement. The UI does not guess which messages to hide by matching keywords. No Agent prompt or memory algorithm is changed.

## Backend and deployment

Existing core baseline: knok-auth `a4d68656069309ec9cdb85ce183986d9076e6ae5`, Agent `1ee43189353372ee1aa80bc30db34b68fa5b2cbf` supporting initialReplay. This release requires knok-auth main `dfedc58ac18e656255e2608712baac229c491a27` (PR5) for Memory/profile/groups. Enable `web.nativeFacade: true` in the existing protected account configuration, preserving all other fields. Keep Cookie, CORS/origin, session secrets and current account/native storage unchanged.

Existing exact public routes used: POST `/api/auth/entry`, `/api/auth/sign-in`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/onboarding/complete`, `/api/web/chat`; GET `/api/auth/bootstrap`. Add the missing exact GET `/api/web/chat/history` route to the same knok-auth upstream (18792). Query strings must be preserved. Native `/v0`, admin/internal paths and tokens must not be exposed to the browser. The retired mobile/profile routes are not used.

Additional exact BFF routes: GET `/api/web/memories/capabilities`; POST `/api/web/memories/list`, `/get`, `/correct`, `/forget` (same memory prefix); GET/PATCH `/api/web/profile`; GET/PATCH `/api/web/agent/nickname`; GET `/api/web/rooms`; GET `/api/web/groups/:roomId` and `/events`; POST `/api/web/groups/:roomId/post`. These return native DTOs directly, with Cookie and X-Knok-User-Id. The server injects bound Agent/direct-room identity; group selection still requires native membership. Do not expose a generic native API proxy.

Build from a clean fixed commit; artifact `build-manifest.json` includes sourceCommit, dirty flag, mode, byte count and SHA-256 for every runtime file. Serve JS with revalidation/no stale deployment cache, and video with HTTP byte ranges. Replace the static directory atomically. Ops verifies fixed version/config, service startup and required route/auth connectivity; reuse development checks instead of rerunning the suite or generating production conversations.

Rollback: switch static directory back to the previous Web release while keeping current backend data and compatible backend versions. Do not restore an old account/native snapshot over new writes. The previous browser-cache namespace remains untouched; new unfinished drafts are in the new namespace and will not appear in the older UI. Newly completed onboarding remains server-owned. Downgrading Auth/Agent can disable history and is outside this Web-only rollback.

## Focused evidence

`npm test` includes Landing policy/handoff and native-session history/privacy tests. `npm run build:live` then `npm run test:live-browser` exercises real Chrome against a synthetic local BFF: login, chat, reload/history, account switch, new registration, Landing failure/retry and completed-account reload, absence of raw Memory UI/requests, profile preservation/nickname revision, and shared-room post/readback. At delivery: 24 Node tests and 10 Chrome scenario checks passed. Set PLAYWRIGHT_MODULE to an existing Playwright installation if needed. These checks do not demonstrate production Memory extraction or a live deployment.
