# Print Clean — Chrome extension

Print clean pages from cluttered websites. Click the toolbar icon to open an
**interactive print preview** right on the page: see exactly what will print,
click anything to remove it, then print — no more guess-and-reprint cycles, and
no CSS knowledge required.

## How it works

Clicking the toolbar icon injects an on-page preview overlay that:

1. **Applies the site's saved rules to the live page**, so what you see is what
   prints.
2. **Lets you curate the page in two ways** (hover highlights the target):
   - **Remove** — click anything to drop it from the printout.
   - **Keep only** — click one section to keep _just_ that (and what's inside
     it); everything else is dropped. Ideal for "print only the email body."

   Each click becomes a durable CSS selector, and you can restore anything from
   the toolbar.
3. **Remembers your choices** per domain via `chrome.storage.sync`, so the next
   visit — and the quick context-menu print — start clean.

A small toolbar (Remove / Keep only · Undo · Reset · Print · Done) floats at the
bottom; it lives in its own Shadow DOM so the host page's styles can't break it,
and it never appears in the printout.

### What you see is what prints

A browser normally swaps to its **print** stylesheet when it actually prints, so
a site's own `@media print` rules can make the paper look nothing like the
screen. Print Clean avoids that: when you hit **Print**, it snapshots the visible,
curated content with its on-screen styles (including backgrounds) into an
isolated document and prints _that_ — so the printout matches the preview.

For sites with bespoke needs there are also **special handlers** (e.g. Gmail at
`mail.google.com`, which keeps just the email body) used by the instant
context-menu print.

## Triggering Print Clean

- **Click the toolbar icon** → opens the interactive preview, or
- Keyboard shortcut **Ctrl+Shift+P** (**⌘+Shift+P** on macOS) → opens the
  preview, or
- Right-click the page → **Clean up and print** → instant print using saved
  rules, no preview.

## Editing rules manually (advanced)

Most people never need this — clicking elements in the preview is enough. For
fine control, open the **options page** (the gear in the preview toolbar,
right-click the icon → _Options_) to add/edit/delete per-domain selectors or
reset built-in domains to their defaults. Settings sync via
`chrome.storage.sync`.

## Project layout

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `manifest.json`        | MV3 manifest (action, options, background, command)          |
| `background.js`        | Service worker: default-settings merge, icon/shortcut, menu  |
| `printPreview.js`      | Injected interactive preview overlay (click-to-hide + print) |
| `printClean.js`        | Injected instant cleanup + print (context menu, data-driven) |
| `settings.{html,js}`   | Options page (advanced manual rule editing)                  |
| `shared.js`            | Pure helpers shared by the extension and tests               |
| `defaultSettings.json` | Bundled default selector rules                               |

## Development

```bash
npm install        # dev tooling (eslint, prettier)
npm run dev        # launch Chrome with the extension pre-loaded (throwaway profile)
npm test           # run unit tests (node --test)
npm run lint       # lint
npm run format     # format with prettier
npm run zip        # build a publishable zip in dist/
```

`npm run dev` launches **Chrome for Testing** with Print Clean already loaded —
no manual `chrome://extensions` steps. (Regular Chrome 137+ ignores the
`--load-extension` flag, so the script uses Google's automation build, which is
downloaded once into `.cache/` on first run.) Pass a URL to open it directly,
e.g. `npm run dev -- https://mail.google.com`.

### Load the unpacked extension (manual alternative)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.

## Adding a new site

- **Simple cases**: add the domain and selectors on the options page (or to
  `defaultSettings.json` to ship them as defaults).
- **Complex cases** (structural DOM surgery like Gmail): add a handler to the
  `specialHandlers` map in `printClean.js`, keyed by hostname.
