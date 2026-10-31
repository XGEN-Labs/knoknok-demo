# Shared birth chart integration (PR only)

The current live Web retains Landing before Agent creation. Auth explicitly
enrolls new accounts with `birthChart.protocol:"shared-birth-chart-v1"` and
`landingCreation.flow:"shared-birth-chart-v1"`. Generic `landing-v1` receipts,
existing accounts, saved bindings, account checks and chat/history keep their
existing paths. Missing or unknown protocol declarations cannot select the
shared flow. This source depends on the matching Native, Studio and Auth PRs;
no merge, publication, deployment or account migration is included.

The confirmation form requires an explicit calendar, date, exact local HH:mm,
sex for calculation, timezone, leap-month choice, timezone confirmation and
storage consent. A questionnaire hour-period midpoint never fills the exact-time
field. Unknown/approximate time remains unresolved until the user can confirm an
exact time. The account's explicit form draft survives reload.
The YYYY-MM-DD date field is calendar-independent text: lunar dates such as
`2024-02-30` must not be rejected by an HTML Gregorian date control. Native
performs the exact calendar and leap-month validation.

`POST /api/auth/onboarding/birth-chart` sends only the published chart form keys:
`birth-date`, `birth-time`, `birth-sex`, `birth-timezone`, `calendar`, `leap-month`,
`timezone-confirmed` and `chart-consent`. Same-origin Cookie and `X-Knok-User-Id`
identify the owner. The existing bounded poll reads bootstrap until the saved
chart is ready; it does not require an Agent binding. Saving the chart prepares
the owner identity and chart only. `GET /api/auth/onboarding/birth-chart` exposes
the same private receipt as bootstrap:

```json
{"birthChart":{"protocol":"shared-birth-chart-v1","status":"ready","chart":{"id":"64 lowercase hex characters","version":1,"labels":{"dayMaster":"乙木","zodiac":"金牛座","element":"wood"}}}}
```

Pending/required receipts have `chart:null`. Native owns calculation and chart
versioning. `labels.element` is optional and, when present, controls the existing
element artwork after binding; it does not declare a selected published persona.
No browser date calculation or display-label parsing chooses the actual family.

At the existing final signed Landing action, Web saves and submits the stable
`{requestId,input}` to `/api/auth/agent-initialization/landing`. Shared `input`
contains only `userName`, `agentName`, `response`, `birthChartId`,
`birthChartVersion` and the existing signed `contract`. Raw birth fields cannot
accompany it. Auth freezes that chart reference and the published Studio profile;
the existing worker then creates the Agent and binding. Pending creation uses
the existing preparation page and explicit status reload. No repeat creation is
triggered by reload or an uncertain response.

Submitted shared receipts preserve the signed non-birth input and
`selection:{profileId,content:{id,version,integrity,sourceSha256,creationProfileId},chart}`.
A fresh browser restores the signed stage from this receipt without inventing
private birth answers. After binding, the existing registered chat handoff sends
names and the ordinary introduction only, then completes onboarding. Shared
birth data never passes through ordinary chat or the generic birth-profile
PATCH/repair. Card defaults use the returned chart labels while later card edits
remain intact. Generic Landing still saves its structured birth profile, but its
ordinary chat prompt also excludes the private birth fields.

The historical compatibility build retains its pinned page baseline and uses
the declared shared capability, chart receipt and final signed initialization.
It is not the current live release or a replacement for its full account and
history integration.
Submitted-but-incomplete compatibility sessions restore the frozen signed
names, introduction, contract and chart reference before continuing. Handoff
uses that owner-checked server receipt, even when an older local draft differs;
no raw birth answer is reconstructed. The pinned questionnaire resumes only
this confirmed stage, with existing account and completion guards retained.

Local checks use synthetic Cookie accounts and BFF responses, with no live host,
real login, paid model or production end-to-end claim. Commands:

- `npm ci`, `npm test`, `npm run build`, `npm run build:compat`.
- `CHROME_PATH=/usr/bin/chromium LANDING_BIRTH_CHART=1 node scripts/verify-landing-creation-browser.mjs`.
- `CHROME_PATH=/usr/bin/chromium node scripts/verify-landing-creation-browser.mjs`.
- `CHROME_PATH=/usr/bin/chromium node scripts/verify-birth-profile-browser.mjs`.
- `CHROME_PATH=/usr/bin/chromium npm run test:browser`.

The creation fixtures exercise actual live app/media assets; the birth-profile
fixture replaces presentation modules and tests actual account/profile code.
The broader `test:live-browser` originally failed at the first existing-account
chat check: Enter reached the body while the composer was not focused, and no
chat request was sent. Requiring a real composer click fixed that test operation
without changing its timeout or response assertion. The rerun passed seven
auth/chat/history/Landing checks, then failed at `card-edit-return` (15000ms):
current main's `manageCardTags` opens `cardTagsManagementMarkup`, whose markup has
no return-to-editor control. Those product functions are unchanged here. The
remaining card/diary/visit checks are unverified; no page errors were reported.

Original integration evidence at `d4cf0d29` remains: 85 Node tests, shared live
7 checks, generic creation 5, generic birth-profile 10, and compatibility 11
passed. The single final-review fix pass reproduced both lunar HTML rejection
and missing fresh-browser compatibility recovery before repair. Affected Node
tests now pass 18/18, shared live Chromium passes 7 checks, and compatibility
passes 13 including submitted receipt recovery and A/B/A owner protection. The
lunar fixture uses Native's separately verified deterministic vector:
`2024-02-30`, lunar/non-leap, `12:00`, male, `Asia/Shanghai`, producing
`壬水 / water / 白羊座`. Browser fixtures remain synthetic BFF verification.
