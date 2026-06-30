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

  const api = {
    normalizeHost,
    isValidDomain,
    mergeSettings,
    buildHideCss,
    buildIsolateCss,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
