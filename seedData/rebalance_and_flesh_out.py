"""
Rebalance seed-events.json toward ~33% battle content (was 72%), and exercise
every data type in the schema (interaction events, eras, details) so the demo
data isn't just civilizations + single-civ battle events.

Usage: python rebalance_and_flesh_out.py
Reads/writes: ../public/data/seed-civ.json, seed-events.json, seed-eras.json (new)
"""
import json

CIV_PATH = "../public/data/seed-civ.json"
EVENTS_PATH = "../public/data/seed-events.json"
ERAS_PATH = "../public/data/seed-eras.json"

with open(CIV_PATH, encoding="utf-8") as f:
    civs = json.load(f)
with open(EVENTS_PATH, encoding="utf-8") as f:
    events = json.load(f)

by_id = {e["id"]: e for e in events}

# ---------------------------------------------------------------------------
# 1. Cut battle-heavy events down to make room for variety.
# ---------------------------------------------------------------------------
CUT_IDS = [
    # Rome: keep Emesa, Clastidium
    "event_battle_of_mount_gindarus", "event_siege_of_cyzicus",
    "event_battle_of_the_cremera", "event_battle_of_arbalo",
    # Han: keep Baideng, Rebellion of the Seven States
    "event_battle_of_chang_an", "event_battle_of_hexi", "event_battle_of_wuchao",
    # Inca: keep Cajamarca, Chanka-Inca War
    "event_battle_of_chimborazo", "event_huanca_inca_war",
    "event_battle_of_the_mangroves", "event_battle_of_huaripampa", "event_battle_of_capi",
    # Macedon: keep Thebes; Pydna (new, interaction) replaces the rest
    "event_battle_of_gythium", "event_second_battle_of_lamia", "event_battle_of_amorgos",
    "event_siege_of_olynthus", "event_war_against_nabis", "event_epirote_macedonian_war",
    # Ptolemaic Egypt: keep Raphia; Nile stays but becomes an interaction
    "event_battle_of_the_oenoparus", "event_battle_of_castra_iudaeorum", "event_battle_of_pelusium",
    # Umayyad: keep Guadalete; Tours (new, curated) replaces the rest
    "event_battle_of_vescera", "event_battle_of_avignon", "event_battle_of_tabarka",
    "event_conquest_of_carmona", "event_battle_of_bajarwan", "event_battle_of_the_nobles",
    # Thin "other" trims
    "event_periplus_mentions_aksum",           # Aksum: weakest of 5 non-battle
    "event_portuguese_raids_in_senegambia",     # Mali: weakest of 5 non-battle
    "event_demetrius_i_s_invasion_of_india",    # Maurya: tangential to Maurya itself
]
events = [e for e in events if e["id"] not in CUT_IDS]
by_id = {e["id"]: e for e in events}

# ---------------------------------------------------------------------------
# 2. Convert Battle of the Nile into a real multi-civilization interaction.
#    Caesar (Rome) backed Cleopatra's faction (Ptolemaic Egypt) against her
#    rival siblings -- a real, dated, two-civilization event already in our data.
# ---------------------------------------------------------------------------
nile = by_id["event_battle_of_the_nile"]
del nile["civilizationId"]
nile["interaction"] = {
    "type": "war",
    "participants": [
        {"civilizationId": "civilization_rome", "role": "ally"},
        {"civilizationId": "civilization_ptolemaic_egypt", "role": "victor"},
    ],
}
nile["details"] = {
    "markdown": "Julius Caesar's intervention on Cleopatra's behalf against her co-ruler siblings "
                "is the clearest direct link between Rome and Ptolemaic Egypt in our data -- it's "
                "the same event from both civilizations' side, not two separate battles.",
    "tags": ["egypt", "rome", "succession-war", "caesar", "cleopatra"],
    "sources": [
        {"title": "Battle of the Nile (47 BC)", "url": nile["metadata"]["wiki"], "publisher": "Wikipedia"}
    ],
    "media": [],
}

# ---------------------------------------------------------------------------
# 3. New curated non-battle events (real history, hand-picked for variety and
#    for cross-civilization link potential -- flagged as curated, not extracted).
# ---------------------------------------------------------------------------
def rec(id_, title, year, display, certainty, civ, notes, icon):
    return {
        "type": "event", "id": id_, "title": title,
        "span": {"startYear": year, "displayLabel": display, "certainty": certainty},
        "civilizationId": civ, "notes": notes,
        "visual": {"kind": "emoji", "value": icon},
        "metadata": {"curated": True, "curationReason": "rebalance pass: reduce battle-event share"},
    }

