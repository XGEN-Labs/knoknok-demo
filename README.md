# Knoknok · Klin interactive demo

Static deployable demo, revision `20261023-scene-35d` (2026-10-23).

- Welcome and sign-in use the opening meadow landscape. The home room continues the mini film ending, preserving champagne-metal details. Existing juvenile and adult 2D characters remain separate layers.
- Visit-friends scenery uses distinct wood, water and earth architectural studies in the same meadow, with avatar positions following the scene crop on shorter screens. These scene variants do not assign permanent element identities to demo friends.
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

85 relevant source tests passed for this scene update. The runtime manifest lists 261 files / 170 assets with SHA-256 checksums. It includes only reviewed web runtime files, not the private development repository, conversation history, source Blender packages or reference archives. Source and reproducible build instructions remain in the private development project.

Published audio is synthetic, not a voice clone. Only fixed public UI sentences were sent for rendering; runtime playback uses local assets. See the included audio NOTICE. Original media and rejected experiments are preserved in the private project.
