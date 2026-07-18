# Timeline interaction and input model

This is the shared product handoff for the wall UI and input UI. The executable
contract remains `src/contracts/history-wall.schema.ts`.

## Four things displayed on the wall

1. **Civilization** — a long bar. Its start/end dates determine its width. Its
   base hue comes from its continent family, with an optional civilization hue.
2. **Era** — a range inside one civilization. Users add it by dragging from a
   start year to an end year. Its width comes from that span. Its `value` (1–5)
   changes intensity, but never changes the continent/civilization color family.
3. **Event** — normally a point on one civilization. Users add it with a tap or
   click, then complete the full event form. Tapping the marker opens its full
   note, media, tags, and sources.
4. **Interaction event** — one event connecting two or more civilizations. It
   has an explicit relationship type and a role for each participant. This is
   how World War II, Anglo-French wars, trade routes, alliances, or hegemonic
   relationships are represented without copying the same event into each row.

## Interaction vocabulary

The fixed types are: war, conquest, occupation, alliance, treaty, diplomacy,
trade, migration, exploration/contact, colonialism, hegemony/tributary,
cultural exchange, religious exchange, technology transfer, rivalry, aid,
epidemic transmission, and other.

Participant roles add direction without changing the relationship type:
aggressor/defender, victor/defeated, occupier/occupied, colonizer/colonized,
hegemon/tributary, explorer/encountered, trader, ally, and migration
origin/destination. Use the neutral `participant` role when historical roles are
unclear or changed during the event.

An interaction must have at least two unique civilization IDs and may have up
to 40. A single event can therefore represent a world war cleanly.

## Input gestures

- Selecting **Event · tap** and tapping a civilization row chooses the date and
  civilization, then opens the event form.
- Selecting **Era · drag** and dragging along an existing civilization chooses
  both dates. The form then collects title, value, tag, summary, full Markdown
  note, tags, media, and sources.
- Selecting **Civilization · drag** uses the same range gesture on a continent
  lane, followed by its own form.
- An interaction form is an event form with relationship type and a repeatable
  participant/role picker. Do not force it into one civilization ID.

The input gesture layer and wall renderer are separate components. Both emit or
consume only canonical Zod-validated data.

## Full notes

`notes` remains the short summary used in lists and tooltips. Optional `details`
contains the full Markdown, tags, source links, and media. This keeps summary
requests small while a tap-to-open detail request can show everything.

## AI-generated event images

`POST /api/v1/images/generate` accepts an event description and returns one
immediate `dataUrl` preview. It supports OpenAI and Gemini behind one contract.
Calls require `IMAGE_GENERATION_SECRET` because each request costs money.

The returned data URL is not durable storage. For the demo it can be previewed
or downloaded; before saving it as an event's `visual`, upload it to a public
object store and save that URL. Do not put multi-megabyte base64 data in
PostgreSQL.
