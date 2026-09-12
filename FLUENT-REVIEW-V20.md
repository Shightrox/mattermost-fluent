# Preview 20 — conversation composition

The previous preview changed surfaces but retained a stack of left-aligned
cards. This preview gives conversations two visual lanes: incoming messages
on the left and the current user's messages on the right. Native author,
avatar, timestamp, reaction and reply controls remain present. DOM reading
order and server preferences are unchanged.

- Incoming and outgoing bubbles use directional corners. Follow-up messages
  retain a straight grouping edge, with measured spacing between rows.
- A restrained accent wash provides depth behind the conversation. Bubble
  fills remain translucent, without per-message blur or geometry animation.
- The channel header is inset, with a separate material and rounded outline.
- The composer has a narrower centered width, raised surface and subtle focus
  halo. Native formatting, attachments, priority and send controls remain.
- Wide and narrow layouts reserve a visual gap between the two message lanes.
- Thread replies retain a linear reading layout in the narrower side pane.

## Validation

The localhost Mattermost 11.10 fixture checks dark/light themes at 1440 and
900 px, message alignment, header containment and horizontal overflow.
The existing real-server harness checks editor sizing, draft restoration,
submission, attachments, threads and zoom. Chat tests check long URLs/code,
virtual row overlap, and wheel distance/reversals in both main and thread lists.
These are geometry/functional checks, not physical-display FPS measurements.

To reproduce the short visual conversation after the standard lab bootstrap
and chat fixture have created the peer account:

```sh
node scripts/seed-fluent-conversation.cjs
node scripts/test-fluent-conversation.cjs
```

The fixture is synthetic and restricted to localhost. Captures are written to
`artifacts/fluent-v20-conversation-{width}-{theme}.png`.

This remains an unsigned preview; release certification and the broader
compatibility matrix remain in FLUENT-TODO.md.
