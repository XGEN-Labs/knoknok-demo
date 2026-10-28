# First-login birth chart integration (review only)

The production compatibility build now submits confirmed birth input to `POST /api/auth/onboarding/birth-chart`, then polls cookie-authenticated bootstrap for a saved chart receipt and bound Agent. The two card labels come from that receipt. Birth inputs are excluded from the ordinary chat handoff, which retains names and the user's ordinary introduction.

The confirmation form requires explicit calendar, timezone, consent, sex-for-calculation and exact local time. It does not silently reuse the existing questionnaire's time-period midpoint. Unknown times remain unresolved rather than receiving invented pillars/family assignments.

Dependencies: Agent PR #717 and Studio PR #15, plus the matching knok-auth implementation. The auth implementation was recovered from deployed release a4d68656; its Git repository is not currently accessible. Do not deploy this frontend alone. The auth configuration must enable birthOnboarding and use a pinned Studio creation-profile reference, not the current fixed nok-earth-1 persona. Existing accounts are not rematched.

Validation: Node tests (16) passed; formal pinned-baseline build passed; headless Chrome protocol-fixture flow passed with no page errors, including first-login gating, explicit chart save, returned labels, failed completion/retry, refresh and A/B/A account switching. This is local validation, not a production end-to-end claim. No deployment or merge is authorized.