new_events = [
    # Rome
    rec("event_twelve_tables", "The Twelve Tables", -451, "451 BCE", "approximate", "civilization_rome",
        "Rome's first written law code, posted in the Forum after plebeian pressure for legal transparency. The foundation of later Roman law.",
        "📜"),
    rec("event_colosseum_completed", "Colosseum completed", 80, "80 CE", "exact", "civilization_rome",
        "The Flavian Amphitheatre opens under Emperor Titus with a hundred days of games, becoming Rome's largest and most enduring public monument.",
        "🏟️"),
    rec("event_edict_of_caracalla", "Edict of Caracalla", 212, "212 CE", "exact", "civilization_rome",
        "Emperor Caracalla grants Roman citizenship to nearly all free inhabitants of the empire, dissolving the old distinction between citizen and subject.",
        "📜"),
    # Han China
    rec("event_zhang_qian_mission", "Zhang Qian's mission west", -138, "138 BCE", "approximate", "civilization_han_china",
        "Emperor Wu sends the envoy Zhang Qian to seek allies against the Xiongnu. He returns 13 years later with the first detailed Chinese account of Central Asia, opening the route that becomes the Silk Road.",
        "🧭"),
    rec("event_cai_lun_papermaking", "Cai Lun improves papermaking", 105, "c. 105 CE", "approximate", "civilization_han_china",
        "Court official Cai Lun refines a cheap, standardized papermaking process using bark, hemp, and rags -- a technology that will eventually spread west through the Islamic world to Europe.",
        "📄"),
    rec("event_records_of_grand_historian", "Records of the Grand Historian completed", -94, "c. 94 BCE", "approximate", "civilization_han_china",
        "Sima Qian completes his sweeping history of China from legendary times to his own -- the model for all later Chinese dynastic histories.",
        "📚"),
    # Inca
    rec("event_pachacuti_ascension", "Pachacuti founds the Inca Empire", 1438, "1438 CE", "approximate", "civilization_inca",
        "After defeating the Chanka, Pachacuti takes the throne and transforms Cusco from a regional chiefdom into an expanding imperial state.",
        "👑"),
    rec("event_qhapaq_nan", "Qhapaq Nan road network built", 1450, "c. 1450 CE", "approximate", "civilization_inca",
        "The Inca build a road system eventually spanning some 40,000 km across the Andes, with rope bridges, waystations, and relay runners connecting the empire.",
        "🛤️"),
    rec("event_machu_picchu", "Machu Picchu built", 1450, "c. 1450 CE", "approximate", "civilization_inca",
        "An estate is built high in the Andes for Pachacuti, likely as a royal retreat -- abandoned a century later and never found by the Spanish.",
        "🏔️"),
    rec("event_mita_labor_system", "Mit'a labor system formalized", 1460, "c. 1460 CE", "approximate", "civilization_inca",
        "The Inca state formalizes mit'a, a rotational labor tax used instead of money to build roads, temples, and terraces across the empire.",
        "🧱"),
    # Macedon
    rec("event_philip_ii_phalanx_reform", "Philip II reforms the Macedonian army", -359, "359 BCE", "approximate", "civilization_macedon",
        "Philip II professionalizes the Macedonian army and introduces the sarissa-armed phalanx, laying the military foundation his son Alexander will use to conquer Persia.",
        "🛡️"),
    rec("event_league_of_corinth", "League of Corinth formed", -337, "337 BCE", "approximate", "civilization_macedon",
        "Philip II organizes the Greek city-states (except Sparta) into a league under Macedonian leadership, ending centuries of Greek city-state independence.",
        "🏛️"),
    rec("event_aristotle_tutors_alexander", "Aristotle tutors Alexander", -343, "c. 343 BCE", "approximate", "civilization_macedon",
        "Philip II hires Aristotle to tutor the young Alexander at Mieza, a three-year education that shapes Alexander's lifelong interest in science, medicine, and philosophy.",
        "📖"),
    rec("event_founding_of_alexandria", "Alexander founds Alexandria", -331, "331 BCE", "approximate", "civilization_macedon",
        "Alexander the Great founds a city on the Egyptian coast bearing his name. After his death it becomes the capital of the Ptolemaic dynasty founded by his general Ptolemy.",
        "🏗️"),
    # Ptolemaic Egypt
    rec("event_library_of_alexandria", "Library of Alexandria founded", -285, "c. 285 BCE", "approximate", "civilization_ptolemaic_egypt",
        "Ptolemy II establishes the great Library and Mouseion at Alexandria, drawing scholars from across the Greek world and aiming to collect all the world's texts.",
        "📚"),
    rec("event_pharos_lighthouse", "Lighthouse of Alexandria completed", -280, "c. 280 BCE", "approximate", "civilization_ptolemaic_egypt",
        "The Pharos of Alexandria, one of the Seven Wonders of the Ancient World, is completed to guide ships into the harbor -- and stands for over a thousand years.",
        "🗼"),
    rec("event_rosetta_stone", "Rosetta Stone inscribed", -196, "196 BCE", "exact", "civilization_ptolemaic_egypt",
        "A priestly decree for Ptolemy V is inscribed in three scripts -- hieroglyphic, Demotic, and Greek. Rediscovered in 1799, it becomes the key that finally lets scholars read hieroglyphs.",
        "🪨"),
    # Umayyad Caliphate
    rec("event_battle_of_tours", "Battle of Tours", 732, "732 CE", "exact", "civilization_umayyad_caliphate",
        "Charles Martel's Frankish army halts an Umayyad force near Tours, in what later European histories treat as the high-water mark of the Umayyad advance into Western Europe.",
        "⚔️"),
    rec("event_dome_of_the_rock", "Dome of the Rock completed", 691, "691 CE", "exact", "civilization_umayyad_caliphate",
        "Caliph Abd al-Malik completes the Dome of the Rock in Jerusalem, one of the earliest and most enduring works of Islamic architecture.",
        "🕌"),
    rec("event_abd_al_malik_reforms", "Abd al-Malik's currency and administrative reforms", 697, "697 CE", "approximate", "civilization_umayyad_caliphate",
        "Abd al-Malik introduces a standardized Islamic gold and silver coinage and makes Arabic the administrative language across the caliphate, replacing Greek and Persian bureaucratic systems.",
        "🪙"),
    rec("event_great_mosque_damascus", "Great Mosque of Damascus completed", 715, "715 CE", "exact", "civilization_umayyad_caliphate",
        "Caliph al-Walid I completes the Great Mosque of Damascus on the site of a former Byzantine church, a model for congregational mosques across the Islamic world.",
        "🕌"),
]
events.extend(new_events)
by_id = {e["id"]: e for e in events}

