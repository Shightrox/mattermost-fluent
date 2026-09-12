# Autonomous UI and release-readiness pass — preview.16

2026-09-09. Scope: the six UI/review workstreams agreed in the conversation. This is a tested local preview, not a declaration that the full 1.0 checklist is complete.

## Implemented

1. **Sidebar:** consistent 36 px rows, 8 px outer inset, separate title/count/menu areas, current category headers, predictable keyboard access to menus. Three-digit counts no longer share space with the menu. The hover marker is clipped to the scroll viewport, uses the row's actual edges and clears on category headers; movement is shortened to 120 ms. Native category collapse, ordering and permissions remain authoritative.
2. **Conversation:** consistent prose spacing, quote surfaces, one enclosing code border, reaction/thread-action rhythm, rounded attachment thumbnails/details and a compact hover toolbar. Existing author grouping, message order, editor autosizing, long-code scrolling and native actions remain intact.
3. **Shell/context:** retained and rechecked title-bar drag regions, shell history/workspace controls, accessible narrow context, draft/scroll restoration and server search. Fixed Fluent icon coverage for webapp glyphs that lack the extra `icon` class; expanded the set for profile/settings controls.
4. **Other surfaces:** core settings dialogs, menus, profile card, local settings and error view share the palette/type/radii. Login is now a bounded single-column form at all widths; corrected more-specific stock responsive rules, excess vertical flex growth, doubled input backgrounds and low-contrast branding. Native appearance settings use compact choices instead of long vertical radio lists. Welcome/add-server screenshots reviewed.
5. **Motion/materials:** removed duplicate pane animation definitions and animation on the invisible width holder; solid/reduced-transparency menus and dialogs bypass blur. No new message-entry animation or layout transition was added to virtual rows.
6. **Review/package:** radio groups now have accessible names, one tab stop, arrow/Home/End control and synchronization with external config changes. Updated Sentry 7.11.0 → 7.18.0, Joi 17.12.2 → 17.13.7, UUID 9.0.1 → 11.1.1 and transitive YAML. Removed upstream Azure signing configuration and assigned a separate MSI upgrade identity. Built x64 ZIP and MSI with `fluentBuild: preview.16` metadata.

## Validation

- `npm run check`: lint, types, build config and 83 suites / 1339 tests passed after final source edits.
- Production build passed. Existing bundle-size and dynamic instrumentation warnings remain.
- `test-fluent.cjs`: production-equivalent isolated preload fixture, scope/CSP/isolation, hover, motion opt-out, editor, navigation and cleanup passed.
- Production shell and local-settings harnesses passed, including radio keyboard focus and actual save IPC. The local file-based shell fixture emits Electron's development CSP warning; this is not a packaged-protocol CSP test.
- Local Server **11.7.0 / 11.8.0 / 11.9.0 / 11.10.0**: actual submit/upload, drafts, navigation, context restoration, zoom and narrow geometry passed. Actual filtered server search, return to results and file-result mode passed on all four versions. 11.7 and 11.10 additionally passed the chat-wheel and message-layout checks.
- Dedicated 11.10 checks passed for real incoming mention badge geometry with a synthetic three-digit display, keyboard menu visibility, light/dark core settings, account menu, profile actions and login. Reviewed settings, profile, login, native settings, welcome and add-server screenshots.
- `npm audit --omit=dev`: **0 reported vulnerabilities** after dependency updates. This is a point-in-time dependency check, not a guarantee of absence of vulnerabilities.
- ZIP contains the same app.asar hash as win-unpacked. Package inventory has no lab scripts/data, artifacts or log files. Packaged metadata contains the updated dependency versions and preview identity. MSI properties confirm Mattermost Fluent and its separate upgrade code. MSI was built and inspected, not installed on a clean Windows machine.

## Performance evidence

`scripts/test-fluent-performance.cjs` uses Chromium wheel input and Performance metrics on the same local channel with Fluent off/on twice. It does not call its offscreen timing display FPS.

| Mode | Idle task time / 2 s | Active task time / wheel run | JS heap sample |
| --- | --- | --- | --- |
| Stock presentation, run 1 | 0.040 s | 0.140 s | 70 MiB |
| Fluent, run 1 | 0.003 s | 0.203 s | 57 MiB |
| Stock presentation, run 2 | 0.002 s | 0.063 s | 61 MiB |
| Fluent, run 2 | 0.002 s | 0.167 s | 79 MiB |

No persistent busy loop is indicated by this sample. Smooth wheel input adds active main-thread work; no claim of faster stock-relative scrolling is made. Heap samples are affected by GC and are not a leak test. Physical frame times, GPU cost, long sessions and delayed media remain required for release performance acceptance.

## Remaining release gates

- Full Calls/device/screen-share, SSO/MFA, restricted-role and arbitrary-plugin scenarios; work accounts were not used for functional testing.
- Physical keyboard/screen-reader pass, all Windows DPI/monitor combinations, high-refresh frame tracing and long-session soak.
- Clean-machine MSI install/uninstall/upgrade, ARM64 and a signed independent distribution/update service.
- Comprehensive screen/state inventory and final visual acceptance. Core surface styling does not prove all extension/admin/error states have been redesigned.
- Existing context limitation: reopening a saved thread depends on its original reply action still being mounted. Search restores query/result mode, not pagination/scroll history.

These are explicit unfinished gates. No public release, server changes or work-message sending was performed.
