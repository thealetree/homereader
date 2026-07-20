#!/usr/bin/env python3
"""Parse Perseus canonical-greekLit TEI XML into card-chunked JSON.

Reads the Odyssey TEI file (tlg0012.tlg002.perseus-grc2) and writes one JSON
file per 20-line card to data/odyssey/book-NN/card-NNN.json, plus a manifest
at data/odyssey/manifest.json.

Card schema (translations filled in later by generate_translations.py; each
line object can grow a "words" array in v2 without breaking changes):

    {
      "book": 1,
      "card": 1,
      "lineStart": 1,
      "lineEnd": 20,
      "lines": [{"n": 1, "greek": "..."}, ...],
      "translations": null,
      "meta": {"source": "urn:cts:greekLit:tlg0012.tlg002.perseus-grc2"}
    }

Usage:
    python3 parse_tei.py --preview 1.1-1.10     # print records, write nothing
    python3 parse_tei.py --book 1               # write cards for book 1
    python3 parse_tei.py --all                  # write cards for all 24 books
    python3 parse_tei.py --fetch                # (re)download the TEI source
"""

import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

TEI_NS = "{http://www.tei-c.org/ns/1.0}"
SOURCE_URN = "urn:cts:greekLit:tlg0012.tlg002.perseus-grc2"
SOURCE_URL = (
    "https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/"
    "data/tlg0012/tlg002/tlg0012.tlg002.perseus-grc2.xml"
)
CARD_SIZE = 20

PIPELINE_DIR = Path(__file__).resolve().parent
RAW_PATH = PIPELINE_DIR / "cache" / "raw" / "tlg0012.tlg002.perseus-grc2.xml"
DATA_DIR = PIPELINE_DIR.parent / "data" / "odyssey"


def fetch_source():
    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Fetching {SOURCE_URL}")
    urllib.request.urlretrieve(SOURCE_URL, RAW_PATH)
    print(f"Saved to {RAW_PATH} ({RAW_PATH.stat().st_size:,} bytes)")


def parse_books(xml_path):
    """Return {book_number: [{"n": line_number, "greek": text}, ...]}."""
    tree = ET.parse(xml_path)
    books = {}
    for div in tree.iter(f"{TEI_NS}div"):
        if div.get("subtype") != "book":
            continue
        book_n = int(div.get("n"))
        lines = []
        for l in div.iter(f"{TEI_NS}l"):
            text = re.sub(r"\s+", " ", "".join(l.itertext())).strip()
            if not text:
                raise ValueError(f"Empty line at book {book_n}, l n={l.get('n')}")
            lines.append({"n": int(l.get("n")), "greek": text})
        books[book_n] = lines
    return books


def chunk_cards(lines):
    return [lines[i:i + CARD_SIZE] for i in range(0, len(lines), CARD_SIZE)]


def write_book(book_n, lines):
    book_dir = DATA_DIR / f"book-{book_n:02d}"
    book_dir.mkdir(parents=True, exist_ok=True)
    cards = chunk_cards(lines)
    for i, card_lines in enumerate(cards, start=1):
        card = {
            "book": book_n,
            "card": i,
            "lineStart": card_lines[0]["n"],
            "lineEnd": card_lines[-1]["n"],
            "lines": card_lines,
            "translations": None,
            "meta": {"source": SOURCE_URN},
        }
        path = book_dir / f"card-{i:03d}.json"
        # Never clobber a card that already has generated translations.
        if path.exists():
            existing = json.loads(path.read_text(encoding="utf-8"))
            if existing.get("translations"):
                if existing["lines"] != card_lines:
                    print(f"  WARNING: {path.name} has translations but Greek "
                          "differs from source — left untouched, review manually.")
                continue
        path.write_text(
            json.dumps(card, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Book {book_n}: {len(lines)} lines -> {len(cards)} cards in {book_dir}")
    return len(cards)


def update_manifest(books_written):
    manifest_path = DATA_DIR / "manifest.json"
    manifest = {"work": "odyssey", "cardSize": CARD_SIZE, "books": {}}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for book_n, (line_count, card_count) in books_written.items():
        manifest["books"][str(book_n)] = {
            "lines": line_count,
            "cards": card_count,
        }
    manifest["books"] = dict(sorted(manifest["books"].items(), key=lambda kv: int(kv[0])))
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest updated: {manifest_path}")


def preview(books, spec):
    m = re.fullmatch(r"(\d+)\.(\d+)-(?:(\d+)\.)?(\d+)", spec)
    if not m:
        sys.exit(f"Bad --preview spec {spec!r}; expected e.g. 1.1-1.10")
    book_n, start, end = int(m.group(1)), int(m.group(2)), int(m.group(4))
    records = [
        {"book": book_n, "line": l["n"], "greek": l["greek"]}
        for l in books[book_n]
        if start <= l["n"] <= end
    ]
    print(json.dumps(records, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fetch", action="store_true", help="download the TEI source")
    ap.add_argument("--book", type=int, help="write cards for one book")
    ap.add_argument("--all", action="store_true", help="write cards for all books")
    ap.add_argument("--preview", metavar="B.L-B.L", help="print records, write nothing")
    args = ap.parse_args()

    if args.fetch:
        fetch_source()
    if not (args.book or args.all or args.preview):
        return
    if not RAW_PATH.exists():
        sys.exit(f"Source not found at {RAW_PATH}; run with --fetch first.")

    books = parse_books(RAW_PATH)
    total = sum(len(v) for v in books.values())
    print(f"Parsed {len(books)} books, {total} lines total", file=sys.stderr)

    if args.preview:
        preview(books, args.preview)
        return

    targets = sorted(books) if args.all else [args.book]
    written = {}
    for book_n in targets:
        if book_n not in books:
            sys.exit(f"No book {book_n} in source (have 1-{max(books)})")
        card_count = write_book(book_n, books[book_n])
        written[book_n] = (len(books[book_n]), card_count)
    update_manifest(written)


if __name__ == "__main__":
    main()
