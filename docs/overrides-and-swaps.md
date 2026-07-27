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
engineer A and a date within A's shift, engineer B and a date within B's shift.

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

## Viewing the result

The schedule table on `/rotations/<rotationId>` marks any changed period with an
**override** or **swap** pill, shows the covering engineer, and strikes through
the base engineer they replaced. The period containing today is highlighted.
