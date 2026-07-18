# History Wall five-hour hackathon stack

This is the shared build contract for contributors and AI coding assistants.
The goal is a working demo in five hours. Prefer the shortest clear path to the
demo and do not add infrastructure for hypothetical future needs.

## Fixed stack

| Area | Choice |
| --- | --- |
| Application | Next.js App Router, React, strict TypeScript |
| Hosting | Vercel |
| Database | Neon PostgreSQL through the Vercel Marketplace |
| Database access | Drizzle ORM |
| Input validation | Zod where user input reaches the server |
| Styling | Tailwind CSS; shadcn/ui when it saves time |
| Package manager | pnpm |

Do not swap frameworks, databases, ORMs, styling systems, or package managers
during the hackathon.

## How to run it

- `pnpm dev` uses the automatic local Docker PostgreSQL database.
- `pnpm dlx vercel@latest env run -- pnpm dev:app` uses the persistent Vercel
  development database while Next.js still runs locally.
- Full setup and teammate instructions live in the root `README.md`.
- Vercel, Neon, schema, and deployment commands live in
  `docs/deployment/vercel.md`.

## Scope

- Build one main page at `src/app/page.tsx`.
- Break the UI into reusable React components where it makes the page easier to
  work on in parallel.
- Implement only the happy path and simple visible error/loading states needed
  for the demo.
- Use one shared Neon database.
- Deploy the working main branch to Vercel.

Explicitly out of scope for the five-hour build:

- Automated tests and test infrastructure
- Backup and recovery automation
- Monitoring, analytics, elaborate logging, or performance work
- Multiple environments or preview database branches
- A separate backend service or internal REST API
- Global state libraries, repository layers, service layers, or speculative
  abstractions
- CI/CD work beyond Vercel's normal Git deployment
- Production hardening that is not necessary to make the demo work

## Minimal structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    history-wall/       # Product-specific components
    ui/                 # Small reusable visual primitives
  lib/
    actions.ts          # Server Actions for writes
    db/
      client.ts         # Server-only Drizzle connection
      schema.ts         # Database schema
      queries.ts        # Shared queries only when useful
    validation.ts       # Small shared Zod schemas
```

Create folders only when they are needed. A small file is better than an empty
architecture.

## React and Next.js rules

- Use Server Components by default.
- Add `"use client"` only to components that need clicks, browser APIs, or local
  interactive state.
- Keep interactive boundaries small; the whole page should not become a Client
  Component by default.
- Put product components in `src/components/history-wall/` and generic visual
  pieces in `src/components/ui/`.
- Use props and local React state. Do not add Redux, Zustand, TanStack Query, or
  another state library.
- Use Server Actions for writes. Read the database directly from Server
  Components through `src/lib/db/`.
- Do not create API routes unless an external service actually needs one.
- Build accessible controls with semantic HTML and labels, but do not build a
  custom design system.

Official background: [Next.js App Router glossary](https://nextjs.org/docs/app/glossary).

## Database rules

- Use the shared Neon PostgreSQL database and Drizzle ORM.
- Keep `DATABASE_URL` server-side. Never expose it to a Client Component or
  commit it to Git.
- Put the Drizzle connection in `src/lib/db/client.ts` and schema in
  `src/lib/db/schema.ts`.
- One designated teammate should coordinate schema changes to avoid people
  changing the shared database at the same time.
- During the hackathon, use Drizzle's direct schema push workflow for speed.
  Check the generated SQL/data-loss warning before accepting it.
- Use database-generated IDs, `timestamptz` for moments in time, and simple
  foreign keys where the data genuinely relates.
- Validate user-submitted values with Zod in the Server Action before writing.

Official background: [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage)
and [Drizzle with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon).

## Environment variables

Use one local ignored `.env.local` file and the Vercel project environment:

```dotenv
DATABASE_URL=
```

Commit an `.env.example` containing names only if the app is scaffolded. Never
commit credentials or real user data. Only browser-safe values may use the
`NEXT_PUBLIC_` prefix.

## Git workflow during the hackathon

- Pull before starting a task.
- Keep each change small and scoped so it can be merged quickly.
- Do not reformat or reorganize unrelated files.
- Commit `pnpm-lock.yaml`; everyone uses pnpm.
- Before handing off, run the fastest relevant checks already present in the
  project, such as TypeScript or the build. Do not stop feature work to create a
  new testing or CI setup.
- If two people need the same file, agree on ownership before editing it.

## Definition of done

A task is done when its demo path works, TypeScript has no known errors in the
changed code, the UI is understandable, and the change can be deployed. Do not
expand the task with optional engineering work.

Give every AI coder [AI_CODER_CONTEXT.md](./AI_CODER_CONTEXT.md) with its
specific task.
