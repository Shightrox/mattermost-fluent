# Preview 31 — liquid feedback and presentation work reduction

Controls now receive a cursor-local glow and a soft ripple from the actual press
position. A single reusable, clipped surface handles both effects. It cannot
intercept pointer input and does not change control geometry. Only pointer events
schedule a frame; animations end naturally. Scrolling, dragging, blur, reduced
motion and motion opt-out stop the effects. Internal and server views share the
same implementation. No additional backdrop filters are introduced.

Presentation optimizations:

- Process each connected added DOM branch once per mutation delivery.
- Avoid whole-document editor/media scans on ordinary navigation updates.
- Discover spacing rules on enable and stylesheet changes, rather than every
  navigation probe. Skip unrelated parents and prune retained markers on removals.
- Pause controller presentation scans and navigation/context scheduling while
  hidden; rescan once visible. Keep server connections and stock background logic.
- Remove large message-surface color transitions; animated feedback stays on
  small controls. Native chat scrolling and history anchoring retain ownership.

Validation: full lint/types and 83 unit suites / 1342 tests; Chromium liquid hit
testing, ripple completion, no idle DOM writes, scroll/motion cleanup; production
pointer actions, composer drafts, image gallery/viewer; visible channel switching
with retained drafts and hide/show recovery. The window lifecycle fixture stays
above other windows to distinguish explicit hiding from Windows occlusion.

Performance limits (synthetic localhost data, this Windows machine):

- 240 wheel inputs with four older-history requests: preview 30 active renderer
  work 2.917 s; new adapter pass 2.942 s. Longest interval ~153 ms in both.
  This does **not** demonstrate a history-scrolling speedup.
- Input-to-renderer-rAF acknowledgement median stayed at 17 ms; final enabled
  p95 samples 17/21 ms. These are not physical display/input latency measurements.
- Six channel switches: 189/216/124/209/124/210 ms versus baseline
  169/245/124/261/115/222 ms. Single-run variations are not a speedup claim.
- A one-second hide interval consumed 75 ms renderer work versus baseline 81 ms,
  including the hide transition. This is not a steady-state battery benchmark.

Residual history stalls, stronger end-to-end improvements and long-session RAM
measurements remain open. This preview does not claim completion of those goals.
