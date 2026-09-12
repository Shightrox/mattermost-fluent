# Preview 25 — focus, personal collections and interface polish

Implemented the approved direction, excluding the proposed Ctrl+K palette.

- Focus button in the channel header hides navigation without replacing the
  editor or virtualized feed. On wide windows the conversation and context panel
  share the available width; narrow context navigation retains its existing Back.
- Personal collections: create, rename, select, pin/unpin current conversations,
  delete; each collection stores its own accent, chat background density and
  compact navigation preference. All conversations restores global appearance.
  Names and links use text nodes, stored URLs are validated against the server.
- Storage is local to this browser profile and server, in `fluent.personal.v1`.
  It does not update server categories or account preferences and is not synced
  across devices. Clearing this server's site data also removes collections.
- Open channel icons now use Fluent number symbols rather than globes. Private
  channels keep locks. Header, gallery download and viewer arrows use the same
  bundled 20 px icon system; plugins and user-supplied artwork are preserved.
- The desktop command strip has more spacing, a rounded search field and an
  overflow icon. Its native webapp controls open as an inset floating surface.
  Empty title-bar space remains draggable; buttons remain interactive.
- Transient menus/pickers reveal smoothly. Fresh messages get a 180 ms opacity
  entrance only when a recognized creation timestamp is newer than entry into
  the route; history and remounts do not replay. Unknown timestamps get no effect.
  Reduced motion and the motion setting cancel/disable the effect.
- Loading includes a readable status. Error screens use a Fluent warning glyph
  and separate collapsible help/technical details. Empty-result typography is
  aligned with the theme; native retry, progress and permission behavior remains.

## Review and verification

Fixed during visual review: adding a button before the native first child broke
the header's flex sizing; the button is now appended and ordered visually with
CSS. Collection labels now read the actual heading rather than its outer wrapper
(which includes counts and description). Controls have labels and visible focus.

- `npm run check`: lint/types and 83 suites / 1339 unit tests passed.
- `test-fluent-personal.cjs`: focus on/off, draft preservation, header containment,
  1440/900 px dark/light, 30 px compact rows, context split, collection/pin/theme
  persistence and cleanup. Screenshots reviewed.
- `test-fluent.cjs`: synthetic Chromium scope/CSP, navigation, motion, hover,
  drafts and cleanup; fresh post entrance vs history/remount verified. Its bundled
  adapter loader was updated for the modules introduced in previews 24 and 25.
- `test-fluent-shell.cjs`: switching, badges, single/multiple servers, window drag
  regions and connection error disclosure controls.
- `test-fluent-lab.cjs`, `test-fluent-review.cjs`, `test-fluent-chat.cjs`: actual
  local webapp functional flows, menu keyboard, picker, zoom/narrow bounds,
  measured message rows, main/thread scrolling and themes passed.
- Final input benchmark: Fluent median 17 ms, p95 18 ms; 40 inputs used 68 ms of
  style recalculation in the final pass. This is renderer timing, not physical
  screen latency. There are no new idle animation loops or backdrop filters.

Core webapp testing used localhost Mattermost 11.10 and synthetic conversations.
This preview is not a new full server-version/plugin compatibility certification
or completion of the remaining 1.0 release checklist.
