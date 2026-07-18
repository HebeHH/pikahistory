# Deploy History Wall to Vercel

The deployed app uses Neon PostgreSQL through `DATABASE_URL`. Local development
uses the Docker database started by `pnpm dev`; the application and Drizzle
schema are identical in both environments.

## First-time setup with Vercel CLI

Run these from the repository root:

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link
pnpm dlx vercel@latest git connect
```

`vercel link` lets you select a team and either create or select the Vercel
project. `vercel git connect` connects this GitHub repository so pushes produce
deployments.

Provision and connect Neon through Vercel's native Marketplace integration:

```bash
pnpm dlx vercel@latest integration add neon --name history-wall-db
pnpm dlx vercel@latest env ls
```

The integration should add `DATABASE_URL` to development, preview, and
production. If using an existing Neon project instead, add its pooled,
TLS-enabled connection string as `DATABASE_URL` in Vercel Project Settings →
Environment Variables.

Also set a long random `HISTORY_WALL_WRITE_SECRET` in each environment where
record creation and note editing should be enabled. Without it, write endpoints
return `503` while reads remain available.

## Create the production table

Apply the Drizzle schema using Vercel's production environment without writing
the secret to disk:

```bash
pnpm dlx vercel@latest env run -e production -- pnpm db:push
```

Review the SQL shown by Drizzle before accepting it. This is required once for
a new database and whenever `src/lib/db/schema.ts` changes.

## Deploy and verify

```bash
pnpm dlx vercel@latest deploy --prod
pnpm dlx vercel@latest curl /
pnpm dlx vercel@latest curl /api/v1/records
pnpm dlx vercel@latest logs --environment production --level error --since 5m
```

The API list should return a versioned JSON envelope. A new production database
will be empty until records are posted; local seed data is intentionally not
copied into production automatically.

## Useful ongoing commands

```bash
# Run Next locally with Vercel's development variables instead of Docker
pnpm dlx vercel@latest env run -- pnpm dev:app

# Preview deployment
pnpm dlx vercel@latest deploy

# Production deployment
pnpm dlx vercel@latest deploy --prod
```

Official references: [Vercel CLI deployment](https://vercel.com/docs/projects/deploy-from-cli),
[Vercel environment commands](https://vercel.com/docs/cli/env), and
[Neon on Vercel](https://neon.com/docs/guides/vercel-manual).
