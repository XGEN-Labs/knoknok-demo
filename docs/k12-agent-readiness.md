# K12: existing account preparation feedback

The existing account page now distinguishes Auth's `agent.initialization.state`:
- `pending` / `working`: preparation is in progress.
- `retry_wait`: preparation has not completed; the backend follows its retry policy.
- `blocked`: preparation is blocked and needs support/dependency recovery.
- `legacy_required`: the existing binding needs attention; do not register or create a replacement.
- Missing or unknown state: preparation status is unconfirmed. Older setup responses remain usable.

The existing reload button only GETs `/api/auth/bootstrap`. It does not retry initialization, register an account, create an Agent or poll. `retryable` is not interpreted as permission to call the recovery API. Internal phase/error values are not rendered. Bootstrap/recovery failures use safe text; failures no longer claim a request is still running. Existing bound validation, onboarding policy, inputs and logout behavior remain unchanged.

Backend contract: Auth446fcfe provides these fields; no new backend deployment is required for this presentation change. The Agent/Auth failure is a separate recovery task. Passing these tests does not demonstrate that preparation succeeds for the affected account.

Validation: `node --test test/auth-readiness.test.mjs test/first-landing.test.mjs` covers known/missing/unknown preparation states, one read per explicit reload, unsafe error text, old bound accounts, required binding IDs, failed logout, input retention and existing first-Landing behavior.

Release scope: only `auth-entry.mjs` and `auth-entry-ui.mjs` from the fixed merged source. Operations must preserve its current Web release, mode module, all other assets and account data. Use the current deployed baseline/hash evidence and verify serving/cache freshness; do not deploy unrelated newer main assets. `npm run build:live` can produce a traceable source artifact but the full artifact is not the authorized release scope for this fix. Rollback restores the prior two modules and normal cache revalidation; no data/schema migration or snapshot restore. Confirm source/main and deployed version separately.
