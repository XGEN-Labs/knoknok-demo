# Knoknok interactive demo

Current release: `20261021-refine-29b` (2026-10-21).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261021-refine-29b)

The immersive onboarding video pauses for each question. Its back button is removed in both playback and input phases. The lower-right Skip action finishes the current film interval, then requires the current answer. The previously trimmed 3-second film and eight pause points remain; original video/audio and earlier cuts stay in the private project. The source watermark remains and playback is muted.

Conversation messages and choices use natural content height without internal clipping; when space is insufficient the whole page scrolls. Birthday input pauses on the first full bright meadow frame (0.533333s), rather than the dark iris frame. Input glass has one painting layer and quick replies no longer clip the backdrop. Main bottom actions share 60% white glass, 52px height and 16px text. Top controls share a 44px circle and safe-area alignment. Signing text stays dark while busy. The room uses ivory surfaces with subtle pale blue reflections. Native card handoff is visible again: the room blurs while the character offers the card clearly. Early clicks wait briefly for the native rig, with a usable static fallback.

The card account menu contains logout only; public card editing remains. Duplicate character-name labels and the large voice failure help panel are removed. Voice errors use a short inline reason; the microphone retries directly. Recognition remains browser-dependent and results stay drafts until manually sent. No independent transcription backend, physical-device microphone verification or genuine recognition-success claim is included.

Validation: 250 automated tests passed; 232 package files including the manifest, 150 reviewed assets, no missing assets. Local browser checks cover all eight video stops, skip, 440px/375px widths, short keyboard layout, shared control styling, native card handoff and contract-to-room evolution. No physical-iPhone verification is claimed.

This public repository contains only the deployable web build and required notices. Development history, original references, source model packages and private handoff documents remain in the private development repository.

Run locally with `python3 -m http.server 8767 --bind 127.0.0.1`, then open `http://127.0.0.1:8767/`.
