"""
Round 2 extraction: dated events per civilization.

Deviates from the original context-transfer doc in one deliberate way:
point-in-polygon assignment against historical-basemaps was dropped as a
stretch goal (no shapely available, and coord/region/wiki have no home in
the current schema besides `metadata` anyway -- see docs/data-contract).
Events are assigned to a civilization by a direct Wikidata relation
(P17 country / P361 part of / P710 participant) to that civilization's QID,
filtered to the civilization's own date span. This is the exact bias the
doc warned about (dense for well-documented civs, thin for others) --
accepted as a known limitation for this round, not silently ignored.

coord/region/wiki are kept in each event's `metadata` object (the schema's
documented escape hatch), not promoted to named fields.

Usage: python round2_events.py
Reads: ../public/data/seed-civ.json (for QIDs + spans)
Writes: events.round2.json
"""

import json
import time
import urllib.parse
import urllib.request

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
WIKI_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
USER_AGENT = "PikaHistoryHackathon/0.1 (seed data extraction)"
EVENTS_PER_CIVILIZATION = 7

EMOJI_BY_KEYWORD = [
    ("battle", "⚔️"), ("siege", "🏰"), ("conquest", "🗡️"),
    ("treaty", "📜"), ("founding", "🏗️"), ("capture", "🚩"),
    ("sack", "🔥"), ("campaign", "🎖️"),
]


def astronomical_to_historical(iso_date: str) -> tuple[int, int, int]:
    sign = -1 if iso_date.startswith("-") else 1
    raw = iso_date.lstrip("-")
    year, month, day = raw[:4], raw[5:7], raw[8:10]
    astronomical = sign * int(year)
    historical = astronomical - 1 if astronomical <= 0 else astronomical
    return historical, int(month), int(day)


def historical_to_astronomical_iso(year: int, end: bool = False) -> str:
    astronomical = year + 1 if year < 0 else year
    date = "12-31" if end else "01-01"
    if astronomical <= 0:
        return f"-{abs(astronomical):04d}-{date}T00:00:00Z"
    return f"{astronomical:04d}-{date}T00:00:00Z"


def sparql(query: str) -> list[dict]:
    url = f"{SPARQL_ENDPOINT}?query={urllib.parse.quote(query)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
    return data["results"]["bindings"]


def fetch_events_for_civilization(qid: str, start_year: int, end_year: int) -> list[dict]:
    date_from = historical_to_astronomical_iso(start_year)
    date_to = historical_to_astronomical_iso(end_year, end=True)
    query = f"""
    SELECT DISTINCT ?event ?eventLabel ?desc ?date ?coord ?article WHERE {{
      {{ ?event wdt:P17 wd:{qid} }} UNION {{ ?event wdt:P361 wd:{qid} }} UNION {{ ?event wdt:P710 wd:{qid} }}
      ?event wdt:P585 ?date .
      OPTIONAL {{ ?event wdt:P625 ?coord . }}
      OPTIONAL {{ ?event schema:description ?desc . FILTER(lang(?desc)="en") }}
      OPTIONAL {{ ?article schema:about ?event ; schema:isPartOf <https://en.wikipedia.org/> . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
      FILTER(?date >= "{date_from}"^^xsd:dateTime && ?date <= "{date_to}"^^xsd:dateTime)
    }}
    ORDER BY ?date
    LIMIT 200
    """
    rows = sparql(query)
    seen_qids = set()
    events = []
    for row in rows:
        event_qid = row["event"]["value"].rsplit("/", 1)[-1]
        if event_qid in seen_qids:
            continue
        seen_qids.add(event_qid)
        label = row.get("eventLabel", {}).get("value")
        if not label or label.startswith("Q"):
            continue
        article = row.get("article", {}).get("value")
        coord_raw = row.get("coord", {}).get("value", "")
        coord = None
        if coord_raw.startswith("Point("):
            lon, lat = coord_raw[6:-1].split(" ")
            coord = [round(float(lon), 4), round(float(lat), 4)]
        events.append({
            "qid": event_qid,
            "label": label,
            "desc": row.get("desc", {}).get("value", ""),
            "date": row["date"]["value"],
            "coord": coord,
            "wiki": article,
        })
    return events


def pick_spread(events: list[dict], n: int) -> list[dict]:
    """Prefer events with an article + coord, spread across the date range."""
    scored = sorted(
        events,
        key=lambda e: (e["wiki"] is None, e["coord"] is None, e["date"]),
    )
    good = [e for e in scored if e["wiki"] is not None]
    pool = good if len(good) >= n else scored
    if len(pool) <= n:
        return pool
    step = len(pool) / n
    return [pool[int(i * step)] for i in range(n)]


def fetch_wiki_summary(article_url: str) -> str | None:
    title = article_url.rsplit("/", 1)[-1]
    url = WIKI_SUMMARY_API + title
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.load(resp)
        return data.get("extract")
    except Exception:
        return None


def slugify(label: str) -> str:
    keep = "".join(c.lower() if c.isalnum() else " " for c in label)
    return "_".join(keep.split())[:60]


def pick_icon(label: str) -> str:
    lower = label.lower()
    for keyword, emoji in EMOJI_BY_KEYWORD:
        if keyword in lower:
            return emoji
    return "📌"


def build_event_record(civ_id: str, raw: dict) -> dict:
    historical_year, month, day = astronomical_to_historical(raw["date"])
    summary = fetch_wiki_summary(raw["wiki"]) if raw["wiki"] else None
    notes = summary or raw["desc"] or raw["label"]
    metadata = {"wikidataQid": raw["qid"]}
    if raw["coord"] is not None:
        metadata["coord"] = raw["coord"]  # [lon, lat]
    if raw["wiki"] is not None:
        metadata["wiki"] = raw["wiki"]
    return {
        "type": "event",
        "id": f"event_{slugify(raw['label'])}",
        "title": raw["label"],
        "span": {
            "startYear": historical_year,
            "displayLabel": f"{abs(historical_year)} {'BCE' if historical_year < 0 else 'CE'}",
            "certainty": "exact" if (month, day) != (1, 1) else "approximate",
        },
        "civilizationId": civ_id,
        "notes": notes.strip() if notes else "",
        "visual": {"kind": "emoji", "value": pick_icon(raw["label"])},
        "metadata": metadata,
    }


def main():
    with open("../public/data/seed-civ.json", encoding="utf-8") as f:
        civs = json.load(f)

    all_events = []
    seen_ids = set()
    for civ in civs:
        qid = civ["metadata"].get("wikidataQid")
        if not qid:
            print(f"skip {civ['id']}: no wikidataQid (curated entry)")
            continue
        print(f"fetching events for {civ['id']} ({qid})...")
        raw_events = fetch_events_for_civilization(
            qid, civ["span"]["startYear"], civ["span"]["endYear"]
        )
        print(f"  {len(raw_events)} candidate events")
        chosen = pick_spread(raw_events, EVENTS_PER_CIVILIZATION)
        for raw in chosen:
            record = build_event_record(civ["id"], raw)
            if record["id"] in seen_ids:
                record["id"] += f"_{civ['id'].split('_', 1)[1]}"
            seen_ids.add(record["id"])
            all_events.append(record)
            time.sleep(0.2)  # be polite to the Wikipedia summary API
        print(f"  kept {len(chosen)}")
        time.sleep(0.5)  # be polite to the SPARQL endpoint

    with open("events.round2.json", "w", encoding="utf-8") as f:
        json.dump(all_events, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {len(all_events)} events to events.round2.json")


if __name__ == "__main__":
    main()
