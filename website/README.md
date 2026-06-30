# Print Clean — landing website

Static landing site + legal pages for the Print Clean Chrome extension.
This folder is **not** part of the extension and is excluded from the
published Chrome zip (`scripts/build-zip.mjs` uses an explicit file allowlist).

## Files

- `index.html` — landing page
- `privacy.html` — Privacy Policy (link this URL in the Chrome Web Store listing)
- `terms.html` — Terms of Use
- `styles.css` — shared styles
- `icon128.png` — app icon (copied from the extension root)

## Local preview

```bash
cd website
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to Cloudflare Pages

Point a Pages project at this repo and set:

- **Build command:** _(none)_
- **Build output directory:** `website`

Cloudflare serves `index.html` at the root and the `.html` pages at their
paths (e.g. `/privacy.html`, `/terms.html`).
