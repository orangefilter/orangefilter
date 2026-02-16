(() => {
  "use strict";

  // ============================================
  // EXPANDED KEYWORDS (keeps chat working)
  // ============================================
  
  const EXTRA_KEYWORDS = [
    "donald trump",
    "president trump", 
    "former president trump",
    "trump administration",
    "mar-a-lago",
    "truth social"
  ];

  // ============================================
  // BASIC SETUP
  // ============================================

  const DEFAULT_CONFIG = {
    version: 2,
    settings: {
      enabledGlobal: true,
      sensitivity: "balanced",
      aiMode: "mobilenet",
      aiConsent: false
    },
    lists: {
      whitelist: ["example.com"],
      userKeywords: ["trump"]
    }
  };

  async function loadConfig() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return DEFAULT_CONFIG;
    }
    
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) {
            console.warn("Storage error:", chrome.runtime.lastError.message);
            return resolve(DEFAULT_CONFIG);
          }
          
          resolve({
            ...DEFAULT_CONFIG,
            ...result,
            settings: { ...DEFAULT_CONFIG.settings, ...result.settings || {} },
            lists: { ...DEFAULT_CONFIG.lists, ...result.lists || {} }
          });
        });
      } catch (error) {
        console.warn("Failed to access storage:", error.message);
        resolve(DEFAULT_CONFIG);
      }
    });
  }

  async function updateStats(increment = 1) {
    try {
      const config = await loadConfig();
      const blockedCount = (config.stats?.blockedCount || 0) + increment;
      
      await chrome.storage.local.set({
        ...config,
        stats: {
          ...config.stats,
          blockedCount,
          lastUpdate: Date.now()
        }
      });
    } catch (error) {
      console.error("Failed to update stats:", error);
    }
  }

  // ============================================
  // ENHANCED SELECTORS (includes Watch pages)
  // ============================================

  const CONTAINER_SELECTORS = [
    "article",
    ".card",
    ".teaser",
    ".story",
    ".sidebar",
    ".post",
    ".content-item",
    'div[role="article"]',
    'div[role="listitem"]',
    ".g",
    ".b_algo",
    
    // Facebook Watch pages - NEW
    'div[data-pagelet="WatchPermalinkVideo"]',
    'div[data-pagelet="VideoMetadata"]',
    'div[data-pagelet="TahoeRightRail"]',
    'div[data-pagelet="TahoeRightRailRecommendations"]'
  ];

  // ============================================
  // FILTERING LOGIC
  // ============================================

  function matchesKeywords(element, keywords) {
    if (!keywords || keywords.length === 0) return false;
    const text = (element.innerText || element.textContent || "").toLowerCase();
    return keywords.some(keyword => {
      if (!keyword) return false;
      return text.includes(keyword.toLowerCase());
    });
  }

  function getImageContext(img) {
    let context = (img.alt || "") + " " + (img.title || "");
    
    const link = img.closest("a");
    if (link) {
      context += " " + (link.innerText || link.textContent || "");
    }
    
    const figure = img.closest("figure");
    if (figure) {
      const caption = figure.querySelector("figcaption");
      if (caption) {
        context += " " + (caption.innerText || caption.textContent || "");
      }
    }
    
    return context.trim();
  }

  function hideElement(element, reason) {
    if (element.tagName === "IMG") {
      const placeholder = createPlaceholder(element, reason);
      element.parentNode.insertBefore(placeholder, element);
      element.style.display = "none";
    } else {
      element.style.display = "none";
    }
    
    element.dataset.orangeFilterHidden = "true";
    console.log(`Orange Filter: Hidden element (${reason})`);
    updateStats(1);
  }

  function createPlaceholder(img, reason) {
    const placeholder = document.createElement("div");
    placeholder.className = "orange-filter-placeholder";
    placeholder.title = `Filtered: ${reason}`;
    
    const style = window.getComputedStyle(img);
    const width = img.naturalWidth || img.width || parseInt(style.width);
    const height = img.naturalHeight || img.height || parseInt(style.height);
    
    placeholder.style.width = style.width !== "0px" ? style.width : (width ? width + "px" : "100%");
    
    if (width && height) {
      placeholder.style.aspectRatio = `${width} / ${height}`;
      placeholder.style.height = "auto";
    } else {
      placeholder.style.height = style.height !== "0px" ? style.height : "150px";
    }
    
    placeholder.style.display = style.display === "inline" ? "inline-block" : style.display;
    placeholder.style.backgroundColor = "#f4f4f4";
    placeholder.style.backgroundImage = "linear-gradient(45deg, #f4f4f4 25%, #eeeeee 25%, #eeeeee 50%, #f4f4f4 50%, #f4f4f4 75%, #eeeeee 75%, #eeeeee 100%)";
    placeholder.style.backgroundSize = "20px 20px";
    placeholder.style.border = "1px solid #ddd";
    placeholder.style.color = "#888";
    placeholder.style.display = "flex";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.fontSize = "11px";
    placeholder.style.fontWeight = "500";
    placeholder.style.fontFamily = "system-ui, -apple-system, sans-serif";
    placeholder.style.textAlign = "center";
    placeholder.style.overflow = "hidden";
    placeholder.style.cursor = "pointer";
    placeholder.style.flexDirection = "column";
    placeholder.style.gap = "4px";
    
    const text = document.createElement("div");
    text.textContent = "Filtered Content (Click to show)";
    placeholder.appendChild(text);
    
    const report = document.createElement("div");
    report.textContent = "Report False Positive";
    report.style.fontSize = "9px";
    report.style.textDecoration = "underline";
    report.style.opacity = "0.7";
    
    report.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log(`Orange Filter: False positive reported - ${img.src || img.currentSrc}`);
      placeholder.click();
      alert("Thank you for your report!");
    });
    
    placeholder.appendChild(report);
    
    placeholder.addEventListener("click", (e) => {
      e.stopPropagation();
      placeholder.remove();
      img.style.display = "";
      img.dataset.orangeFilterHidden = "false";
      img.dataset.orangeFilterRevealed = "true";
    });
    
    return placeholder;
  }

  async function filterContent(keywords, settings = {}, extraSelectors = []) {
    if (!keywords || keywords.length === 0) return;
    
    // Merge user keywords with extra keywords
    const allKeywords = [...keywords, ...EXTRA_KEYWORDS];
    
    // Filter text content (if not pictures-only mode)
    if (settings.sensitivity !== "pictures-only") {
      const selectors = [...CONTAINER_SELECTORS, ...extraSelectors];
      const containers = document.querySelectorAll(selectors.join(", "));
      
      containers.forEach(container => {
        if (container.dataset.orangeFilterHidden === "true") return;
        
        if (matchesKeywords(container, allKeywords)) {
          hideElement(container, "Text match");
          
          // Try to hide larger parent containers that might contain videos/content
          const mainContainer = container.closest('[role="main"], main, .main-content, [data-testid="article"]');
          if (mainContainer && mainContainer !== container && !mainContainer.dataset.orangeFilterHidden) {
            // Check if parent also contains matching keywords (to avoid hiding unrelated content)
            if (matchesKeywords(mainContainer, allKeywords)) {
              hideElement(mainContainer, "Parent container match");
            }
          }
        }
      });
    }
    
    // Filter images
    const images = document.querySelectorAll('img:not([data-orange-filter-hidden="true"]):not([data-orange-filter-revealed="true"])');
    const imagesToScan = [];
    
    images.forEach(img => {
      if (img.closest('[data-orange-filter-hidden="true"]')) return;
      
      const context = getImageContext(img);
      if (allKeywords.some(kw => context.toLowerCase().includes(kw.toLowerCase()))) {
        hideElement(img, "Image context match");
        return;
      }
      
      if (settings.aiMode && settings.aiMode !== "none" && settings.aiConsent) {
        if (!img.dataset.orangeFilterScanning) {
          imagesToScan.push(img);
        }
      }
    });
    
    if (imagesToScan.length > 0) {
      await scanImagesWithAI(imagesToScan, settings);
    }
  }

  async function scanImagesWithAI(images, settings) {
    const queue = [...images];
    
    const scanNext = async () => {
      if (queue.length === 0) return;
      
      const img = queue.shift();
      if (img.dataset.orangeFilterScanning || img.width < 50 || img.height < 50) {
        return scanNext();
      }
      
      const imgSrc = img.currentSrc || img.src;
      if (!imgSrc) return scanNext();
      
      img.dataset.orangeFilterScanning = "true";
      
      try {
        let payload = { url: imgSrc, sensitivity: settings.sensitivity };
        let blob = null;
        
        if (imgSrc.startsWith("data:")) {
          const response = await fetch(imgSrc);
          blob = await response.blob();
        } else {
          try {
            const base64 = await imageToBase64(img);
            if (base64) {
              payload.data = base64;
              payload.type = "base64";
            }
          } catch (e) {
            blob = await fetchImageBlob(imgSrc);
          }
        }
        
        if (!payload.data && blob) {
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          payload.data = base64;
          payload.type = "base64";
        }
        
        const result = await chrome.runtime.sendMessage({
          target: "background",
          type: "CHECK_IMAGE",
          data: payload
        });
        
        if (result && result.success) {
          const confidence = Math.round(result.confidence * 100);
          
          if (result.isBlocked) {
            hideElement(img, `AI detected (${confidence}%)`);
          } else if (result.confidence > 0.65) {
            blurElement(img, `AI low confidence (${confidence}%)`);
          }
        }
      } catch (error) {
        console.error("Error scanning image:", error);
      } finally {
        delete img.dataset.orangeFilterScanning;
        scanNext();
      }
    };
    
    // Scan 3 at a time
    for (let i = 0; i < 3 && i < images.length; i++) {
      scanNext();
    }
  }

  function blurElement(element, reason) {
    element.style.filter = "blur(20px)";
    element.style.cursor = "pointer";
    element.title = `Filtered: ${reason} (Click to show)`;
    element.dataset.orangeFilterHidden = "true";
    
    const clickHandler = function(e) {
      e.stopPropagation();
      element.style.filter = "";
      element.style.cursor = "";
      element.title = "";
      element.dataset.orangeFilterHidden = "false";
      element.dataset.orangeFilterRevealed = "true";
      element.removeEventListener("click", clickHandler);
    };
    
    element.addEventListener("click", clickHandler);
    console.log(`Orange Filter: Blurred element (${reason})`);
    updateStats(1);
  }

  async function imageToBase64(img) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (img.complete || await img.decode().catch(() => {})) {
            if (img.naturalWidth === 0) return resolve(null);
            
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg"));
          }
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  async function fetchImageBlob(url) {
    try {
      const response = await fetch(url);
      return response.ok ? await response.blob() : null;
    } catch (error) {
      console.warn("Content Script fetch failed:", url);
      return null;
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  let userKeywords = [];
  let observer = null;

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        clearTimeout(timeout);
        func(...args);
      }, wait);
    };
  }

  async function init() {
    try {
      const config = await loadConfig();
      const hostname = window.location.hostname;
      
      if (config.settings.enabledGlobal === false || 
          config.lists.whitelist.includes(hostname)) {
        console.log("Orange Filter: Disabled for this site");
        return;
      }
      
      userKeywords = config.lists.userKeywords;
      
      if (userKeywords.length > 0) {
        await filterContent(userKeywords, config.settings);
        
        observer = new MutationObserver(
          debounce(() => filterContent(userKeywords, config.settings), 500)
        );
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    } catch (error) {
      if (error.message.includes("Extension context invalidated")) {
        console.log("Orange Filter: Context invalidated. Please refresh.");
      } else {
        console.error("Orange Filter Init Error:", error);
      }
    }
  }

  window.addEventListener("pagehide", () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });

  init();
})();