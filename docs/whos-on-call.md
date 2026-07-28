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

## Just the current + next on-call

If you only need who's on call **now and next** (e.g. a Slack bot), use the
convenience endpoint instead of computing it from the schedule:

```sh
curl "http://localhost:3000/api/rotations/<rotationId>/on-call" \
  -H "Cookie: <your-session-cookie>"
```

It returns `{ current, next }`, each `{ engineer, periodStart, periodEnd }`
(or `null`) with overrides/swaps already applied — so `current.engineer` is who
to page right now, and `current.engineer.slackUserId` is what a Slack bot needs
to `@mention` them.

## In the app

The `/rotations/[id]` page renders this data two ways: a **calendar** overview
(each on-call period is a colored bar) that you can page through and switch
between a **2 weeks** and a **Month** view, and a **schedule list** below it. Times are shown in the rotation's timezone. Every
engineer has a **stable color** used consistently across the calendar bars, the
schedule-list dots, and the home-page preview, so the same person always reads
as the same color. On the calendar, an overridden or swapped period keeps the
covering engineer's color with an `(override)` / `(swap)` suffix, and stacks a
separate muted, struck-through bar for the originally scheduled engineer **above**
it — so overrides read separately from who is really on call. Tapping the on-call
(main person) bar opens the same pre-filled **Swap shifts** dialog as clicking a
row in the schedule list.

Following the Opsgenie / incident.io convention, the schedule list surfaces
overrides **separately** from who is really on call. Each On-call cell shows the
engineer actually on call (`effectiveEngineerId`) as the prominent line, with a
color dot; when an override or swap changed the assignment, the originally
scheduled engineer (`baseEngineerId`) appears struck-through in gray *above* it.
A period with no override shows just the single on-call name. Clicking a row
opens a pre-filled **Swap shifts** dialog suggesting a trade between that shift's
engineer and you.

You can edit a rotation's settings — name, description, cadence, handoff time,
and timezone — via the **Edit rotation** button on its page, or the **Edit**
button on its card on the home page (both save via `PATCH /api/rotations/[id]`).

The home page (`/`) lists rotations as **cards**, each showing the rotation's
cadence as a caption (e.g. **Weekly rotation**, **Biweekly rotation**, or
**Every N days rotation**) plus a compact **"… is on call until …"** preview
(shown as **"You are on call until …"** when you are the one on call). Full
schedule details — the calendar and this table — live on the rotation's own
`/rotations/[id]` page, not on the home page.