# ---------------------------------------------------------------------------
# 4. New interaction event: Rome's conquest of Macedon (Battle of Pydna),
#    the event that ends Macedon as an independent kingdom -- lines up exactly
#    with civilization_macedon's own dissolved year.
# ---------------------------------------------------------------------------
pydna = {
    "type": "event", "id": "event_battle_of_pydna",
    "title": "Battle of Pydna",
    "span": {"startYear": -168, "displayLabel": "168 BCE", "certainty": "exact"},
    "interaction": {
        "type": "conquest",
        "participants": [
            {"civilizationId": "civilization_rome", "role": "victor"},
            {"civilizationId": "civilization_macedon", "role": "defeated"},
        ],
    },
    "notes": "Rome decisively defeats King Perseus of Macedon, ending the Antigonid dynasty and Macedon's independence -- the event behind civilization_macedon's own end date.",
    "visual": {"kind": "emoji", "value": "⚔️"},
    "details": {
        "markdown": "The Roman legion's flexibility famously exploited gaps that opened in the "
                    "Macedonian phalanx on broken ground -- a tactical lesson later Roman writers "
                    "returned to repeatedly. Macedon was carved into four Roman client republics "
                    "afterward, then annexed outright in 148 BCE.",
        "tags": ["rome", "macedon", "conquest", "phalanx", "legion"],
        "sources": [
            {"title": "Battle of Pydna", "url": "https://en.wikipedia.org/wiki/Battle_of_Pydna", "publisher": "Wikipedia"}
        ],
        "media": [],
    },
    "metadata": {"curated": True, "curationReason": "demonstrates a multi-civilization interaction event"},
}
events.append(pydna)

with open(EVENTS_PATH, "w", encoding="utf-8") as f:
    json.dump(events, f, indent=2, ensure_ascii=False)

# ---------------------------------------------------------------------------
# 5. Era records -- none existed before this pass. Sentiment sub-periods
#    within a civilization, using a spread of the tag vocabulary.
# ---------------------------------------------------------------------------
def era(id_, title, start, end, display, civ, notes, value, tag, details=None):
    e = {
        "type": "era", "id": id_, "title": title,
        "span": {"startYear": start, "endYear": end, "displayLabel": display, "certainty": "approximate"},
        "civilizationId": civ, "notes": notes, "value": value, "tag": tag,
        "metadata": {},
    }
    if details:
        e["details"] = details
    return e

