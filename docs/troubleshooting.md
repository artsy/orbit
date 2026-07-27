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

### You can sign in but can't make changes

Writes require the Gravity `team` role. If you're logged out immediately or see
an authorization error, your user is likely missing that role. In staging you
can assign it yourself via the Gravity console; production role changes go
through the platform team.

### Database connection errors

- Is Postgres running? `yarn db:up` starts it via docker-compose.
- Does `DATABASE_URL` match `docker-compose.yml`? The default is in `.env.example`.
- Have you applied migrations? Run `yarn prisma:migrate`.

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
