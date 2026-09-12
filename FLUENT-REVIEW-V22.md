# Preview 22 — restore glass and remove typing stalls

## Fixes

Preview 21's sidebar gradient ended in the opaque `--fp-nav` color. It now
ends in the material-aware `--fp-nav-panel`, restoring the existing native
Mica/Acrylic beneath the transparent WebContentsView.

The conversation canvas also allows the native material through. Appearance
settings now include **Chat background density**, 30–100%, default 75%.
Higher values darken the glass in the dark theme; in the light theme they
increase the light surface's opacity. Solid mode and reduced transparency
remain opaque. No blur filter was added to messages or the scrolling canvas.
The local setting is validated, persisted and sent through existing config IPC.
The slider saves when the keyboard/pointer gesture ends, not on every move.

The typing stall reproduced on the localhost webapp. Removed relational
`:has()` matching from message bubbles and the cross-row corner dependency.
Bubble targeting now uses the native adjacent avatar/content siblings.
Same-author grouping stays local to each row. Message geometry, input handlers
and server preferences are unchanged by the performance fix.

## Evidence and limits

An A/B run using the actual preview 21 preload and the new preload on the same
fixture measured 40 Chromium character events per pass. With Fluent enabled,
median renderer acknowledgment fell from 34 ms to 17 ms; p95 from 50–52 ms to
19 ms. Style recalculation fell from 1039–1053 ms to 58 ms across 40 characters.
These are offscreen renderer measurements, not physical-display input latency
or a certification of frame pacing on the user's monitor. The sidebar hover
comparison showed no substantial change; do not claim a measured improvement
there. Native material composition still depends on Windows and the GPU.

A separate pass targeting message bubbles (40 pointer moves) reduced main-thread
work from 1634–1690 ms to 604–640 ms, and style recalculation from 1258–1299 ms
to 225–246 ms. The same pass retained a 17 ms median input acknowledgment versus
35–36 ms with preview 21. Measurements were taken before packaging, without a
concurrent build, using the same local conversation for each pair.

Validation: lint/types and 83 unit suites (1339 tests); local material alpha
at 30/75/100% across solid/Mica/Acrylic; reduced-transparency fallback; native
slider keyboard/save behavior; main/thread scrolling, long URL/code layout,
input, attachments, drafts and viewport/zoom checks. Synthetic Fluent checks
also pass. The wider release matrix remains open.

Reproduce the renderer input benchmark with:

```sh
node scripts/test-fluent-input-performance.cjs
```

`FLUENT_PERF_PRELOAD` optionally selects a local old preload for comparison.
The harness only connects to the isolated localhost fixture and clears its
synthetic draft afterwards. Material checks use `test-fluent-material.cjs`.
