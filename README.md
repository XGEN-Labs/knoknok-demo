# Knoknok · Klin interactive demo

Revision `20261026-motion-44`.

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261026-motion-44)

Visit a tiny plush world: drag, scroll, or use arrow keys to turn the globe. Eight rooms show contact avatars; the closest friend is largest. Tap an avatar to knock. Search also exposes a simple contact list. No self node is shown.

Both participants bring their saved Klin companions to the shared room. Welcome video colors retain natural saturation and use broad feathered color selections for a soft meadow/sky transition; sign-in and registration blur only the background, leaving controls and the white logo sharp. Hint text uses the shared cool-gray standard.

Business cards use one cream portrait design, with editing, all seven tags, sharing and PNG export. Existing card links render in the same portrait design.

Registration is a frontend prototype: it creates no remote account and stores no account credentials. Other sample state stays in this browser. The in-world contract is fictional.

The root static Pages demo is separate from the formal Web compatibility build. Existing `compat/web-naming`, `scripts`, `test`, package configuration and `docs/LANDING-HANDOFF.md` are preserved.

Local hosting must support HTTP byte ranges for film cue seeking. Private sources, original design explorations and modeling files are excluded from this public runtime.

The welcome wordmark moves continuously into the sign-in header and back. Fullscreen loading keeps the small character stationary with a clearer, earlier double blink. Reduced motion remains static.

After completing the first encounter, signed-in users reopen directly in their room. Incomplete encounters resume onboarding; logging out still requires sign-in. Shared-card links retain priority, and explicit reset starts a new first encounter. This prototype stores progress in the current browser.
