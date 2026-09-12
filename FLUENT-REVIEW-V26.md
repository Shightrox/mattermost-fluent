# Preview 26 — restore pointer input after startup

Preview 25 introduced a `FormattedMessage` in the loading screen without an
`IntlProvider` in that renderer entry. React failed to render, leaving an empty
transparent native `WebContentsView` above the webapp. It intercepted pointer
input while the previously focused editor could still accept keyboard input.
The isolated webapp tests did not include this native overlay.

The loading screen now has its localization provider. The main process also
removes a fading loading view after two seconds if the renderer never sends its
completion event. A new loading cycle cancels this timeout; completion events
from other renderers and stale events while visible are ignored. Destruction
cancels the timeout and removes the resize listener.

Verification:
- Production `loadingScreen.html` renders its localized status and sends the
  fade-completion IPC (`scripts/test-fluent-loading.cjs`).
- Three new unit cases cover missing completion, a new loading cycle, and sender
  isolation/single removal. Full check: 83 suites, 1342 tests, lint and types.
- Coordinate-based Chromium mouse input toggles focus, opens/closes context,
  switches a channel and opens its menu (`scripts/test-fluent-pointer.cjs`).
  These tests do not bypass hit testing by calling DOM `.click()`.
- The stuck overlay was dismissed from the running installation during diagnosis.
  Diagnosis read layout/overlay state; no work messages were sent or edited.

This is a regression fix; the preview 25 features remain enabled.
