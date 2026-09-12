# Preview 24 — compact composer and media

The main composer places its actions beside the input when space permits.
Formatting opens below it; narrow editors keep a separate action row. The
original textarea, draft handling, formatting commands and send controls remain
owned by the webapp. The local formatting toggle does not save server preferences.
Keyboard activation focuses formatting, and Escape closes it and restores focus.
Unrecognized editor markup retains the native toolbar behavior.

Multiple image attachments use a two-column mosaic, with an odd final tile
spanning both columns. Thumbnails crop to fill; the original viewer retains the
full image. Viewer controls, header, zoom bar and surfaces use Fluent tokens.
Gallery markers use separate data attributes: React rewrites its class names
when collapsing/expanding, which otherwise caused the mosaic to disappear.

## Verification

- `npm run check`: lint, types, 83 suites / 1339 tests passed.
- `test-fluent-lab.cjs`: main/thread drafts, sending, attachments, navigation,
  narrow layouts and 125/150% zoom passed in the synthetic localhost server.
- `test-fluent-composer-media.cjs`: draft preservation, keyboard focus/Escape,
  no formatting preference writes, dark/light mosaic bounds at 1440/900 widths,
  collapse/expand height, viewer next/previous/Escape and disable cleanup passed.
  Run after the lab and `seed-fluent-conversation.cjs`; missing gallery images
  are generated and uploaded only to the explicit localhost fixture.
- `test-fluent-chat.cjs`: both themes, message bounds, long URL/code and main/thread
  scrolling passed. Eight detents moved 480 px with no reversals or row-height drift.
- Input renderer benchmark remained near 17 ms median with Fluent enabled;
  this is a Chromium input/frame measurement, not physical monitor latency.
- Inspected local screenshots of the composer, gallery and image viewer.

No new broad message-body relational selectors, idle animation loops or extra
backdrop filters. This pass exercised image attachments on the 11.10 lab;
mixed/video galleries and the complete server-version matrix remain release QA.
This is an unsigned preview, not completion of the 1.0 checklist.
