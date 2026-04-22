// content.js
console.log("🕵️ OFF Detective extension loaded on this page!");

function extractProductSchema() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let productData = null;
    scripts.forEach(script => {
        try {
            const json = JSON.parse(script.innerText);
            const schemas = Array.isArray(json) ? json : (json['@graph'] || [json]);
            schemas.forEach(schema => {
                if (schema['@type'] === 'Product') {
                    productData = {
                        name: schema.name || '',
                        brand: schema.brand ? (schema.brand.name || schema.brand) : '',
                    };
                }
            });
        } catch (e) {}
    });
    return productData;
}

function injectUpgradedBadge(productData) {
  const oldBadge = document.getElementById('off-upgraded-badge');
  if (oldBadge) oldBadge.remove();

  const host = document.createElement('div');
  host.id = 'off-upgraded-badge';
  const shadowRoot = host.attachShadow({ mode: 'open' });

  shadowRoot.innerHTML = `
    <style>
      .off-widget-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        width: 320px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid rgba(0, 0, 0, 0.05);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #333333;
        opacity: 0;
        transform: translateY(20px);
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        cursor: grab;
        user-select: none;
      }
      .off-widget-container:active { cursor: grabbing; }

      @keyframes slideUp {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .off-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .off-score-badge {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 9999px;
        font-weight: bold;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .score-A, .score-a { background-color: #038141; color: white; }
      .score-B, .score-b { background-color: #85BB2F; color: white; }
      .score-C, .score-c { background-color: #FECB02; color: #333; }
      .score-D, .score-d { background-color: #EE8100; color: white; }
      .score-E, .score-e { background-color: #E63E11; color: white; }
      .score-UNKNOWN, .score-unknown { background-color: #9ca3af; color: white; }

      .off-info {
        font-size: 13px;
        line-height: 1.5;
        color: #4B5563;
        margin: 0;
      }

      .off-close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #9CA3AF;
        font-size: 18px;
        padding: 0;
        transition: color 0.2s;
      }

      .off-close-btn:hover {
        color: #374151;
      }
    </style>

    <div class="off-widget-container" id="draggable-card">
      <div class="off-title">
        Open Food Facts
        <button class="off-close-btn" id="close-btn" aria-label="Close">×</button>
      </div>

      <p class="off-info">Detected product: <strong>${productData.brand} ${productData.name}</strong></p>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="off-info">Nutri-Score:</span>
        <span class="off-score-badge score-${productData.nutriScore.toLowerCase()}">${productData.nutriScore}</span>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  const card = shadowRoot.getElementById('draggable-card');
  const closeBtn = shadowRoot.getElementById('close-btn');

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    host.remove();
  });

  // --- DRAG LOGIC ---
  let isDragging = false;
  let offsetX, offsetY;

  card.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn || e.target.tagName.toLowerCase() === 'a') return;
    isDragging = true;
    offsetX = e.clientX - card.getBoundingClientRect().left;
    offsetY = e.clientY - card.getBoundingClientRect().top;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    card.style.bottom = 'auto';
    card.style.right = 'auto';
    card.style.left = `${e.clientX - offsetX}px`;
    card.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function searchOpenFoodFacts(product) {
    if (!product || (!product.name)) return;
    
    let cleanName = product.name.split(',')[0].replace(/Family Size|Format Familial|[0-9]+g/gi, '').trim();
    const query1 = `${product.brand} ${cleanName}`.trim();
    const query2 = `${product.brand} ${cleanName.split(' ').slice(0, 3).join(' ')}`.trim();
    const query3 = product.brand || "Nutella"; 
    
    console.log(`🔍 Search Pass 1: "${query1}"`);
    
    chrome.runtime.sendMessage({ action: "searchOFF", query: query1 }, (res1) => {
        if (isValidMatch(res1)) return handleSuccessfulMatch(res1.data.products, query1);
        
        console.log(`⚠️ Pass 1 failed. Triggering Pass 2: "${query2}"...`);
        chrome.runtime.sendMessage({ action: "searchOFF", query: query2 }, (res2) => {
            if (isValidMatch(res2)) return handleSuccessfulMatch(res2.data.products, query2);
            
            console.log(`⚠️ Pass 2 failed. Triggering Pass 3 (Brand Only): "${query3}"...`);
            chrome.runtime.sendMessage({ action: "searchOFF", query: query3 }, (res3) => {
                if (isValidMatch(res3)) return handleSuccessfulMatch(res3.data.products, query3);
                
                console.log("❌ All passes failed. Injecting UNKNOWN.");
                injectUpgradedBadge({
                    nutriScore: 'UNKNOWN',
                    nova: '?',
                    brand: product.brand || 'Unknown',
                    name: cleanName,
                    offLink: `https://ca.openfoodfacts.org`
                }); 
            });
        });
    });
}

