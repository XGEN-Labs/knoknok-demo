# Knoknok · Klin interactive demo

Static deployable demo, revision `20261023-experience-34d` (2026-10-23).

- Updated landing video pauses at 5s for all profile responses, 30.5s for the in-world contract, then continues to the room after signing.
- Cool input text, borderless input focus, autofocus and microphone/send switching; sound starts muted, sound at upper left and film skip at upper right.
- Small juvenile line character acts during loading: black fullscreen stage, transparent inline variant.
- Shared iOS safe-area positioning and independently scrollable short-screen contract.
- Original 2D adult illustration in the metallic room and card handoff; current 3D exploration is not enabled.
- 22 prerecorded Yunxia neural lines, native pitch and slightly slower delivery. Voice direction remains an iteration, not approved final casting.

Run locally from this directory:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

Open http://127.0.0.1:8767/ . This is a frontend prototype with local browser state; the in-world contract is fictional.

322 source tests passed. The runtime manifest lists 260 files / 170 assets with SHA-256 checksums. It includes only reviewed web runtime files, not the private development repository, conversation history, source Blender packages or reference archives. Source and reproducible build instructions remain in the private development project.

Published audio is synthetic, not a voice clone. Only fixed public UI sentences were sent for rendering; runtime playback uses local assets. See the included audio NOTICE. Original media and rejected experiments are preserved in the private project.
