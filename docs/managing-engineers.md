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
(optionally) their Slack username, and submit.

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/engineers \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@artsymail.com",
    "slackUsername": "@ada"
  }'
```

`slackUsername` is optional and can be updated later via `PATCH /api/engineers/[id]`.

## Remove (deactivate) an engineer

Engineers are **soft-deactivated** (`active: false`) rather than deleted, so
historical overrides that reference them stay intact.

**In the UI:** on **`/engineers`**, click **Deactivate** next to the person.

**Via the API:**

```sh
curl -X DELETE http://localhost:3000/api/engineers/<engineerId> \
  -H "Cookie: <your-session-cookie>"
```

## Create a rotation

Creating a rotation is currently an API action (no dedicated UI page yet):

```sh
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Platform on-call",
    "cadenceDays": 7,
    "anchorDate": "2026-07-20T00:00:00.000Z"
  }'
```

- `cadenceDays` defaults to `7` (weekly) if omitted.
- `anchorDate` is the start of period 0 — the schedule cycles forward and
  backward from here.

## Add or remove an engineer in a rotation's on-call order

Membership is set as a **complete ordered list**: position in the array is the
position in the round-robin. To add someone, send the full list including them;
to remove someone, send the full list without them.

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

> Note: creating rotations and editing membership are API-only today and are
> good candidates for a future admin UI. If you add that UI, update this page
> (see the doc-sync rule in `AGENTS.md`).
