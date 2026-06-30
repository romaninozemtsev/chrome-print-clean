importScripts('shared.js');

const CONTEXT_MENU_ID = 'clean-print';

// Merge bundled default selectors into stored settings without overriding
// anything the user has customized.
function initDefaultSettings() {
  fetch(chrome.runtime.getURL('defaultSettings.json'))
    .then((response) => response.json())
    .then((defaultSettings) => {
      chrome.storage.sync.get('siteSelectors', (data) => {
        const mergedSettings = mergeSettings(
          defaultSettings,
          data.siteSelectors
        );
        chrome.storage.sync.set({ siteSelectors: mergedSettings });
      });
    })
    .catch((error) => console.error('Failed to load default settings:', error));
}

function cleanPrintTab(tab) {
  if (!tab || !tab.id) return;
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ['shared.js', 'printClean.js'],
    })
    .catch((error) => console.error('Cannot run on this page:', error));
}

function previewTab(tab) {
  if (!tab || !tab.id) return;
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ['shared.js', 'printPreview.js'],
    })
    .catch((error) => console.error('Cannot run on this page:', error));
}

// Clicking the toolbar icon opens the interactive preview (no popup).
chrome.action.onClicked.addListener((tab) => previewTab(tab));

// The preview overlay asks the worker to open the advanced options page.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'open-options') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  initDefaultSettings();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Clean up and print',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    cleanPrintTab(tab);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'clean-print') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      previewTab(tab);
    });
  }
});
