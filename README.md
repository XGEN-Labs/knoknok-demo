# Knoknok interactive demo

Current release: `20261020-refine-26c` (2026-10-20).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261020-refine-26c)

This release moves the login group higher, unifies navigation and card actions with 50% white glass, puts editing directly on the preview card, fixes sharing-card overlap and tag styling, and draws signatures along authentic character strokes before the seal appears. Signature glyph pages load locally on demand.

Voice input has one speaker-style entry, visible recognition feedback and bounded timeouts. Background home updates and sound toggles preserve active recognition. Browser speech recognition requires HTTPS, microphone permission and the browser's recognition service; real microphone and physical-device recognition have not been verified. Recognition results remain a draft until manually sent. No realtime AI voice service is connected.

Validation: 189 automated tests passed; 217 build files, 143 reviewed assets, no missing assets. Responsive browser checks cover 440px and 375px widths and a reduced keyboard viewport; simulated speech events verify UI behaviour only.

This public repository contains only the deployable web build and required third-party notices. Development history, original design references, source model packages and private handoff documents remain in the private development repository.

Run locally with `python3 -m http.server 8767 --bind 127.0.0.1`, then open `http://127.0.0.1:8767/`.
