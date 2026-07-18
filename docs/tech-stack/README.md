# History Wall technology stack

Status: **accepted project standard**

Last reviewed: **18 July 2026**

This folder is the shared technical contract for contributors and AI coding
assistants. Read it before proposing or generating application code. If the
team changes a decision, update this guide in the same pull request.

## Decision summary

| Area | Project standard |
| --- | --- |
| Application | Next.js App Router with React and strict TypeScript |
| Hosting | Vercel |
| Database | Neon PostgreSQL, connected through the Vercel Marketplace |
| Database access | Drizzle ORM and Drizzle Kit migrations |
| Validation | Zod at every untrusted-data boundary |
| Styling | Tailwind CSS; shadcn/ui components may be added selectively |
| Package manager | pnpm, with the lockfile committed |
| Unit/component tests | Vitest and React Testing Library |
| Browser tests | Playwright for critical user journeys |
| Backup | Neon point-in-time restore plus an independent `pg_dump` copy |

Do not substitute another framework, ORM, database, validation library,
package manager, or state library without a team decision recorded here.

## Why Next.js for a one-screen application?

The product can have one main route and still benefit from Next.js. The App
Router provides the React application, server-side database access, mutations,
and Vercel deployment in one codebase. We do not need a separately deployed
API simply because the application uses PostgreSQL.

The initial application should have one product page at `src/app/page.tsx`.
Reusable components are independent of routes and live under
`src/components/`. New routes should only be added for a real user or platform
need, such as authentication callbacks, a webhook, or a public API.

## Rendering and data-access rules

Next.js App Router components are Server Components unless they contain the
`"use client"` directive.

- Keep pages and data-loading components on the server by default.
- Use Client Components only for browser APIs, event handlers, or interactive
  state. Put `"use client"` at the smallest practical boundary.
- Read PostgreSQL through functions under `src/lib/db/queries/`. A page or
  Server Component may call those functions directly.
- Client Components must never import database code or receive database
  credentials.
- Prefer Server Actions for application-owned form submissions and mutations.
- Use Route Handlers for webhooks, external consumers, file responses, or when
  explicit HTTP semantics are useful. Do not create an internal REST layer by
  default.
- Validate every mutation, URL parameter, form submission, upload, webhook,
  and external API response with Zod before trusting it.
- Authorize on the server for every protected read and write. Hiding a control
  in the browser is not authorization.
- After a mutation, explicitly refresh or invalidate the affected data. Add
  caching only when its freshness behaviour is understood and tested.

