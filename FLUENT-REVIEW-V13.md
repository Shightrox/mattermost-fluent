# Conversational Fluent surfaces and search — v13

## Implemented

- Softer message surfaces in the conversation and thread, with a subtle local accent on own messages, compact timestamps, grouped corners and rounded editors. Author controls, avatars, message order, reactions and native virtual-list measurement remain intact. The user requested selected Telegram-like chat details in Fluent, not a copy of Telegram.
- Bounded message width, wrapping long URLs and native horizontally scrollable code. Search snippets and unfamiliar post markup retain their existing presentation.
- Visible search query with collapsible channel, username and date fields. Queries go through the webapp's original React search input/form and its server search. Advanced query text is retained; additional fields append their corresponding operators. Invalid handle fields reveal the filter section instead of submitting.
- Synchronize the form after a new native global search. Existing Messages/Files tabs continue to own result mode and counts.
- Results action in the context toolbar returns to the previous query and restores file-result mode after opening a thread or channel information. This state remains in memory for the current channel.
- Pinned-message shortcut opens the stock channel info action followed by its existing pinned list action. Pending work is bounded and cancelled by new user input, disposal or disabling the feature. It does not pin or unpin messages.
- File-result cards use consistent spacing, filename hierarchy and metadata while retaining native preview, menu and download actions.

## Validation and review

- Lint, TypeScript and 83 suites / 1339 tests passed.
- Production build and sandboxed Chromium/preload checks passed; existing Webpack warnings remain.
- Production shell checks passed.
- Local Mattermost 11.10.0 regression checks passed for message/file submission, both drafts, thread scroll restoration, context changes, zoom and narrow geometry.
- `scripts/test-fluent-search.cjs` verifies the actual outgoing server query with channel, author and dates, invalid handle validation, native-query synchronization, return from thread/info, file-result mode restoration and the pinned-list shortcut.
- `scripts/test-fluent-chat.cjs` uses two synthetic local users to verify distinct own/incoming surfaces, Cyrillic through API and rendering, long URLs/code, no overlapping measured rows and no page overflow in both themes. Synthetic fixture text encoding was corrected and explicitly asserted during review.
- Reviewed the local chat screenshots in both themes. Tests use only the isolated loopback lab; no work messages were sent or changed.

## Remaining

This is the first conversational message-layout pass. It does not yet add a complete new media library, independent search pagination/history, Telegram-style quote composition or per-conversation layout preferences. Search position across refreshed/paginated results is not restored; the query and selected result type are restored.

The v12 limitation on returning to a thread whose original reply action has been virtualized away remains. Investigation confirmed that a stock permalink alone centers the message rather than reopening the thread, so that route was not shipped as a misleading replacement. Full server-version, plugin and assistive-technology compatibility work remains in the release matrix. This build is an unsigned local preview.
