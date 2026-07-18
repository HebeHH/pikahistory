# PikaHistory — Data Format (shared contract)

The single source of truth for the JSON that flows between the **note form**, the
**timeline display**, and the **database**. If you change a field here, tell the other two.

Each item on the timeline is one of two node types, distinguished by `type`.

## Shared fields (both types)

| Field      | Type              | Notes                                                    |
|------------|-------------------|----------------------------------------------------------|
| `id`       | string            | Slug, unique. e.g. `"bronze-age"`. DB may override.      |
| `type`     | `"era"`/`"event"` | Discriminator.                                           |
| `title`    | string            | Display name.                                            |
| `location` | string            | The **vertical lane** on the timeline. Must match the shared lane list exactly (see below). |
| `icon`     | string            | Emoji or icon key.                                       |
| `body`     | string            | **Markdown** study notes. May embed base64 images (`![](data:...)`). |

## `era` — a span of time

Adds a start and end. Use this for periods (Bronze Age, Han Dynasty…).

| Field       | Type   | Notes                                    |
|-------------|--------|------------------------------------------|
| `startYear` | number | See **year convention** below.           |
| `endYear`   | number | Must be `>= startYear`.                  |

```json
{
  "id": "bronze-age",
  "type": "era",
  "title": "Bronze Age",
  "location": "Mesopotamia",
  "icon": "🏛️",
  "startYear": -3300,
  "endYear": -1200,
  "body": "## Smelting\nThey mixed **copper** and *tin*..."
}
```

## `event` — a single moment

Adds a single year and an optional opposing civilization (battles, conquests…).

| Field                  | Type            | Notes                              |
|------------------------|-----------------|------------------------------------|
| `year`                 | number          | See **year convention** below.     |
| `opposingCivilization` | string \| null  | e.g. `"Persia"`, or `null`.        |

```json
{
  "id": "fall-of-babylon",
  "type": "event",
  "title": "Fall of Babylon",
  "location": "Mesopotamia",
  "icon": "⚔️",
  "year": -539,
  "opposingCivilization": "Persia",
  "body": "..."
}
```

## Year convention ⚠️

Years are stored as a **signed integer**, not a date string:

- **Negative = BCE**, **positive = CE**. `-3300` = 3300 BCE, `1492` = 1492 CE.
- Year granularity only (no months/days). Postgres column: `INTEGER`.
- **Do not** use JS `Date` or date pickers — they break on BCE years.

## Lanes (`location` values)

The `location` string must be one of the shared lanes so notes land in the right row.
Keep this list identical across the form, the timeline, and the seed data:

```
Mesopotamia, Egypt, Greece, Rome, China, India, Mesoamerica
```

*(Edit this list in one place — the `LANES` array in the note form — and mirror it here.)*

## Suggested Postgres schema

```sql
CREATE TABLE nodes (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL CHECK (type IN ('era', 'event')),
  title     TEXT NOT NULL,
  location  TEXT NOT NULL,
  icon      TEXT,
  body      TEXT,                 -- markdown
  start_year INTEGER,             -- era only
  end_year   INTEGER,             -- era only
  year       INTEGER,             -- event only
  opposing_civilization TEXT      -- event only
);
```