Official background: [Next.js App Router glossary](https://nextjs.org/docs/app/glossary).

## Expected application structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    history-wall/       # Product/domain components
    forms/              # Shared form compositions
    ui/                 # Generic UI primitives
  lib/
    actions/            # Server Actions
    db/
      client.ts         # Server-only Drizzle connection
      schema.ts         # Version-controlled schema source of truth
      queries/          # Named database operations
    validation/         # Shared Zod schemas
  types/                # Truly shared types that cannot be inferred
drizzle/                # Generated, reviewed, committed SQL migrations
tests/
  e2e/                  # Playwright tests
```

Keep a component beside its component-specific tests and small helpers. Do not
create generic abstractions until at least two real callers need them.

## React component conventions

- Components and files use `PascalCase` for exported React components.
- Hooks begin with `use`; ordinary functions do not.
- Prefer composition and explicit props over large configuration objects.
- Keep domain components in `components/history-wall/`; keep reusable visual
  primitives in `components/ui/`.
- Do not put database rows directly into client state when a smaller view model
  will do.
- Use local React state first. Do not add Redux, Zustand, or TanStack Query
  unless a documented requirement justifies it.
- Accessibility is part of completion: semantic HTML, keyboard operation,
  visible focus, labelled controls, and sensible empty/error/loading states.

## TypeScript conventions

- Enable strict TypeScript. Do not use `any` to bypass an error.
- Infer types from Drizzle schemas and Zod schemas instead of maintaining
  duplicate interfaces.
- Use `unknown` for untrusted values and narrow them through validation.
- Avoid TypeScript enums; prefer string unions or `as const` objects.
- Keep server-only modules out of client dependency graphs. Mark sensitive
  modules with `import "server-only"` when appropriate.
- Environment variables are read through one validated server-side module;
  application code should not scatter direct `process.env` access.

## Database conventions

Use Neon PostgreSQL provisioned or connected through the Vercel Marketplace.
Place the database and Vercel Functions in nearby regions. Use the pooled Neon
connection string for serverless application traffic and SSL connections in
every environment.

- Drizzle schema files are the code-level source of truth.
- Use PostgreSQL `snake_case` for table and column names.
- Prefer database-generated UUID primary keys unless a domain-specific natural
  key is clearly better.
- Use `timestamptz` for moments in time and store them in UTC.
- Add `created_at` and `updated_at` when the lifecycle of a record matters.
- Model relationships with foreign keys and choose deletion behaviour
  deliberately; do not default everything to cascade.
- Add constraints for rules the database must never violate. Application
  validation improves errors but does not replace database integrity.
- Add indexes from observed query patterns and verify them with query plans.
- Avoid unbounded list queries; define ordering and pagination.

Official background: [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage)
and [Drizzle with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon).

## Migration workflow for a team

1. Change `src/lib/db/schema.ts` on a feature branch.
2. Generate a named migration with the project's `pnpm db:generate` script.
3. Read the generated SQL. Check locks, data loss, defaults, backfills, foreign
   keys, and indexes.
4. Commit the schema and generated `drizzle/` migration together.
5. Apply and test the migration against a development or preview database.
6. Merge migrations through review and apply them to production through the
   agreed deployment workflow.

Never run `drizzle-kit push` against a shared, preview, staging, or production
database. It is acceptable only for disposable local experimentation. Never
edit production schema manually to get around a migration. Coordinate with
other open database pull requests before regenerating or renumbering migration
files.

Official background: [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations).

## Environments and secrets

Use separate databases or Neon branches for development/preview and
production. A preview deployment must not mutate production data.

Expected server-side variables will include:

```dotenv
DATABASE_URL=
```

Add names, never values, to `.env.example`. Keep real values in local ignored
files, Vercel environment variables, Neon, and GitHub Actions secrets. Never
commit credentials, database dumps, production records, or personal data.
Only variables intentionally safe for browsers may use the `NEXT_PUBLIC_`
prefix.

## Dependency and quality policy

- pnpm is the only package manager. Commit `pnpm-lock.yaml` and pin the pnpm
  version through the `packageManager` field in `package.json`.
- Pin the Node.js major version in the repository when the app is scaffolded.
- Add a dependency only when it is materially better than a small local
  implementation and is maintained, typed, and browser/server compatible.
- A normal pull request must pass formatting, linting, type checking, and
  relevant tests.
- Add tests for business rules and regressions. Cover the critical create/edit/
  view journey with Playwright once that journey exists.

## Backup and recovery

Backups have two independent layers:

1. Neon point-in-time restore and/or scheduled snapshots for fast operational
   recovery.
2. A scheduled custom-format `pg_dump` stored in an encrypted bucket outside
   Neon for provider-independent recovery and portability.

The exact schedule, retention, security requirements, and restore procedure are
defined in [DATABASE_BACKUPS.md](./DATABASE_BACKUPS.md). A backup is not
considered reliable until the team has restored and verified it.

## Rules for changing this standard

A contributor may propose a change, but must explain the problem, alternatives,
migration cost, deployment impact, and rollback path. Update this document and
`AI_CODER_CONTEXT.md` in the same pull request. Until that pull request is
merged, this guide remains the project standard.

## Instructions for AI-assisted work

Give every AI coder [AI_CODER_CONTEXT.md](./AI_CODER_CONTEXT.md) together with
the specific task. The AI context is intentionally short enough to paste, while
this document remains the canonical explanation.
