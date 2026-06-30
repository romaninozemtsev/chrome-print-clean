const domainInput = document.getElementById('domain');
const selectorsInput = document.getElementById('selectors');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('errorText');
const saveBtn = document.getElementById('saveBtn');
const updateBtn = document.getElementById('updateBtn');
const cancelBtn = document.getElementById('cancelBtn');

saveBtn.addEventListener('click', persist);
updateBtn.addEventListener('click', persist);
cancelBtn.addEventListener('click', exitEditMode);

// Basic domain validation: labels of letters/digits/hyphens separated by dots,
// e.g. united.com or mail.google.com. Rejects spaces, schemes, and paths.
const DOMAIN_RE =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function showError(message) {
  errorTextEl.textContent = message || '';
  errorEl.classList.toggle('is-visible', Boolean(message));
}

function persist() {
  const domain = normalizeDomain(domainInput.value);
  const rawSelectors = selectorsInput.value.trim();

  if (!domain || !rawSelectors) {
    showError('Enter both a domain and at least one selector.');
    return;
  }
  if (!DOMAIN_RE.test(domain)) {
    showError('Enter a valid domain such as “united.com”.');
    return;
  }

  const selectors = rawSelectors
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  chrome.storage.sync.get('siteSelectors', (data) => {
    const siteSelectors = data.siteSelectors || {};
    siteSelectors[domain] = selectors;
    chrome.storage.sync.set({ siteSelectors }, () => {
      loadCurrentSettings();
      exitEditMode();
    });
  });
}

function loadCurrentSettings() {
  Promise.all([
    new Promise((resolve) =>
      chrome.storage.sync.get(
        ['siteSelectors', 'siteKeep', 'siteHighlight', 'siteOptions'],
        (data) =>
          resolve({
            hide: data.siteSelectors || {},
            keep: data.siteKeep || {},
            highlight: data.siteHighlight || {},
            options: data.siteOptions || {},
          })
      )
    ),
    fetch(chrome.runtime.getURL('defaultSettings.json'))
      .then((r) => r.json())
      .catch(() => ({})),
  ]).then(([store, defaultSettings]) => {
    const container = document.getElementById('currentSettings');
    container.textContent = '';

    const domains = Array.from(
      new Set([
        ...Object.keys(store.hide),
        ...Object.keys(store.keep),
        ...Object.keys(store.highlight),
        ...Object.keys(store.options),
      ])
    ).sort();

    if (domains.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No sites configured yet. Add one above to begin.';
      container.appendChild(empty);
      return;
    }

    domains.forEach((domain) => {
      container.appendChild(
        renderRule(
          domain,
          {
            hide: store.hide[domain] || [],
            keep: store.keep[domain] || [],
            highlight: store.highlight[domain] || [],
            options: store.options[domain] || null,
          },
          defaultSettings
        )
      );
    });
  });
}

function optionsSummary(options) {
  if (!options) return '';
  const parts = [];
  if (options.hideImages) parts.push('Images hidden');
  if (options.textScale && options.textScale !== 1) {
    parts.push(`Text ${Math.round(options.textScale * 100)}%`);
  }
  if (options.pageSize && options.pageSize !== 'A4') {
    parts.push(options.pageSize);
  }
  if (options.margins && options.margins !== 'normal') {
    parts.push(`${options.margins} margins`);
  }
  return parts.join(' · ');
}

function renderSelectorGroup(label, selectors) {
  if (!selectors || !selectors.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'rule__group';

  const heading = document.createElement('div');
  heading.className = 'rule__group-label';
  heading.textContent = label;
  wrap.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'rule__selectors';
  selectors.forEach((selector) => {
    const li = document.createElement('li');
    li.textContent = selector;
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

function renderRule(domain, data, defaultSettings) {
  const rule = document.createElement('div');
  rule.className = 'rule';

  const title = document.createElement('div');
  title.className = 'rule__domain';
  title.textContent = domain;
  rule.appendChild(title);

  const summary = optionsSummary(data.options);
  if (summary) {
    const meta = document.createElement('div');
    meta.className = 'rule__meta';
    meta.textContent = summary;
    rule.appendChild(meta);
  }

  const hideGroup = renderSelectorGroup('Hidden', data.hide);
  if (hideGroup) rule.appendChild(hideGroup);
  const keepGroup = renderSelectorGroup('Kept only', data.keep);
  if (keepGroup) rule.appendChild(keepGroup);
  const highlightGroup = renderSelectorGroup('Highlighted', data.highlight);
  if (highlightGroup) rule.appendChild(highlightGroup);

  const actions = document.createElement('div');
  actions.className = 'rule__actions';

  actions.appendChild(
    makeButton('Edit hidden', 'btn small', () => editSettings(domain))
  );
  actions.appendChild(
    makeButton('Delete', 'btn small danger', () => deleteSettings(domain))
  );
  if (defaultSettings[domain]) {
    actions.appendChild(
      makeButton('Reset to default', 'btn small', () =>
        resetToDefault(domain, defaultSettings)
      )
    );
  }
  rule.appendChild(actions);

  return rule;
}

function makeButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function editSettings(domain) {
  chrome.storage.sync.get('siteSelectors', (data) => {
    const siteSelectors = data.siteSelectors || {};
    const selectors = siteSelectors[domain] || [];
    domainInput.value = domain;
    selectorsInput.value = selectors.join('\n');
    showError('');
    enterEditMode();
    domainInput.focus();
  });
}

function deleteSettings(domain) {
  if (!confirm(`Delete all saved settings for ${domain}?`)) return;
  chrome.storage.sync.get(
    ['siteSelectors', 'siteKeep', 'siteHighlight', 'siteOptions'],
    (data) => {
      const siteSelectors = data.siteSelectors || {};
      const siteKeep = data.siteKeep || {};
      const siteHighlight = data.siteHighlight || {};
      const siteOptions = data.siteOptions || {};
      delete siteSelectors[domain];
      delete siteKeep[domain];
      delete siteHighlight[domain];
      delete siteOptions[domain];
      chrome.storage.sync.set(
        { siteSelectors, siteKeep, siteHighlight, siteOptions },
        loadCurrentSettings
      );
    }
  );
}

function resetToDefault(domain, defaultSettings) {
  if (!defaultSettings[domain]) return;
  chrome.storage.sync.get('siteSelectors', (data) => {
    const siteSelectors = data.siteSelectors || {};
    siteSelectors[domain] = defaultSettings[domain];
    chrome.storage.sync.set({ siteSelectors }, loadCurrentSettings);
  });
}

function enterEditMode() {
  saveBtn.style.display = 'none';
  updateBtn.style.display = 'inline-flex';
  cancelBtn.style.display = 'inline-flex';
}

function exitEditMode() {
  domainInput.value = '';
  selectorsInput.value = '';
  showError('');
  saveBtn.style.display = 'inline-flex';
  updateBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

loadCurrentSettings();
