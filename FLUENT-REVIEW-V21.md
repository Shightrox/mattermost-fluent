# Preview 21 — conversation details and supporting panels

Continues the two-sided conversation composition accepted in preview 20.

- Message groups close with rounded bottom corners. Adjacent virtual rows
  affect only corner paint, never measured height or message order.
- The actual webapp `post--system` class is excluded from ordinary bubbles.
  System events keep their native content and controls with quieter typography.
- Date separators use compact labels without a full-width rule.
- Reactions and reply/follow actions share rounded controls. The thread unread
  marker stays inside the footer instead of hanging outside the bubble.
- Document attachments use one card with a tinted icon tile, metadata and the
  original preview/download links. Image aspect-ratio layout is unchanged.
- Main and thread composers use the same surface, outline and focus treatment.
- Sidebar selection uses the accent, with a faint material tint behind the list.
  Context actions sit in an inset rounded panel matching the channel header.

## Review

Validated against the isolated Mattermost 11.10 lab: both themes, 900/1440 px
conversation geometry, draft restoration, submission, attachments, thread
navigation, search/context return, zoom and narrow context mode. Sidebar tests
cover real mentions, three-digit badges and keyboard menus. Chat checks cover
long URLs/code, virtual row overlap and wheel movement in both scroll areas.
The extended review covers dialogs, menu keyboard navigation and emoji input.
Synthetic Fluent fixtures also pass. Physical-display frame pacing and the
remaining release compatibility matrix are not certified by these checks.

The short conversation fixture now includes a document, reaction and reply:

```sh
node scripts/seed-fluent-conversation.cjs
node scripts/test-fluent-conversation.cjs
```

All fixture writes are restricted to localhost; no work conversations are used.
This is a client-only unsigned preview, not a completed 1.0 release.
