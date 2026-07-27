---
layout: default
title: Getting started
---

# Getting started

[← Back to home](index.html)

## Prerequisites

- Node.js ≥ 22.5 (see `.nvmrc`)
- Yarn
- Docker (for local Postgres)

## Setup

1. **Install dependencies**

   ```sh
   yarn install
   ```

2. **Configure environment**

   Copy the example env file and fill in the blanks:

   ```sh
   cp .env.example .env.local
   ```

   You'll need:

   - `CLIENT_APPLICATION_ID` / `CLIENT_APPLICATION_SECRET` — a Gravity ClientApplication (see [Gravity API authentication](https://github.com/artsy/gravity/blob/main/doc/ApiAuthentication.md)).
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `DATABASE_URL`, `GRAVITY_URL`, `NEXTAUTH_URL`, `PUBLIC_GRAVITY_URL` — defaults for local dev are already in `.env.example`.

3. **Start Postgres**

   ```sh
   yarn db:up      # docker-compose up -d
   ```

4. **Create the schema and seed sample data**

   ```sh
   yarn prisma:migrate   # applies migrations
   yarn seed             # 5 engineers, a weekly rotation, a demo override + swap
   ```

5. **Run the app**

   ```sh
   yarn dev
   ```

   Open <http://localhost:3000> and sign in with Artsy. Only users with the
   Gravity `team` role can sign in and make changes.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `CLIENT_APPLICATION_ID` | Gravity OAuth client id. |
| `CLIENT_APPLICATION_SECRET` | Gravity OAuth client secret. |
| `GRAVITY_URL` | Gravity base URL (server-side auth). |
| `NEXTAUTH_URL` | Canonical URL of this app. |
| `NEXTAUTH_SECRET` | next-auth session/JWT secret. |
| `PUBLIC_GRAVITY_URL` | Gravity URL exposed to the client. |

## Useful scripts

| Script | Does |
|---|---|
| `yarn dev` | Start the dev server. |
| `yarn build` | Production build. |
| `yarn test` | Jest test suite. |
| `yarn type-check` | `tsc --noEmit`. |
| `yarn lint` | ESLint. |
| `yarn seed` | Seed sample data. |
| `yarn db:up` / `yarn db:down` | Start / stop local Postgres. |
| `yarn prisma:migrate` | Apply migrations (dev). |

Having trouble? See [Troubleshooting](troubleshooting.html).
