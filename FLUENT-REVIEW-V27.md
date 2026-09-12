# Preview 27 — conversation scrolling

The Fluent wheel listener was registered on the entire document. This made
conversation wheel input wait for a blocking JavaScript listener even when that
listener ultimately left precision input native. Detented wheels could also
start a requestAnimationFrame/scrollTo interpolator competing with the webapp's
virtual-list anchoring. External anchor corrections stopped that interpolator,
discarding its remaining accepted wheel distance.

The external webapp now registers this listener only on its recognized sidebar
(or the auth surface before login). Main chat, thread, search and other external
surfaces use Chromium's native wheel path. Sidebar smoothing remains unchanged.
Scope replacement removes the previous listener and cancels pending animation.
The internal desktop UI retains its existing scroll behavior.

Programmatic message anchoring still uses `scroll-behavior: auto`; changing this
to CSS smooth would animate virtual-list position corrections. There are no new
per-message effects, layout changes or server preference writes.

Measured on Windows 11, Electron 43 / Chromium 150, local Mattermost 11.10,
1440x960 offscreen renderer. Same channel, 20 real Chromium wheel inputs at
50 ms intervals, two enabled passes interleaved with stock appearance:

| Metric | Preview 26 | Preview 27 |
| --- | --- | --- |
| Active JS task time | 251 / 227 ms | 74 / 76 ms |
| rAF interval p95 | 16.7 / 16.8 ms | 16.7 / 16.7 ms |
| Travel range | 800 / 800 px | 800 / 800 px |

Mean task time fell from 239 to 75 ms (69%). The rAF cadence was already regular
in this offscreen scenario; this is not evidence of a threefold FPS increase or
a measurement of physical display latency. Acrylic composition, device-specific
wheel acceleration and slow-network history loading still require on-device
acceptance. Server virtualization and history loading remain owned by Mattermost.

Verification:

- Real Chromium wheel input in both the main conversation and thread: 480 px
  requested and travelled, zero backward jumps. Replaces the old DOM-synthetic
  wheel test, which could not test native scrolling.
- Synthetic controller coverage: sidebar smoothing, exact distance, reversal,
  external position cancellation, nested containment, precision input, zoom,
  motion opt-out, cleanup, and no interception outside the sidebar.
- Input performance: enabled median 17 ms / p95 18 ms in the lab typing harness.
- Full lint, type checks and unit suite; coordinate-based pointer and production
  loading-renderer regressions are checked before installation.

Raw comparison is reproducible with `scripts/test-fluent-performance.cjs`;
`FLUENT_PERF_PRELOAD` selects the old preload and `FLUENT_PERF_OUTPUT` preserves
each report. Local reports are under ignored `artifacts/fluent-v27*performance.json`.
