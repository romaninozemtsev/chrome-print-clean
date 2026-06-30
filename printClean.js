// Injected into the active tab to hide clutter and trigger printing.
// Used by the popup button, the keyboard shortcut, and the context menu.
(function () {
  function addPrintStyles(css) {
    const style = document.createElement('style');
    style.textContent = `@media print { ${css} }`;
    document.head.appendChild(style);
  }

  function hideSiblings(element) {
    if (!element || !element.parentElement) return;
    Array.from(element.parentElement.children).forEach((sibling) => {
      if (sibling !== element) {
        sibling.classList.add('hide-during-print');
      }
    });
  }

  // Site-specific handlers keyed by hostname (www. stripped).
  // Each handler tags elements with `hide-during-print`; the shared print
  // stylesheet hides them only while printing.
  const specialHandlers = {
    'mail.google.com': function cleanupGmail() {
      const urlParams = new URLSearchParams(window.location.search);
      const isPrintableView = urlParams.get('view') === 'pt';

      if (isPrintableView) {
        const mainContent = document.querySelector('.maincontent');
        if (mainContent) {
          hideSiblings(mainContent);
          const messageTable = mainContent.querySelector('table.message');
          if (messageTable) {
            hideSiblings(messageTable);
            const tbody = messageTable.querySelector('tbody');
            if (tbody) {
              const rows = Array.from(tbody.rows);
              if (rows.length > 1) rows[0].classList.add('hide-during-print');
              if (rows.length > 2) rows[1].classList.add('hide-during-print');
            }
          }
        }
      } else {
        let currentElement = document.querySelector('[role="main"]');
        while (currentElement && currentElement.tagName !== 'BODY') {
          hideSiblings(currentElement);
          currentElement = currentElement.parentElement;
        }
      }

      addPrintStyles('.hide-during-print { display: none !important; }');
    },
  };

  const hostname = window.location.hostname.replace(/^www\./, '');

  function isolateCss(selectors) {
    const list = (selectors || []).filter(Boolean);
    if (!list.length) return '';
    const grp = list.join(', ');
    return (
      `body *:not(:is(${grp})):not(:is(${grp}) *):not(:has(:is(${grp})))` +
      ` { display: none !important; }`
    );
  }

  // Scroll containers (e.g. an email body that scrolls inside a fixed-height
  // pane) otherwise print only their visible slice. Tag each scroller and its
  // clipping ancestors so a print-only rule can release them — the screen is
  // untouched because the rule lives inside @media print.
  const UNCLIP = 'pc-print-unclip';
  const CLIP = ['auto', 'scroll', 'hidden', 'clip'];

  function releaseScrollContainers() {
    let tagged = false;
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      const overflowsY =
        CLIP.includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const overflowsX =
        CLIP.includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (!overflowsY && !overflowsX) return;
      // Tag the scroller and every clipping ancestor up to <body>, so a nested
      // fixed-height layout can't clamp the expanded content back down.
      let node = el;
      while (
        node &&
        node !== document.body &&
        node !== document.documentElement
      ) {
        const ncs = getComputedStyle(node);
        if (CLIP.includes(ncs.overflowY) || CLIP.includes(ncs.overflowX)) {
          node.classList.add(UNCLIP);
          tagged = true;
        }
        node = node.parentElement;
      }
    });
    return tagged;
  }

  chrome.storage.sync.get(
    ['siteSelectors', 'siteKeep', 'siteHighlight', 'siteOptions'],
    (data) => {
      const hide = (data.siteSelectors || {})[hostname];
      const keep = (data.siteKeep || {})[hostname];
      const highlight = (data.siteHighlight || {})[hostname];
      const options = (data.siteOptions || {})[hostname];

      const hasUserSettings =
        (hide && hide.length) ||
        (keep && keep.length) ||
        (highlight && highlight.length) ||
        options;

      // A user's saved tweaks take precedence over the built-in special
      // handler: if they curated this page themselves, honour that instead.
      const handler = specialHandlers[hostname];
      if (handler && !hasUserSettings) {
        handler();
        window.print();
        return;
      }

      let css = isolateCss(keep);
      if (hide && hide.length > 0) {
        css += hide
          .map((selector) => `${selector} { display: none !important; }`)
          .join(' ');
      }
      if (highlight && highlight.length > 0) {
        css += ' ' + buildHighlightCss(highlight);
      }
      if (options) {
        if (options.hideImages) css += ' img { display: none !important; }';
        if (options.textScale && options.textScale !== 1) {
          css += ` body { zoom: ${options.textScale}; }`;
        }
        css += ' ' + pageBoxCss(options.pageSize, options.margins);
      }
      if (releaseScrollContainers()) {
        css +=
          ` .${UNCLIP} { overflow: visible !important;` +
          ` height: auto !important; max-height: none !important; }`;
      }
      if (css) addPrintStyles(css);

      window.print();
    }
  );
})();
