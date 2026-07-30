---
title: Event log
---

# Event log

The Event Log is a running history of operations across Orbit — who did what,
and when. It's useful for answering "who added that override?" or "when was
this rotation created?" without digging through Slack.

**In the UI:** go to **`/events`**. It's a table, newest first, showing the
timestamp, the acting user's email, the action, the rotation involved (if any,
linking back to it), and a one-line summary.

## What gets recorded

Every write action across the app records one entry:

| Action | Recorded on |
|---|---|
| `rotation.created` | Creating a rotation |
| `rotation.updated` | Editing a rotation's name, cadence, anchor, timezone, or description |
| `rotation.deleted` | Deleting a rotation |
| `membership.updated` | Changing a rotation's ordered on-call membership |
| `engineer.created` | Adding an engineer |
| `engineer.updated` | Editing an engineer |
| `engineer.deleted` | Deleting an engineer |
| `override.created` | Adding an override |
| `override.updated` | Editing an override |
| `override.deleted` | Deleting an override |
| `swap.created` | Swapping two engineers' shifts (one entry for the pair, not two) |

The acting user's **email** is always the identity recorded — the same
`user.email` that authenticates the request, matching the convention already
used for `Override.createdByEmail`.

## Design note: it survives deletion

The `Event` model has **no foreign key** to `Rotation`/`Engineer`/`Override` —
those all cascade-delete (deleting a rotation removes its overrides and
memberships; deleting an engineer removes their memberships and the overrides
they covered). If the event log had a real relation to them, deleting a
rotation would silently erase its own history right when it matters most.

Instead, `rotationId`/`rotationName` on an `Event` are a **denormalized
snapshot** taken at the time the event was recorded — they keep working as a
label and a link even after the rotation is gone (`rotationId` is `null` for a
`rotation.deleted` event itself, so there's nothing to link to).

## Via the API

```sh
curl http://localhost:3000/api/events \
  -H "Cookie: <your-session-cookie>"
```

Filter to one rotation's history:

```sh
curl "http://localhost:3000/api/events?rotationId=<rotationId>" \
  -H "Cookie: <your-session-cookie>"
```

Read-only — see the [API contract](./api-contract.md#event-log--domain-events)
for the full shape. It's also readable by a service token, like the other read
endpoints.
