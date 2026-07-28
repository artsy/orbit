---
title: Who's on call
---

# Who's on call

To see who is on call — the computed rotation with overrides and swaps already
applied — call the schedule endpoint for a rotation and a date window:

```sh
curl "http://localhost:3000/api/rotations/<rotationId>/schedule?start=2026-07-27T00:00:00.000Z&end=2026-08-24T00:00:00.000Z" \
  -H "Cookie: <your-session-cookie>"
```

The response has one entry per on-call period. `effectiveEngineerId` is who is
actually on call for that period (after overrides/swaps); `override` is set when
the period was changed:

```json
{
  "rotation": { "id": "...", "name": "Platform on-call", "cadenceDays": 7 },
  "entries": [
    {
      "periodStart": "2026-07-27T00:00:00.000Z",
      "periodEnd": "2026-08-03T00:00:00.000Z",
      "baseEngineerId": "eng-ada",
      "effectiveEngineerId": "eng-ada",
      "override": null
    },
    {
      "periodStart": "2026-08-03T00:00:00.000Z",
      "periodEnd": "2026-08-10T00:00:00.000Z",
      "baseEngineerId": "eng-grace",
      "effectiveEngineerId": "eng-alan",
      "override": { "id": "...", "swapGroupId": null, "reason": "covering" }
    }
  ]
}
```

The period containing today tells you who's on call right now.

## In the app

The `/rotations/[id]` page renders this data two ways: a **month calendar**
overview (each on-call period is a colored bar) that you can page through, and a
**schedule list** below it. Times are shown in the rotation's timezone. Every
engineer has a **stable color** used consistently across the calendar bars, the
schedule-list dots, and the home-page preview, so the same person always reads
as the same color. On the calendar, an overridden or swapped period keeps the
covering engineer's color with an `(override)` / `(swap)` suffix, and stacks a
separate muted, struck-through bar for the originally scheduled engineer **above**
it — so overrides read separately from who is really on call.

Following the Opsgenie / incident.io convention, the schedule list surfaces
overrides **separately** from who is really on call. Each On-call cell shows the
engineer actually on call (`effectiveEngineerId`) as the prominent line, with a
color dot; when an override or swap changed the assignment, the originally
scheduled engineer (`baseEngineerId`) appears struck-through in gray *above* it.
A period with no override shows just the single on-call name. Clicking a row
opens a pre-filled **Swap shifts** dialog suggesting a trade between that shift's
engineer and you.

The home page (`/`) only lists rotations, each with a compact **"… is on call
until …"** preview (shown as **"You are on call until …"** when you are the one
on call). Full schedule details — the calendar and this table — live on the
rotation's own `/rotations/[id]` page, not on the home page.
