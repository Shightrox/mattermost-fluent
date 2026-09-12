# Review: workspace shell foundation

2026-09-08. First implementation block of FLUENT-REBUILD.md, not completion of the full redesign.

## Changes and review

- Native React workspace rail, shown for multiple servers only. Uses existing server switching and creation APIs; honors modal disabling and server-management policy. Counts reserve their own position and cap their visible label at 99+ while the accessible label retains the full count.
- Server views reserve 56 logical pixels only for Fluent Windows tabs with multiple servers. Resize, activation and load/settings paths use the same view wrapper. Popout windows and disabled/high-contrast layouts retain their original geometry. No server DOM elements were reparented.
- Single-tab title duplication removed from Fluent chrome; new-tab control and multiple-tab functionality retained. Search uses the remaining titlebar space; compact icon-only mode is limited to narrow windows.
- Replaced mapped hand-drawn icons with Microsoft Fluent System Icons 1.1.339 regular 20 px assets. Includes editor/navigation glyphs and a document-edit glyph for Drafts. Unknown plugin glyphs are unchanged. Only mapped SVG data is bundled, with MIT attribution in NOTICE-Fluent-Icons.txt and platform packaging lists.
- Existing switch-server IPC now validates the server ID shape before dispatch. No new API is exposed to server pages.

## Validation

- `npm run check`: 83 suites / 1339 tests passed, lint and TypeScript passed.
- `node scripts/test-fluent-shell.cjs`: production React shell and internal preload with synthetic workspaces; switch IPC, active indicator, 99+ count, two widths, Fluent disable and removal down to one server. No debug port or work account. Fixed box-sizing discrepancy found by this test.
- `npm run test:fluent`: sandboxed Electron fixture and shipped external preload passed.
- `node scripts/test-fluent-lab.cjs`: actual local Mattermost 11.10 message/attachment sending, themes, drafts, threads, zoom and viewport checks passed.
- Production build and unsigned local Windows directory package. Existing webpack instrumentation/bundle-size warnings remain.

## Remaining scope

The new Inbox, contextual navigation, search filters, redesigned thread workflow, file browser and consolidated settings are not yet implemented. The compatibility matrix, plugins, Calls and long-running performance validation remain release tasks. The server dropdown remains available for management; it can be consolidated with the rail in the navigation phase. No new server-side feature or cross-device synchronization is claimed.
