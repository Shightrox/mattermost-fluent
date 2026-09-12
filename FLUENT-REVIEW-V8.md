# Fluent v8 — seam and motion review

2026-09-08. Local Windows build; client-side changes only.

## Changes

- Removed the server webapp's outer rounded corner and `0 0 4px 4px` inset. The sidebar now meets the titlebar and window edge. The conversation canvas retains its own upper-left corner.
- Verified on the installed client that the titlebar and sidebar use the same acrylic tint (`#202020`, alpha 0.42), while nested sidebar containers and the outer webapp wrapper are transparent.
- Added shared motion styles for controls, reactions, row highlights, menus, suggestions, welcome/settings surfaces and the thread panel. Feedback takes 160 ms, entrances 240 ms, panels 300 ms.
- Channel-title text changes use a 280 ms opacity transition. Only the title subtree is observed; message updates do not trigger full-feed scans or animations. Existing animations are cancelled before replacement, on preference changes and on disposal.
- The existing single hover marker now uses a soft gradient and 240 ms movement. No timers replay intermediate rows after the pointer has already moved on.
- The local motion switch and system reduced-motion preference stop transitions, including in-flight title animations. No message input, selection, scroll position or server preference is changed by the motion code.

## Validation

- `npm run check`: 82 suites, 1336 tests passed; lint and TypeScript passed.
- `npm run build-prod`: passed. Existing webpack bundle-size and dynamic instrumentation warnings remain.
- `npm run test:fluent`: actual sandboxed Chromium, including corner/inset regression, title replacement, cancellation and emulated system reduced motion, plus production preload integration.
- `node scripts/test-fluent-lab.cjs`: actual local Mattermost 11.10.0, themes, sending a synthetic message and attachment, draft reload, thread editor and viewport/zoom matrix.
- Inspected a live client corner capture and computed material layers. No work messages were sent during inspection.

## Limits

This is an incremental alpha update, not the completed 1.0 roadmap. CSS entrances cover recognized markup; stock components that remain mounted and only toggle hidden state can require a dedicated adapter. Exit animations are not added to React components removed immediately by the server webapp. No sustained GPU frame-time benchmark is claimed. Calls, SSO and the full server-version matrix remain separate release work.
