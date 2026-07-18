"""
Round 1 extraction: civilization-level metadata (Wikidata P571/P576/P36).

Produces the `civilizations` array of the History Wall data contract
(src/contracts/history-wall.schema.ts). This is Round 1 from the
map/KG context-transfer doc, retargeted: the doc's "era" (a top-level
polity with start/end/capital) is this schema's `civilization`, not its
`era` (which is a sentiment sub-period within one civilization and is
out of scope here).

Usage: python round1_civilizations.py
Writes: civilizations.round1.json (array only, not the full HistoryWallData
payload -- merge into public/data/history-wall.base.json by hand once
reviewed).
"""

import json
import time
import urllib.parse
import urllib.request

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "PikaHistoryHackathon/0.1 (seed data extraction)"

# Confirmed civilization list. Khmer Empire (originally the 3rd Asian slot)
# was dropped in favor of a hand-curated pre-colonial Maori/Aotearoa entry --
# oral-tradition history has no Wikidata inception/dissolution/capital triple
# and isn't a fit for this extraction round at all.
CIVILIZATIONS = [
    {"id": "civilization_rome", "title": "Ancient Rome", "qid": "Q1747689",
     "continent": "europe", "color": "#8C1C13",
     "icon": "🏛️", "certainty": "approximate"},
    {"id": "civilization_ptolemaic_egypt", "title": "Ptolemaic Egypt", "qid": "Q2320005",
     "continent": "africa", "color": "#C9A227",
     "icon": "𓋹", "certainty": "exact"},
    {"id": "civilization_macedon", "title": "Macedon", "qid": "Q83958",
     "continent": "europe", "color": "#3C6E71",
     "icon": "⭐", "certainty": "approximate"},
    {"id": "civilization_aksum", "title": "Kingdom of Aksum", "qid": "Q139377",
     "continent": "africa", "color": "#6A4C93",
     "icon": "🗿", "certainty": "approximate"},
    {"id": "civilization_mali", "title": "Mali Empire", "qid": "Q184536",
     "continent": "africa", "color": "#D68C45",
     "icon": "👑", "certainty": "exact"},
    {"id": "civilization_umayyad_caliphate", "title": "Umayyad Caliphate", "qid": "Q8575586",
     "continent": "transcontinental", "color": "#2E7D32",
     "icon": "☪️", "certainty": "exact"},
    {"id": "civilization_han_china", "title": "Han China", "qid": "Q7209",
     "continent": "asia", "color": "#B23A48",
     "icon": "🐉", "certainty": "exact"},
    {"id": "civilization_maurya_india", "title": "Maurya India", "qid": "Q62943",
     "continent": "asia", "color": "#E07A5F",
     "icon": "🦁", "certainty": "exact"},
    {"id": "civilization_inca", "title": "Inca Empire", "qid": "Q28573",
     "continent": "south_america", "color": "#FFB703",
     "icon": "☀️", "certainty": "exact"},
]


def astronomical_to_historical(iso_date: str) -> int:
    """Wikidata P571/P576 use astronomical year numbering (year 0 exists).

    historicalYear = astronomicalYear - 1 for astronomicalYear <= 0 (BCE)
    historicalYear = astronomicalYear      for astronomicalYear > 0  (CE)
    """
    year = int(iso_date[:5]) if iso_date.startswith("-") else int(iso_date[:4])
    return year - 1 if year <= 0 else year


def display_label(start: int, end: int) -> str:
    def fmt(y: int) -> str:
        return f"{abs(y)} BCE" if y < 0 else f"{y} CE"
    return f"{fmt(start)}–{fmt(end)}"


def fetch_wikidata(qids: list[str]) -> dict:
    values = " ".join(f"wd:{q}" for q in qids)
    query = f"""
    SELECT ?item ?itemLabel ?inception ?dissolved ?capitalLabel WHERE {{
      VALUES ?item {{ {values} }}
      OPTIONAL {{ ?item wdt:P571 ?inception. }}
      OPTIONAL {{ ?item wdt:P576 ?dissolved. }}
      OPTIONAL {{ ?item wdt:P36 ?capital. }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    """
    url = f"{SPARQL_ENDPOINT}?query={urllib.parse.quote(query)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)

    by_qid: dict[str, dict] = {}
    for row in data["results"]["bindings"]:
        qid = row["item"]["value"].rsplit("/", 1)[-1]
        entry = by_qid.setdefault(qid, {"label": None, "inception": None,
                                          "dissolved": None, "capitals": []})
        entry["label"] = row.get("itemLabel", {}).get("value", entry["label"])
        if "inception" in row:
            entry["inception"] = row["inception"]["value"]
        if "dissolved" in row:
            entry["dissolved"] = row["dissolved"]["value"]
        cap = row.get("capitalLabel", {}).get("value")
        if cap and cap not in entry["capitals"]:
            entry["capitals"].append(cap)
    return by_qid


def build_civilizations() -> list[dict]:
    wd = fetch_wikidata([c["qid"] for c in CIVILIZATIONS])
    records = []
    for c in CIVILIZATIONS:
        row = wd[c["qid"]]
        start = astronomical_to_historical(row["inception"])
        end = astronomical_to_historical(row["dissolved"])
        records.append({
            "type": "civilization",
            "id": c["id"],
            "title": c["title"],
            "span": {
                "startYear": start,
                "endYear": end,
                "displayLabel": display_label(start, end),
                "certainty": c["certainty"],
            },
            "notes": "",  # fill in by hand: Wikidata has no good short blurb field
            "location": {"continent": c["continent"]},
            "icon": {"kind": "emoji", "value": c["icon"]},
            "color": c["color"],
            "metadata": {
                "wikidataQid": c["qid"],
                "wikidataLabel": row["label"],
                "capitals": row["capitals"],
            },
        })
    return records


if __name__ == "__main__":
    civs = build_civilizations()
    with open("civilizations.round1.json", "w", encoding="utf-8") as f:
        json.dump(civs, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(civs)} civilizations to civilizations.round1.json")
