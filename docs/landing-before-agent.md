# New accounts: Landing before Agent creation

Development status: the protocol and bound-family presentation are implemented on
`codex/landing-before-agent`. New-account first-encounter film treatment still
awaits the user's design decision. This is not a release or production receipt.

## Scope and original design

The user authorized new registrations to finish Landing before family selection
and Agent creation. Existing accounts, bindings, initialization tasks and local
data must retain their old path, including existing unbound accounts. No account
is migrated based on `onboarding.required` alone.

Rongyu's `a3fe769ed399d590121a5b4e6d0da942678d0e7f` contains the existing
`landing-day-master-reading.mjs` / `social-tags.mjs` civil-date day-master rule.
Its ten stems map to five elements. That is evidence of the original prototype
reading; selection and published persona mapping belong to Auth, not to a second
browser algorithm or an ordinary chat message. Studio's preference-based
`match-persona` skill is a different mechanism and must not be described as this
date rule. Missing or ambiguous published mappings must fail explicitly.

## Additive Auth contract

Only newly created accounts marked by Auth enter this flow. Bootstrap retains
its existing fields and adds:

```json
{"landingCreation":{"flow":"landing-v1","state":"awaiting_input"}}
```

This requires `onboarding.status=required`, `nextAction=setup_agent` and
`agent.status=setup_required`. The Web enters the existing Landing page without
opening chat or loading history. No marker means the existing account path.

After the user completes the form and signs the original paper:

`POST /api/auth/agent-initialization/landing`, same-origin Cookie and
`X-Knok-User-Id`, with `{requestId,input}`. `input` contains `userName`, `agentName`,
`birthDate`, nullable `birthTime`, `gender`, `birthPlace`, `response`, and the
original `contract:{version:1,signedAt,userName,companionName}`. The browser saves
this exact request in the authenticated account's existing draft before sending.
No persona selection or service credential comes from the browser.

The successful response is `{landingCreation,initialization}`. The Web then reads
bootstrap. Auth persists the following even after binding:

```json
{
  "landingCreation": {
    "flow": "landing-v1",
    "state": "submitted",
    "requestId": "original-request-id",
    "input": "the original complete input object",
    "selection": {
      "ruleVersion": "the implemented rule version",
      "dayMaster": "甲木",
      "element": "wood",
      "familyId": "wood",
      "personaSpecId": "published-persona-id",
      "personaVersion": "published-version-string"
    }
  }
}
```

Auth owns atomic input/plan freezing. Same input, including a repeated request
from another device, returns the original receipt; conflicting input returns
409. The Web reads bootstrap after a conflict or lost response, without an
automatic repeated write. Multiple finish taps cannot send concurrent creates.
Recovery checks immutable account ID as well as username.

Pending creation uses the existing account-preparation page and explicit reload.
Reload only reads status. There is no new worker, retry loop or recovery API.
After actual `bound` IDs arrive, the original submitted input and real contract
are restored; then the existing native chat intake runs, followed by
`onboarding/complete`. Ordinary chat cannot start before binding. A successful
handoff receipt still avoids repeating intake when only completion failed.

## Published identity and assets

For this flow, the returned `familyId` drives the existing room character and chat
avatar. Unknown or missing family/persona values fail protocol validation rather
than showing Klin. Old accounts retain their original assets and film.

Studio's existing five-family source art and crop rectangles are recorded in
`studio-family-assets.json`. The SVG embeds the unchanged supplied JPEG and uses
the original adult, baby and head crop rectangles; it contains no private prompt
or published document. This avoids exposing Studio's protected consumer token.
For new assigned accounts the room uses the existing empty room scene with the
selected Studio character, so the embedded Klin actor in the original room film
cannot override the real assignment. Existing controls and page layout remain.

The current first-encounter film has Klin baked into its images and voice.
Studio supplies the verified static dual-form art; replacing that film in the
new flow requires the pending user choice. Do not ship a misleading non-metal
assignment with that film or claim that five-family films have been verified.

## Compatibility and checks

No database migration, account reset, old-plan retry or new production account is
performed by Web. Existing onboarding, chat/history and browser storage formats
remain readable. The new draft request is additive. Existing users are not
assigned a family from browser defaults. Server input is restored only for
explicit new-flow accounts whose onboarding is still required.

Run the targeted auth, first-Landing, creation and handoff Node tests. Build with
`npm run build:live`, then use `scripts/verify-landing-creation-browser.mjs` with
an existing Playwright install. The browser check uses synthetic local accounts
and deliberately staged signed input to isolate creation transitions. It is
technical verification, not PM black-box acceptance of the film or real Agent
selection. It checks no premature chat/history, one create, pending reload,
binding-before-handoff, actual Studio family art, reload and old-account behavior.

Deployment requires matching Auth first and the completed approved Web release.
Returning to an old Web can strand new accounts on the setup page; it must not
cause Auth to fall back to default-earth provisioning. Do not downgrade Auth to
an implementation that loses the new input/plan marker, and never restore an
old account snapshot over newer data. Final fixed versions and release contents
are to be recorded only after the remaining design decision and verification.
