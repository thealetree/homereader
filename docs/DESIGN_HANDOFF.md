# Design Handoff — Orientation

Everything a designer needs to know about where things are and what the
constraints are. (The design brief itself is separate.)

## What this is

A static web reader for Homer's *Odyssey*: the Greek text with a line-by-line
English crib on the left page, and a stylized literary translation on the right
page — a two-page spread meant to feel like a Loeb Classical Library edition,
not a web app.

- **Repo**: https://github.com/thealetree/homereader
- **Live**: https://thealetree.github.io/homereader/
- **Local**: `npx serve -l 8090 .` from the repo root, then open
  `http://localhost:8090/site/`

## Hard constraints

- **Pure static. No build step, no framework, no npm, no bundler.** Plain HTML,
  one CSS file, one vanilla-JS file. Please keep it that way.
- **No external requests.** Deploys to GitHub Pages and must stay IPFS-friendly:
  relative paths only, no CDNs. Any fonts must be self-hosted in `site/fonts/`.
- **No sans-serif anywhere**, including UI controls. Controls are typographic
  (small caps, hairline rules) rather than material-design widgets.
- Content is fetched client-side from static JSON. Don't change the JSON shape.

## File map

```
site/index.html      The entire markup. All components listed below live here.
site/css/main.css    The entire design system + all component styles.
site/js/app.js       App controller: routing, data loading, rendering, controls.
site/fonts/          Empty — intended home for self-hosted WOFF2 files.
data/odyssey/        manifest.json + book-NN/card-NNN.json (616 cards).
docs/STYLE.md        Translation style guide (content rules, not visual design).
pipeline/            Python parsers/generators. Not part of the site.
```

## Current design system (`site/css/main.css`)

All colors and shared control values are CSS custom properties in `:root`.
Retuning the whole site should mostly mean editing these:

| Token | Role |
|---|---|
| `--paper` | page background |
| `--ink` | primary text |
| `--ink-faint` | secondary text (cribs, labels, inactive controls) |
| `--rule` | hairlines and borders |
| `--greek-font` | Greek type stack |
| `--english-font` | English type stack |
| `--transition` | shared transition timing |
| `--menu-bg`, `--menu-shadow` | book dropdown surface |
| `--hover-wash` | hover background tint |
| `--edge-arrow-size` | page-turn arrow scale |

**Dark mode** is a second token block under `:root[data-theme="dark"]` — the
same warm neutrals inverted, nothing cold or blue. The theme is resolved before
first paint by an inline script in `index.html` (saved choice wins, else system
preference) and persisted in `localStorage`. Both modes must be styled.

**Typography intent, not yet realized**: the font stacks name **GFS Porson**
(Greek, must render polytonic correctly) and **EB Garamond** (English), but
neither is actually loaded yet — the site currently falls back to Times/Georgia.
Self-hosting these two (both OFL-licensed) in `site/fonts/` is an open task and
probably the single highest-impact visual change.

## Component inventory

Every component, its class hook, and where it sits.

| Component | Hook | Location / behavior |
|---|---|---|
| Masthead title | `.masthead h1` | Centered top, letterspaced caps |
| Book selector | `.book-select`, `.book-current`, `.book-menu`, `.book-option` | The italic "Book I" under the title is a click-to-open custom menu listing Books I–XXIV. Deliberately looks like plain text until hovered. Not a native `<select>` |
| Theme toggle | `.theme-toggle`, `.theme-icon`, `.theme-icon-moon`, `.theme-icon-sun` | Fixed top-right. Minimal inline-SVG moon/sun; shows the theme you'd switch *to*. Icon swap is pure CSS off `data-theme` |
| Two-page spread | `.spread`, `.page`, `.page-greek`, `.page-english`, `.gutter` | Flex row on desktop with a hairline gutter |
| Greek line + crib | `.line`, `.line-no`, `.line-greek`, `.line-gloss` | Each Greek line with its English crib directly beneath in italic. Line numbers every 5 lines, hanging left |
| Murray fallback | `.line-gloss-prose` | For cards without authored per-line cribs, Murray's 1919 prose renders in 5-line blocks instead |
| Crib toggle | `.crib-controls`, `.crib-label` | Top of the left page: Interlinear / Literal. Hidden on cards lacking per-line cribs |
| Style buttons | `.controls`, `.style-buttons`, `.style-btn` | Top of the right page: Elizabethan / Modernist / Storybook |
| Mobile pane toggle | `.pane-toggle`, `.pane-btn` | **Mobile only** (≤720px). Source / Stylized picks which single page shows, driven by `<html data-pane>`. Hidden on desktop |
| Page-turn arrows | `.edge-arrow`, `.edge-arrow-prev`, `.edge-arrow-next` | Fixed at left/right window edges, vertically centered. Currently plain `‹ ›` guillemets — **explicitly open to redesign** |
| Position counter | `.pager`, `.pager-label` | Bottom center, e.g. "3 / 23" |
| Attribution | `.col-attribution` | Foot of the left column; Perseus/Murray credit. Must remain present |
| Placeholder | `.placeholder` | Shown where a translation hasn't been authored yet |

## Content state (so nothing looks "broken")

Only **Book I, cards 1–5** have authored translations. Every other card
intentionally shows Murray's 1919 prose crib on the left and a "not written yet"
placeholder on the right. That is expected, not a bug. Good cards to design
against: `#1.1`, `#1.3`, `#1.5`.

## Behavior that must keep working

- **URL hash routing**: `#<book>.<card>.<style>` (e.g. `#1.3.storybook`) — the
  reader reads and writes this; links must stay shareable.
- **`<html>` attributes** `data-theme` and `data-pane` drive theming and the
  mobile pane. CSS may restyle them but must keep reading them.
- **Navigation**: edge arrows, Left/Right arrow keys, and touch swipe all turn
  pages; Escape closes the book menu.
- **Crib alignment**: each English crib line must stay visually bound to the
  Greek line above it — that pairing is the core of the reader.
- `localStorage` keys in use: `homer-theme`, `homer-crib`, `homer-pane`.

## Verifying

Open `http://localhost:8090/site/`, then check: desktop and ≤720px mobile, light
and dark themes, a card with translations (`#1.3`) and one without (`#2.1`), and
the book menu open. No console errors, and the page body must never scroll
horizontally.
