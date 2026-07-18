# PikaHistory data format

The executable, shared contract for the note form, timeline wall, and database
is maintained in these files:

- [`src/contracts/history-wall.schema.ts`](./src/contracts/history-wall.schema.ts)
  — canonical Zod runtime schemas and validation
- [`src/contracts/history-wall.types.ts`](./src/contracts/history-wall.types.ts)
  — TypeScript types inferred from those schemas
- [`public/data/history-wall.base.json`](./public/data/history-wall.base.json)
  — valid base/example data, publicly served at `/data/history-wall.base.json`
- [`docs/data-contract/README.md`](./docs/data-contract/README.md)
  — conventions and usage guide

Do not define a second data shape in this file, a form component, or the wall
renderer. Import the Zod schemas/types and parse data at its boundary.

## Shape at a glance

The versioned top-level JSON contains three arrays:

```json
{
  "schemaVersion": 1,
  "civilizations": [],
  "events": [],
  "eras": []
}
```

- A `civilization` creates a dated wall lane with a title, notes, geography,
  icon, and color.
- An `event` is a dated wall item and may reference a civilization by ID.
- An `era` is a dated sentiment period and must reference a civilization by ID.

Every record has a stable globally unique `id` and a `type` discriminator.
References use IDs, not titles.

## Important year convention

Years are signed integers: negative is BCE and positive is CE. There is no year
zero. Do not use JavaScript `Date` for historical years. Each record also keeps
a human-readable `displayLabel`, which is for presentation rather than sorting.

See the canonical schema and comments for every field and validation rule.
