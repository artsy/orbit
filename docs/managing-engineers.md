---
title: Managing engineers & rotations
---

# Managing engineers & rotations

There are two distinct concepts:

- An **engineer** is a person record (name + email).
- A **rotation member** is an engineer placed at a specific position in a
  rotation's on-call order.

Adding an engineer to the app does **not** put them on-call — you also add them
to a rotation's ordered membership.

All write actions require being signed in with the Gravity `team` role. The API
examples below assume you pass your authenticated session cookie; the easiest
way to get one is to sign in through the app in your browser.

## Add an engineer

**In the UI:** go to **`/engineers`**, enter the person's name, email, and
(optionally) their Slack user ID, and submit.

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/engineers \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@artsymail.com",
    "slackUserId": "U01427GSPK9"
  }'
```

`slackUserId` (the Slack **user ID**, used by Slack bots to `@mention` the
engineer — stable even if they change their handle) is optional and can be
updated later via `PATCH /api/engineers/[id]`.

## Delete an engineer

Deleting an engineer **permanently removes** them. Their rotation memberships
are removed, any overrides where they were the replacement are deleted, and the
`originalEngineer` snapshot on other overrides is cleared — so no dangling
references remain.

**In the UI:** on **`/engineers`**, click **Delete** next to the person (you'll
be asked to confirm).

**Via the API:**

```sh
curl -X DELETE http://localhost:3000/api/engineers/<engineerId> \
  -H "Cookie: <your-session-cookie>"
```

## Create a rotation

**In the UI:** click **New rotation** on the home page (`/rotations/new`). Choose:

- **Name**.
- **Cadence** — Weekly or Biweekly.
- **Start date**, **start hour**, and **timezone** — together these set the
  rotation's anchor. The start hour is the weekly (or biweekly) **handoff time**
  in the chosen timezone: the rotation rolls to the next engineer at that local
  hour, and it stays at that local hour across daylight-saving changes.

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Platform on-call",
    "cadenceDays": 7,
    "anchorDate": "2026-07-20T10:00:00.000Z"
  }'
```

- `cadenceDays` is `7` for weekly or `14` for biweekly (defaults to `7`).
- `anchorDate` is the start of period 0, **including the handoff hour** — the
  schedule cycles forward and backward from this instant.

## Add or remove an engineer in a rotation's on-call order

**In the UI:** open the rotation at **`/rotations/<rotationId>`** and use the
**On-call order** section to add an engineer, reorder with the ↑/↓ buttons, or
remove one. Changes save immediately and the schedule updates.

**Via the API:** membership is set as a **complete ordered list** — position in
the array is the position in the round-robin. To add someone, send the full list
including them; to remove someone, send the full list without them.

Get the current members first:

```sh
curl http://localhost:3000/api/rotations/<rotationId>/members \
  -H "Cookie: <your-session-cookie>"
```

Then replace the ordered set:

```sh
curl -X PUT http://localhost:3000/api/rotations/<rotationId>/members \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{ "engineerIds": ["<eng-1>", "<eng-2>", "<eng-3>"] }'
```

The order of `engineerIds` **is** the on-call order. Reordering the array
reorders the rotation.
