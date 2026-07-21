#!/usr/bin/env python3
"""Author a personal translation style, one book at a time, as plain Markdown.

Two modes:

  --scaffold   Build authoring/book-NN.<style>.md from the card JSON: one
               section per card, each showing the Greek lines and the literal
               crib for reference, with a placeholder for you to replace.

  --merge      Read a filled-in manuscript back and fold each card's text into
               that card's translations.<style> field. Cards whose placeholder
               is untouched (or empty) are left alone, so merging a
               half-finished draft is safe and repeatable.

The deployed reader never runs this. Stdlib only; no API, no network.

    python3 author_style.py --scaffold --book 1
    # ...write your translation in authoring/book-01.vansanders.md...
    python3 author_style.py --merge --book 1

Style defaults to 'vansanders' (button label "Van Sanders"). Pass --style /
--label to author a differently-named voice.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "odyssey"
AUTHORING_DIR = ROOT / "authoring"

# Sentinel that separates the read-only reference block from your text. You
# write below it; everything above it (Greek + crib) is ignored on merge.
MARKER = ">>> YOUR TRANSLATION BELOW — replace the placeholder line"
PLACEHOLDER = "[ card {card}: write your translation of lines {a}-{b} here ]"

CARD_HEADER_RE = re.compile(r"^#{2,3}\s+CARD\s+(\d+)\b", re.IGNORECASE)


def reflow(text):
    """Flow prose the way the reader wants it: a blank line starts a new
    paragraph; soft line-wraps inside a paragraph are joined with a space.

    The reader renders any block that still contains newlines as verse (each
    line hangs), so a hard-wrapped prose paragraph would come out looking like
    verse. Joining soft-wraps here stores one line per paragraph, matching the
    Modernist/Storybook convention, and prose flows correctly. To write actual
    verse, keep each card a single paragraph and hand it in pre-lineated — say
    so and it's stored with its line breaks intact.
    """
    paragraphs = re.split(r"\n[ \t]*\n", text.strip())
    flowed = [" ".join(part.split()) for part in paragraphs]
    return "\n\n".join(p for p in flowed if p)


def card_paths(book):
    book_dir = DATA_DIR / f"book-{book:02d}"
    if not book_dir.exists():
        sys.exit(f"no such book directory: {book_dir}")
    return sorted(book_dir.glob("card-*.json"))


def load_card(path):
    return json.loads(path.read_text(encoding="utf-8"))


def manuscript_path(book, style):
    return AUTHORING_DIR / f"book-{book:02d}.{style}.md"


# ---------- scaffold ----------

def scaffold(book, style, label):
    paths = card_paths(book)
    if not paths:
        sys.exit(f"book {book} has no card files yet")

    out = manuscript_path(book, style)
    if out.exists():
        sys.exit(
            f"{out} already exists — refusing to overwrite your work.\n"
            f"Delete it yourself if you really want a fresh scaffold."
        )

    lines = [
        f"# {label} — Odyssey, Book {book}",
        "",
        "How to use this file:",
        "",
        f"- Write your translation for each card in the space under the "
        f'"{MARKER}" line.',
        "- Replace the placeholder line entirely. Leave a card's placeholder "
        "untouched and it stays unwritten (safe to merge a partial draft).",
        "- Write in paragraphs. Separate them with a BLANK line. Wrap lines "
        "however you like inside a paragraph — soft wraps are joined back into "
        "flowing prose on merge, so hard-wrapping in your editor is fine.",
        "- Want actual verse instead? Say so when you hand the file back and "
        "your line breaks are kept exactly as written.",
        "- The Greek and literal crib above each marker are reference only and "
        "are ignored on merge — edit or delete them freely.",
        "",
        "When you're done (or want to preview a partial draft), hand this file "
        "back and it gets merged into the cards.",
        "",
        "---",
        "",
    ]

    for path in paths:
        card = load_card(path)
        n = card["card"]
        a, b = card["lineStart"], card["lineEnd"]
        lines.append(f"## CARD {n} — lines {a}-{b}")
        lines.append("")
        lines.append("Greek:")
        lines.append("")
        for ln in card["lines"]:
            lines.append(f"    {ln['n']:>3}  {ln['greek']}")
        lines.append("")
        crib = (card.get("translations") or {}).get("literal")
        if crib:
            lines.append("Literal crib (reference):")
            lines.append("")
            for text in crib:
                lines.append(f"    {text}")
            lines.append("")
        lines.append(MARKER)
        lines.append("")
        lines.append(PLACEHOLDER.format(card=n, a=a, b=b))
        lines.append("")

    AUTHORING_DIR.mkdir(exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(paths)} cards)")
    print(f"Now write in it, then: python3 author_style.py --merge --book {book} --style {style}")


# ---------- merge ----------

def parse_manuscript(text):
    """Return {card_number: authored_text} for every card that has real text."""
    result = {}
    current = None
    body = []
    capturing = False

    def flush():
        if current is None:
            return
        joined = "\n".join(body).strip()
        # Drop an untouched placeholder (matches "[ card N: ... ]").
        if not joined or re.fullmatch(r"\[ card \d+:.*?\]", joined, re.DOTALL):
            return
        result[current] = reflow(joined)

    for line in text.splitlines():
        header = CARD_HEADER_RE.match(line)
        if header:
            flush()
            current = int(header.group(1))
            body = []
            capturing = False
            continue
        if current is None:
            continue
        if not capturing:
            if line.strip() == MARKER:
                capturing = True
            continue
        body.append(line)

    flush()
    return result


def merge(book, style):
    src = manuscript_path(book, style)
    if not src.exists():
        sys.exit(f"no manuscript at {src} — run --scaffold first")

    authored = parse_manuscript(src.read_text(encoding="utf-8"))
    if not authored:
        sys.exit(f"{src} has no written cards yet (all placeholders untouched)")

    paths = {load_card(p)["card"]: p for p in card_paths(book)}
    written = 0
    for card_n, prose in sorted(authored.items()):
        path = paths.get(card_n)
        if path is None:
            print(f"  ! card {card_n} in manuscript has no matching JSON — skipped")
            continue
        card = load_card(path)
        card.setdefault("translations", {})[style] = prose
        path.write_text(
            json.dumps(card, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        written += 1
        print(f"  card {card_n:>3}: {len(prose)} chars -> translations.{style}")

    unwritten = sorted(set(paths) - set(authored))
    print(f"\nmerged {written} cards into book {book} under '{style}'")
    if unwritten:
        print(f"still blank: {', '.join(str(n) for n in unwritten)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--scaffold", action="store_true", help="write the manuscript file")
    mode.add_argument("--merge", action="store_true", help="fold a filled manuscript into the cards")
    ap.add_argument("--book", type=int, required=True)
    ap.add_argument("--style", default="vansanders", help="translations key / URL slug")
    ap.add_argument("--label", default="Van Sanders", help="heading label for the scaffold")
    args = ap.parse_args()

    if args.scaffold:
        scaffold(args.book, args.style, args.label)
    else:
        merge(args.book, args.style)


if __name__ == "__main__":
    main()
