# Claude Code Prompt: Homer Interlinear Reader

Copy everything below the line into Claude Code as your kickoff prompt.

---

## Project: Homer Interlinear Reader

Build a static web app for reading Homer's Odyssey in original Greek alongside adjustable AI-generated translations. The app will be open-sourced and publicly released. Prioritize beauty, minimalism, and typographic quality — the feel should be a Loeb Classical Library edition, not a web app.

### Core layout (two-page spread)

- **Left page:** Original Greek text, line-numbered, with a literal line-level translation rendered in smaller italic type directly beneath each Greek line (interlinear format).
- **Right page:** A synthesized translation of the same passage, controlled by a fidelity slider and flavor chips (see below).
- Both pages scroll/paginate together in synced "cards" of ~20 lines. Page navigation via arrow keys, on-screen arrows, and swipe on touch devices.
- Responsive: side-by-side spread on desktop; stacked (Greek above, translation below) on mobile.

### Fidelity slider (right page)

A single horizontal slider with four discrete, labeled stops:

1. **Interlinear** — mirrors the left page's literal gloss (word-order faithful, raw)
2. **Literal** — grammatical English, Greek structure preserved where possible
3. **Natural** — fluent modern English verse, faithful in content
4. **Free** — fluid literary prose/verse, prioritizing readability

### Flavor chips (unlock only at the "Free" stop)

Mutually exclusive toggle chips, visible but disabled at other slider stops:

- **Homeric** (default) — epic register, modern English
- **Shakespearean** — Elizabethan blank verse
- **Modernist** — spare, declarative 20th-century prose (Hemingway-esque simplicity)
- **Lucretian** — didactic philosophical hexameter in the spirit of De Rerum Natura
- **Storybook** — children's-book cadence and vocabulary, but retaining ALL graphic/violent content unchanged (this contrast is intentional satire)

No blending of flavors. One active at a time.

### Data pipeline

1. **Greek source:** Fetch the Odyssey Greek text from the PerseusDL `canonical-greekLit` GitHub repo (TEI XML, public domain). Write a parser (Python or Node) that converts it to clean JSON: `{book, line, greek}` records, chunked into 20-line cards. Preserve line numbers exactly.
2. **Translations:** A batch generation script that calls the Anthropic API (claude-sonnet-4-6) to produce, per card: the interlinear gloss, plus each fidelity level, plus each flavor at the Free level. Cache all output as static JSON files (`/data/odyssey/book-01/card-001.json` etc.). Never regenerate a cached card.
3. **Lazy corpus growth:** Pre-generate ONLY Odyssey Book 1 in all modes for launch. Structure the pipeline so additional books can be generated with a single command later.
4. Include a validation step: every generated card must contain the same number of translated lines/units as Greek lines (interlinear and literal levels), and the script should flag any card where the model's output drifted.

### Typography & design (non-negotiable)

- Greek set in **GFS Porson** (fallback GFS Didot) — must render polytonic Greek correctly.
- English in **EB Garamond**. NO sans-serif anywhere, including UI controls.
- Cream/off-white background, near-black text, generous margins, no visual chrome. Controls should be typographically styled (small caps, hairline rules) rather than material-design widgets.
- Interlinear gloss in a smaller italic size, visually subordinate to the Greek.
- Subtle, fast transitions only. No page-turn animations in v1.

### Architecture

- Pure static site: HTML/CSS/vanilla JS or a lightweight framework — no backend, no accounts, no database. All translation data is pre-cached JSON fetched client-side.
- Must deploy cleanly to GitHub Pages (and be IPFS-friendly: relative paths, no server-side routing).
- Keep the generation pipeline (API key required) fully separate from the deployed reader (no API key ever shipped).
- Reader state (current book/card, slider position, active flavor) persisted in the URL hash so positions are shareable/bookmarkable.

### Explicitly OUT of scope for v1

- Word-under-word interlinear alignment (v2 will use the Perseus Ancient Greek Treebank for tap-a-word glosses — structure the JSON schema so a `words` array can be added per line later without breaking changes)
- Blended/custom flavors
- The Iliad (schema should accommodate it; don't generate it)
- User accounts, annotations, audio

### Deliverables

1. `/pipeline/` — TEI parser + batch translation generator with README
2. `/site/` — the static reader app
3. `/data/` — generated JSON for Odyssey Book 1, all modes
4. Root README covering: project purpose, licensing (Greek text public domain via Perseus; generated translations released under CC0 or CC-BY — ask me to confirm), local dev, deployment, and how to generate additional books
5. A LICENSE file (MIT for code — confirm with me)

Start by scaffolding the repo structure and writing the TEI parser. Show me the parsed JSON for Odyssey 1.1–1.10 before building anything else, so we can verify the Greek text is clean.
