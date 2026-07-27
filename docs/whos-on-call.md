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
overview (each on-call period is a colored bar — base rotation, override, or
swap) that you can page through, and a **schedule list** below it. Times are
shown in the rotation's timezone.
