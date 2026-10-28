# Web design and real account integration

The product pages and interactions follow rongyu's root demo. API availability does not authorize replacing a page, suppressing an entry, exposing native DTOs, or designing a new panel. If the backend does not support that design, the backend owner must adapt its contract.

## Restoration (2026-10-28)

Removed the unrequested native profile/nickname editor and shared-room list/chat panels, including their frontend API wrappers. Restored the original card scene/editor/share/preview, visiting scene/search, diary calendar and chat diary entry, social-tag controls, and settings/account menu. The raw Memory panel remains removed; the original product diary is not that panel. Removed the always-visible history reload control and live-mode action/route blockers. Preserved all rongyu changes through d7f0090, including the diary navigation, card colors, shared composer backdrop and removal of the manual diary collection button.

These restored card/diary/tag/visiting implementations currently retain their original browser-local prototype storage and social simulation behavior. This restoration does **not** establish server persistence, real friend discovery, real invitations, or real shared-room messaging for those product flows. Existing native profile/groups endpoints do not match those product contracts; backend adaptation has been handed to the backend owner. Do not describe those flows as fully integrated or swap in a different UI to conceal the gap.

## Retained authorized integration

- Real Cookie account entry, sign-in, registration, bootstrap, logout, and account-bound Agent identity. Native credentials remain on the server.
- Server-owned first-Landing policy: unfinished new accounts complete Landing; existing/completed users skip it. Full intake is sent to the Agent before completion. Failed completion retains answers and an accepted intake receipt is not resent.
- Real private conversation and server history, with pagination, redaction, account isolation and cancellation. Unknown sends are not automatically retried. Existing toast feedback reports request failures; no replacement status panel is introduced.
- Existing account-scoped browser data remains readable. Login no longer unconditionally clears the restored local card/social/diary state. Authoritative private chat bodies remain excluded from the browser state cache and are read from server history. No database or binding migration; no backend data deletion.

Landing still uses an ordinary native message without a reliable purpose marker. Restored server history may include its intake/acknowledgement; no keyword-based hiding is added.

## Build and deployment

`npm run build:live` produces `dist/web-live/` from the root runtime allowlist and sets `LIVE_WEB = true` only in that artifact. Build from a clean fixed commit. The generated manifest records commit, dirty flag, file sizes and SHA-256 hashes. The old `npm run build` compatibility artifact is a different page and must not replace this release.

Required same-origin routes remain POST `/api/auth/entry`, `/api/auth/sign-in`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/onboarding/complete`, `/api/web/chat`; GET `/api/auth/bootstrap`, `/api/web/chat/history`. Preserve Cookie/owner checks and history query strings. This release does not require modifying the Auth/Agent services, native facade configuration, database, or Studio.

Ops publishes only this fixed Web artifact, verifies file hashes and necessary connectivity, and preserves data. Rollback switches static files while keeping current backend data and compatible backend versions; never restore a database snapshot over new writes. Browser data written by the restored original UI may be hidden or cleared by the superseded PR6 UI on login, so reverting to that UI does not promise preservation of newly edited local product state.

## Focused verification

Existing Node checks cover auth/onboarding handoff and server-history account isolation. The Chrome script uses a local synthetic BFF and checks real-protocol login/chat/history, registration/Landing retry, original card editing/tag-management draft retention and reload, sharing/preview, diary controls, original settings, and visiting/search. It also checks there are no calls to the removed native-panel endpoints. These checks do not demonstrate production deployment or completion of the missing product backend contracts.
