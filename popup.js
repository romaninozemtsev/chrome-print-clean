document.getElementById('printBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: cleanupAndPrint,
    });
  });
  
  function cleanupAndPrint() {
    function cleanupGmail() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check if we are in printable view
        const isPrintableView = urlParams.get('view') === 'pt';
        
        if (isPrintableView) {
          // Step 1: Find the main content element by class "maincontent"
          const mainContentElement = document.querySelector('.maincontent');
          
          if (mainContentElement) {
            // Add 'hide-during-print' class to all sibling elements of "maincontent"
            Array.from(mainContentElement.parentElement.children).forEach((sibling) => {
              if (sibling !== mainContentElement) {
                sibling.classList.add('hide-during-print'); // Hide sibling elements during print
              }
            });
      
            // Step 2: Inside "maincontent", find the table with class "message"
            const messageTable = mainContentElement.querySelector('table.message');
            
            if (messageTable) {
              // Add 'hide-during-print' class to all sibling elements of the "message" table
              Array.from(messageTable.parentElement.children).forEach((sibling) => {
                if (sibling !== messageTable) {
                  sibling.classList.add('hide-during-print'); // Hide sibling elements during print
                }
              });
      
              // Step 3: Inside the "message" table, hide the first 2 rows of tbody
              const tbody = messageTable.querySelector('tbody');
              
              if (tbody) {
                const rows = Array.from(tbody.rows);
                if (rows.length > 1) {
                  rows[0].classList.add('hide-during-print'); // Hide the first row during print
                }
                if (rows.length > 2) {
                  rows[1].classList.add('hide-during-print'); // Hide the second row during print
                }
              }
            }
          }
        } else {
          // Non-printable view: Hide all siblings of the main content as before
          let currentElement = document.querySelector('[role="main"]');
      
          if (currentElement) {
            // Traverse up the DOM tree until reaching the <body> element
            while (currentElement && currentElement.tagName !== 'BODY') {
              const parent = currentElement.parentElement;
      
              // Add 'hide-during-print' class to all sibling elements of the current element
              Array.from(parent.children).forEach((sibling) => {
                if (sibling !== currentElement) {
                  sibling.classList.add('hide-during-print'); // Hide sibling elements during print
                }
              });
      
              // Move up to the parent for the next iteration
              currentElement = parent;
            }
          }
        }
      
        // Add CSS to hide elements during printing
        addPrintStyles();
      }
      
      function addPrintStyles() {
        const style = document.createElement('style');
        style.textContent = `
          @media print {
            .hide-during-print {
              display: none !important;
            }
          }
        `;
        document.head.appendChild(style);
      }
  
    const hostname = window.location.hostname.replace(/^www\./, '');
  
    if (hostname === 'mail.google.com') {
      cleanupGmail();
      window.print(); // Trigger the print dialog after cleanup
      return;
    }
  
    chrome.storage.sync.get('siteSelectors', (data) => {
      const siteSelectors = data.siteSelectors || {};
      const selectors = siteSelectors[hostname];
  
      if (selectors && selectors.length > 0) {
        // Add CSS to hide elements based on selectors during printing
        const style = document.createElement('style');
        style.textContent = `
          @media print {
            ${selectors.map(selector => `${selector} { display: none !important; }`).join(' ')}
          }
        `;
        document.head.appendChild(style);
  
        window.print(); // Trigger the print dialog after cleanup
      } else {
        window.print(); // Trigger the print dialog without cleanup
      }
    });
  }