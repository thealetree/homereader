#!/usr/bin/env python3
"""Record in manifest.json how many cards of each book have line-by-line cribs.

The reader only exposes authored cards, so a reader never lands on a page whose
English is Murray's 5-line prose blocks instead of a line-by-line crib. Counts
the leading run of authored cards so navigation can never fall into a gap.

Run after every authoring batch:
    python3 index_authored.py
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "odyssey"


def authored_run(book_dir, card_count):
    """Number of consecutive cards from card 1 that have both cribs."""
    run = 0
    for i in range(1, card_count + 1):
        path = book_dir / f"card-{i:03d}.json"
        if not path.exists():
            break
        translations = json.loads(path.read_text(encoding="utf-8")).get("translations") or {}
        if translations.get("interlinear") and translations.get("literal"):
            run += 1
        else:
            break
    return run


def main():
    manifest_path = DATA_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    total = 0
    for book_str, info in manifest["books"].items():
        book_dir = DATA_DIR / f"book-{int(book_str):02d}"
        info["authored"] = authored_run(book_dir, info["cards"])
        total += info["authored"]
        if info["authored"]:
            print(f"book {int(book_str):>2}: {info['authored']}/{info['cards']} cards authored")

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{total} authored cards total; manifest updated")


if __name__ == "__main__":
    main()
