document.getElementById('printBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: cleanupAndPrint,
    });
  });
  
  function cleanupAndPrint() {
    const hostname = window.location.hostname.replace(/^www\./, '');
  
    chrome.storage.sync.get('siteSelectors', (data) => {
      const siteSelectors = data.siteSelectors || {};
      console.log("siteSelectors", siteSelectors);
      console.log("hostname", hostname);
      console.log("siteSelectors[hostname]", siteSelectors[hostname]);
      const selectors = siteSelectors[hostname];
  
      if (selectors && selectors.length > 0) {
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(element => {
            element.style.display = 'none';
          });
        });
  
        window.print();  // Trigger the print dialog after cleanup
      } else {
        alert('No specific cleanup configured for this site.');
      }
    });
  }
