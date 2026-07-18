# Shared context for AI coding assistants

Paste this into each AI coding session with the specific task.

---

You are contributing to the **History Wall**, a five-hour hackathon project.
Optimize for a working demo, fast integration, and minimal code. Follow
`docs/tech-stack/README.md` and do not add long-term infrastructure.

## Fixed stack

- Next.js App Router, React, and strict TypeScript
- Vercel
- Neon PostgreSQL through the Vercel Marketplace
- Drizzle ORM
- Zod for user input that reaches the server
- Tailwind CSS; shadcn/ui only when it saves time
- pnpm

## Required run modes

- `pnpm dev` is the default: it opens/uses Docker, starts isolated local
  PostgreSQL, applies the schema, seeds missing base records, and starts Next.
- `pnpm dlx vercel@latest env run -- pnpm dev:app` runs locally against the
  shared persistent **development** Neon database connected to Vercel.
- Never assume `pnpm dev` uses Neon, and never point ordinary development work
  at the production database.
- Setup details are canonical in `README.md`; deployment and production schema
  commands are canonical in `docs/deployment/vercel.md`.

## Rules

0. The canonical data contract is `src/contracts/history-wall.schema.ts`, with
   inferred types in `src/contracts/history-wall.types.ts` and an example at
   `public/data/history-wall.base.json`. Read it before producing or consuming
   History Wall data; do not invent alternate fields or date formats.
   People are first-class `person` records in the top-level `people` collection;
   do not bury biographies inside civilization or event metadata.
   Cross-civilization relationships are event `interaction` objects with 2+
   participants; never duplicate one war/trade relationship as unrelated events.
0. The public REST contract is documented in `docs/api/v1.md`. It is
   append-only for identity/history fields: POST adds a new stable ID, GET reads,
   PATCH edits only notes/details, and duplicate IDs return a conflict. Do not add
   PUT, DELETE, or upsert behaviour. The records
   list returns summaries unless `detail=full` is explicitly requested.
1. Keep the product on one main page unless the task cannot work without
   another route.
2. Default to Server Components. Add `"use client"` only to the smallest
   interactive subtree.
3. Put wall components in `src/components/timeline/`, other product components
   in `src/components/history-wall/`, and small generic primitives in
   `src/components/ui/`.
4. Keep database access in `src/lib/db/`; never expose `DATABASE_URL` or import
   database code into a Client Component.
5. Use the existing versioned REST API in `src/app/api/v1/` for record reads and
   writes. Do not create competing unversioned endpoints or alternate data
   access contracts.
6. Validate user-submitted values with Zod immediately before server-side use.
7. Use props and local React state. Do not add a global state or client
   data-fetching library.
8. Use the simplest working implementation. Do not introduce speculative
   abstractions, service layers, repositories, or a custom design system.
9. Do not add tests, test infrastructure, backups, monitoring, analytics, extra
   deployment environments, or CI/CD work unless the task explicitly asks for
   it.
10. Preserve unrelated repository work and do not reformat unrelated files.
11. Use pnpm and preserve the lockfile. Never commit secrets or real user data.
    AI provider keys and `IMAGE_GENERATION_SECRET` are server-only environment
    variables; never expose them with a `NEXT_PUBLIC_` prefix.
12. Run only the quick checks already available and report what you actually
    verified.

Before coding, briefly state which files you expect to change. If the task
conflicts with this context, flag it instead of silently changing the stack.

Specific task:

`[PASTE THE TASK HERE]`

---

If this short context differs from `docs/tech-stack/README.md`, the README wins.
