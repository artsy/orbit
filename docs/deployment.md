# Deployment (Hokusai)

Orbit deploys to Artsy's Kubernetes clusters with
[Hokusai](https://github.com/artsy/hokusai), the same tooling used by most
Artsy services. This page covers the files in the repo, the CI pipeline, and
the one-time setup an operator needs to do.

## What's in the repo

| Path | Purpose |
|---|---|
| `Dockerfile` | Builds the production image: Node 22 (Alpine), installs deps with the vendored Yarn 4, runs `prisma generate` + `next build`, runs as the non-root `deploy` user. |
| `.dockerignore` | Keeps the build context small (no `node_modules`, `.next`, docs, env files, …). |
| `scripts/load_secrets_and_run.sh` | Container entrypoint. Sources the fortress-provided `$SECRETS_FILE` (if set) into the environment, then execs the command (`yarn start`). |
| `hokusai/config.yml` | Project name, the `pre-deploy: yarn prisma:deploy` migration hook, and the shared `template-config-files` var source. |
| `hokusai/build.yml` / `development.yml` / `test.yml` | docker-compose files for local `hokusai build` / `dev` / `test`. |
| `hokusai/staging.yml` / `production.yml` | Kubernetes manifests (Deployment, HPA, Service, Ingress, example CronJob) for each environment. |
| `.circleci/config.yml` | CI pipeline: test → build/push image → deploy staging (on `main`) → deploy production (on `release`). |
| `.tool-versions` / `.nvmrc` | Pin the Node version for asdf / nvm. |

## How it runs in the cluster

- The app listens on **port 8080** (`PORT` is set in the manifest; Next.js'
  `yarn start` honours it).
- Kubernetes health-checks the app with a readiness probe against
  **`/api/status`** (the endpoint in `src/pages/api/status.page.ts`).
- Secrets are delivered by the **fortress** init container, which writes them
  to a shared `/secrets` volume; `secrets-config` sets `SECRETS_FILE`, and
  `load_secrets_and_run.sh` sources that file before the app starts. This is
  why the entrypoint script is required — do not remove it.

## Database migrations

Orbit uses Prisma/Postgres against an external (RDS) database, not an
in-cluster one. Schema migrations run automatically **before** each rollout via
the Hokusai pre-deploy hook in `hokusai/config.yml`:

```yaml
pre-deploy: yarn prisma:deploy
```

`prisma migrate deploy` applies any pending migrations in
`prisma/migrations/`. Because it runs as a one-off pre-deploy step (not on every
pod start), it's safe with multiple replicas.

## Required secrets

Set these in citadel/fortress for both `staging` and `production` (see
[`.env.example`](https://github.com/artsy/orbit/blob/main/.env.example) for
descriptions):

- `DATABASE_URL`
- `NEXTAUTH_URL` (the public URL of the environment) and `NEXTAUTH_SECRET`
- `CLIENT_APPLICATION_ID` / `CLIENT_APPLICATION_SECRET` (Gravity OAuth)
- `GRAVITY_URL` and `PUBLIC_GRAVITY_URL`
- `ORBIT_SERVICE_TOKENS` (optional — read-only bearer tokens for headless
  clients such as [release-lookout](https://github.com/artsy/release-lookout))

## One-time setup

An operator with cluster access does this once (see the Artsy
[Hokusai playbook](https://github.com/artsy/README/blob/main/playbooks/hokusai.md#using-hokusai-to-set-up-a-new-artsy-project)):

1. `hokusai setup --project-type nodejs` created the scaffolding (already
   committed). Adjust the manifests as above.
2. Create the ECR repository and push the first image
   (`hokusai registry push` / `hokusai build`).
3. Create the citadel/fortress secret set with the variables listed above.
4. The Horizon **`project_id`** in `.circleci/config.yml` (`282`) gates
   production releases via the `horizon/block` job on the `release` branch.
5. Wire the `hokusai` CircleCI context and open the pipeline.

Once set up, the flow is: merge to `main` → CI builds, pushes, and deploys to
**staging**; promote to the `release` branch → CI deploys to **production**
(gated by the Horizon block).
