# Homer Interlinear Reader

A static web app for reading Homer's Odyssey in the original Greek alongside
adjustable AI-generated translations. The feel aims for a Loeb Classical
Library edition, not a web app: a two-page spread with the Greek text and a
literal interlinear gloss on the left, and on the right a synthesized
translation controlled by a **fidelity slider** (Interlinear → Literal →
Natural → Free) and, at the Free stop, **flavor chips** (Homeric,
Shakespearean, Modernist, Lucretian, Storybook).

## How it works

- **Greek text**: Homer's Odyssey from the [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)
  (A. T. Murray's 1919 edition, public domain), parsed from TEI XML into
  20-line "cards" of JSON.
- **Translations**: generated once, offline, by `pipeline/generate_translations.py`
  using the Anthropic API (Claude Opus 4.8), then committed as static JSON.
  The deployed site is pure static HTML/CSS/JS — no backend, no API key, no
  build step.
- **Reader state** (book, card, slider position, flavor) lives in the URL
  hash (`#1.3.free.storybook`), so any position is shareable.

## Repository layout

```
site/       The reader app (HTML/CSS/vanilla JS)
pipeline/   TEI parser + translation generator (Python; API key required)
data/       Generated JSON — Greek text and cached translations
docs/       Project spec
```

## Local development

```bash
npx serve -l 8090 .        # from repo root
# open http://localhost:8090/site/
```

## Generating translations

Requires Python 3 and an Anthropic API key. Cached cards are never
regenerated, so re-running is safe and cheap.

```bash
cd pipeline
python3 -m venv .venv && .venv/bin/pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
.venv/bin/python parse_tei.py --fetch --book 1      # parse Greek into cards
.venv/bin/python generate_translations.py --book 1  # generate all modes
```

To add another book later: `parse_tei.py --book N` then
`generate_translations.py --book N`. The schema already accommodates the
Iliad and per-word alignment (v2) without breaking changes.

## Deployment

Pure static site — deploys to GitHub Pages from the repo root (the root
`index.html` redirects into `site/`). All paths are relative, so it is also
IPFS-friendly.

## Licensing

- **Code**: MIT (see LICENSE)
- **Greek text**: public domain, via the Perseus Digital Library
  (CC BY-SA metadata/markup; the underlying text is public domain)
- **Generated translations**: released under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — public
  domain dedication, no attribution required
