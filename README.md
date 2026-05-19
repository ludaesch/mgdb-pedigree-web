# MGDB Pedigree Web App

Lightweight TypeScript + Vite frontend for the
[MGDB academic pedigree explorer](https://github.com/ludaesch/MGDB).
See the [project spec (SPEC.org)](https://github.com/ludaesch/MGDB/blob/main/SPEC.org)
§7 for the design rationale.

Currently deployed for Lan Li (PhD 2026, UIUC) — but the code is agnostic about
the focal student; swap `public/spec.json` + `public/pedigree.svg` and you get a
pedigree for anyone.

Live: <https://ludaesch.github.io/mgdb-pedigree-web/>

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/
```

## Build

```bash
npm run build    # → dist/
npm run preview  # serve dist/ at http://localhost:4173/
```

The `base` path in `vite.config.ts` is set to `/mgdb-pedigree-web/` for
production builds (matches the GitHub Pages URL) and `/` for `dev`. The fetch
URLs in `src/main.ts` use `import.meta.env.BASE_URL` so this works in both.

## Data inputs

Two files in `public/`:

- `spec.json` — a `RenderSpec` exported by the Python backend
  (`mgdb primary --json build/<focal>.json`).
- `pedigree.svg` — Graphviz SVG produced from the same view
  (`mgdb render build/<focal>.dot`).

To regenerate for a different focal student (e.g. Daniel Zinn):

```bash
cd ~/Dropbox/Projects/MGDB
make zinn-primary   # produces build/zinn-primary.{json,svg}
cp build/zinn-primary.json ~/Dropbox/Projects/mgdb-pedigree-web/public/spec.json
cp build/zinn-primary.svg  ~/Dropbox/Projects/mgdb-pedigree-web/public/pedigree.svg
cd ~/Dropbox/Projects/mgdb-pedigree-web
git add public/ && git commit -m "Switch focal student to Zinn" && git push
```

The push triggers GitHub Actions, which rebuilds and redeploys in ~60s.

## Deployment

Every push to `main` is built and deployed automatically by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
The workflow:

1. Checks out the repo.
2. Installs Node 20 + dependencies (`npm ci`).
3. Type-checks with `tsc --noEmit`.
4. Builds with `vite build` (output in `dist/`).
5. Uploads `dist/` as a GitHub Pages artifact.
6. Deploys it.

To set up Pages on a fresh fork: Settings → Pages → Source → "GitHub Actions".

## Layout

```
src/
  main.ts        # entry: load assets, wire handlers, init pan/zoom
  types.ts       # mirrors tool/mgdb/spec.py
  svgIndex.ts    # map (svg "nodeN" id ↔ DOT name like "n63244")
  graph.ts       # adjacency, ancestors, path-on-DAG
  highlight.ts   # selection-driven highlight state machine
  selection.ts   # side-panel UI rendering
  search.ts      # name + role-keyword search
  links.ts       # primary-link priority + fallback search URL
  vite-env.d.ts  # Vite client types
styles/
  screen.css
public/
  spec.json      # RenderSpec for the current focal student
  pedigree.svg   # Graphviz SVG for the current focal student
.github/workflows/
  deploy.yml     # build + GH Pages deploy
```

## Keyboard / mouse

| Gesture                | Action                              |
|------------------------|-------------------------------------|
| Click node             | Select; show side panel             |
| Double-click node      | Open primary external link          |
| Cmd/Ctrl-click node    | Open primary external link          |
| Tab + Enter / Space    | Keyboard select                     |
| Drag background        | Pan                                 |
| Scroll / pinch         | Zoom                                |
| Esc                    | Clear selection + highlights        |

## Stack

Deliberately minimal:

- **Vite** — dev server + bundler
- **TypeScript** — strict mode
- **svg-pan-zoom** — pan/zoom over inline SVG
- **No framework** (no React, no Vue, no Cytoscape)

The pedigree has ~50–200 visible nodes per view; Graphviz already produced the
layout server-side, so the browser just needs DOM event handling on the inline
SVG.

## License

MIT.
