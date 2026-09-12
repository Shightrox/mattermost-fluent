# Smooth scrolling and persistent history controls

2026-09-08. Incremental implementation of the approved UI rebuild.

## Implemented

- Shared smooth wheel behavior in recognized server pages and the desktop shell. Finds the nearest vertical scrolling container, accumulates discrete wheel input and cancels old momentum immediately on direction reversal.
- Precision pixel input stays native unless it has a clearly stepped legacy wheel signature. This is a conservative heuristic, not guaranteed hardware identification. Horizontal scrolling, zoom modifiers, editors, code blocks, sliders, canvas/video, reverse-flex and snap scrollers remain native.
- Nested containers respect scroll chaining and overscroll containment. External position changes, pointer presses, keyboard input, blur, reduced motion, disabling Fluent and disposal cancel the animation. No animation frames run while idle; the non-passive wheel listener is removed when disabled.
- Smooth programmatic navigation in settings, workspace list, menus and suggestions. Virtualized message-list programmatic anchoring is left to the webapp.
- Back/Forward controls in the persistent desktop toolbar. They operate on the active tab's existing history; enabled state updates from history events and on tab changes. Commands and history queries are accepted only from the trusted main renderer. No new API exposed to server pages.

## Validation

- `npm run check`: 83 suites / 1339 tests passed, including trusted history command routing; lint and TypeScript passed.
- `npm run test:fluent`: exact wheel distance, precision/zoom/editor bypass, cancellation by an external position change, direction reversal, nested containment/chaining and motion opt-out in Chromium, plus existing editor/preload checks.
- `node scripts/test-fluent-shell.cjs`: actual production React shell/internal preload with synthetic history state; control availability and command IPC, workspace switching, badges, sizes and disable/single-server states.
- `node scripts/test-fluent-lab.cjs`: actual local server message/attachment, theme, draft reload, thread and viewport geometry assertions completed. Full visual validation did NOT pass: capture at 840×680 after zoom changes consistently fails with Electron `UnknownVizError`. Software rendering and a fixed device scale did not resolve it and are not enabled in the final harness. Other captures succeeded. The harness reports missing visual coverage explicitly rather than treating it as a pass.
- Stabilized the thread fixture by creating a reply to the current run's local synthetic attachment post; an old seeded thread can leave the virtualized viewport after repeated runs.

## Remaining

This does not make every scroll source custom: touch/precision input, scrollbar dragging, unknown plugin frames and webapp-owned virtual-list jumps intentionally retain their existing behavior. Physical-device feel and sustained frame-time benchmarking still need validation; smoothing is not a claim of higher rendering FPS. Inbox, full navigation replacement and contextual panel redesign remain open in FLUENT-REBUILD.md.
