# Preview 29 — collapsed attachment cards

Attachment-only messages in the legacy webapp layout could produce a zero-width
file list beside floated header elements. The cards then overflowed the bubble
to the right. The client stylesheet clears these floats and gives the collapsed
list a bounded, responsive width with vertically stacked cards.

Validation: production preload against synthetic localhost Mattermost 11.7,
captioned and attachment-only posts, both bubble lanes and themes, 600/900/1440
window widths, 125% zoom and the thread panel. Card bounds and internal overflow
are asserted. The Mattermost 11.10 composer/media regression also passes:
draft/focus retention, gallery geometry, collapse/expand, image viewer navigation
and restoring native appearance when Fluent is disabled.

The change is CSS-only and adds no scroll handlers or server mutations.
