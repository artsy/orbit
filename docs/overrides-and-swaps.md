---
title: Overrides & swaps
---

# Overrides & swaps

Overrides and swaps are how the team adjusts the schedule without changing the
base rotation order. The base round-robin is always recomputed, so removing an
override instantly restores the original assignment.

## Add an override (one engineer covers a range)

Use an override when someone needs coverage for a stretch of days — a vacation,
a conference, an appointment.

**In the UI:** open the rotation at **`/rotations/<rotationId>`** and click
**Add override**. Pick the covering engineer, the start and end dates, and an
optional reason.

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/rotations/<rotationId>/overrides \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "startDate": "2026-08-03T00:00:00.000Z",
    "endDate": "2026-08-09T00:00:00.000Z",
    "replacementEngineerId": "<engineerId>",
    "reason": "covering while Ada is out"
  }'
```

The date range is inclusive. If two overrides cover the same day, the one
created most recently wins.

## Swap two engineers' shifts

Use a swap when two engineers want to trade upcoming on-call weeks. A swap
creates **two reciprocal overrides** that share a `swapGroupId`: engineer A's
shift is covered by B, and B's shift is covered by A.

**In the UI:** on **`/rotations/<rotationId>`**, click **Swap shifts**. Choose
engineer A and engineer B; each engineer's shift field is a dropdown of that
engineer's **next two upcoming shifts** — the shifts they're currently on call
for, whether that's their base round-robin slot or one they picked up through
an earlier swap. The nearest one is preselected — pick the shift to give up
from the dropdown rather than typing a date.

You can also start a swap from the schedule list itself: clicking any row
opens **Swap shifts** pre-filled with that row's currently on-call engineer as
engineer A (that shift as A's) and you (the signed-in user, matched by email
to an engineer record) as engineer B, with your own next upcoming shift
preselected for B. Adjust either side before submitting.

A swap can trade a shift that's on someone's schedule only because of an
earlier swap — swaps chain. Say the base order is Margaret / Ada / Grace and a
first swap trades Margaret's week for Grace's, so Grace is now covering what
was Margaret's week. A second swap can then trade Grace's currently-on-call
week for Ada's, landing on Ada / Grace / Margaret. Each swap is an independent
layer on the schedule, so deleting the most recent one rolls the schedule back
exactly one step to the swap underneath it, not all the way back to the base
order.

A swap request naming a shift the engineer isn't currently on call for is
rejected with a `400` — see
[`docs/api-contract.md`](api-contract.md#swaps--domain-overrides).

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/rotations/<rotationId>/swaps \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "engineerAId": "<engineerA>",
    "engineerBId": "<engineerB>",
    "dateA": "2026-08-03T00:00:00.000Z",
    "dateB": "2026-08-17T00:00:00.000Z"
  }'
```

`dateA` / `dateB` are any date **inside** each engineer's shift being traded;
the app resolves them to the full periods and builds the two overrides.

## Remove an override

**In the UI:** the **Overrides & swaps** section on `/rotations/<rotationId>`
lists active overrides — click **Remove** to delete one.

**Via the API:** deleting an override restores the base assignment for that range:

```sh
curl -X DELETE http://localhost:3000/api/overrides/<overrideId> \
  -H "Cookie: <your-session-cookie>"
```

To undo a swap, delete both overrides that share its `swapGroupId`.

## Modify, delete, or add another swap from the calendar

Tapping the on-call bar of an **overridden or swapped** period in the calendar
opens an actions dialog:

- **Add swap** — opens **Swap shifts** pre-filled with this period's currently
  on-call engineer as engineer A, to trade this shift for another one. Always
  available, and the way to chain a swap onto this one.
- **Modify** — opens the change pre-filled: a plain override opens the override
  form (which saves via `PATCH /api/overrides/[id]`); a swap opens the swap
  form pre-filled with the schedule as it'll look once this swap's own two
  overrides are removed, and saving replaces them with a fresh pair.
- **Delete** — removes the override, or, for a swap, both overrides in the
  group.

**Modify and Delete are disabled** on a swap that a later swap has chained off
of (the dialog explains why). Editing or removing that swap would corrupt the
schedule — one engineer would end up covering two periods, another none — so
undo or edit swaps **newest-first**: modify or delete the later swap first,
and the earlier one becomes editable again.

(Tapping the bar of a normal, unchanged period still opens the "swap with me"
suggestion instead.)

## Viewing the result

The schedule table on `/rotations/<rotationId>` marks any changed period with an
**override** or **swap** pill. The On-call cell shows the originally scheduled
engineer in gray on top; when an override or swap changes who's actually
covering, the covering engineer appears below it. The period containing today
is highlighted.