eras = [
    era("era_pax_romana", "Pax Romana", 27, 180, "27 BCE - 180 CE", "civilization_rome",
        "Two centuries of relative internal peace and stability across the Roman world, from Augustus to the death of Marcus Aurelius.",
        5, "golden_age",
        details={
            "markdown": "Trade, travel, and construction flourished under the protection of a "
                        "single power controlling the Mediterranean rim. Historians conventionally "
                        "close the period with Marcus Aurelius's death and the accession of Commodus.",
            "tags": ["rome", "golden-age", "stability"],
            "sources": [{"title": "Pax Romana", "url": "https://en.wikipedia.org/wiki/Pax_Romana", "publisher": "Wikipedia"}],
            "media": [],
        }),
    era("era_han_wudi_expansion", "Reign of Emperor Wu", -141, -87, "141-87 BCE", "civilization_han_china",
        "Emperor Wu vastly expands Han territory, defeats the Xiongnu in sustained campaigns, and opens westward contact along what becomes the Silk Road.",
        4, "expansion"),
    era("era_ptolemaic_golden_age", "Ptolemaic Golden Age", -285, -246, "285-246 BCE", "civilization_ptolemaic_egypt",
        "Under Ptolemy II Philadelphus, Alexandria becomes the intellectual capital of the Hellenistic world, home to the Library and the Lighthouse.",
        5, "golden_age",
        details={
            "markdown": "Ptolemy II's reign is the peak of Ptolemaic wealth and cultural patronage, "
                        "before the dynasty's slow decline through internal succession conflicts in "
                        "later centuries.",
            "tags": ["egypt", "alexandria", "golden-age", "scholarship"],
            "sources": [],
            "media": [],
        }),
    era("era_mansa_musa_reign", "Reign of Mansa Musa", 1312, 1337, "1312-1337 CE", "civilization_mali",
        "Mali reaches its height of wealth, territory, and international renown under Mansa Musa, capped by his famous hajj to Mecca.",
        5, "golden_age"),
    era("era_umayyad_second_fitna", "Second Fitna", 683, 692, "683-692 CE", "civilization_umayyad_caliphate",
        "A succession crisis fractures the caliphate into competing claimants for nearly a decade before Umayyad authority is forcibly reunified.",
        1, "civil_war"),
]

with open(ERAS_PATH, "w", encoding="utf-8") as f:
    json.dump(eras, f, indent=2, ensure_ascii=False)

# ---------------------------------------------------------------------------
# 6. Add `details` to a few flagship civilizations, to exercise that field
#    on the civilization type too (not just events/eras).
# ---------------------------------------------------------------------------
CIV_DETAILS = {
    "civilization_rome": {
        "markdown": "From a single city-state to a Mediterranean-spanning empire across roughly "
                    "twelve centuries, through Kingdom, Republic, and Empire.",
        "tags": ["mediterranean", "empire", "republic"],
        "sources": [{"title": "Ancient Rome", "url": "https://en.wikipedia.org/wiki/Ancient_Rome", "publisher": "Wikipedia"}],
        "media": [],
    },
    "civilization_ptolemaic_egypt": {
        "markdown": "A Greek Macedonian dynasty ruling pharaonic Egypt for nearly three centuries, "
                    "blending Hellenistic and Egyptian traditions until Roman annexation.",
        "tags": ["egypt", "hellenistic", "alexandria"],
        "sources": [{"title": "Ptolemaic Kingdom", "url": "https://en.wikipedia.org/wiki/Ptolemaic_Kingdom", "publisher": "Wikipedia"}],
        "media": [],
    },
    "civilization_han_china": {
        "markdown": "A foundational Chinese imperial dynasty that consolidated bureaucratic rule, "
                    "expanded far into Central Asia, and gave its name to the Han ethnic majority.",
        "tags": ["china", "silk-road", "bureaucracy"],
        "sources": [{"title": "Han dynasty", "url": "https://en.wikipedia.org/wiki/Han_dynasty", "publisher": "Wikipedia"}],
        "media": [],
    },
}
for civ in civs:
    if civ["id"] in CIV_DETAILS:
        civ["details"] = CIV_DETAILS[civ["id"]]

with open(CIV_PATH, "w", encoding="utf-8") as f:
    json.dump(civs, f, indent=2, ensure_ascii=False)

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
battle_kw = ["battle", "siege", "war", "conquest", "campaign", "sack", "invasion", "capture", "rebellion"]
battle_count = sum(1 for e in events if any(k in e["title"].lower() for k in battle_kw))
interaction_count = sum(1 for e in events if "interaction" in e)
details_events = sum(1 for e in events if "details" in e)
print(f"civilizations: {len(civs)} ({sum(1 for c in civs if 'details' in c)} with details)")
print(f"events: {len(events)} ({battle_count} battle-ish = {battle_count/len(events):.1%}, {interaction_count} interactions, {details_events} with details)")
print(f"eras: {len(eras)}")
