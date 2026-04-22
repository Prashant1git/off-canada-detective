// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "searchOFF") {
        
        // Your fetch logic to the Open Food Facts API
        const apiUrl = `https://ca.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(request.query)}&search_simple=1&action=process&json=1`;
        
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                // Send the actual data back to content.js
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error("API Error:", error);
                sendResponse({ success: false, error: error });
            });

        // 👇 THIS IS THE MAGIC LINE YOU NEED 👇
        // It tells Chrome to keep the message port open asynchronously 
        // until sendResponse() is called inside the .then() block.
        return true; 
    }
});