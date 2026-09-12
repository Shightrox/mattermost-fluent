# Context panel and narrow layout — v12

## Implemented

- Shared context toolbar for channel information, files, members and return to the last open thread. Original webapp controls still own the content, routing and permissions; no server changes or new external API.
- Preserve the thread ID and scroll position locally while switching context. Return uses the existing reply action and waits for the thread content to mount before restoring position. User wheel, pointer and keyboard input cancel pending restoration.
- At viewport widths up to 1100 CSS pixels, context fills the conversation area instead of covering a narrow slice of the conversation. At up to 768 pixels it fills the available main area. Wide windows retain side-by-side conversation and context.
- Keep the conversation mounted while covered, with its editor and virtual list. Use visibility and `inert` to prevent interaction with the covered content; restore the previous inert state on close, disable, element replacement and disposal.
- A single Back action in narrow mode restores the conversation and editor focus after the webapp's close lifecycle. Duplicate close/expand controls and redundant search bar in thread/info/member context are hidden only in narrow mode. The original search-results input remains available.
- Known panel structure is required. Other markup retains its stock layout. Generated/styled-component class hashes are not used as integration hooks.

## Review findings addressed

- Mobile webapp assigns different grid areas and static positioning. Explicit narrow grid areas and positioning prevent implicit columns from squeezing the context at 600 pixels.
- Context creation can occur after the sidebar itself mounts. Existing controller observes relevant lifecycle changes; the context observer stays within the panel and ignores its own toolbar changes.
- The channel editor can become focusable later than the panel close event. Focus restoration checks visibility/accessibility and successful focus, is bounded to 60 frames, and is cancelled by new user input or disabling the feature.
- Member selection now has its own active state. Original controls remain available through the toolbar even when the channel header is covered.

## Validation

- `npm run check`: lint, TypeScript and 83 suites / 1339 tests passed.
- `npm run build-prod`: passed with existing Webpack warnings.
- Chromium fixture checks cover narrow inert state, keeping the conversation mounted, disable cleanup and Back cleanup, in addition to previous navigation/editor/motion checks.
- Real local Mattermost 11.10.0 checks cover both drafts and a nonzero thread scroll position through Files, Info and Members; context selection; wide/narrow geometry; 125%/150% zoom; 840- and 600-pixel windows; narrow switching and Back.
- Production shell regression checks passed. All test messages and files belong to the isolated local laboratory account.

## Limits and remaining work

Return to a thread currently requires its original reply control to remain in the channel's rendered list. If virtualization removes that action, the return control is disabled; it does not navigate elsewhere or invent state. Position restoration is bounded and stays in memory for the current channel, not persisted across app restarts. This is not a general history of every context panel.

Panel bodies still use upstream components with Fluent styling. A dedicated materials view, search filters, pinned-message shortcuts and Inbox remain subsequent work. The full supported-server, assistive-technology and plugin compatibility matrix is still open. The packaged build is an unsigned local preview.
