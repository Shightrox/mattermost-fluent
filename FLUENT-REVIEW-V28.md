# Preview 28 — history loading in a visible Windows window

The previous short, offscreen wheel benchmark did not expose expensive history
mounts. A new fixture has 160 variable-height messages and 960x540 images in an
isolated localhost channel. The harness opens a normal, visible Electron window
with the production preload, hardware compositing and native Acrylic. It issues
240 Chromium wheel inputs: 200 upward followed by 40 downward. Network events
verify that older history was actually requested; visible messages must remain
after the direction reversal.

Chromium invalidation tracing identified broad sibling-spacing selectors in the
server webapp stylesheet. Inserting virtual-list placeholders invalidates unrelated
descendants because of `.class > * + *` and `.PanelHeader__right div + div`.
The virtualizer then forces those styles to resolve while measuring its rows.

`spacing.ts` replaces only these narrowly recognized selector forms with local
DOM markers. Element-sibling relationships, CSS specificity, declarations and
stylesheet ordering are preserved. Markers update on insertion, removal, reorder
and class changes. New stylesheets are discovered; inaccessible sheets and
unrecognized selectors retain native behavior. Disabling Fluent restores original
selectors and removes markers. If another owner has changed a patched selector,
cleanup does not overwrite that change. No React internals, wheel events, server
preferences or server files are changed by this adapter.

Final before/after comparison, same fixture and preload versions, Windows 11 /
Electron 43, 1440x960 visible window, Acrylic, chat opacity 90%. CPU profiler and
invalidation tracing were disabled for this comparison:

| Metric | Preview 27 | Preview 28 |
| --- | --- | --- |
| Older-history requests | 4 | 4 |
| Active task time | 6.529 s | 3.371 s |
| Style recalculation | 4.784 s | 1.287 s |
| rAF interval p95 | 46.7 ms | 13.3 ms |
| rAF intervals over 25 ms | 88 | 23 |
| Longest rAF interval | 206.6 ms | 159.9 ms |

This run reduced task time by 48%, style recalculation by 73%, and long renderer
intervals by 74%. These are renderer measurements, not physical display/input
latency. Isolated history-loading stalls remain: this is not a claim that every
frame meets budget. Warm-history scrolling showed comparable task time for solid
and Acrylic surfaces (~0.24 s in each pass), so native glass remains enabled.

Validation covers exact CSS spacing/specificity, late stylesheet discovery,
mixed div/span/text siblings, reorder/removal, opt-out restoration and marker
cleanup. Existing real-webapp checks cover both themes, 480 px of native wheel
travel without reversals in main chat and thread, coordinate-based clicks,
composer formatting, galleries and attachment viewer navigation. Lint, type
checking and 83 unit suites / 1342 tests passed.

Reproduce with `node scripts/test-fluent-visible-scroll.cjs` for material passes;
set `FLUENT_SCROLL_HISTORY=1` for history loading. `FLUENT_PERF_PRELOAD` chooses an
older bundle, `FLUENT_PERF_OUTPUT` chooses the report path. Optional
`FLUENT_SCROLL_PROFILE=1` and `FLUENT_SCROLL_TRACE=1` collect diagnostics and add
overhead; do not mix these runs with plain before/after results. All traffic and
generated content are restricted to the synthetic localhost lab. Raw final reports
are in ignored `artifacts/fluent-v28-before-final.json` and
`artifacts/fluent-v28-after-final.json`.
