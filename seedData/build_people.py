"""
Seed data for the new `person` record type (schema v2).

Picks people who either genuinely span two of our seeded civilizations
(Alexander, Caesar, Cleopatra) or anchor an existing single-civilization
event so the person record isn't floating disconnected from the timeline.
Multi-civilization links are only used where there's a real, direct
connection -- not inferred legacy (e.g. Ashoka's Buddhism reaching Han China
centuries later via missionaries he never met is NOT modeled as a link on
his person record; that's a job for a future bridge/shock-link entity, not
a claim about Ashoka himself).
"""
import json

def person(id_, title, start, end, display, civ_ids, roles, role_title, notes, icon, details=None):
    p = {
        "type": "person", "id": id_, "title": title,
        "span": {"startYear": start, "endYear": end, "displayLabel": display, "certainty": "approximate"},
        "civilizationIds": civ_ids, "roles": roles, "roleTitle": role_title,
        "notes": notes,
        "visual": {"kind": "emoji", "value": icon},
        "metadata": {"curated": True},
    }
    if details:
        p["details"] = details
    return p

people = [
    person("person_alexander_the_great", "Alexander the Great", -356, -323, "356-323 BCE",
        ["civilization_macedon", "civilization_ptolemaic_egypt"],
        ["monarch", "military_leader"], "King of Macedon",
        "Conquered the Persian Empire and founded Alexandria in Egypt; after his death, his general Ptolemy took Egypt and founded the Ptolemaic dynasty.",
        "👑",
        details={
            "markdown": "The direct link between two of our civilizations: Alexander is Macedon's "
                        "own king, and the reason Ptolemaic Egypt exists at all -- his general "
                        "Ptolemy I Soter took Egypt after Alexander's empire fractured.",
            "tags": ["macedon", "egypt", "conqueror"], "sources": [], "media": [],
        }),
    person("person_julius_caesar", "Julius Caesar", -100, -44, "100-44 BCE",
        ["civilization_rome", "civilization_ptolemaic_egypt"],
        ["political_leader", "military_leader"], "Dictator of Rome",
        "Intervened in a Ptolemaic succession dispute on Cleopatra's behalf at the Battle of the Nile, then ruled Rome as dictator until his assassination.",
        "🏛️"),
    person("person_cleopatra_vii", "Cleopatra VII", -69, -30, "69-30 BCE",
        ["civilization_ptolemaic_egypt", "civilization_rome"],
        ["monarch", "political_leader", "diplomat"], "Pharaoh",
        "The last active ruler of the Ptolemaic Kingdom, allied first with Caesar and then Mark Antony against Rome's shifting internal politics before her death and Egypt's annexation.",
        "👑"),
    person("person_ashoka", "Ashoka", -304, -232, "c. 304-232 BCE",
        ["civilization_maurya_india"],
        ["monarch", "religious_leader"], "Emperor",
        "Maurya emperor whose brutal conquest of Kalinga led him to renounce further warfare and promote Buddhism through edicts inscribed across the empire.",
        "☸️"),
    person("person_zhang_qian", "Zhang Qian", -200, -114, "c. 200-114 BCE",
        ["civilization_han_china"],
        ["explorer", "diplomat"], "Imperial Envoy",
        "Sent west by Emperor Wu to seek allies against the Xiongnu; his 13-year journey produced the first Chinese account of Central Asia and opened the route later travelers turned into the Silk Road.",
        "🧭"),
    person("person_mansa_musa", "Mansa Musa", 1280, 1337, "c. 1280-1337 CE",
        ["civilization_mali"],
        ["monarch", "political_leader"], "Mansa",
        "Ruler of the Mali Empire at its wealthiest, remembered for a hajj to Mecca so lavish it depressed Cairo's gold price for years.",
        "🕋"),
    person("person_aristotle", "Aristotle", -384, -322, "384-322 BCE",
        ["civilization_macedon"],
        ["philosopher", "scholar"], "Tutor",
        "Greek philosopher hired by Philip II to tutor the young Alexander at Mieza, shaping Alexander's lifelong interests in science and philosophy.",
        "📖"),
]

# fix Mansa Musa's negative start year typo (year sign bug guard)
for p in people:
    if p["span"]["startYear"] == 0 or p["span"]["endYear"] == 0:
        raise ValueError(f"year zero in {p['id']}")

with open("../public/data/seed-people.json", "w", encoding="utf-8") as f:
    json.dump(people, f, indent=2, ensure_ascii=False)

print(f"wrote {len(people)} people")
