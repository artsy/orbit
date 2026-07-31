---
title: Teams
---

# Teams

A **team** is a named group of engineers (e.g. "Frontend", "Platform") —
independent of any rotation. It exists purely as a convenience for putting a
whole team on-call in one action, instead of adding each engineer to a
rotation individually.

A team has **no lasting relationship to a rotation**. Adding a team's members
to a rotation just adds each of them as an ordinary member of that rotation's
on-call order — same as adding them one at a time. After that, you add or
remove individuals normally; there's no trace of which team (if any) they
came from.

## Create a team

**In the UI:** go to **`/teams`**, enter a name, and submit.

**Via the API:**

```sh
curl -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{ "name": "Frontend" }'
```

Team names must be unique.

## Manage a team's roster

**In the UI:** open the team at **`/teams/<teamId>`** and use the **Roster**
section to add or remove engineers. Unlike a rotation's on-call order, a
team's roster is **unordered** — there's no position to manage.

**Via the API:** like rotation membership, a team's roster is replaced as a
complete list:

```sh
curl -X PUT http://localhost:3000/api/teams/<teamId>/members \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{ "engineerIds": ["<eng-1>", "<eng-2>"] }'
```

## Rename or delete a team

**In the UI:** on the team's page (`/teams/<teamId>`), edit the name and save,
or use **Delete team**. Deleting a team only removes the team and its roster
records — it has no effect on any rotation an engineer from that team was
added to.

**Via the API:**

```sh
curl -X PATCH http://localhost:3000/api/teams/<teamId> \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{ "name": "Platform" }'

curl -X DELETE http://localhost:3000/api/teams/<teamId> \
  -H "Cookie: <your-session-cookie>"
```

## Add a full team to a rotation

**In the UI:** open a rotation at **`/rotations/<rotationId>`**, and in the
**On-call order** section use **Add a team** — pick a team and click **Add
team**. Every active engineer on that team's roster who isn't already a
member is appended to the on-call order. You can then reorder or remove
anyone individually, exactly as if they'd been added one at a time.

There's no dedicated API endpoint for this — it's the same
`PUT /api/rotations/<rotationId>/members` used for individual membership
changes, just with the team's engineer IDs merged into the existing list. To
do it yourself via the API: fetch the team's roster
(`GET /api/teams/<teamId>/members`), fetch the rotation's current membership
(`GET /api/rotations/<rotationId>/members`), then `PUT` the union of both
sets of `engineerId`s (in whatever order you want the on-call rotation to
follow) — see [Managing engineers & rotations](./managing-engineers.md) for
the membership `PUT` request shape.
