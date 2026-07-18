# History Wall data contract

This contract lets the input form, database code, and wall renderer work in
parallel without inventing different field names or date formats.

## Canonical files

- `src/contracts/history-wall.schema.ts` — runtime Zod validation and the
  authoritative field definitions
- `src/contracts/history-wall.types.ts` — TypeScript types inferred from Zod
- `public/data/history-wall.base.json` — valid example/base payload, available
  at `/data/history-wall.base.json` when the Next.js app is running

AI coders must read the schema comments before changing data-producing or
data-consuming code. Do not use `parsingEvents/events.json` as the application
contract; it is legacy source material with a different shape.

## Core model

The top-level payload has a `schemaVersion` and three arrays:

- `civilizations`: timeline lanes with dates, title, notes, location, icon, and
  color
- `events`: dated wall items, optionally linked to a civilization
- `eras`: dated sentiment bands, always linked to one civilization

Every record also has a literal `type` discriminator: `civilization`, `event`,
or `era`. The arrays make whole-wall access simple, while the discriminator
makes it safe for code to handle records as a combined union.

All record IDs are globally unique. Civilization links use the stable
`civilizationId`, never a title. Titles can change; IDs should not.

## Date convention

Every record uses the same `span` object:

- `startYear`: negative for BCE, positive for CE
- `endYear`: optional; omit it for a single-year event
- `displayLabel`: the exact friendly text shown to people
- `certainty`: `exact`, `approximate`, `estimated`, or `legendary`

There is no year zero. The numeric fields control sorting and wall position;
`displayLabel` controls presentation.

## Using the contract

Parse untrusted JSON or database results instead of using a type assertion:

```ts
import { parseHistoryWallData } from "@/contracts/history-wall.schema";

const response = await fetch("/data/history-wall.base.json");
const historyWall = parseHistoryWallData(await response.json());
```

Use inferred types for component props:

```ts
import type { Civilization, HistoryEvent } from "@/contracts/history-wall.types";
```

Zod defaults are applied only when data is parsed. The public base JSON includes
the defaulted fields explicitly so it is readable without running code.

The append-only database and REST mapping for this contract is documented in
`docs/api/v1.md`.

## Extending it

For a small experiment, put non-contract data in a record's `metadata` object.
When a field becomes relied upon by the input UI or wall renderer, promote it
to a named Zod field and update all four of these together:

1. schema;
2. inferred type exports, if a new named type is useful;
3. public base JSON; and
4. this README.

Increment `schemaVersion` only for a breaking change that makes existing JSON
invalid or changes a field's meaning.
