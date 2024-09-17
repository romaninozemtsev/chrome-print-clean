document.getElementById('saveBtn').addEventListener('click', saveSettings);
document.getElementById('updateBtn').addEventListener('click', updateSettings);

function saveSettings() {
  let domain = document.getElementById('domain').value.trim();
  const selectors = document.getElementById('selectors').value.trim();

  if (domain && selectors) {
    // Normalize the domain to remove 'www.' if it exists
    domain = domain.replace(/^www\./, '');

    // Get existing settings
    chrome.storage.sync.get('siteSelectors', (data) => {
      const siteSelectors = data.siteSelectors || {};
      
      // Save the new selectors for the domain
      siteSelectors[domain] = selectors.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      
      chrome.storage.sync.set({ siteSelectors }, () => {
        alert('Settings saved!');
        loadCurrentSettings();
        clearInputs();
      });
    });
  } else {
    alert('Please enter both domain and selectors.');
  }
}

function loadCurrentSettings() {
  chrome.storage.sync.get('siteSelectors', (data) => {
    const siteSelectors = data.siteSelectors || {};
    const settingsDiv = document.getElementById('currentSettings');
    settingsDiv.innerHTML = '';

    // Load default settings from JSON file to determine if reset is needed
    fetch(chrome.runtime.getURL('defaultSettings.json'))
      .then(response => response.json())
      .then(defaultSettings => {
        for (const domain in siteSelectors) {
          const selectors = siteSelectors[domain].join('<br>');
          const domainEntry = document.createElement('div');
          domainEntry.classList.add('domain-entry');
          domainEntry.innerHTML = `
            <strong>${domain}:</strong><br>${selectors}<br>
            <button class="editBtn" data-domain="${domain}">Edit</button>
            ${
              defaultSettings[domain]
                ? `<button class="resetBtn" data-domain="${domain}">Reset to Default</button>`
                : ''
            }
          `;
          settingsDiv.appendChild(domainEntry);
        }

        // Attach event listeners to the new edit and reset buttons
        document.querySelectorAll('.editBtn').forEach(button => {
          button.addEventListener('click', () => editSettings(button.getAttribute('data-domain')));
        });

        document.querySelectorAll('.resetBtn').forEach(button => {
          button.addEventListener('click', () => resetToDefault(button.getAttribute('data-domain')));
        });
      });
});
}

function editSettings(domain) {
  // Normalize the domain to remove 'www.' if it exists
  const normalizedDomain = domain.replace(/^www\./, '');

  chrome.storage.sync.get('siteSelectors', (data) => {
    const siteSelectors = data.siteSelectors || {};
    const selectors = siteSelectors[normalizedDomain] || [];

    // Populate the input fields with the current settings
    document.getElementById('domain').value = normalizedDomain;
    document.getElementById('selectors').value = selectors.join('\n');

    // Show the Update button and hide the Save button
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('updateBtn').style.display = 'inline-block';
  });
}

function updateSettings() {
  const domain = document.getElementById('domain').value.trim().replace(/^www\./, '');
  const selectors = document.getElementById('selectors').value.trim();

  if (domain && selectors) {
    // Get existing settings
    chrome.storage.sync.get('siteSelectors', (data) => {
      const siteSelectors = data.siteSelectors || {};
      
      // Update the selectors for the domain
      siteSelectors[domain] = selectors.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      
      chrome.storage.sync.set({ siteSelectors }, () => {
        alert('Settings updated!');
        loadCurrentSettings();
        clearInputs();
        
        // Show the Save button and hide the Update button
        document.getElementById('saveBtn').style.display = 'inline-block';
        document.getElementById('updateBtn').style.display = 'none';
      });
    });
  } else {
    alert('Please enter both domain and selectors.');
  }
}

function resetToDefault(domain) {
  fetch(chrome.runtime.getURL('defaultSettings.json'))
    .then(response => response.json())
    .then(defaultSettings => {
      if (defaultSettings[domain]) {
        chrome.storage.sync.get('siteSelectors', (data) => {
          const siteSelectors = data.siteSelectors || {};

          // Reset to default settings
          siteSelectors[domain] = defaultSettings[domain];
          chrome.storage.sync.set({ siteSelectors }, () => {
            alert(`Settings for ${domain} have been reset to default.`);
            loadCurrentSettings();
          });
        });
      }
    });
}

function clearInputs() {
  document.getElementById('domain').value = '';
  document.getElementById('selectors').value = '';
}

// Load current settings on page load
loadCurrentSettings();