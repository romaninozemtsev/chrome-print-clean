// Pure, dependency-free helpers shared across the extension and unit tests.
(function (root) {
  // Strip a leading "www." and lowercase the host for consistent lookups.
  function normalizeHost(hostname) {
    return String(hostname)
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
  }

  // A domain is one or more labels (letters/digits/hyphens, not leading/
  // trailing hyphen) separated by dots, with at least one dot.
  const DOMAIN_RE =
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

  function isValidDomain(domain) {
    return DOMAIN_RE.test(domain);
  }

  // Merge bundled defaults with user settings; user values win.
  function mergeSettings(defaults, user) {
    return { ...(defaults || {}), ...(user || {}) };
  }

  // Build a CSS string that hides each selector (intended for @media print).
  function buildHideCss(selectors) {
    return (selectors || [])
      .map((selector) => `${selector} { display: none !important; }`)
      .join(' ');
  }

  // Build a CSS string that keeps ONLY the given selectors (plus their
  // ancestors and descendants) and hides everything else inside <body>.
  // Relies on :is() and :has(), both supported in Chrome.
  function buildIsolateCss(selectors) {
    const list = (selectors || []).filter(Boolean);
    if (!list.length) return '';
    const grp = list.join(', ');
    return (
      `body *:not(:is(${grp})):not(:is(${grp}) *):not(:has(:is(${grp})))` +
      ` { display: none !important; }`
    );
  }

  // Default highlight colour (amber) used by "Highlight" mode.
  const HIGHLIGHT_COLOR = '#fff176';

  // Build a CSS string that highlights each selector. Forces colour to survive
  // the print pipeline (browsers strip backgrounds by default when printing).
  function buildHighlightCss(selectors, color) {
    const c = color || HIGHLIGHT_COLOR;
    return (selectors || [])
      .filter(Boolean)
      .map(
        (selector) =>
          `${selector} { background-color: ${c} !important;` +
          ` -webkit-print-color-adjust: exact !important;` +
          ` print-color-adjust: exact !important; }`
      )
      .join(' ');
  }

  // ---- page geometry (paper size + margins) ------------------------------
  const PAGE_WIDTH_MM = { A4: 210, Letter: 215.9 };
  const MARGIN_MM = { normal: 14, narrow: 6, none: 0 };

  function mmToPx(mm) {
    return (mm * 96) / 25.4;
  }

  // Printable content width in CSS px for a given paper size + margin preset.
  // Used to scale the frozen snapshot so it fits the page.
  function printableWidthPx(pageSize, margins) {
    const w = PAGE_WIDTH_MM[pageSize] || PAGE_WIDTH_MM.A4;
    const m =
      MARGIN_MM[margins] != null ? MARGIN_MM[margins] : MARGIN_MM.normal;
    return Math.round(mmToPx(w - 2 * m));
  }

  // CSS @page rule for the chosen paper size + margins.
  function pageBoxCss(pageSize, margins) {
    const size =
      (pageSize || 'A4').toLowerCase() === 'letter' ? 'letter' : 'a4';
    const m =
      MARGIN_MM[margins] != null ? MARGIN_MM[margins] : MARGIN_MM.normal;
    return `@page { size: ${size}; margin: ${m}mm; }`;
  }

  const api = {
    normalizeHost,
    isValidDomain,
    mergeSettings,
    buildHideCss,
    buildIsolateCss,
    buildHighlightCss,
    printableWidthPx,
    pageBoxCss,
    mmToPx,
    HIGHLIGHT_COLOR,
    PAGE_WIDTH_MM,
    MARGIN_MM,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
