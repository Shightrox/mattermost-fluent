# Compatibility baseline — 2026-09-09

Upstream base: Mattermost Desktop 6.3.0. Current runtime: Electron 43.0.0.

The official Desktop release table lists Server 11.7, 11.8, 11.9 and 11.10 for Desktop 6.3. The current desktop requirements specify Windows 11+ and 800×600 minimum content size. These are the release targets; older DOM adapters and Windows 10 material fallback do not constitute a promise of official support.

Sources checked on 2026-09-09:
- https://docs.mattermost.com/product-overview/mattermost-desktop-releases
- https://docs.mattermost.com/deployment-guide/software-hardware-requirements

| Configuration | State |
| --- | --- |
| Windows x64, current work server | Read-only visual/navigation checks; no work messages sent |
| Server 11.10.0, isolated local Docker lab | Production preload; actual submit/upload, draft reload, thread, dark/light/accent/text size, width and web zoom tests passed |
| Server 11.7.0 / 11.8.0 / 11.9.0, separate local Docker labs | Actual submit/upload, drafts, navigation, context, zoom/narrow geometry and filtered search/return tests passed in preview.16. 11.7 additionally passed chat-wheel checks. Full functional coverage remains pending. |
| Windows ARM64 | Not yet built or tested |
| Windows 11 x64, different DPI/screens | Partial local verification; full matrix pending |
| SSO/MFA / Calls / managed policies | Retained upstream implementation; dedicated end-to-end verification pending |

Unknown routes retain stock behavior when they cannot be recognized safely. Preserving upstream code is a compatibility strategy, not a substitute for this matrix.

Current detailed evidence and limits: [preview.16 review](FLUENT-REVIEW-V16.md). Windows x64 ZIP and MSI are built; MSI clean-machine installation and signing remain unverified/unavailable respectively.
