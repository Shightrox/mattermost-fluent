# Preview 23 — filter and separator geometry

- Sidebar unread filter: a 32×32 px hit area with a centered 20×20 px Fluent
  glyph. The icon no longer inherits the 13 px label font or sits at the top.
- Message/date separators: the outer text container owns the single rounded
  surface. Its inner span has no background, border or padding, removing the
  nested-pill appearance and inline line-box overflow.

Verified on the local Mattermost lab in dark/light themes. The small-controls
harness checks glyph centering, dimensions, transparent inner label and text
containment; its screenshot uses a copy of the native separator DOM with a
synthetic label. The sidebar mention/count/keyboard-menu checks also pass.
No new animation or relational message selectors were introduced.
