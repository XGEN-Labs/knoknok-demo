# Knoknok interactive demo

Current release: `20261021-video-28a` (2026-10-21).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261021-video-28a)

Onboarding now uses a persistent inline video scene. It pauses at each question, shows the existing 60% white glass UI, and continues only after a valid answer. Back navigation restores the previous frame; reduced motion, blocked autoplay and media failures keep the flow usable. The supplied 10-second concept film contains baked forms and a contract, so this interactive cut skips those sections. Its original bytes, audio track and watermark are retained; runtime playback is muted. Replace the source and cue sheet with a UI-free master for a continuous final film.

The room, login light and blurred card backdrop now follow the welcome scene's periwinkle, cream and restrained warm-gold palette. The supplied onboarding video keeps its own meadow colors. Native white-particle evolution, centered cards, full profile editing, self-hosted paper fonts and the seal are retained. Room controls appear only after signing and evolution finish.

Voice input has one microphone entry, visible recognition feedback and bounded timeouts. Background home updates and sound toggles preserve active recognition. Browser speech recognition requires HTTPS, microphone permission and the browser's recognition service; real microphone and physical-device recognition have not been verified. Recognition results remain a draft until manually sent. No realtime AI voice service is connected.

Validation: 242 automated tests passed; 231 build files, 150 reviewed assets, no missing assets. Browser checks cover all eight video stops, invalid input, back navigation, 440px and 375px widths, a reduced keyboard viewport, and contract-to-room evolution. No physical-device or real microphone verification is claimed.

This public repository contains only the deployable web build and required third-party notices. Development history, original design references, source model packages and private handoff documents remain in the private development repository.

Run locally with `python3 -m http.server 8767 --bind 127.0.0.1`, then open `http://127.0.0.1:8767/`.
