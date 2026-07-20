# Pipeline

Offline tools that produce the static JSON in `/data`. The deployed reader
never runs these — no API key ever ships.

## parse_tei.py

Parses the Perseus TEI XML of the Odyssey (Murray 1919, public domain) into
20-line card JSON. Stdlib only.

```bash
python3 parse_tei.py --fetch              # download TEI source (~1.5 MB)
python3 parse_tei.py --preview 1.1-1.10   # print records, write nothing
python3 parse_tei.py --book 1             # write data/odyssey/book-01/card-*.json
python3 parse_tei.py --all                # all 24 books
```

Line numbers are preserved exactly as printed in the edition — including
editorial transpositions (books 3 and 14) and omitted lines (10.456, 16.101,
23.49). Cards that already contain translations are never overwritten.

## generate_translations.py

Fills each card's `translations` field via the Anthropic API
(`claude-opus-4-8`). Eight renderings per card: interlinear + literal
(per-line, validated against the Greek line count), natural (verse), and five
Free flavors. Cached cards are skipped — never regenerated — so re-running is
safe. Line-count drift is recorded in `meta.drift` and printed loudly.

```bash
python3 -m venv .venv && .venv/bin/pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
.venv/bin/python generate_translations.py --book 1 --card 1   # one card
.venv/bin/python generate_translations.py --book 1            # whole book
```

Each generated card is stamped with the model ID and timestamp in `meta`, so
future regenerations with newer models are traceable.
