// Print Clean — interactive on-page preview.
//
// Injected into the active tab when the user clicks the toolbar icon (or hits
// the keyboard shortcut). It applies the site's saved hide-rules to the LIVE
// page so "what you see is what prints", then lets the user click elements to
// remove or restore them — no CSS knowledge required. Choices are saved per
// host into the same `siteSelectors` storage the instant-print path uses.
(function () {
  const HOST_ID = '__print_clean_preview__';

  // Toggle off if it's already open.
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.__printClean.exit();
    return;
  }

  const host = location.hostname.replace(/^www\./, '');

  // ---- selector generation ------------------------------------------------

  // Classes that look auto-generated (hashes, CSS-modules, utility soup) make
  // brittle selectors, so we skip them when building a path.
  function isStableClass(cls) {
    if (!cls || cls.length > 40) return false;
    if (/[^a-zA-Z0-9_-]/.test(cls)) return false;
    if (/(^|[-_])[a-f0-9]{6,}$/i.test(cls)) return false; // trailing hash
    if (/\d{4,}/.test(cls)) return false; // long digit runs
    return true;
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  // Build a reasonably short, durable selector that matches exactly `el`.
  function selectorFor(el) {
    if (el.id && isUnique('#' + CSS.escape(el.id))) {
      return '#' + CSS.escape(el.id);
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      let part = node.tagName.toLowerCase();

      const classes = Array.from(node.classList).filter(isStableClass);
      if (classes.length) part += '.' + classes.map(CSS.escape).join('.');

      const siblings = node.parentElement
        ? Array.from(node.parentElement.children).filter(
            (c) => c.tagName === node.tagName
          )
        : [];
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }

      parts.unshift(part);
      const candidate = parts.join(' > ');
      if (isUnique(candidate)) return candidate;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  // ---- state --------------------------------------------------------------

  // `selectors` are hidden ("Remove" mode); `keepSelectors` isolate the page
  // to only their subtrees ("Keep only" mode); `highlightSelectors` mark
  // elements so they stand out in the printout. The undo stack records all.
  const selectors = new Set();
  const keepSelectors = new Set();
  const highlightSelectors = new Set();
  const undoStack = [];
  let mode = 'remove';

  // Per-domain layout options, persisted in siteOptions[host].
  const DEFAULT_OPTIONS = {
    hideImages: false,
    textScale: 1,
    pageSize: 'A4',
    margins: 'normal',
  };
  let options = { ...DEFAULT_OPTIONS };

  function optionsAreDefault(o) {
    return (
      !o.hideImages &&
      o.textScale === 1 &&
      o.pageSize === 'A4' &&
      o.margins === 'normal'
    );
  }

  function isolateCss(list) {
    const items = list.filter(Boolean);
    if (!items.length) return '';
    const grp = items.join(', ');
    return `body *:not(:is(${grp})):not(:is(${grp}) *):not(:has(:is(${grp}))){display:none!important}`;
  }

  function persist() {
    chrome.storage.sync.get(
      ['siteSelectors', 'siteKeep', 'siteHighlight', 'siteOptions'],
      (data) => {
        const hide = data.siteSelectors || {};
        const keep = data.siteKeep || {};
        const high = data.siteHighlight || {};
        const opts = data.siteOptions || {};
        const hl = Array.from(selectors);
        const kl = Array.from(keepSelectors);
        const gl = Array.from(highlightSelectors);
        if (hl.length) hide[host] = hl;
        else delete hide[host];
        if (kl.length) keep[host] = kl;
        else delete keep[host];
        if (gl.length) high[host] = gl;
        else delete high[host];
        if (optionsAreDefault(options)) delete opts[host];
        else opts[host] = { ...options };
        chrome.storage.sync.set({
          siteSelectors: hide,
          siteKeep: keep,
          siteHighlight: high,
          siteOptions: opts,
        });
      }
    );
  }

  function renderHideStyle() {
    let css = isolateCss(Array.from(keepSelectors));
    css += Array.from(selectors)
      .map((s) => `${s}{display:none!important}`)
      .join('');
    css += buildHighlightCss(Array.from(highlightSelectors));
    if (options.hideImages) css += 'img{display:none!important}';
    hideStyle.textContent = css;
    countEl.textContent = String(
      selectors.size + keepSelectors.size + highlightSelectors.size
    );
    renderList();
  }

  function addHide(sel, quiet) {
    if (!sel || selectors.has(sel)) return;
    // Removing wins over a prior highlight on the same node.
    highlightSelectors.delete(sel);
    selectors.add(sel);
    undoStack.push({ kind: 'hide', sel });
    renderHideStyle();
    persist();
    if (!quiet) toast('Removed from print');
  }

  function addKeep(sel) {
    if (!sel || keepSelectors.has(sel)) return;
    keepSelectors.add(sel);
    undoStack.push({ kind: 'keep', sel });
    renderHideStyle();
    persist();
    toast('Keeping only this');
  }

  function addHighlight(sel) {
    if (!sel || highlightSelectors.has(sel)) return;
    highlightSelectors.add(sel);
    undoStack.push({ kind: 'highlight', sel });
    renderHideStyle();
    persist();
    toast('Highlighted');
  }

  function pruneUndo(kind, sel) {
    for (let i = undoStack.length - 1; i >= 0; i--) {
      if (undoStack[i].kind === kind && undoStack[i].sel === sel) {
        undoStack.splice(i, 1);
        return;
      }
    }
  }

  function restoreHide(sel) {
    if (!selectors.delete(sel)) return;
    pruneUndo('hide', sel);
    renderHideStyle();
    persist();
  }

  function restoreKeep(sel) {
    if (!keepSelectors.delete(sel)) return;
    pruneUndo('keep', sel);
    renderHideStyle();
    persist();
  }

  function restoreHighlight(sel) {
    if (!highlightSelectors.delete(sel)) return;
    pruneUndo('highlight', sel);
    renderHideStyle();
    persist();
  }

  function undo() {
    const a = undoStack.pop();
    if (!a) return;
    if (a.kind === 'hide') selectors.delete(a.sel);
    else if (a.kind === 'keep') keepSelectors.delete(a.sel);
    else if (a.kind === 'highlight') highlightSelectors.delete(a.sel);
    renderHideStyle();
    persist();
  }

  function reset() {
    selectors.clear();
    keepSelectors.clear();
    highlightSelectors.clear();
    undoStack.length = 0;
    renderHideStyle();
    persist();
  }

  // ---- overlay UI (Shadow DOM, isolated from the host page) ----------------

  const shadowHost = document.createElement('div');
  shadowHost.id = HOST_ID;
  const root = shadowHost.attachShadow({ mode: 'open' });

  const hideStyle = document.createElement('style');
  document.head.appendChild(hideStyle);

  // Keep our own UI out of the printout; the removed elements are already
  // display:none live, so they stay gone in print too.
  const printGuard = document.createElement('style');
  printGuard.textContent = `@media print{#${HOST_ID}{display:none!important}}`;
  document.head.appendChild(printGuard);

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: 'Avenir Next', ui-sans-serif, system-ui, sans-serif; }
      .bar {
        position: fixed; z-index: 2147483647; left: 50%; bottom: 24px;
        transform: translateX(-50%);
        display: flex; align-items: center; gap: 14px;
        padding: 10px 14px;
        background: oklch(0.205 0.01 250);
        color: oklch(0.97 0 0);
        border-radius: 14px;
        box-shadow: 0 8px 28px oklch(0 0 0 / 0.32), 0 0 0 1px oklch(1 0 0 / 0.06);
        animation: rise 240ms cubic-bezier(0.16,1,0.3,1) both;
      }
      @keyframes rise { from { opacity: 0; transform: translateX(-50%) translateY(12px); } }
      .brand { display: flex; align-items: center; gap: 9px; padding-right: 4px; }
      .brand svg { width: 18px; height: 18px; }
      .brand b { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }
      .brand small { display: block; font-size: 11px; color: oklch(0.97 0 0 / 0.6); font-weight: 400; }
      .sep { width: 1px; align-self: stretch; background: oklch(1 0 0 / 0.12); }
      .count {
        font-size: 12px; color: oklch(0.97 0 0 / 0.7);
        min-width: 78px; text-align: center; font-variant-numeric: tabular-nums;
      }
      .count b { color: oklch(0.97 0 0); font-weight: 600; }
      .acts { display: flex; align-items: center; gap: 6px; }
      .mode {
        display: inline-flex; background: oklch(1 0 0 / 0.07);
        border-radius: 9px; padding: 2px; gap: 2px;
      }
      .mode button {
        padding: 6px 11px; font-size: 11.5px; border-radius: 7px;
        color: oklch(0.97 0 0 / 0.62); font-weight: 550;
      }
      .mode button.on { background: oklch(1 0 0 / 0.16); color: oklch(0.97 0 0); }
      .mode button:hover:not(.on) { background: oklch(1 0 0 / 0.06); }
      button {
        all: unset; cursor: pointer; font-size: 12.5px; font-weight: 550;
        padding: 7px 12px; border-radius: 9px; color: oklch(0.97 0 0);
        transition: background 140ms ease, opacity 140ms ease;
        white-space: nowrap;
      }
      button:hover { background: oklch(1 0 0 / 0.1); }
      button:focus-visible { outline: 2px solid oklch(0.7 0.16 250); outline-offset: 1px; }
      button.ghost[disabled] { opacity: 0.35; cursor: default; }
      button.ghost[disabled]:hover { background: none; }
      button.print {
        background: oklch(0.62 0.17 25);
        color: oklch(0.99 0 0);
        font-weight: 600;
      }
      button.print:hover {
        background: oklch(0.66 0.17 25);
      }
      .icon { all: unset; cursor: pointer; padding: 6px; border-radius: 8px; display: inline-flex; }
      .icon:hover { background: oklch(1 0 0 / 0.1); }
      .icon svg { width: 16px; height: 16px; display: block; }

      .hint {
        position: fixed; z-index: 2147483646; left: 50%; bottom: 84px;
        transform: translateX(-50%);
        font-size: 12px; color: oklch(0.97 0 0); background: oklch(0.205 0.01 250 / 0.9);
        padding: 6px 12px; border-radius: 999px; pointer-events: none;
        animation: rise 240ms cubic-bezier(0.16,1,0.3,1) both;
      }

      .toast {
        position: fixed; z-index: 2147483647; left: 50%; bottom: 84px;
        transform: translateX(-50%) translateY(8px);
        display: flex; align-items: center; gap: 10px;
        background: oklch(0.97 0 0); color: oklch(0.2 0.01 250);
        font-size: 12.5px; font-weight: 550;
        padding: 8px 10px 8px 14px; border-radius: 10px;
        box-shadow: 0 8px 24px oklch(0 0 0 / 0.28);
        opacity: 0; pointer-events: none;
        transition: opacity 160ms ease, transform 160ms cubic-bezier(0.16,1,0.3,1);
      }
      .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
      .toast button { color: oklch(0.55 0.17 25); padding: 4px 8px; font-weight: 650; }
      .toast button:hover { background: oklch(0.55 0.17 25 / 0.1); }

      .panel {
        position: fixed; z-index: 2147483646; left: 50%; bottom: 84px;
        transform: translateX(-50%);
        width: 320px; max-height: 46vh; overflow: auto;
        background: oklch(0.205 0.01 250); color: oklch(0.97 0 0);
        border-radius: 12px; padding: 8px;
        box-shadow: 0 12px 32px oklch(0 0 0 / 0.34), 0 0 0 1px oklch(1 0 0 / 0.06);
        display: none; animation: rise 200ms cubic-bezier(0.16,1,0.3,1) both;
      }
      .panel.open { display: block; }
      .panel h2 { margin: 4px 6px 8px; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.06em; color: oklch(0.97 0 0 / 0.5); font-weight: 600; }
      .row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; }
      .row:hover { background: oklch(1 0 0 / 0.06); }
      .row code { flex: 1; min-width: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 11.5px; color: oklch(0.97 0 0 / 0.78);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .row button { font-size: 11.5px; padding: 5px 9px; background: oklch(1 0 0 / 0.08); }
      .row button:hover { background: oklch(1 0 0 / 0.16); }

      /* Layout options popover */
      .opts {
        position: fixed; z-index: 2147483646; left: 50%; bottom: 84px;
        transform: translateX(-50%);
        width: 300px;
        background: oklch(0.205 0.01 250); color: oklch(0.97 0 0);
        border-radius: 12px; padding: 6px 14px;
        box-shadow: 0 12px 32px oklch(0 0 0 / 0.34), 0 0 0 1px oklch(1 0 0 / 0.06);
        display: none; animation: rise 200ms cubic-bezier(0.16,1,0.3,1) both;
      }
      .opts.open { display: block; }
      .opts .grp {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 0;
      }
      .opts .grp + .grp { border-top: 1px solid oklch(1 0 0 / 0.08); }
      .opts .lbl { font-size: 12.5px; font-weight: 550; }
      .seg { display: inline-flex; background: oklch(1 0 0 / 0.07); border-radius: 8px; padding: 2px; gap: 2px; }
      .seg button { padding: 5px 9px; font-size: 11.5px; border-radius: 6px; color: oklch(0.97 0 0 / 0.62); font-weight: 550; }
      .seg button.on { background: oklch(1 0 0 / 0.16); color: oklch(0.97 0 0); }
      .seg button:hover:not(.on) { background: oklch(1 0 0 / 0.06); }
      .stepper { display: inline-flex; align-items: center; gap: 4px; }
      .stepper button { padding: 4px 10px; background: oklch(1 0 0 / 0.08); border-radius: 6px; font-size: 13px; }
      .stepper button:hover { background: oklch(1 0 0 / 0.16); }
      .stepper button[disabled] { opacity: 0.35; cursor: default; }
      .stepper button[disabled]:hover { background: oklch(1 0 0 / 0.08); }
      .stepper .val { min-width: 44px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; }
      .toggle {
        width: 38px; height: 22px; border-radius: 999px; flex: 0 0 auto;
        background: oklch(1 0 0 / 0.16); position: relative; cursor: pointer;
        transition: background 140ms ease;
      }
      .toggle.on { background: oklch(0.62 0.17 25); }
      .toggle::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 18px; height: 18px; border-radius: 50%; background: oklch(0.99 0 0);
        transition: transform 140ms ease;
      }
      .toggle.on::after { transform: translateX(16px); }
      .toggle:focus-visible { outline: 2px solid oklch(0.7 0.16 250); outline-offset: 2px; }
      button.save { background: oklch(1 0 0 / 0.1); }
      button.save:hover { background: oklch(1 0 0 / 0.18); }
      .icon.on { background: oklch(1 0 0 / 0.16); }

      @media (prefers-reduced-motion: reduce) {
        .bar, .toast, .panel, .opts, .hint { animation: none; transition: none; }
      }
    </style>

    <div class="hint" id="hint">Click anything to remove it from the printout</div>

    <div class="panel" id="panel"><div id="list"></div></div>

    <div class="opts" id="opts">
      <div class="grp">
        <span class="lbl">Text size</span>
        <span class="stepper">
          <button id="textMinus" aria-label="Smaller text">A&minus;</button>
          <span class="val" id="textVal">100%</span>
          <button id="textPlus" aria-label="Larger text">A+</button>
        </span>
      </div>
      <div class="grp">
        <span class="lbl">Hide all images</span>
        <span class="toggle" id="imgToggle" role="switch" aria-checked="false" tabindex="0" aria-label="Hide all images"></span>
      </div>
      <div class="grp">
        <span class="lbl">Paper</span>
        <span class="seg" id="paperSeg" role="group" aria-label="Paper size">
          <button data-v="A4" class="on">A4</button>
          <button data-v="Letter">Letter</button>
        </span>
      </div>
      <div class="grp">
        <span class="lbl">Margins</span>
        <span class="seg" id="marginSeg" role="group" aria-label="Margins">
          <button data-v="normal" class="on">Normal</button>
          <button data-v="narrow">Narrow</button>
          <button data-v="none">None</button>
        </span>
      </div>
    </div>

    <div class="bar" role="toolbar" aria-label="Print preview controls">
      <span class="brand">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9V3h12v6" stroke="oklch(0.7 0.16 25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="3" y="9" width="18" height="8" rx="1.5" stroke="oklch(0.97 0 0 / 0.85)" stroke-width="2"/>
          <path d="M7 15h10v6H7z" stroke="oklch(0.97 0 0 / 0.6)" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <b>Print preview<small>What you see is what prints</small></b>
      </span>
      <span class="sep"></span>
      <span class="mode" role="group" aria-label="Click action">
        <button id="m-remove" class="on" title="Click elements to drop them from the printout">Remove</button>
        <button id="m-keep" title="Click one section to keep only it — everything else is dropped">Keep only</button>
        <button id="m-highlight" title="Click elements to highlight them in the printout">Highlight</button>
        <button id="m-edit" title="Click text to edit it before printing">Edit</button>
      </span>
      <button class="count-btn icon" id="countBtn" title="Show changes" aria-label="Show changes">
        <span class="count"><b id="count">0</b> changes</span>
      </button>
      <button class="icon" id="layoutBtn" title="Layout: text size, images, paper &amp; margins" aria-label="Layout options">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h11M4 12h7M4 18h13" stroke="oklch(0.97 0 0 / 0.85)" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="6" r="2.4" stroke="oklch(0.97 0 0 / 0.85)" stroke-width="2"/><circle cx="14" cy="12" r="2.4" stroke="oklch(0.97 0 0 / 0.85)" stroke-width="2"/><circle cx="20" cy="18" r="2.4" stroke="oklch(0.97 0 0 / 0.85)" stroke-width="2"/></svg>
      </button>
      <span class="acts">
        <button class="ghost" id="undo" disabled>Undo</button>
        <button class="ghost" id="reset" disabled>Reset</button>
        <button class="save" id="savepdf" title="Open the print dialog, then choose “Save as PDF”">Save PDF</button>
        <button class="print" id="print">Print</button>
        <button id="done">Done</button>
      </span>
      <span class="sep"></span>
      <button class="icon" id="settings" title="Edit rules manually" aria-label="Edit rules manually">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="oklch(0.97 0 0 / 0.8)" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="oklch(0.97 0 0 / 0.8)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  // Floating highlight that tracks the hovered element.
  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'fixed',
    zIndex: '2147483640',
    pointerEvents: 'none',
    border: '2px solid oklch(0.62 0.17 25)',
    background: 'oklch(0.62 0.17 25 / 0.12)',
    borderRadius: '4px',
    display: 'none',
    transition: 'all 60ms linear',
  });
  root.appendChild(highlight);

  document.documentElement.appendChild(shadowHost);

  const countEl = root.getElementById('count');
  const countLabel = countEl.parentElement;
  const countBtn = root.getElementById('countBtn');
  const undoBtn = root.getElementById('undo');
  const resetBtn = root.getElementById('reset');
  const panel = root.getElementById('panel');
  const listEl = root.getElementById('list');
  const hintEl = root.getElementById('hint');
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  root.appendChild(toastEl);

  let hintTimer;
  function showHint(text) {
    if (!hintEl) return;
    hintEl.textContent = text;
    hintEl.style.display = 'block';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintEl.style.display = 'none';
    }, 3200);
  }

  function addGroup(label, set, onRestore) {
    const h = document.createElement('h2');
    h.textContent = label;
    listEl.appendChild(h);
    Array.from(set).forEach((sel) => {
      const row = document.createElement('div');
      row.className = 'row';
      const code = document.createElement('code');
      code.textContent = sel;
      const btn = document.createElement('button');
      btn.textContent = 'Restore';
      btn.addEventListener('click', () => {
        onRestore(sel);
        if (
          selectors.size === 0 &&
          keepSelectors.size === 0 &&
          highlightSelectors.size === 0
        )
          panel.classList.remove('open');
      });
      row.append(code, btn);
      listEl.appendChild(row);
    });
  }

  function renderList() {
    listEl.textContent = '';
    if (keepSelectors.size)
      addGroup('Kept sections', keepSelectors, restoreKeep);
    if (selectors.size) addGroup('Removed sections', selectors, restoreHide);
    if (highlightSelectors.size)
      addGroup('Highlighted', highlightSelectors, restoreHighlight);
    const total = selectors.size + keepSelectors.size + highlightSelectors.size;
    if (countLabel)
      countLabel.lastChild.textContent = total === 1 ? ' change' : ' changes';
    undoBtn.disabled = undoStack.length === 0;
    resetBtn.disabled = total === 0;
  }

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = '';
    const span = document.createElement('span');
    span.textContent = msg;
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.addEventListener('click', () => {
      undo();
      hideToast();
    });
    toastEl.append(span, btn);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3000);
  }
  function hideToast() {
    toastEl.classList.remove('show');
  }

  // ---- pointer interaction on the host page --------------------------------

  let hovered = null;

  function withinUI(el) {
    return el === shadowHost || (el && shadowHost.contains(el));
  }

  function isPageRoot(el) {
    return el === document.documentElement || el === document.body;
  }

  function onMove(e) {
    if (dragging) {
      updateMarquee(e);
      return;
    }
    const el = e.target;
    if (withinUI(el) || isPageRoot(el)) {
      highlight.style.display = 'none';
      hovered = null;
      return;
    }
    hovered = el;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      highlight.style.display = 'none';
      return;
    }
    highlight.style.display = 'block';
    highlight.style.top = r.top - 2 + 'px';
    highlight.style.left = r.left - 2 + 'px';
    highlight.style.width = r.width + 4 + 'px';
    highlight.style.height = r.height + 4 + 'px';
  }

  // ---- inline text editing (Edit mode) ------------------------------------

  const editedEls = new Set();

  function makeEditable(el) {
    if (!el || editedEls.has(el)) return;
    el.setAttribute('contenteditable', 'true');
    el.dataset.pcEdited = '1';
    editedEls.add(el);
  }

  function clearEdits() {
    editedEls.forEach((el) => {
      el.removeAttribute('contenteditable');
      delete el.dataset.pcEdited;
    });
    editedEls.clear();
  }

  // ---- marquee drag-to-remove (Remove mode only) --------------------------

  const marquee = document.createElement('div');
  Object.assign(marquee.style, {
    position: 'fixed',
    zIndex: '2147483641',
    pointerEvents: 'none',
    border: '1.5px dashed oklch(0.62 0.17 25)',
    background: 'oklch(0.62 0.17 25 / 0.08)',
    borderRadius: '3px',
    display: 'none',
  });
  root.appendChild(marquee);

  let pendingDrag = false;
  let dragging = false;
  let suppressClick = false;
  let startX = 0;
  let startY = 0;
  const DRAG_THRESHOLD = 6;

  function marqueeBox(e) {
    return {
      left: Math.min(startX, e.clientX),
      top: Math.min(startY, e.clientY),
      right: Math.max(startX, e.clientX),
      bottom: Math.max(startY, e.clientY),
    };
  }

  function updateMarquee(e) {
    const b = marqueeBox(e);
    marquee.style.display = 'block';
    marquee.style.left = b.left + 'px';
    marquee.style.top = b.top + 'px';
    marquee.style.width = b.right - b.left + 'px';
    marquee.style.height = b.bottom - b.top + 'px';
    highlight.style.display = 'none';
  }

  function rectInside(r, b) {
    return (
      r.left >= b.left &&
      r.top >= b.top &&
      r.right <= b.right &&
      r.bottom <= b.bottom
    );
  }

  function rectIntersects(r, b) {
    return (
      r.left < b.right &&
      r.right > b.left &&
      r.top < b.bottom &&
      r.bottom > b.top
    );
  }

  // Collect the topmost elements fully enclosed by the marquee: descend only
  // into branches that merely intersect, so we pick whole blocks, not slivers.
  function collectInBox(el, box, out) {
    for (const child of el.children) {
      if (withinUI(child) || child === shadowHost) continue;
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (rectInside(r, box)) out.push(child);
      else if (rectIntersects(r, box)) collectInBox(child, box, out);
    }
  }

  function onMouseDown(e) {
    if (withinUI(e.target) || mode !== 'remove') return;
    if (e.button !== 0) return;
    pendingDrag = true;
    startX = e.clientX;
    startY = e.clientY;
  }

  function onMouseUp(e) {
    if (!pendingDrag) return;
    pendingDrag = false;
    if (!dragging) return;
    dragging = false;
    suppressClick = true;
    marquee.style.display = 'none';
    const box = marqueeBox(e);
    if (box.right - box.left < 8 || box.bottom - box.top < 8) return;
    const found = [];
    collectInBox(document.body, box, found);
    let n = 0;
    found.forEach((el) => {
      const sel = selectorFor(el);
      if (sel && !selectors.has(sel)) {
        addHide(sel, true);
        n++;
      }
    });
    if (n) toast(`Removed ${n} ${n === 1 ? 'item' : 'items'}`);
  }

  function onClick(e) {
    if (withinUI(e.target)) return;
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (mode === 'edit') {
      if (isPageRoot(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      makeEditable(el);
      const range =
        document.caretRangeFromPoint &&
        document.caretRangeFromPoint(e.clientX, e.clientY);
      const selection = window.getSelection();
      if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      el.focus();
      return;
    }

    if (!hovered) return;
    e.preventDefault();
    e.stopPropagation();
    highlight.style.display = 'none';
    const sel = selectorFor(hovered);
    if (mode === 'keep') addKeep(sel);
    else if (mode === 'highlight') addHighlight(sel);
    else addHide(sel);
    hovered = null;
  }

  function onKey(e) {
    // Don't hijack typing while editing page text.
    if (mode === 'edit' && e.target && e.target.isContentEditable) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === 'Escape') exit();
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  }

  // Promote a pending press into a marquee drag once it moves far enough.
  function onMouseMoveDrag(e) {
    if (!pendingDrag || dragging) return;
    if (
      Math.abs(e.clientX - startX) > DRAG_THRESHOLD ||
      Math.abs(e.clientY - startY) > DRAG_THRESHOLD
    ) {
      dragging = true;
    }
  }

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMoveDrag, true);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);

  // ---- toolbar wiring ------------------------------------------------------

  root.getElementById('undo').addEventListener('click', undo);
  root.getElementById('reset').addEventListener('click', reset);
  root.getElementById('done').addEventListener('click', exit);
  countBtn.addEventListener('click', () => {
    if (selectors.size || keepSelectors.size || highlightSelectors.size) {
      const open = panel.classList.toggle('open');
      if (open) {
        optsPanel.classList.remove('open');
        layoutBtn.classList.remove('on');
      }
    }
  });
  root.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-options' });
  });

  // ---- mode toggle: Remove / Keep only / Highlight / Edit ------------------

  const mRemove = root.getElementById('m-remove');
  const mKeep = root.getElementById('m-keep');
  const mHighlight = root.getElementById('m-highlight');
  const mEdit = root.getElementById('m-edit');
  const MODE_BTNS = {
    remove: mRemove,
    keep: mKeep,
    highlight: mHighlight,
    edit: mEdit,
  };
  const MODE_HINTS = {
    remove: 'Click anything to remove it — or drag to remove several at once',
    keep: 'Click a section to keep only it — everything else is dropped',
    highlight: 'Click anything to highlight it in the printout',
    edit: 'Click text to edit it, then type. Press Esc to finish a field.',
  };
  const MODE_COLOR = {
    remove: ['oklch(0.62 0.17 25)', 'oklch(0.62 0.17 25 / 0.12)'],
    keep: ['oklch(0.58 0.14 155)', 'oklch(0.58 0.14 155 / 0.16)'],
    highlight: ['oklch(0.82 0.17 95)', 'oklch(0.82 0.17 95 / 0.22)'],
    edit: ['oklch(0.62 0.16 250)', 'oklch(0.62 0.16 250 / 0.14)'],
  };
  function setMode(next) {
    mode = next;
    Object.entries(MODE_BTNS).forEach(([k, btn]) =>
      btn.classList.toggle('on', k === next)
    );
    const [border, bg] = MODE_COLOR[next] || MODE_COLOR.remove;
    highlight.style.borderColor = border;
    highlight.style.background = bg;
    showHint(MODE_HINTS[next]);
  }
  Object.entries(MODE_BTNS).forEach(([k, btn]) =>
    btn.addEventListener('click', () => setMode(k))
  );
  showHint(MODE_HINTS.remove);

  // ---- layout options popover (text size, images, paper, margins) ---------

  const optsPanel = root.getElementById('opts');
  const layoutBtn = root.getElementById('layoutBtn');
  const imgToggle = root.getElementById('imgToggle');
  const paperSeg = root.getElementById('paperSeg');
  const marginSeg = root.getElementById('marginSeg');
  const textVal = root.getElementById('textVal');
  const textMinusBtn = root.getElementById('textMinus');
  const textPlusBtn = root.getElementById('textPlus');

  const TEXT_MIN = 0.8;
  const TEXT_MAX = 1.6;
  const TEXT_STEP = 0.1;
  const TEXT_SKIP = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'TEXTAREA',
    'svg',
  ]);

  // Per-element original sizes, so text scaling is reversible and flows into
  // the print snapshot (which reads each node's computed font-size).
  const textBase = new Map();

  function eligibleTextEls() {
    const out = [];
    if (!document.body) return out;
    document.body.querySelectorAll('*').forEach((el) => {
      if (withinUI(el) || TEXT_SKIP.has(el.tagName)) return;
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
          out.push(el);
          break;
        }
      }
    });
    return out;
  }

  function restoreTextSizing() {
    textBase.forEach((b, el) => {
      el.style.fontSize = b.prevFs;
      el.style.lineHeight = b.prevLh;
    });
    textBase.clear();
  }

  function applyTextScale(scale) {
    options.textScale = scale;
    if (scale === 1) {
      restoreTextSizing();
      return;
    }
    eligibleTextEls().forEach((el) => {
      let b = textBase.get(el);
      if (!b) {
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const lh = /^[\d.]+px$/.test(cs.lineHeight)
          ? parseFloat(cs.lineHeight)
          : null;
        b = { fs, lh, prevFs: el.style.fontSize, prevLh: el.style.lineHeight };
        textBase.set(el, b);
      }
      if (b.fs) el.style.fontSize = (b.fs * scale).toFixed(2) + 'px';
      if (b.lh) el.style.lineHeight = (b.lh * scale).toFixed(2) + 'px';
    });
  }

  function updateTextUI() {
    textVal.textContent = Math.round(options.textScale * 100) + '%';
    textMinusBtn.disabled = options.textScale <= TEXT_MIN + 1e-9;
    textPlusBtn.disabled = options.textScale >= TEXT_MAX - 1e-9;
  }

  function setTextScale(scale) {
    scale = Math.round(scale * 10) / 10;
    scale = Math.min(TEXT_MAX, Math.max(TEXT_MIN, scale));
    applyTextScale(scale);
    updateTextUI();
    persist();
  }

  function setImages(hide) {
    options.hideImages = hide;
    imgToggle.classList.toggle('on', hide);
    imgToggle.setAttribute('aria-checked', String(hide));
    renderHideStyle();
    persist();
  }

  function wireSeg(seg, key) {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      options[key] = btn.dataset.v;
      Array.from(seg.children).forEach((b) =>
        b.classList.toggle('on', b === btn)
      );
      persist();
    });
  }

  function syncOptionsUI() {
    imgToggle.classList.toggle('on', options.hideImages);
    imgToggle.setAttribute('aria-checked', String(options.hideImages));
    Array.from(paperSeg.children).forEach((b) =>
      b.classList.toggle('on', b.dataset.v === options.pageSize)
    );
    Array.from(marginSeg.children).forEach((b) =>
      b.classList.toggle('on', b.dataset.v === options.margins)
    );
    updateTextUI();
  }

  layoutBtn.addEventListener('click', () => {
    const open = optsPanel.classList.toggle('open');
    layoutBtn.classList.toggle('on', open);
    if (open) panel.classList.remove('open');
  });
  imgToggle.addEventListener('click', () => setImages(!options.hideImages));
  imgToggle.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setImages(!options.hideImages);
    }
  });
  wireSeg(paperSeg, 'pageSize');
  wireSeg(marginSeg, 'margins');
  textMinusBtn.addEventListener('click', () =>
    setTextScale(options.textScale - TEXT_STEP)
  );
  textPlusBtn.addEventListener('click', () =>
    setTextScale(options.textScale + TEXT_STEP)
  );

  function closePopovers() {
    highlight.style.display = 'none';
    hideToast();
    panel.classList.remove('open');
    optsPanel.classList.remove('open');
    layoutBtn.classList.remove('on');
  }

  root.getElementById('print').addEventListener('click', () => {
    closePopovers();
    printExact();
  });
  root.getElementById('savepdf').addEventListener('click', () => {
    closePopovers();
    printExact();
  });

  function exit() {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMoveDrag, true);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    clearEdits();
    restoreTextSizing();
    hideStyle.remove();
    printGuard.remove();
    shadowHost.remove();
  }

  shadowHost.__printClean = { exit };

  // ---- exact print: snapshot the curated screen view ----------------------

  // Properties copied onto each cloned node. Inlining computed styles makes the
  // snapshot render identically regardless of the site's print stylesheet
  // (which never applies inside our isolated print iframe).
  const SNAPSHOT_PROPS = [
    'color',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-clip',
    '-webkit-background-clip',
    'mask-image',
    'mask-size',
    'mask-repeat',
    'mask-position',
    '-webkit-mask-image',
    '-webkit-mask-size',
    '-webkit-mask-repeat',
    '-webkit-mask-position',
    'fill',
    'stroke',
    'stroke-width',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'font-variant',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-align',
    'text-decoration',
    'text-transform',
    'text-indent',
    'text-overflow',
    'white-space',
    'vertical-align',
    'direction',
    'display',
    'float',
    'clear',
    'overflow',
    'overflow-x',
    'overflow-y',
    'visibility',
    'flex-direction',
    'flex-wrap',
    'justify-content',
    'align-items',
    'align-content',
    'align-self',
    'gap',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'order',
    'grid-template-columns',
    'grid-template-rows',
    'grid-column',
    'grid-row',
    'grid-auto-flow',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'transform',
    'transform-origin',
    'width',
    'height',
    'max-width',
    'min-width',
    'max-height',
    'box-sizing',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-radius',
    'box-shadow',
    'outline',
    'list-style',
    'table-layout',
    'border-collapse',
    'border-spacing',
    'caption-side',
    'empty-cells',
    'opacity',
    'object-fit',
    'object-position',
  ];

  const SNAPSHOT_SKIP = new Set([
    'SCRIPT',
    'NOSCRIPT',
    'TEMPLATE',
    'LINK',
    'META',
    'STYLE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'VIDEO',
    'AUDIO',
    'CANVAS',
  ]);

  function buildSnapshot(src) {
    if (src.nodeType === 3) {
      const t = src.nodeValue;
      return t && t.trim() ? document.createTextNode(t) : null;
    }
    if (src.nodeType !== 1) return null;
    if (src === shadowHost) return null;
    if (SNAPSHOT_SKIP.has(src.tagName) && src.tagName !== 'IMG') return null;

    const cs = getComputedStyle(src);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;

    const clone = src.cloneNode(false);
    clone.removeAttribute('class');
    clone.removeAttribute('id');

    let css = '';
    for (const prop of SNAPSHOT_PROPS) {
      css += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    // Pin floating/sticky chrome in place so it can't overlap the printout.
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      css += 'position:static;';
    }
    // Release vertical scroll/clip containers (e.g. Gmail's email body) so
    // their full content flows onto the page instead of being cut off at the
    // scroll viewport. We pin each node's computed px height for layout, which
    // would otherwise clamp a scroller to only its visible slice; here we let
    // it grow. Both axes go visible because a single non-visible axis forces
    // the other back to auto (re-clipping).
    const CLIP = ['auto', 'scroll', 'hidden', 'clip'];
    if (CLIP.includes(cs.overflowY)) {
      css +=
        'overflow:visible !important;height:auto !important;max-height:none !important;';
    } else if (CLIP.includes(cs.overflowX)) {
      css += 'overflow:visible !important;';
    }
    clone.setAttribute('style', css);

    if (src.tagName === 'IMG') {
      // Capture the resolved (srcset) image and force it to load in print.
      if (src.currentSrc) clone.setAttribute('src', src.currentSrc);
      clone.removeAttribute('srcset');
      clone.removeAttribute('loading');
      return clone;
    }

    for (const child of src.childNodes) {
      const c = buildSnapshot(child);
      if (c) clone.appendChild(c);
    }
    return clone;
  }

  function printExact() {
    const vw = document.documentElement.clientWidth;
    // Lock the snapshot to the on-screen width and scale it down to fit the
    // chosen page, so the layout is frozen exactly as previewed. Changing the
    // paper size or margins then only changes the surrounding whitespace
    // instead of reflowing the content. We only ever scale down, never up.
    const TARGET = printableWidthPx(options.pageSize, options.margins);
    const scale = Math.min(1, TARGET / vw);
    const bodyClone = buildSnapshot(document.body);

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = `position:fixed;top:-100000px;left:0;width:${vw}px;height:200px;border:0;opacity:0;`;
    document.body.appendChild(frame);

    const idoc = frame.contentDocument;
    idoc.open();
    idoc.write(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<title>${(document.title || 'Print Clean').replace(/</g, '&lt;')}</title>` +
        `<base href="${location.href.replace(/"/g, '&quot;')}">` +
        `<style>${pageBoxCss(options.pageSize, options.margins)}` +
        `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
        `html,body{margin:0;padding:0;background:#fff}` +
        `img{max-width:100%}</style></head><body></body></html>`
    );
    idoc.close();

    if (bodyClone) {
      const stage = idoc.createElement('div');
      stage.setAttribute(
        'style',
        `${bodyClone.getAttribute('style') || ''};width:${vw}px;zoom:${scale};`
      );
      while (bodyClone.firstChild) stage.appendChild(bodyClone.firstChild);
      idoc.body.appendChild(stage);
    }

    let printed = false;
    const fire = () => {
      if (printed) return;
      printed = true;
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    };

    const imgs = Array.from(idoc.images || []);
    const pending = imgs.filter((im) => !im.complete);
    if (pending.length === 0) {
      setTimeout(fire, 60);
    } else {
      let left = pending.length;
      const tick = () => {
        if (--left <= 0) fire();
      };
      pending.forEach((im) => {
        im.addEventListener('load', tick);
        im.addEventListener('error', tick);
      });
      setTimeout(fire, 2000); // safety net for slow/blocked images
    }
  }

  // ---- load existing rules for this host -----------------------------------

  chrome.storage.sync.get(
    ['siteSelectors', 'siteKeep', 'siteHighlight', 'siteOptions'],
    (data) => {
      ((data.siteSelectors || {})[host] || []).forEach((s) => selectors.add(s));
      ((data.siteKeep || {})[host] || []).forEach((s) => keepSelectors.add(s));
      ((data.siteHighlight || {})[host] || []).forEach((s) =>
        highlightSelectors.add(s)
      );
      const saved = (data.siteOptions || {})[host];
      if (saved) Object.assign(options, saved);
      renderHideStyle();
      renderList();
      syncOptionsUI();
      if (options.textScale !== 1) applyTextScale(options.textScale);
    }
  );
})();
