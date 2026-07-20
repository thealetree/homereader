#!/usr/bin/env python3
"""Extract A. T. Murray's 1919 English translation (Perseus perseus-eng3 TEI)
and merge it into the card JSON files as a "murray" field.

Murray's prose is aligned to the Greek with <milestone unit="line" n="N"/>
markers every 5 lines, so each card gains a list of 5-line segments:

    "murray": [
      {"lines": [1, 4],  "text": "Tell me, O Muse, of the man of many devices..."},
      {"lines": [5, 9],  "text": "seeking to win his own life..."},
      ...
    ]

Footnotes (<note>) are excluded. Existing card contents (Greek text and any
generated translations) are preserved untouched.

Usage:
    python3 parse_murray.py --book 1
    python3 parse_murray.py --all
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

TEI_NS = "{http://www.tei-c.org/ns/1.0}"
PIPELINE_DIR = Path(__file__).resolve().parent
RAW_PATH = PIPELINE_DIR / "cache" / "raw" / "tlg0012.tlg002.perseus-eng3.xml"
DATA_DIR = PIPELINE_DIR.parent / "data" / "odyssey"

SKIP_TAGS = {"note", "head"}


def parse_segments(xml_path):
    """Return {book: {start_line: text}} from milestone-delimited prose."""
    tree = ET.parse(xml_path)
    books = {}
    for div in tree.iter(f"{TEI_NS}div"):
        if div.get("subtype") != "book":
            continue
        book_n = int(div.get("n"))
        parts = {}  # start line -> list of text fragments
        state = {"cur": 0}

        def walk(el):
            tag = el.tag.split("}")[-1]
            if tag in SKIP_TAGS:
                return
            if tag == "milestone" and el.get("unit") == "line":
                state["cur"] = int(el.get("n"))
            if el.text:
                parts.setdefault(state["cur"], []).append(el.text)
            for child in el:
                walk(child)
                if child.tail:
                    parts.setdefault(state["cur"], []).append(child.tail)

        walk(div)
        segments = {}
        for start, frags in parts.items():
            text = re.sub(r"\s+", " ", "".join(frags)).strip()
            if start > 0 and text:
                segments[start] = text
        books[book_n] = segments
    return books


def merge_book(book_n, segments):
    book_dir = DATA_DIR / f"book-{book_n:02d}"
    card_paths = sorted(book_dir.glob("card-*.json"))
    if not card_paths:
        sys.exit(f"No cards in {book_dir}; run parse_tei.py first.")

    starts = sorted(segments)
    # Each segment runs from its start line to the line before the next start.
    ends = {s: starts[i + 1] - 1 if i + 1 < len(starts) else 10_000
            for i, s in enumerate(starts)}

    total = 0
    for path in card_paths:
        card = json.loads(path.read_text(encoding="utf-8"))
        lo, hi = card["lineStart"], card["lineEnd"]
        card["murray"] = [
            {"lines": [s, min(ends[s], hi)], "text": segments[s]}
            for s in starts if lo <= s <= hi
        ]
        total += len(card["murray"])
        path.write_text(
            json.dumps(card, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Book {book_n}: merged {total} Murray segments into {len(card_paths)} cards")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--book", type=int)
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if not (args.book or args.all):
        ap.error("pass --book N or --all")
    if not RAW_PATH.exists():
        sys.exit(f"Missing {RAW_PATH}; download perseus-eng3 first.")

    books = parse_segments(RAW_PATH)
    targets = sorted(books) if args.all else [args.book]
    for book_n in targets:
        if (DATA_DIR / f"book-{book_n:02d}").is_dir():
            merge_book(book_n, books[book_n])


if __name__ == "__main__":
    main()
