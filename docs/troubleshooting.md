---
title: Troubleshooting
---

# Troubleshooting

### `Only absolute URLs are supported` on login

Your env isn't fully configured. Make sure `NEXTAUTH_URL` and `GRAVITY_URL` are
set (see [Getting started](./getting-started.md)) — this usually means you're
missing a `.env.local`.

### `Unauthorized: invalid client_id` on login

`CLIENT_APPLICATION_ID` / `CLIENT_APPLICATION_SECRET` are wrong or missing. Get
valid Gravity ClientApplication credentials — see
[Gravity API authentication](https://github.com/artsy/gravity/blob/main/doc/ApiAuthentication.md).

### "Access denied" on sign-in

Orbit requires the Gravity **`team`** role — that's the only bar, for both
signing in and using every feature. The error page shows which account was
rejected; sign out (the button on that page), then sign back in with an
account that has `team`. In staging you can assign yourself the role via the
Gravity console; production role changes go through the platform team.

Roles are only read at sign-in — if you were just granted `team`, sign out and
back in to pick it up.

### Database connection errors

- Is Postgres running? `yarn db:up` starts it via docker-compose.
- Does `DATABASE_URL` match `docker-compose.yml`? The default is in `.env.example`.
- Have you applied migrations? Run `yarn prisma:migrate`.
- `Environment variable not found: DATABASE_URL` from a `prisma` command: the
  Prisma CLI only reads a plain `.env` file, not `.env.local`. Run
  `cp .env.local .env` and re-run the command.
- `P1010: User was denied access on the database` even though `.env` looks
  right: something else on your machine is already listening on port 5432 (a
  Homebrew/system Postgres, for example) and is intercepting the connection
  before it reaches the Docker container. Check with
  `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Orbit's docker-compose Postgres publishes
  on host port **5433** for exactly this reason — make sure `DATABASE_URL`
  points at `5433`, not `5432`.

### `PrismaClient did not initialize` / missing client types

Regenerate the client after pulling schema changes:

```sh
yarn prisma generate
```

### A new page doesn't show up

Route files must use the `.page.tsx` (or `.page.ts`) suffix — this is enforced
by `pageExtensions` in `next.config.js`. A file named `foo.tsx` under `pages/`
is ignored.

### Type errors after changing the data model

`src/rotations/types.ts` is the shared contract. If you change
`prisma/schema.prisma`, update the types and every consumer (API + UI) together,
then run `yarn type-check`.
