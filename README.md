# History Wall

A Next.js application for exploring civilizations, eras, and world events on a
shared timeline. The project stack and contribution constraints are documented
in [`docs/tech-stack/README.md`](docs/tech-stack/README.md).

## Local development

Requirements: Node.js 20.9 or newer and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The starter page validates
and displays summary counts from the canonical History Wall sample data.

Set `DATABASE_URL` in `.env.local` before using the database commands:

```bash
pnpm db:push
pnpm db:studio
```

The Drizzle table definition is in `src/lib/db/schema.ts`. Configure
`DATABASE_URL`, then push it to the shared Neon database.

## REST API

The append-only v1 API is documented in
[`docs/api/v1.md`](docs/api/v1.md). Its core routes are:

- `GET /api/v1/records` — all record summaries
- `GET /api/v1/records?detail=full` — all complete records
- `GET /api/v1/records/:id` — one complete record
- `POST /api/v1/records` — append one civilization, event, or era

There are intentionally no update or delete endpoints.

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
