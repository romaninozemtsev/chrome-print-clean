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

  const handler = specialHandlers[hostname];
  if (handler) {
    handler();
    window.print();
    return;
  }

  function isolateCss(selectors) {
    const list = (selectors || []).filter(Boolean);
    if (!list.length) return '';
    const grp = list.join(', ');
    return (
      `body *:not(:is(${grp})):not(:is(${grp}) *):not(:has(:is(${grp})))` +
      ` { display: none !important; }`
    );
  }

  chrome.storage.sync.get(['siteSelectors', 'siteKeep'], (data) => {
    const hide = (data.siteSelectors || {})[hostname];
    const keep = (data.siteKeep || {})[hostname];

    let css = isolateCss(keep);
    if (hide && hide.length > 0) {
      css += hide
        .map((selector) => `${selector} { display: none !important; }`)
        .join(' ');
    }
    if (css) addPrintStyles(css);

    window.print();
  });
})();
