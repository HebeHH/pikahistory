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

## Rules

1. Keep the product on one main page unless the task cannot work without
   another route.
2. Default to Server Components. Add `"use client"` only to the smallest
   interactive subtree.
3. Put product components in `src/components/history-wall/` and small generic
   primitives in `src/components/ui/`.
4. Keep database access in `src/lib/db/`; never expose `DATABASE_URL` or import
   database code into a Client Component.
5. Prefer Server Actions for writes and direct server-side queries for reads.
   Do not create an internal REST API.
6. Validate user-submitted values with Zod immediately before server-side use.
7. Use props and local React state. Do not add a global state or client
   data-fetching library.
8. Use the simplest working implementation. Do not introduce speculative
   abstractions, service layers, repositories, or a custom design system.
9. Do not add tests, test infrastructure, backups, monitoring, analytics,
   multiple environments, or CI/CD work unless the task explicitly asks for
   it.
10. Preserve unrelated repository work and do not reformat unrelated files.
11. Use pnpm and preserve the lockfile. Never commit secrets or real user data.
12. Run only the quick checks already available and report what you actually
    verified.

Before coding, briefly state which files you expect to change. If the task
conflicts with this context, flag it instead of silently changing the stack.

Specific task:

`[PASTE THE TASK HERE]`

---

If this short context differs from `docs/tech-stack/README.md`, the README wins.
