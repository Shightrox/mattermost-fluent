# Chat scrolling and message spacing — v14

## Changes and review

- Repeated scroll-controller updates with unchanged settings no longer cancel an accepted wheel event. DOM probes can issue these updates while React mounts UI. The Chromium regression now refreshes settings during an active wheel movement and requires the full distance to be delivered.
- Wheel interpolation uses a 90 ms time constant instead of 55 ms to soften the pulses between detents. Precision input, navigation jumps, reversal, containment, motion opt-out and cancellation on interaction retain their existing behavior.
- Disable stock AutoHeight transitions inside the two recognized virtual message scrollers. Row measurement should receive final geometry, not intermediate animated heights. Native programmatic anchoring remains instantaneous; only stepped wheel input uses our interpolation.
- Message bubbles have a borderless surface, consistent 12 px corners, a 780 px maximum width and 6 px spacing inside the measured post content. This avoids collapsing outer margins and touching consecutive bubbles. Own messages retain their subtle accent. No React nodes or message controls are moved.

## Validation

- Lint, TypeScript and 83 suites / 1339 tests passed.
- Production build, sandboxed Chromium behavior checks and production shell checks passed.
- Local Mattermost 11.10 checks passed for attachments, drafts, submission, thread restoration and zoom/narrow viewport geometry.
- Extended real-webapp chat checks pass in light and dark themes: consecutive bubble spacing, measured row overlap, long URLs/code and horizontal overflow. Screenshots reviewed in both themes.
- Main conversation and long thread each receive eight synthetic line-mode wheel events: expected and delivered distance 480 px, eight events handled, zero sampled reverse jumps, stable scroll height during each run.

## Limits

The earlier main-chat baseline also delivered all 480 px in a quiet synthetic run. The reproducible defect fixed here is interruption by repeated settings updates; these results do not establish that it was the only source of the user's reported lag. AutoHeight suppression and the softer interpolation address additional sources of visual instability but are not a measured FPS improvement. Physical input, large production histories, delayed media and server/plugin versions still require the release performance matrix. This remains an unsigned local preview.
