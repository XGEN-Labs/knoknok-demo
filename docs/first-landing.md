# Registration-only Landing

Existing accounts enter their room directly, including after logout/login and from a new browser. Only accounts with server `onboarding.status: required` enter Landing. An unfinished questionnaire remains resumable; completing it once persists `completed` on the account. Local answers remain drafts, not the source of account completion.

## Serving the current production page

`npm run build` still builds the existing compatibility page into `dist/web`. This change does not switch production to the newer visual demo. Deploy with the knok-auth release that adds `onboarding` to login/me/bootstrap and `POST /api/auth/onboarding/complete` (Cookie, `X-Knok-User-Id`, `{}`). Deploy the backend and route first, then this Web artifact. No Agent update or Memory change is required.

The page sends the existing one-message Landing handoff to `/api/web/chat`. Only a native Agent response is accepted. It then saves completion through the new endpoint; failed completion remains retryable. A successful local handoff receipt avoids resending that same intake when only the completion write failed. The receipt is not proof that long-term Memory was written. Normal chat never resends completed or exempt users' intake.

## Compatibility and data

- Existing account IDs, passwords, bindings, conversations and local answers are unchanged. No fabricated questionnaire answers or signatures are created to bypass Landing.
- Older login/me responses without `onboarding` are treated as existing accounts (`not_required`). Unknown status values fail rather than being converted to successful completion. Do not deploy this frontend before the matching backend if newly registered accounts must receive Landing.
- No Web data migration or localStorage deletion. The backend owns additive account-state persistence and its migration.
- Reverting the frontend to the previous every-login version would restore the unwanted Landing prompts. Prefer rolling forward; do not restore old account snapshots or erase post-upgrade data.
- The latest visual demo remains local, with the same policy represented in its demo adapter. This patch does not enable its real login/chat/history integration. Its API adapter preserves server onboarding state and supports completion for future integration after the real handoff.

## Targeted verification

`node --test test/first-landing.test.mjs test/landing-handoff.test.mjs`

`npm run build`, then `node scripts/verify-landing-browser.mjs` (optional `PLAYWRIGHT_MODULE` points to an existing Playwright installation).

The Chrome check uses isolated synthetic accounts and a local protocol fixture. It covers existing-account logout/login, pre-state auth compatibility, unfinished new-account resume, handoff and completion failures, completion retry without repeated handoff, account switching, and a fresh browser. It does not claim production or Memory verification.
