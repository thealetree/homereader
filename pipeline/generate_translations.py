#!/usr/bin/env python3
"""Generate AI translations for parsed Odyssey cards via the Anthropic API.

Fills the "translations" field of each card JSON produced by parse_tei.py:

    "translations": {
      "interlinear": [...],   one literal gloss per Greek line (left page +
                              slider stop 1 -- generated once, used twice)
      "literal":     [...],   one grammatical-English line per Greek line
      "natural":     "...",   fluent modern English verse (whole card)
      "free": {               fluid literary renderings (whole card)
        "homeric":       "...",
        "shakespearean": "...",
        "modernist":     "...",
        "lucretian":     "...",
        "storybook":     "..."
      }
    }

Cached cards are never regenerated: any card whose "translations" field is
already populated is skipped (use --overwrite to force, e.g. while iterating
on prompts during development).

Line-count validation: interlinear and literal must contain exactly as many
units as the card has Greek lines. Mismatches are recorded in meta.drift and
printed loudly, per the project spec.

Usage:
    python3 generate_translations.py --book 1 --card 1    # one card
    python3 generate_translations.py --book 1             # all cards in book
    ANTHROPIC_API_KEY must be set (or another SDK credential source).
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

MODEL = "claude-opus-4-8"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "odyssey"

STYLES = ["shakespearean", "modernist", "storybook"]

SYSTEM = """\
You are a classical philologist and literary translator producing translations
of Homer's Odyssey for an interlinear reader. You work from the Greek text of
the Perseus Digital Library (Murray's 1919 edition). You are rigorous about
fidelity to the Greek in the line-by-line cribs and a gifted stylist in the
stylized renderings. Never add commentary, notes, headings, or line numbers to
your output unless the format instructions say otherwise. Never bowdlerize:
Homer's violence, cruelty, and frankness must survive translation everywhere."""

LINES_SCHEMA = {
    "type": "object",
    "properties": {
        "lines": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["lines"],
    "additionalProperties": False,
}

PER_LINE_PROMPTS = {
    "interlinear": """\
Produce a literal interlinear gloss of each Greek line below. Follow the Greek
word order as closely as English tolerates, even where the result is rough or
un-English. Translate every word; use hyphenated compounds where one Greek
word needs several English words (e.g. "much-turned"). This gloss sits
directly beneath the Greek line, so it must correspond to that line alone.
Return JSON with a "lines" array containing exactly {n} strings, one per
Greek line, in order.""",
    "literal": """\
Translate each Greek line below into grammatical English prose, staying as
close to the Greek structure, vocabulary, and imagery as good grammar allows.
Preserve epithets and formulaic phrases literally. Each line of translation
must correspond to its Greek line; where Greek syntax spills across lines,
divide the English at the same points as best you can. Return JSON with a
"lines" array containing exactly {n} strings, one per Greek line, in order.""",
}

WHOLE_CARD_PROMPTS = {
    "shakespearean": """\
Translate the following passage of the Odyssey into Elizabethan blank verse --
unrhymed iambic pentameter in the manner of Shakespeare, with period diction
(thou/thee/hath where natural, but never stilted). Prioritize dramatic power
and readability over line-by-line fidelity. Return only the translation
text.""",
    "modernist": """\
Translate the following passage of the Odyssey into spare, declarative
twentieth-century prose -- short sentences, concrete nouns, no ornament, in
the manner of Hemingway. Prioritize clarity and understatement over
line-by-line fidelity. Return only the translation text.""",
    "storybook": """\
Translate the following passage of the Odyssey in the cadence and vocabulary
of a children's storybook -- simple words, warm narration, gentle rhythms
("And so...", "Now, ..."). CRITICAL: retain ALL of Homer's graphic, violent,
and disturbing content completely unchanged in substance; the contrast between
the cozy register and the brutal events is deliberate satire. Soften the
diction, never the facts. Return only the translation text.""",
}


def greek_block(card):
    return "\n".join(f"{l['n']}. {l['greek']}" for l in card["lines"])


def call_model(client, prompt, greek, schema=None):
    kwargs = {}
    if schema is not None:
        kwargs["output_config"] = {"format": {"type": "json_schema", "schema": schema}}
    with client.messages.stream(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=SYSTEM,
        messages=[{"role": "user", "content": f"{prompt}\n\n{greek}"}],
        **kwargs,
    ) as stream:
        message = stream.get_final_message()
    if message.stop_reason == "refusal":
        raise RuntimeError("Model refused the request")
    text = next(b.text for b in message.content if b.type == "text")
    return text.strip()


def generate_card(client, card_path, overwrite=False):
    card = json.loads(card_path.read_text(encoding="utf-8"))
    if card.get("translations") and not overwrite:
        print(f"  {card_path.name}: cached, skipping")
        return

    greek = greek_block(card)
    n = len(card["lines"])
    drift = []
    translations = {}

    for mode, prompt in PER_LINE_PROMPTS.items():
        print(f"  {card_path.name}: {mode}...", flush=True)
        text = call_model(client, prompt.format(n=n), greek, schema=LINES_SCHEMA)
        lines = json.loads(text)["lines"]
        if len(lines) != n:
            drift.append({"mode": mode, "expected": n, "got": len(lines)})
            print(f"    DRIFT: {mode} returned {len(lines)} units, expected {n}")
        translations[mode] = lines

    for style in STYLES:
        print(f"  {card_path.name}: {style}...", flush=True)
        translations[style] = call_model(client, WHOLE_CARD_PROMPTS[style], greek)

    card["translations"] = translations
    card["meta"]["model"] = MODEL
    card["meta"]["generatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if drift:
        card["meta"]["drift"] = drift
    card_path.write_text(
        json.dumps(card, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  {card_path.name}: saved{' WITH DRIFT FLAGS' if drift else ''}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--book", type=int, required=True)
    ap.add_argument("--card", type=int, help="generate one card only")
    ap.add_argument("--overwrite", action="store_true",
                    help="regenerate even if cached (dev only)")
    args = ap.parse_args()

    book_dir = DATA_DIR / f"book-{args.book:02d}"
    if not book_dir.is_dir():
        sys.exit(f"No parsed data at {book_dir}; run parse_tei.py first.")

    if args.card:
        paths = [book_dir / f"card-{args.card:03d}.json"]
        if not paths[0].exists():
            sys.exit(f"{paths[0]} does not exist")
    else:
        paths = sorted(book_dir.glob("card-*.json"))

    client = anthropic.Anthropic()
    print(f"Generating translations for {len(paths)} card(s) with {MODEL}")
    for path in paths:
        generate_card(client, path, overwrite=args.overwrite)
    print("Done.")


if __name__ == "__main__":
    main()
