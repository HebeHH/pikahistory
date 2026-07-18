# Shared context for AI coding assistants

Paste this file into an AI coding session, or instruct the assistant to read it
and `docs/tech-stack/README.md` before editing the repository.

---

You are contributing to the **History Wall** group project. Follow the
repository's canonical stack guide at `docs/tech-stack/README.md`. Do not make
silent architecture substitutions.

## Fixed stack

- Next.js App Router, React, and strict TypeScript
- Vercel hosting
- Neon PostgreSQL through the Vercel Marketplace
- Drizzle ORM with reviewed, committed Drizzle Kit migrations
- Zod validation at untrusted-data boundaries
- Tailwind CSS; use shadcn/ui only selectively
- pnpm with the committed lockfile
- Vitest + React Testing Library; Playwright for critical browser journeys

## Required implementation behaviour

1. Keep the application on one main page unless the task truly needs another
   route.
2. Default to Server Components. Add `"use client"` only to the smallest
   interactive subtree.
3. Put reusable product components in `src/components/history-wall/` and
   generic primitives in `src/components/ui/`.
4. Put database access in `src/lib/db/`; never import it into a Client
   Component or expose credentials to the browser.
5. Prefer Server Actions for application-owned mutations. Use Route Handlers
   for webhooks, external APIs, file responses, or explicit HTTP needs.
6. Validate inputs with Zod and authorize protected operations on the server.
7. Treat the Drizzle schema and committed migrations as the schema source of
   truth. Never run schema push against any shared or production database.
8. Infer types from Drizzle and Zod instead of duplicating interfaces. Do not
   use `any` to suppress TypeScript errors.
9. Use local React state first. Do not introduce a global state or data-fetching
   library without a demonstrated requirement and team approval.
10. Preserve unrelated work in the repository. Keep changes scoped, add
    relevant tests, and run format/lint/typecheck/tests before reporting done.
11. Never commit secrets, dumps, production data, or `.env` values.
12. Do not replace the agreed framework, database, ORM, validation library,
    package manager, or test tools without an approved guide change.

Before coding, summarize the files you expect to change and identify any task
request that conflicts with this context. When requirements are ambiguous,
prefer the smallest implementation consistent with the existing code and this
guide. Report assumptions explicitly.

Specific task:

`[PASTE THE TASK HERE]`

---

If this short context and the canonical guide differ, the canonical guide wins.
