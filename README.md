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

## Local app with the persistent Vercel database

Use this when teammates need to see the same persistent Neon data instead of
their isolated Docker data:

```bash
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link --project history-wall
pnpm dlx vercel@latest env run -- pnpm dev:app
```

This injects Vercel's **development** `DATABASE_URL` into Next.js without
writing the secret into the repository. Each teammate must log in and link their
own checkout once. Do not use `pnpm dev` for this mode: that command always
selects the local Docker database.

The production database can be selected with `-e production`, but it should not
be used for ordinary development:

```bash
pnpm dlx vercel@latest env run -e production -- pnpm dev:app
```

## REST API

The append-only v1 API is documented in
[`docs/api/v1.md`](docs/api/v1.md). Its core routes are:

- `GET /api/v1/records` — all record summaries
- `GET /api/v1/records?detail=full` — all complete records
- `GET /api/v1/records/:id` — one complete record
- `POST /api/v1/records` — append one civilization, event, or era
- `POST /api/v1/images/generate` — protected OpenAI/Gemini event-image preview

There are intentionally no update or delete endpoints.

Timeline interaction types, drag/tap input behavior, era colors, structured
notes, and image-generation behavior are documented in
[`docs/product/timeline-interactions.md`](docs/product/timeline-interactions.md).

To enable event images locally or on Vercel, set `IMAGE_GENERATION_SECRET` and
at least one of `GEMINI_API_KEY` or `OPENAI_API_KEY`. Keep these server-only;
never use a `NEXT_PUBLIC_` prefix. The cost-oriented defaults and optional model
overrides are listed in [`.env.example`](.env.example).

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