// 🐛 FIX 2: STRICTER MATCHING LOGIC
// We now filter out products that return "unknown" or "not-applicable"
function isValidMatch(response) {
    if (!response || !response.success || !response.data || !response.data.products) return false;
    // Check if at least one product has a REAL grade (a, b, c, d, e)
    return response.data.products.some(p => 
        p.nutriscore_grade && 
        p.nutriscore_grade !== 'unknown' && 
        p.nutriscore_grade !== 'not-applicable'
    );
}

function handleSuccessfulMatch(products, fallbackName) {
    // 🐛 FIX 2 (cont): Find the FIRST product in the array that has a REAL grade
    const bestMatch = products.find(p => 
        p.nutriscore_grade && 
        p.nutriscore_grade !== 'unknown' && 
        p.nutriscore_grade !== 'not-applicable'
    ) || products[0]; 

    const score = bestMatch.nutriscore_grade ? bestMatch.nutriscore_grade.toUpperCase() : 'UNKNOWN';
    
    console.log("✅ Match found!", score);
    injectUpgradedBadge({
        nutriScore: score,
        nova: bestMatch.nova_group || '?',         
        brand: bestMatch.brands || 'Unknown Brand',
        name: bestMatch.product_name || fallbackName, 
        offLink: bestMatch.url || `https://ca.openfoodfacts.org`
    });
}

function fallbackBarcodeSearch() {
  const barcodeRegex = /(?:GTIN|UPC|EAN|Barcode)?[\s#:-]*\b(\d{12,14})\b/i;
  const pageText = document.body.innerText;
  const match = pageText.match(barcodeRegex);
  if (match && match[1]) {
    console.log("🕵️ Detective Engine Fallback: Extracted Barcode ->", match[1]);
    return match[1];
  }
  return null;
}

function extractFromJsonLD() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let barcode = null;
  scripts.forEach(script => {
    try {
      const json = JSON.parse(script.innerText);
      const schemas = Array.isArray(json) ? json : (json['@graph'] || [json]);
      schemas.forEach(schema => {
        if (schema.gtin || schema.gtin12 || schema.gtin13 || schema.gtin14) {
          barcode = schema.gtin || schema.gtin12 || schema.gtin13 || schema.gtin14;
        }
      });
    } catch (e) {}
  });
  return barcode;
}

function fetchProductFromOFF(barcode) {
  if (!barcode) return;
  console.log(`📦 Fetching Open Food Facts via barcode: ${barcode}`);

  chrome.runtime.sendMessage({ action: "searchOFF", query: barcode }, (response) => {
    if (isValidMatch(response)) {
      return handleSuccessfulMatch(response.data.products, barcode);
    }
    console.log("⚠️ Barcode lookup did not return a valid match. Falling back to schema search.");
    const hiddenData = extractProductSchema();
    if (hiddenData) {
      searchOpenFoodFacts(hiddenData);
    }
  });
}

// ==========================================
// 🥷 FIX: PASSIVE DETECTIVE ENGINE
// ==========================================

