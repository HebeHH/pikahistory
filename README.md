# History Wall

A Next.js application for exploring civilizations, eras, and world events on a
shared timeline. The project stack and contribution constraints are documented
in [`docs/tech-stack/README.md`](docs/tech-stack/README.md).

## Local development

Requirements: Node.js 20.9 or newer, pnpm 10, and Docker Desktop.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts a dedicated PostgreSQL 17 container, waits until it is ready,
applies the Drizzle schema, inserts any missing base records, and starts Next.js.
Data persists between runs in a Docker volume. Open
[http://localhost:3000](http://localhost:3000).

On macOS, the command also opens Docker Desktop when it is installed but
stopped. The first run may take a moment while Docker downloads PostgreSQL.

Useful local database commands:

```bash
pnpm db:local:up    # Start, apply schema, and seed without starting Next.js
pnpm db:local:url   # Print the local connection string
pnpm db:local:down  # Stop PostgreSQL; its data remains
```

If Docker Desktop is stopped, `pnpm dev` explains what to start and exits rather
than falling back to a remote database. `pnpm dev:app` starts only Next.js and
uses `DATABASE_URL` from the environment or `.env.local`.

## REST API

The append-only v1 API is documented in
[`docs/api/v1.md`](docs/api/v1.md). Its core routes are:

- `GET /api/v1/records` — all record summaries
- `GET /api/v1/records?detail=full` — all complete records
- `GET /api/v1/records/:id` — one complete record
- `POST /api/v1/records` — append one civilization, event, or era

There are intentionally no update or delete endpoints.

## Vercel deployment

See [`docs/deployment/vercel.md`](docs/deployment/vercel.md) for linking the
project, provisioning Neon, applying the schema, deploying, and verifying the
API with Vercel CLI.

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
