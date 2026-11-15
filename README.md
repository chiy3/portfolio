# Eric Chi — portfolio

Staff UX Designer at Walmart. Live at https://eric-chi.com

Plain HTML and CSS with no build step. GitHub Pages serves the files as they are.

## Structure

```
index.html              Home: intro, selected work, about, contact
work/*.html             One page per case study
assets/css/site.css     All styles (colors and type scale are at the top)
assets/img/             Headshot, favicon, and case-study images (work/)
404.html                Shown for broken links
legacy/                 The previous (2020–2023) site, kept for reference
```

## Adding case-study images

Each case study has grey image slots. To fill one:

1. Export the image from Figma (SVG, or PNG/WebP at 2x, about 2400px wide).
2. Save it as `assets/img/work/<name>.svg` (each slot's HTML comment gives the exact name).
3. In the case-study page, replace the `<div class="slot">…</div>` with the `<img>` line from the comment above it.

## Editing

- Home copy and the work list: `index.html`. Each project row has a title, one line, and a headline figure.
- Case-study text: `work/<project>.html`. Sections are Overview, Challenge, Solution, Impact.
- Colors and fonts: the `:root` block at the top of `assets/css/site.css`.
- The map tour: the town is a live 3D scene built with three.js (`assets/js/town3d.js`, engine bundled in `assets/vendor/three/`). Camera stops, Eric's avatar, traffic and lighting live there. The storefront, aisle and service desk are inline SVG illustrations; `TOUR_KEYS` in the page head lists the keyframes, including the card-less walk-in. Devices without WebGL see `assets/img/town.png`.
- The page generator lives outside this repo; edit the HTML directly.

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publishing

Settings → Pages → Source: "Deploy from a branch", branch `master`, folder `/ (root)`. Custom domain: eric-chi.com (set by the `CNAME` file; DNS is at Porkbun).