function runDetectivePassively() {
    console.log("🕵️ Detective Engine: Waiting silently for Walmart to render...");

    // 1. Give Walmart 1.5 seconds to do its thing completely uninterrupted.
    setTimeout(() => {
        let barcode = extractFromJsonLD();

        if (barcode) {
            console.log(`✅ Target Acquired via JSON-LD: ${barcode}`);
            fetchProductFromOFF(barcode);
        } else {
            console.log("⚠️ JSON-LD not ready. Waiting 2 more seconds...");
            
            // 2. Try one final time 2 seconds later. If it fails, run the fallback ONCE.
            setTimeout(() => {
                barcode = extractFromJsonLD();
                if (barcode) {
                    console.log(`✅ Target Acquired via JSON-LD (Attempt 2): ${barcode}`);
                    fetchProductFromOFF(barcode);
                } else {
                    console.log("⚠️ JSON-LD missing entirely. Running Regex fallback ONE TIME...");
                    barcode = fallbackBarcodeSearch();
                    if (barcode) {
                        fetchProductFromOFF(barcode);
                    } else {
                        console.log("❌ Product details unavailable. Falling back to schema extraction.");
                        const hiddenData = extractProductSchema();
                        if (hiddenData) searchOpenFoodFacts(hiddenData);
                    }
                }
            }, 2000);
        }
    }, 1500);
}

function startDetectiveEngine() {
    const oldBadge = document.getElementById('off-upgraded-badge');
    if (oldBadge) oldBadge.remove();

    if (location.href.includes('/ip/') || location.href.includes('/pr/')) {
        runDetectivePassively();
    } else {
        console.log("🛑 Not a product page. Detective Engine sleeping.");
    }
}

// 1. Run once on initial page load
startDetectiveEngine();

// 2. PASSIVE SPA ROUTER (Zero-Bloat, Zero-Loop)
// Single Page Applications almost always change the <title> tag when you click a new product.
// We attach a passive observer to the title. No more setInterval loops!
let lastUrl = location.href;
const titleObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("🔄 Navigation detected passively! Restarting engine...");
        startDetectiveEngine();
    }
});

// Start observing the <title> tag for changes
const titleNode = document.querySelector('title');
if (titleNode) {
    titleObserver.observe(titleNode, { subtree: true, characterData: true, childList: true });
}

// Check if __NEXT_DATA__ is already present on initial load
const initialNextDataScript = document.getElementById('__NEXT_DATA__');
if (initialNextDataScript && (location.href.includes('/ip/') || location.href.includes('/pr/'))) {
    // Process immediately if on product page
    try {
        const nextData = JSON.parse(initialNextDataScript.textContent);
        const productInfo = nextData?.props?.pageProps?.initialData?.product;
        if (productInfo) {
            const productData = {
                name: productInfo.product_name || productInfo.name || '',
                brand: productInfo.brand || productInfo.brands || '',
            };
            const barcode = productInfo.upc || productInfo.gtin || productInfo.barcode;
            if (barcode) {
                fetchProductFromOFF(barcode);
            } else {
                searchOpenFoodFacts(productData);
            }
        }
    } catch (error) {
        console.error("Failed to parse initial __NEXT_DATA__ JSON:", error);
    }
}

// MutationObserver for __NEXT_DATA__
const observerCallback = (mutationsList, observer) => {
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
        console.log("🎯 __NEXT_DATA__ detected! CAPTCHA solved or page loaded.");
        observer.disconnect();
        try {
            const nextData = JSON.parse(nextDataScript.textContent);
            console.log("Raw Next.js Payload:", nextData);
            const productInfo = nextData?.props?.pageProps?.initialData?.product;
            if (productInfo && (location.href.includes('/ip/') || location.href.includes('/pr/'))) {
                const productData = {
                    name: productInfo.product_name || productInfo.name || '',
                    brand: productInfo.brand || productInfo.brands || '',
                };
                const barcode = productInfo.upc || productInfo.gtin || productInfo.barcode;
                if (barcode) {
                    fetchProductFromOFF(barcode);
                } else {
                    searchOpenFoodFacts(productData);
                }
            }
        } catch (error) {
            console.error("Failed to parse the __NEXT_DATA__ JSON:", error);
        }
    }
};

const observer = new MutationObserver(observerCallback);

const observerOptions = { 
    childList: true,
    subtree: true
};

console.log("👀 Starting observer to watch for __NEXT_DATA__...");
observer.observe(document.documentElement, observerOptions);