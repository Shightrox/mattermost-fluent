# Navigation and conversation header — v11

## Implemented

- Persistent Conversations / Threads / Later / Drafts navigation in recognized Channels sidebars, with Russian and English labels. Counts have a separate, fixed-height badge; Conversations and Threads use distinct Fluent SVG icons.
- Existing webapp controls continue to own routing, permissions and draft persistence. Later opens the existing saved-message panel. Conversations returns to the last available conversation and closes saved messages through the original action.
- Empty or unavailable draft controls disable the entry without shifting the other sections. Unknown sidebar markup keeps the stock navigation. Disabling Fluent removes the adapter and restores the original entries.
- Channel title receives the available header width; member/file/info controls remain available. The long description is removed from this line only when the stock channel info action exists. The description remains in that panel.
- Keyboard focus, selected state, hover transitions and reduced-motion handling for the new navigation.

## Review findings addressed

- Navigation can mount after the channel list. Re-probe only sidebar/header child changes, rather than scanning the message feed on every post update.
- Drafts may have no stock entry when empty; this no longer prevents navigation installation.
- Observe text-node count updates and replacement of the saved-message button. Clean up observers, elements and scheduled animation frames on disable/disposal.
- Thread detail routes retain the Threads selection; a first available conversation is used when opening directly into a section without previous conversation state.
- The real-webapp harness now implements the existing desktop history IPC round trip, restricted to its own window and synthetic team. Without it, even original webapp navigation did not work in this harness.
- Separate zoom and window-size changes in the offscreen harness and verify actual viewport width before geometry assertions. The final run captured all four viewport cases, including 840×680 at 100%; earlier runs exposed an offscreen compositor/zoom race.

## Validation

- `npm run check`: lint, TypeScript, 83 suites / 1339 tests passed.
- `npm run build-prod`: passed with existing Webpack bundle/instrumentation warnings.
- `npm run test:fluent`: passed, including late navigation mount, action delegation, count updates, empty drafts, disable cleanup and unknown-markup fallback.
- `node scripts/test-fluent-shell.cjs`: production shell checks passed.
- `node scripts/test-fluent-lab.cjs`: final run passed against local Mattermost 11.10.0. Draft round trips through Threads/Drafts, saved-panel return, accessible channel description, message submission, attachment upload, draft reload, thread editor and viewport geometry/captures passed.
- Reviewed local synthetic screenshots in light and dark themes. No work messages were sent or used as test data.

## Still open

This is the navigation/header portion of the rebuild, not completed replacement screens. Category filters, a redesigned context panel with thread/scroll restoration, the narrow-window conversation layout, Inbox and search remain open. The narrow view still uses the upstream overlapping right-hand panel. Other supported server versions and full keyboard/screen-reader coverage remain in the release matrix. This is an unsigned local preview, not a public release or native WinUI client.
