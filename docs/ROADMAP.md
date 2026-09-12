# Road to a Windows release

The current source preview includes local palettes, window materials, chat presentation, navigation and motion feedback. It is not a completed 1.0 release. See [validation results](VALIDATION.md) for measured results and limitations.

## Responsiveness

- Reduce remaining history-loading stalls without replacing native virtualized chat scrolling or breaking scroll anchoring.
- Measure long-session memory, background CPU, multiple servers and recovery after sleep.
- Compare repeated input, scrolling and channel-switch measurements against stock on representative hardware.

## Interface and accessibility

- Review the composer, attachments, threads, dialogs and menus with long content and narrow windows.
- Validate both themes, all window materials, multiple monitors and Windows scaling from 100% to 200%.
- Complete keyboard, screen-reader, contrast, high-contrast and reduced-motion checks.
- Verify translations and fallbacks, including long labels and right-to-left content.

## Compatibility and security

- Expand the server-version and plugin matrix; verify authentication methods, restricted accounts and managed settings.
- Exercise messages, drafts, unread counts, notifications, Calls, downloads, reconnect and deep links against stock behavior.
- Review IPC validation, isolation, navigation permissions, dependencies and upstream security fixes.

## Distribution

- Validate a clean, reproducible Windows build and install on a machine without development tools.
- Finalize fork versioning, installer identity, signing and release checksums.
- Verify upgrade, rollback, uninstall and coexistence with stock while preserving profiles and drafts.
- Establish a fork-owned update channel; upstream binary updates remain disabled.
- Audit the final package for debug settings, private data and unnecessary artifacts.
- Publish tested binaries with release notes, known limitations and a maintenance policy.

Release acceptance requires the relevant checks on the actual distributed package, no unresolved blocking defects and documented compatibility limits.
