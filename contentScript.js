(function() {
    // Define the selectors of the elements to hide
    const elementsToHide = [
      '.navbar',  // Example selector, hide the navigation bar
      '.footer',  // Example selector, hide the footer
      '.ads',     // Example selector, hide advertisements
    ];

    console.log("executing script");
  
    // Hide each element using CSS
    elementsToHide.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.style.display = 'none';
      });
    });
  
    // Automatically trigger the print dialog
    // window.print();
  })();