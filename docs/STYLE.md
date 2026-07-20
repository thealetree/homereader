# Translation Style Guide

The rulebook for authoring cards. The point of this document is **consistency
across the whole poem**: card 400 must feel like it was made by the same hand
as card 1. Read it before authoring a batch; update it whenever a new
convention is decided (especially the epithet glossary).

## Sources

- **Greek text**: Perseus `tlg0012.tlg002.perseus-grc2` — Homer, *Odyssey*,
  ed. A. T. Murray (Loeb, 1919). Public domain. Line numbers preserved exactly,
  including editorial transpositions (books 3, 14) and omitted lines
  (10.456, 16.101, 23.49).
- **Murray 1919 English**: Perseus `perseus-eng3`. Public domain. Prose,
  anchored to the Greek only every 5 lines; shown on the left page as the
  fallback crib and always credited.

## Card structure

- Fixed **20-line cards**. Cards may break mid-scene or mid-sentence — this is
  accepted (Loeb pages do the same). Each card's stylized prose should still
  read as a reasonably self-contained unit.
- Each card's `translations` object is flat:
  `{ interlinear: [...], literal: [...], elizabethan: "...", modernist: "...", storybook: "..." }`
  Every card also carries a `murray` array (5-line segments) from
  `parse_murray.py`.
- `meta` records `method: "interactive"`, `model`, and `generatedAt`.

## Proper names — Latinized / familiar English forms

Use the **familiar English/Latin forms**, never strict transliteration.
Odysseus (not Odysseus→Ulysses; keep the Greek hero-name *Odysseus*, but
Latinize everything else that has a standard English form).

| Greek | Use | Not |
|---|---|---|
| Ὀδυσσεύς | Odysseus | Odysseös |
| Ζεύς | Zeus | Zeús |
| Ποσειδάων | Poseidon | Poseidōn |
| Καλυψώ | Calypso | Kalypsō |
| Ἰθάκη | Ithaca | Ithakē |
| Τροίη | Troy | Troíē |
| Ὑπερίων Ἠέλιος | Hyperion the Sun / Helios Hyperion | Hyperiōn Ēelios |
| Ἀθήνη | Athena | Athene / Athēnē |
| Κίρκη | Circe | Kirke |
| Ἀχιλλεύς | Achilles | Akhilleus |
| Αἴας | Ajax | Aias |
| Ἑρμείας | Hermes | Hermeias |
| Αἴγισθος | Aegisthus | Aigisthos |
| Ὀρέστης | Orestes | Orestes |
| Ἀτρεΐδης | son of Atreus | Atreides |
| Κρονίδης | son of Cronos | Kronides |
| Κύκλωψ / Πολύφημος | Cyclops / Polyphemus | Kyklops / Polyphemos |
| Ὠγυγίη | Ogygia | Ōgygiē |
| Σπάρτη / Πύλος | Sparta / Pylos | Spartē / Pylos |
| Ἀχαιοί | Achaeans | Akhaioi |
| Ἄτλας / Φόρκυς / Θόωσα | Atlas / Phorcys / Thoosa | — |

When a new name first appears, add its decided form to this table.

## The two line-by-line cribs (left page)

Both must contain **exactly one unit per Greek line** — the generator and any
authoring pass validate this, and mismatches are flagged in `meta.drift`.

### `interlinear` — word-by-word gloss
- Follow **Greek word order**, even where the English is rough.
- One Greek word → one English token; join multi-word renderings with hyphens
  (`the-much-turned`, `was-driven-wandering`).
- Reflect the morphology: tense, voice, mood, and case-role show in the English
  (aorist passive πλάγχθη → `was-driven-wandering`; accusative ἄνδρα as object
  → `the-man`). Do **not** append formal case/tense tags — the hyphen-gloss
  itself carries it.
- Translate every word; don't smooth over particles where they carry meaning.

### `literal` — grammatical English, line by line
- Real, readable English grammar, but stay close to the Greek structure,
  vocabulary, and imagery.
- One English line per Greek line; where Greek syntax spills across lines,
  divide the English at the same points as best you can.
- Preserve epithets and formulaic phrases **literally and consistently** (see
  glossary).

## Recurring epithets & formulae — running glossary

Homer is formulaic. Translate each stock epithet/formula the **same way every
time** it appears, so the reader hears a returning phrase. Add rows as new
formulae appear. (Left column = literal rendering; keep interlinear consistent
too.)

| Greek | Literal rendering |
|---|---|
| πολύτροπος | of many turns |
| γλαυκῶπις Ἀθήνη | bright-eyed Athena *(Murray: "flashing-eyed"; we standardize to bright-eyed)* |
| νεφεληγερέτα Ζεύς | Zeus the cloud-gatherer / cloud-gathering Zeus |
| πατὴρ ἀνδρῶν τε θεῶν τε | the father of men and gods |
| γαιήοχος (Poseidon) | the earth-enfolder |
| ἐνοσίχθων (Poseidon) | the earth-shaker |
| ἐύσκοπος ἀργεϊφόντης (Hermes) | the keen-sighted Argeiphontes |
| δῖα θεάων | bright among goddesses |
| ῥοδοδάκτυλος Ἠώς | rosy-fingered Dawn *(when it appears)* |
| οἶνοψ πόντος | the wine-dark sea *(when it appears)* |
| πόδας ὠκὺς Ἀχιλλεύς | swift-footed Achilles *(when it appears)* |

## The three stylized renderings (right page)

Whole-card prose (or verse), one string each. **Never bowdlerize** — Homer's
violence, cruelty, and frankness survive in every style, including Storybook
(the cozy-register-over-brutal-content contrast is deliberate satire).

- **Elizabethan** — unrhymed iambic-pentameter blank verse in an Elizabethan
  register; period diction (thou/thee/hath) where natural, never stilted.
  Dramatic power and readability over line-by-line fidelity. *(Renamed from
  "Shakespearean" to avoid using a real author's name.)*
- **Modernist** — spare, declarative 20th-century prose; short sentences,
  concrete nouns, no ornament (Hemingway-esque). Clarity and understatement.
- **Storybook** — children's-storybook cadence and vocabulary; simple words,
  warm narration, gentle rhythms ("And so…", "Now, …"). All graphic content
  retained unchanged in substance — soften the diction, never the facts.

## Workflow

- Author in **batches of 5 cards**, all three styles per card.
- Van reviews each batch. Once conventions are stable, review can focus on the
  stylized prose (the cribs self-validate on line count).
- Keep this file updated as names and epithets accumulate — it is the memory
  that keeps the poem consistent.
