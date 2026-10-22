# Knoknok interactive demo

Current release: `20261022-video-30b` (2026-10-22).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261022-video-30b)

The new 30-second landing film pauses at 2 seconds while all seven profile questions are answered. After the final answer, the encounter and contract reveal play continuously to 19.75 seconds. Signing becomes available after that reveal. Signing then continues the film through growth and arrival at 29.958 seconds, before the room controls appear. Skip finishes the active film interval. There is no back button in the film or information entry phase.

The welcome screen uses the existing static fluffy portrait. The room connects to the film with cream surfaces, sage hills and champagne-gold lighting, arch trim and ornaments. The older app-generated particle growth animation is removed from the flow. The native adult room character and card handoff remain.

Input glass uses a held video frame and precomposed blur. All information stages reuse the same held frame. Conversation content retains natural height, with whole-page scrolling on smaller screens.

Validation: 271 automated tests passed. The build contains 238 files including its manifest and 151 assets, with no missing assets. Browser checks recorded 1,660 onboarding frames and 1,003 signing/arrival frames, with no premature input, room controls or duplicate growth animation. No physical-device verification is claimed.

This public repository contains only the deployable web build and required notices. Development history, references, source model packages and private handoff documents remain in the private development repository. Video seeks require an HTTP server supporting byte-range requests; the hosted demo supports this.
