// Load default settings from JSON file when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    fetch(chrome.runtime.getURL('defaultSettings.json'))
      .then(response => response.json())
      .then(defaultSettings => {
        // Check existing settings
        chrome.storage.sync.get('siteSelectors', (data) => {
          const userSettings = data.siteSelectors || {};
          const mergedSettings = { ...defaultSettings };
  
          // Merge default settings with user settings, without overriding
          for (const domain in userSettings) {
            if (userSettings.hasOwnProperty(domain)) {
              mergedSettings[domain] = userSettings[domain]; // Keep user settings
            }
          }
  
          // Save merged settings
          chrome.storage.sync.set({ siteSelectors: mergedSettings }, () => {
            console.log('Default settings have been initialized without overriding user settings.');
          });
        });
      })
      .catch(error => console.error('Failed to load default settings:', error));
  });