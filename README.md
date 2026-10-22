# Knoknok interactive demo

Current release: `20261022-mini-v16-32` (2026-10-22).

[Open the demo](https://xgen-labs.github.io/knoknok-demo/?rev=20261022-mini-v16-32)

The updated landing film is 48.208333 seconds at 24 fps. It pauses at 5 seconds while all seven profile questions are answered. After the final answer, the encounter and contract reveal play continuously to 30.5 seconds. The contract interaction becomes available after that reveal. Completing the signature continues the film to its final frame at 48.166667 seconds, then enters the room. Skip finishes the active film interval; it does not skip profile validation or sign the contract. The film and information entry stages have no back button.

The adult room character uses the new v16 model, including its rigged mesh and matching hair data. Room interactions and the card handoff remain part of the experience. The welcome screen retains its static portrait. Cream surfaces, sage hills and champagne-gold room elements continue the existing scene styling. Evolution is presented by the film, without a second app-generated particle sequence.

The UI uses the shared typography, spacing, buttons and icons. Standard glass has 70% white fill; landing input glass uses a decoded held frame and precomposed blur. All information stages reuse the same held frame. Conversation content retains natural height, with whole-page scrolling on smaller screens.

Validation: 272 automated tests passed. The runtime build contains 240 files before its generated manifest and 150 assets, with no missing assets. Browser verification is recorded separately in the private development project. No physical-device verification is claimed.

This public repository contains only the deployable web build and required notices. Development history, references, source model packages and private handoff documents remain in the private development repository. Video seeks require an HTTP server supporting byte-range requests.
