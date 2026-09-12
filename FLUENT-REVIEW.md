# Review: Fluent v6 — 2026-09-07

Reviewed the client-side navigation, typography and sidebar badge changes. No
server API or account theme setting was changed.

Findings addressed:

- Conflicting selector specificity kept some text on Segoe UI Variable Text.
  Prose and controls now consistently use Segoe UI; code and icon fonts remain distinct.
- Stock draft badge CSS forced zero padding. The draft-specific override preserves
  6 px horizontal padding, a 4 px icon gap and room for wider counts.
- The working server uses `#searchFormContainer`; the command bridge now recognizes
  it as well as newer search markup. Focus precedes clicking to preserve modal focus.
- Escape handlers in the webapp can intercept keyboard events. The native view
  forwards dismissal without consuming Escape; deferred focus restoration returns
  to the draft when the webapp resets focus to the document body.
- The flyout keeps the original header stacking level so server popovers can appear
  above it. Disabling Fluent restores the original header layout.

Validation:

- `npm run check`: lint, types and 82 suites / 1335 tests passed.
- `npm run test:fluent`: Electron rendering, production preload, palette, composer,
  scope/cleanup, counts 19 and 1999, toolbar focus and dismissal passed.
- Native IPC tests reject untrusted senders and unsupported commands.
- Installed Windows build: original search focused its searchbox; Escape closed
  the flyout and returned focus to `post_textbox`. These CDP keyboard checks used
  focus emulation because the automation session could not reliably activate the OS window.
- Live draft badge measured 18 px high with a 6 px icon inset and 4 px gap.
- The channel content starts at y=1 instead of y=45 after the permanent second row
  is collapsed; original toolbar controls remain available from the top bar.

Limits: a 90-frame synthetic hover sample with focus emulation completed, but it
is not an end-to-end FPS benchmark or evidence of improvement over stock. Long-list
scrolling, the full server-version matrix, SSO, calls, uploads and every onboarding
state still need dedicated validation. This review found no remaining critical
issue in the tested scope; it does not certify complete server compatibility.
