# Knoknok interactive demo

Current release: `20261020-refine-25d` (2026-10-20).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261020-refine-25d)

This release refines login alignment and full-screen light transitions, 50% white glass controls, consistent onboarding bubbles, paper-scroll signing and card typography, room-preserving profile editing, and one voice-input action with animated composer expansion. The volume glyph is 22px inside a 44px touch target.

Browser speech recognition is user-initiated and returns text to a draft. Account, AI, neighbours and messages remain local demo behaviour. No realtime AI voice service is connected.

Validation: 171 automated tests passed; 112 build files, 38 runtime assets, no missing assets. Responsive browser checks cover 440px and 375px widths and a reduced keyboard viewport; these are not physical-device or microphone certification.

This public repository contains only the deployable web build. Development history, original design references, source model packages and private handoff documents remain in the private development repository.

Run locally with `python3 -m http.server 8767 --bind 127.0.0.1`, then open `http://127.0.0.1:8767/`.
