(function () {
  "use strict";

  var API_BASE_KEY = "radios-api-base";
  var API_BASE = resolveInitialApiBase();
  var CART_KEY = "radios-cart";
  var CUSTOMER_KEY = "radios-customer";
  var WISHLIST_SESSION_KEY = "radios_session_id";
  var WISHLIST_AUTH_MIGRATION_KEY = "radios_wishlist_auth_migration";
  var WISHLIST_FALLBACK_KEY = "radios-wishlist";
  var INVENTORY_SESSION_KEY = "radios_inventory_session_id";
  var ABANDONED_CART_SESSION_KEY = "radios_abandoned_cart_session_id";
  var ANALYTICS_SESSION_KEY = "radios_analytics_session_id";
  var APPLIED_DISCOUNT_KEY = "radios-applied-discount-code";
  var SEARCH_SESSION_KEY = "radios_search_session_id";
  var RECENTLY_VIEWED_KEY = "radios_recently_viewed";
  var IMAGE_PLACEHOLDER = "assets/img/product/img_165.png";
  var CATEGORY_TAG_PREFIX = "__category:";
  var SUBCATEGORY_TAG_PREFIX = "__subcategory:";
  var SMART_SEARCH_MIN_LENGTH = 2;
  var SMART_SEARCH_DEBOUNCE_MS = 300;
  var SMART_SEARCH_FALLBACK_TERMS = ["Best Sellers", "Earbuds", "Charger", "Baby Care", "Hair Dryer"];
  var PROMOTIONS_CACHE_MS = 60000;
  var CATALOG_CACHE_TTL_MS = 60000;
  var CATEGORIES_CACHE_TTL_MS = 300000;
  var BANNERS_CACHE_TTL_MS = 120000;
  var PRODUCT_LIST_COLUMNS = [
    "id", "title", "name", "slug", "price", "compare_at_price", "image_url", "image", "images",
    "category", "category_slug", "subcategory", "subcategory_slug", "description", "sku", "stock",
    "reserved_stock", "available_stock", "low_stock_threshold", "track_inventory", "allow_backorder",
    "inventory_status", "visible", "is_active", "status", "badges", "tags", "search_keywords",
    "is_hot", "is_best_seller", "is_featured", "is_new", "sales_count", "updated_at", "created_at",
    "meta_title", "meta_description", "canonical_url", "og_image_url", "brand"
  ].join(",");
  var PRODUCT_PAGE_SIZE_DESKTOP = 12;
  var PRODUCT_PAGE_SIZE_MOBILE = 8;
  var PRODUCT_CARD_IMAGE_SIZE = { width: 360, height: 360 };
  var abandonedCartSyncTimer = null;
  var abandonedCartWarningShown = false;
  var promotionsCache = {
    expiresAt: 0,
    items: []
  };
  var memoryCache = {};
  var DEFAULT_CATEGORIES = [
    { name: "Electronics", slug: "electronics", icon: "fas fa-laptop", description: "Wifi cameras, keyboards, speakers, and everyday electronics." },
    { name: "Mobile Accessories", slug: "mobile-accessories", icon: "fas fa-headphones", description: "Chargers, earbuds, headphones, stands, and mobile essentials." },
    { name: "Health Supplements", slug: "health-supplements", icon: "fas fa-capsules", description: "Powders, tablets, liquids, and health support essentials." },
    { name: "Hygiene & Personal Care", slug: "hygiene-personal-care", icon: "fas fa-heart", description: "Personal care, grooming, skincare, and hygiene products." },
    { name: "Baby Products", slug: "baby-products", icon: "fas fa-baby", description: "Gentle baby care products and daily essentials." },
    { name: "Household Items", slug: "household-items", icon: "fas fa-home", description: "Useful household, home care, and utility items." }
  ];

  function uniqueStrings(list) {
    return list.filter(function (value, index) {
      return value && list.indexOf(value) === index;
    });
  }

  function buildApiCandidates() {
    var explicitBase = window.RADIOS_API_BASE;
    var savedBase = localStorage.getItem(API_BASE_KEY);
    var currentOrigin = window.location.origin || "";
    var sameOriginApi = currentOrigin ? currentOrigin.replace(/\/$/, "") + "/api" : "";

    return uniqueStrings([
      explicitBase,
      savedBase,
      "http://localhost:5000/api",
      "http://127.0.0.1:5000/api",
      sameOriginApi,
      "http://localhost:3000/api",
      "http://127.0.0.1:3000/api"
    ]);
  }

  function resolveInitialApiBase() {
    return buildApiCandidates()[0] || "http://localhost:5000/api";
  }

  function rememberApiBase(nextBase) {
    API_BASE = nextBase;
    localStorage.setItem(API_BASE_KEY, nextBase);
  }

  function debugLog() {
    if (window.console && typeof window.console.log === "function") {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[Radios Store]");
      window.console.log.apply(window.console, args);
    }
  }

  function cacheKey(name, suffix) {
    return "radios-cache:" + name + ":" + (suffix || "default");
  }

  function readCache(name, suffix, ttlMs) {
    var key = cacheKey(name, suffix);
    var cached = memoryCache[key];
    var now = Date.now();

    if (!cached) {
      try {
        cached = JSON.parse(sessionStorage.getItem(key) || "null");
      } catch (_error) {
        cached = null;
      }
    }

    if (!cached || !cached.time || now - cached.time > ttlMs) {
      return null;
    }

    memoryCache[key] = cached;
    return cached.value;
  }

  function writeCache(name, suffix, value) {
    var key = cacheKey(name, suffix);
    var cached = { time: Date.now(), value: value };
    memoryCache[key] = cached;

    try {
      sessionStorage.setItem(key, JSON.stringify(cached));
    } catch (_error) {
      // Session storage is best-effort; storefront rendering should never depend on it.
    }

    return value;
  }

  function getListingPageSize() {
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches
      ? PRODUCT_PAGE_SIZE_MOBILE
      : PRODUCT_PAGE_SIZE_DESKTOP;
  }

  function runWhenVisible(element, callback) {
    if (!element || typeof callback !== "function") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      callback();
      return;
    }

    var didRun = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (didRun || !entry.isIntersecting) {
          return;
        }
        didRun = true;
        observer.disconnect();
        callback();
      });
    }, { rootMargin: "220px 0px" });

    observer.observe(element);
  }

  function getProductIdentifier(product) {
    if (!product || typeof product !== "object") {
      return "";
    }

    return product._id || product.id || product.productId || "";
  }

  function getProductSlug(product) {
    if (!product || typeof product !== "object") {
      return "";
    }

    return String(product.slug || product.productSlug || product.handle || "").trim();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function getProductName(product) {
    if (!product || typeof product !== "object") {
      return "Product";
    }

    return product.name || product.title || product.productName || "Product";
  }

  function getDashboardAssetOrigin() {
    var explicitOrigin = window.RADIOS_DASHCODE_ORIGIN || window.RADIOS_ASSET_BASE;
    var explicitApiBase = window.RADIOS_API_BASE;
    var base = explicitOrigin || explicitApiBase || "http://127.0.0.1:3000";

    return String(base)
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");
  }

  function resolveImageUrl(value) {
    var url = "";

    if (typeof value === "string") {
      url = value.trim();
    } else if (value && typeof value === "object") {
      url = String(value.url || value.src || value.image || value.imageUrl || value.image_url || "").trim();
    }

    if (!url) {
      return "";
    }

    if (/^(https?:|data:|blob:|assets\/|\.\/|\.\.\/)/i.test(url)) {
      return url;
    }

    if (url.charAt(0) === "/") {
      return getDashboardAssetOrigin() + url;
    }

    return url;
  }

  function getProductImage(product) {
    if (!product || typeof product !== "object") {
      return "";
    }

    var primaryImage = resolveImageUrl(
      product.image_url ||
      product.imageUrl ||
      product.main_image_url ||
      product.mainImageUrl ||
      product.image ||
      product.img ||
      product.thumbnail ||
      product.thumbnailUrl ||
      product.thumbnail_url ||
      product.featuredImage ||
      product.featured_image
    );

    if (primaryImage) {
      return primaryImage;
    }

    if (Array.isArray(product.images) && product.images.length > 0) {
      var firstImage = resolveImageUrl(product.images[0]);
      if (firstImage) {
        return firstImage;
      }
    }

    return "";
  }

  function getProductGallery(product) {
    if (!product || typeof product !== "object") {
      return [];
    }

    var gallery = Array.isArray(product.images) ? product.images : [];
    var urls = [
      product.image_url,
      product.imageUrl,
      product.main_image_url,
      product.mainImageUrl
    ].concat(gallery, [
      product.image,
      product.img,
      product.thumbnail,
      product.thumbnailUrl,
      product.thumbnail_url,
      product.featuredImage,
      product.featured_image
    ]);

    return uniqueStrings(urls.map(resolveImageUrl).filter(Boolean));
  }

  function normalizeJsonObject(value) {
    if (!value) {
      return {};
    }

    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (error) {
        return {};
      }
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).reduce(function (nextValue, key) {
        var item = value[key];
        if (item !== null && item !== undefined && String(item).trim() !== "") {
          nextValue[key] = item;
        }
        return nextValue;
      }, {});
    }

    return {};
  }

  function normalizeFaqs(value) {
    if (!value) {
      return [];
    }

    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (error) {
        return [];
      }
    }

    if (!Array.isArray(value)) {
      return [];
    }

    return value.map(function (item) {
      if (!item || typeof item !== "object") {
        return null;
      }
      var question = String(item.question || item.q || "").trim();
      var answer = String(item.answer || item.a || "").trim();
      return question && answer ? { question: question, answer: answer } : null;
    }).filter(Boolean);
  }

  function normalizeRelatedProductIds(value) {
    if (!value) {
      return [];
    }

    if (typeof value === "string") {
      value = value.split(",");
    }

    return uniqueStrings((Array.isArray(value) ? value : []).map(function (item) {
      return String(item || "").trim();
    }).filter(Boolean));
  }

  function fetchJson(endpoint, options) {
    var candidates = buildApiCandidates();
    var lastError = null;

    function attempt(index) {
      if (index >= candidates.length) {
        if (lastError) {
          throw lastError;
        }
        throw new Error("API is unavailable");
      }

      var base = candidates[index];
      debugLog("Fetching", base + endpoint);

      return fetch(base + endpoint, options).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            var error = new Error(data.message || "Request failed");
            error.payload = data;
            error.status = response.status;
            throw error;
          }

          rememberApiBase(base);
          return data;
        });
      }).catch(function (error) {
        lastError = error;

        if (error && error.status && error.status !== 404 && error.status !== 405) {
          throw error;
        }

        return attempt(index + 1);
      });
    }

    return attempt(0);
  }

  function buildDashcodeApiCandidates() {
    var explicitBase = window.RADIOS_API_BASE;
    var savedBase = localStorage.getItem(API_BASE_KEY);
    var currentOrigin = window.location.origin || "";
    var sameOriginApi = currentOrigin ? currentOrigin.replace(/\/$/, "") + "/api" : "";

    return uniqueStrings([
      explicitBase,
      "http://127.0.0.1:3000/api",
      "http://localhost:3000/api",
      savedBase,
      API_BASE,
      sameOriginApi,
      "http://localhost:5000/api",
      "http://127.0.0.1:5000/api"
    ]);
  }

  function fetchDashcodeJson(endpoint, options) {
    var candidates = buildDashcodeApiCandidates();
    var lastError = null;

    function attempt(index) {
      if (index >= candidates.length) {
        if (lastError) {
          throw lastError;
        }
        throw new Error("Dashcode API is unavailable");
      }

      var base = candidates[index];
      debugLog("Fetching dashboard catalog", base + endpoint);

      return fetch(base + endpoint, options).then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            var error = new Error(data.message || "Request failed");
            error.payload = data;
            error.status = response.status;
            throw error;
          }

          return data;
        });
      }).catch(function (error) {
        lastError = error;

        if (error && error.status && error.status !== 404 && error.status !== 405) {
          throw error;
        }

        return attempt(index + 1);
      });
    }

    return attempt(0);
  }

  function fetchDashcodeDiscounts() {
    var currentOrigin = window.location.origin || "";
    var sameOriginApi = currentOrigin ? currentOrigin.replace(/\/$/, "") + "/api" : "";
    var candidates = uniqueStrings([
      "http://127.0.0.1:3000/api",
      "http://localhost:3000/api",
      API_BASE,
      localStorage.getItem(API_BASE_KEY),
      "http://localhost:5000/api",
      "http://127.0.0.1:5000/api",
      sameOriginApi
    ]);

    function attempt(index) {
      if (index >= candidates.length) {
        return [];
      }

      var base = candidates[index];
      return fetch(base + "/discounts?active=true")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Discount API unavailable");
          }
          return response.json();
        })
        .then(extractList)
        .catch(function () {
          return attempt(index + 1);
        });
    }

    return attempt(0);
  }

  function fetchSupabaseDiscounts() {
    var client = getSupabaseClient();
    if (!client) {
      return Promise.resolve([]);
    }

    return client
      .from("discounts")
      .select("*")
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return (result.data || []).map(normalizeDiscount).filter(isDiscountActive);
      })
      .catch(function (error) {
        debugLog("Supabase promotions unavailable:", error.message);
        return [];
      });
  }

  function uniqueDiscounts(discounts) {
    var seen = {};
    return (discounts || []).map(normalizeDiscount).filter(function (discount) {
      if (!discount) {
        return false;
      }

      var key = String(discount.id || discount._id || discount.code || discount.title || "").toUpperCase();
      if (!key || seen[key]) {
        return false;
      }

      seen[key] = true;
      return true;
    });
  }

  function fetchStorefrontDiscounts(options) {
    options = options || {};
    var now = Date.now();

    if (!options.force && promotionsCache.expiresAt > now) {
      return Promise.resolve(promotionsCache.items.slice());
    }

    return Promise.all([
      fetchSupabaseDiscounts(),
      fetchDashcodeDiscounts().catch(function () { return []; })
    ]).then(function (results) {
      var discounts = uniqueDiscounts([].concat(results[0] || [], results[1] || [])).filter(isDiscountActive);
      promotionsCache = {
        expiresAt: Date.now() + PROMOTIONS_CACHE_MS,
        items: discounts
      };
      return discounts.slice();
    });
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function categoryUrl(category) {
    return "category.html?slug=" + encodeURIComponent(normalizeCategorySlug(category.slug || category.name));
  }

  function normalizeCategorySlug(value) {
    var raw = String(value || "").trim();
    var match = raw.match(/(?:^|\/)category-([a-z0-9-]+)\.html(?:[?#].*)?$/i) ||
      raw.match(/^category-([a-z0-9-]+)\.html(?:[?#].*)?$/i);

    return slugify(match ? match[1] : raw);
  }

  function normalizeCategoryHref(value) {
    var href = String(value || "").trim();
    var match = href.match(/(?:^|\/)category-([a-z0-9-]+)\.html(?:[?#].*)?$/i);

    if (!match) {
      return href;
    }

    return "category.html?slug=" + encodeURIComponent(slugify(match[1]));
  }

  function normalizeStaticCategoryLinks(scope) {
    var root = scope || document;
    var anchors = [];
    var dataLinkElements = [];

    if (root.matches && root.matches("a[href]")) {
      anchors.push(root);
    }

    if (root.querySelectorAll) {
      anchors = anchors.concat(Array.prototype.slice.call(root.querySelectorAll("a[href]")));
    }

    anchors.forEach(function (anchor) {
      var href = anchor.getAttribute("href") || "";
      var normalized = normalizeCategoryHref(href);
      if (normalized && normalized !== href) {
        anchor.setAttribute("href", normalized);
      }
    });

    if (root.matches && root.matches("[data-link]")) {
      dataLinkElements.push(root);
    }

    if (root.querySelectorAll) {
      dataLinkElements = dataLinkElements.concat(Array.prototype.slice.call(root.querySelectorAll("[data-link]")));
    }

    dataLinkElements.forEach(function (element) {
      var link = element.getAttribute("data-link") || "";
      var normalized = normalizeCategoryHref(link);
      if (normalized && normalized !== link) {
        element.setAttribute("data-link", normalized);
      }
    });
  }

  function setupStaticCategoryLinkGuard() {
    normalizeStaticCategoryLinks();

    document.addEventListener("click", function (event) {
      var anchor = event.target.closest ? event.target.closest("a[href]") : null;
      if (!anchor) {
        return;
      }

      var href = anchor.getAttribute("href") || "";
      var normalized = normalizeCategoryHref(href);
      if (normalized && normalized !== href) {
        anchor.setAttribute("href", normalized);
      }
    }, true);

    if ("MutationObserver" in window) {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
            if (node.nodeType === 1) {
              normalizeStaticCategoryLinks(node);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function isPlaceholderHref(value) {
    var href = String(value || "").trim().toLowerCase();
    return !href || href === "#!" || href === "#" || href === "javascript:void(0)" || href === "javascript:void(0);";
  }

  function getProductUrl(productOrId) {
    if (productOrId && typeof productOrId === "object") {
      var productSlug = getProductSlug(productOrId);
      if (productSlug) {
        return "shop-single.html?slug=" + encodeURIComponent(productSlug);
      }
    }

    var productId = typeof productOrId === "object" ? getProductIdentifier(productOrId) : productOrId;
    return productId ? "shop-single.html?id=" + encodeURIComponent(productId) : "shop-left-sidebar.html";
  }

  function getAbsoluteStorefrontUrl(value) {
    var raw = String(value || "").trim();
    try {
      return new URL(raw || window.location.pathname, window.location.href).href;
    } catch (_error) {
      return window.location.href;
    }
  }

  function cleanSeoText(value) {
    var element = document.createElement("div");
    element.innerHTML = String(value || "");
    return (element.textContent || element.innerText || String(value || ""))
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateSeoText(value, maxLength) {
    var text = cleanSeoText(value);
    var limit = Number(maxLength) || 160;
    if (text.length <= limit) {
      return text;
    }
    return text.slice(0, Math.max(0, limit - 1)).replace(/\s+\S*$/, "") + "...";
  }

  function ensureMetaTag(attributeName, attributeValue, content) {
    if (!document.head || !attributeValue) {
      return;
    }

    var selector = 'meta[' + attributeName + '="' + String(attributeValue).replace(/"/g, '\\"') + '"]';
    var tag = document.head.querySelector(selector);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attributeName, attributeValue);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", String(content || ""));
  }

  function ensureCanonicalLink(url) {
    if (!document.head || !url) {
      return;
    }

    var link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", getAbsoluteStorefrontUrl(url));
  }

  function setJsonLd(id, data) {
    if (!document.head || !id) {
      return;
    }

    var script = document.getElementById(id);
    if (!data) {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      return;
    }

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  function applySeoMeta(options) {
    options = options || {};
    var title = truncateSeoText(options.title || document.title || "Radios", 70) || "Radios";
    var description = truncateSeoText(options.description || "Shop live Radios products with INR pricing, reliable delivery, and secure checkout.", 160);
    var url = getAbsoluteStorefrontUrl(options.canonicalUrl || window.location.href);
    var image = options.image ? getAbsoluteStorefrontUrl(options.image) : getAbsoluteStorefrontUrl("assets/img/logo/logo.svg");
    var type = options.type || "website";

    document.title = title;
    ensureMetaTag("name", "description", description);
    ensureCanonicalLink(url);
    ensureMetaTag("property", "og:title", title);
    ensureMetaTag("property", "og:description", description);
    ensureMetaTag("property", "og:image", image);
    ensureMetaTag("property", "og:url", url);
    ensureMetaTag("property", "og:type", type);
    ensureMetaTag("name", "twitter:card", "summary_large_image");
    ensureMetaTag("name", "twitter:title", title);
    ensureMetaTag("name", "twitter:description", description);
    ensureMetaTag("name", "twitter:image", image);
  }

  function applyDefaultSeo() {
    var descriptionTag = document.querySelector('meta[name="description"]');
    applySeoMeta({
      title: document.title || "Radios",
      description: descriptionTag ? descriptionTag.getAttribute("content") : "",
      canonicalUrl: window.location.href,
      type: "website"
    });
  }

  function getProductSeoTitle(product) {
    return product.meta_title || product.metaTitle || (getProductName(product) + " - Radios");
  }

  function getProductSeoDescription(product) {
    return product.meta_description ||
      product.metaDescription ||
      product.description ||
      product.desc ||
      product.subtitle ||
      (getProductName(product) + " is available from Radios with live pricing and checkout.");
  }

  function getProductSeoImage(product) {
    return product.og_image_url || product.ogImageUrl || getProductImage(product) || IMAGE_PLACEHOLDER;
  }

  function getProductCanonicalUrl(product) {
    return product.canonical_url || product.canonicalUrl || getProductUrl(product);
  }

  function getCategorySeoTitle(category) {
    return category.meta_title || category.metaTitle || (category.name + " - Radios");
  }

  function getCategorySeoDescription(category) {
    return category.meta_description ||
      category.metaDescription ||
      category.description ||
      ("Browse " + category.name + " products from Radios.");
  }

  function getCategorySeoImage(category) {
    return category.og_image_url || category.ogImageUrl || category.banner_url || category.bannerUrl || category.image_url || category.imageUrl || "";
  }

  function getSchemaAvailability(product) {
    if (canPurchaseProduct(product, 1)) {
      return product.allow_backorder || product.allowBackorder ? "https://schema.org/BackOrder" : "https://schema.org/InStock";
    }
    return "https://schema.org/OutOfStock";
  }

  function removeEmptySchemaValues(value) {
    if (Array.isArray(value)) {
      return value
        .map(removeEmptySchemaValues)
        .filter(function (item) { return item !== undefined && item !== null && item !== ""; });
    }

    if (value && typeof value === "object") {
      var cleaned = {};
      Object.keys(value).forEach(function (key) {
        var nextValue = removeEmptySchemaValues(value[key]);
        if (nextValue !== undefined && nextValue !== null && nextValue !== "" && (!Array.isArray(nextValue) || nextValue.length)) {
          cleaned[key] = nextValue;
        }
      });
      return cleaned;
    }

    return value;
  }

  function buildProductSchema(product, reviews) {
    product = normalizeProduct(product);
    var productId = getProductIdentifier(product);
    var productName = getProductName(product);
    var approvedReviews = Array.isArray(reviews) ? reviews : [];
    var summary = summarizeReviews(approvedReviews);
    var schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productName,
      image: getProductGallery(product).map(getAbsoluteStorefrontUrl),
      description: truncateSeoText(getProductSeoDescription(product), 500),
      sku: product.sku,
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      url: getAbsoluteStorefrontUrl(getProductCanonicalUrl(product)),
      offers: {
        "@type": "Offer",
        url: getAbsoluteStorefrontUrl(getProductCanonicalUrl(product)),
        priceCurrency: "INR",
        price: readNumberValue(product.price, 0).toFixed(2),
        availability: getSchemaAvailability(product),
        itemCondition: "https://schema.org/NewCondition"
      }
    };

    if (summary.count > 0) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(summary.average || 0).toFixed(1),
        reviewCount: summary.count,
        bestRating: "5",
        worstRating: "1"
      };
      schema.review = approvedReviews.slice(0, 5).map(function (review) {
        var reviewDate = review.created_at ? new Date(review.created_at) : null;
        return {
          "@type": "Review",
          author: {
            "@type": "Person",
            name: review.customer_name || "Radios customer"
          },
          datePublished: reviewDate && !Number.isNaN(reviewDate.getTime()) ? reviewDate.toISOString().slice(0, 10) : undefined,
          reviewBody: truncateSeoText(review.comment || "", 500),
          reviewRating: {
            "@type": "Rating",
            ratingValue: Math.min(5, Math.max(1, Number(review.rating) || 5)),
            bestRating: "5",
            worstRating: "1"
          },
          itemReviewed: productId ? { "@type": "Product", name: productName, sku: product.sku } : undefined
        };
      });
    }

    return removeEmptySchemaValues(schema);
  }

  function applyProductSeo(product, reviews) {
    product = normalizeProduct(product);
    applySeoMeta({
      title: getProductSeoTitle(product),
      description: getProductSeoDescription(product),
      canonicalUrl: getProductCanonicalUrl(product),
      image: getProductSeoImage(product),
      type: "product"
    });
    setJsonLd("radios-product-schema", buildProductSchema(product, reviews || []));
  }

  function preferVisibleProductSlugUrl(product) {
    var productSlug = getProductSlug(product);
    if (!productSlug || !window.history || !window.history.replaceState) {
      return;
    }

    var params = new URLSearchParams(window.location.search || "");
    if (params.get("slug") === productSlug) {
      return;
    }

    var nextUrl = getProductUrl(product);
    if (nextUrl && getCurrentFilename() === "shop-single.html") {
      window.history.replaceState({}, document.title, nextUrl);
    }
  }

  function applyCategorySeo(category) {
    applySeoMeta({
      title: getCategorySeoTitle(category),
      description: getCategorySeoDescription(category),
      canonicalUrl: category.canonical_url || category.canonicalUrl || categoryUrl(category),
      image: getCategorySeoImage(category),
      type: "website"
    });
    setJsonLd("radios-product-schema", null);
  }

  function resolveStorefrontHref(value, fallbackHref) {
    var normalized = normalizeCategoryHref(String(value || "").trim());
    if (isPlaceholderHref(normalized)) {
      return fallbackHref || "shop-left-sidebar.html";
    }

    return normalized;
  }

  function getProductOldPriceText(product, fallbackIncrement) {
    var price = readNumberValue(product && product.price, 0);
    var compareAtPrice = readNumberValue(
      product && (product.compareAtPrice ?? product.compare_at_price ?? product.oldPrice ?? product.old_price),
      0
    );

    if (compareAtPrice > price) {
      return formatCurrency(compareAtPrice);
    }

    if (product && product.sku) {
      return "SKU: " + product.sku;
    }

    return formatCurrency(price + (Number(fallbackIncrement) || 0));
  }

  function escapeAttribute(value) {
    return String(value || "").replace(/"/g, "&quot;");
  }

  function imageFallbackAttribute() {
    return "this.onerror=null;this.src='" + escapeAttribute(IMAGE_PLACEHOLDER) + "';";
  }

  function buildImageAttrs(options) {
    options = options || {};
    var index = Number(options.index) || 0;
    var eagerCount = Number(options.eagerCount) || 0;
    var loading = options.priority || index < eagerCount ? "eager" : "lazy";
    var attrs = [
      'loading="' + loading + '"',
      'decoding="async"',
      'onerror="' + imageFallbackAttribute() + '"'
    ];

    if (options.priority) {
      attrs.push('fetchpriority="high"');
    }

    if (options.width) {
      attrs.push('width="' + escapeAttribute(options.width) + '"');
    }

    if (options.height) {
      attrs.push('height="' + escapeAttribute(options.height) + '"');
    }

    return attrs.join(" ");
  }

  function buildProductImageAttrs(index, options) {
    options = Object.assign({
      index: index,
      eagerCount: 4,
      width: PRODUCT_CARD_IMAGE_SIZE.width,
      height: PRODUCT_CARD_IMAGE_SIZE.height
    }, options || {});

    return buildImageAttrs(options);
  }

  function readNumberValue(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function readBooleanValue(value) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value > 0;
    }

    if (typeof value === "string") {
      var normalized = value.trim().toLowerCase();
      return ["1", "true", "yes", "y", "on"].indexOf(normalized) !== -1;
    }

    return false;
  }

  function hasProductFlag(product, fields) {
    return fields.some(function (field) {
      return readBooleanValue(product && product[field]);
    });
  }

  function readCategoryValue(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (typeof value === "object") {
      return String(value.name || value.title || value.slug || value.id || "").trim();
    }

    return String(value).trim();
  }

  function normalizeCategory(category) {
    if (!category || typeof category !== "object") {
      return null;
    }

    var name = readCategoryValue(category.name || category.title || category.label);
    if (!name) {
      return null;
    }

    return {
      id: category.id || category._id || "",
      name: name,
      slug: normalizeCategorySlug(category.slug || name),
      description: category.description || category.subtitle || "",
      icon: category.icon || category.iconClass || category.icon_class || "fas fa-tag",
      imageUrl: resolveImageUrl(category.image_url || category.imageUrl || category.image || category.icon_url || category.iconUrl),
      image_url: resolveImageUrl(category.image_url || category.imageUrl || category.image || category.icon_url || category.iconUrl),
      bannerUrl: resolveImageUrl(category.banner_url || category.bannerUrl || category.banner || category.hero_image_url || category.heroImageUrl),
      banner_url: resolveImageUrl(category.banner_url || category.bannerUrl || category.banner || category.hero_image_url || category.heroImageUrl),
      meta_title: category.meta_title || category.metaTitle || "",
      metaTitle: category.metaTitle || category.meta_title || "",
      meta_description: category.meta_description || category.metaDescription || "",
      metaDescription: category.metaDescription || category.meta_description || "",
      canonical_url: category.canonical_url || category.canonicalUrl || "",
      canonicalUrl: category.canonicalUrl || category.canonical_url || "",
      og_image_url: category.og_image_url || category.ogImageUrl || "",
      ogImageUrl: category.ogImageUrl || category.og_image_url || "",
      sortOrder: readNumberValue(category.sort_order ?? category.sortOrder, 0),
      isActive: category.is_active !== false &&
        category.isActive !== false &&
        category.active !== false &&
        category.visible !== false &&
        String(category.status || "active").toLowerCase() !== "inactive"
    };
  }

  function normalizeCategories(categories) {
    return (categories || [])
      .map(normalizeCategory)
      .filter(function (category) { return category && category.isActive; })
      .sort(function (left, right) {
        return Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || left.name.localeCompare(right.name);
      });
  }

  function getSupabaseClient() {
    if (!window.supabase || !window.RADIOS_SUPABASE_URL || !window.RADIOS_SUPABASE_ANON_KEY) {
      return null;
    }

    window.radiosSupabase = window.radiosSupabase || window.supabase.createClient(window.RADIOS_SUPABASE_URL, window.RADIOS_SUPABASE_ANON_KEY);
    return window.radiosSupabase;
  }

  function fetchSupabaseCategories() {
    var cachedCategories = readCache("categories", "active", CATEGORIES_CACHE_TTL_MS);
    if (cachedCategories) {
      return Promise.resolve(normalizeCategories(cachedCategories));
    }

    var client = getSupabaseClient();
    if (!client) {
      return Promise.reject(new Error("Supabase is not configured"));
    }

    return client
      .from("categories")
      .select("id,name,slug,description,icon,image_url,banner_url,is_active,visible,status,sort_order,meta_title,meta_description,canonical_url,og_image_url,updated_at,created_at")
      .order("sort_order", { ascending: true })
      .then(function (result) {
        if (result.error) {
          return client.from("categories").select("*").order("sort_order", { ascending: true });
        }
        return result;
      })
      .then(function (result) {
        if (result.error) throw result.error;
        return writeCache("categories", "active", normalizeCategories(result.data || []));
      });
  }

  function cleanSupabaseSearchTerm(value) {
    return String(value || "").trim().replace(/[,%]/g, " ").replace(/\s+/g, " ");
  }

  function applySupabaseProductFilters(query, options) {
    options = options || {};
    var categorySlug = normalizeCategorySlug(options.categorySlug || options.category_slug || "");
    var search = cleanSupabaseSearchTerm(options.search || "");

    query = query
      .or("visible.eq.true,is_active.eq.true")
      .not("status", "in", "(draft,hidden,archived,inactive,unpublished,disabled,deleted)");

    if (categorySlug) {
      query = query.eq("category_slug", categorySlug);
    }

    if (search && search.length >= SMART_SEARCH_MIN_LENGTH) {
      var pattern = "%" + search + "%";
      query = query.or([
        "title.ilike." + pattern,
        "name.ilike." + pattern,
        "description.ilike." + pattern,
        "sku.ilike." + pattern,
        "search_keywords.ilike." + pattern,
        "category.ilike." + pattern
      ].join(","));
    }

    if (options.sortBy === "price") {
      query = query.order("price", { ascending: true });
    } else if (options.sortBy === "price-desc") {
      query = query.order("price", { ascending: false });
    } else if (options.sortBy === "date") {
      query = query.order("updated_at", { ascending: false });
    } else if (options.sortBy === "popularity") {
      query = query.order("sales_count", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    return query;
  }

  function fetchSupabaseProductPage(options) {
    options = options || {};
    var client = getSupabaseClient();
    var page = Math.max(1, Number(options.page) || 1);
    var perPage = Math.max(1, Math.min(48, Number(options.perPage) || getListingPageSize()));
    var from = (page - 1) * perPage;
    var to = from + perPage - 1;
    var cacheSuffix = JSON.stringify({
      page: page,
      perPage: perPage,
      categorySlug: normalizeCategorySlug(options.categorySlug || ""),
      search: cleanSupabaseSearchTerm(options.search || ""),
      sortBy: options.sortBy || ""
    });
    var cachedPage = readCache("products-page", cacheSuffix, CATALOG_CACHE_TTL_MS);

    if (cachedPage) {
      return Promise.resolve(cachedPage);
    }

    if (!client) {
      return Promise.reject(new Error("Supabase is not configured"));
    }

    function run(selectClause, withFilters) {
      var query = client
        .from("products")
        .select(selectClause, { count: "exact" });

      if (withFilters) {
        query = applySupabaseProductFilters(query, options);
      } else {
        query = query.order("updated_at", { ascending: false });
      }

      return query.range(from, to);
    }

    return run(PRODUCT_LIST_COLUMNS, true)
      .then(function (result) {
        if (result.error) {
          return run("*", false);
        }

        return result;
      })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var items = getVisibleProducts(result.data || []);
        var pageResult = {
          items: items,
          total: Number(result.count) || items.length,
          page: page,
          perPage: perPage
        };

        return writeCache("products-page", cacheSuffix, pageResult);
      });
  }

  function fetchSupabaseProducts(options) {
    options = options || {};
    if (options.page || options.perPage || options.categorySlug || options.search || options.sortBy) {
      return fetchSupabaseProductPage(options).then(function (result) {
        return options.returnPage ? result : result.items;
      });
    }

    var cachedProducts = readCache("products", "visible", CATALOG_CACHE_TTL_MS);
    if (cachedProducts) {
      return Promise.resolve(getVisibleProducts(cachedProducts));
    }

    var client = getSupabaseClient();
    if (!client) {
      return Promise.reject(new Error("Supabase is not configured"));
    }

    return client
      .from("products")
      .select(PRODUCT_LIST_COLUMNS)
      .limit(96)
      .then(function (result) {
        if (result.error) {
          return client.from("products").select("*").limit(96);
        }
        return result;
      })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return writeCache("products", "visible", getVisibleProducts(result.data || []));
      });
  }

  function fetchSupabaseProduct(productId) {
    var client = getSupabaseClient();
    if (!client || !productId) {
      return Promise.reject(new Error("Supabase product lookup is unavailable"));
    }

    return client
      .from("products")
      .select("*")
      .eq("id", productId)
      .limit(1)
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        if (!result.data || !result.data[0]) {
          throw new Error("Product not found");
        }

        return requireStorefrontVisibleProduct(result.data[0]);
      });
  }

  function matchesProductSlug(product, productSlug) {
    var requestedSlug = slugify(productSlug);
    if (!requestedSlug) {
      return false;
    }

    return [
      product && product.slug,
      product && product.productSlug,
      product && product.handle,
      getProductName(product),
      getProductIdentifier(product)
    ].some(function (value) {
      return slugify(value) === requestedSlug;
    });
  }

  function findProductBySlug(products, productSlug) {
    var normalized = normalizeProducts(products || []);
    return normalized.find(function (product) {
      return matchesProductSlug(product, productSlug);
    });
  }

  function fetchSupabaseProductBySlug(productSlug) {
    var client = getSupabaseClient();
    if (!client || !productSlug) {
      return Promise.reject(new Error("Supabase slug lookup is unavailable"));
    }

    return client
      .from("products")
      .select("*")
      .eq("slug", productSlug)
      .limit(1)
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        if (result.data && result.data[0]) {
          return requireStorefrontVisibleProduct(result.data[0]);
        }

        throw new Error("Product not found");
      })
      .catch(function () {
        return fetchSupabaseProducts().then(function (products) {
          var match = findProductBySlug(products, productSlug);
          if (!match) {
            throw new Error("Product not found");
          }
          return match;
        });
      });
  }

  function fetchStorefrontProducts() {
    var cachedProducts = readCache("storefront-products", "visible", CATALOG_CACHE_TTL_MS);
    if (cachedProducts) {
      return Promise.resolve(getVisibleProducts(cachedProducts));
    }

    return fetchDashcodeJson("/products")
      .then(extractProductList)
      .then(function (products) {
        return products.length ? getVisibleProducts(products) : fetchSupabaseProducts();
      })
      .catch(function (error) {
        debugLog("Dashcode product API unavailable; loading products from Supabase:", error.message);
        return fetchSupabaseProducts();
      })
      .then(attachPromotionBadgesToProducts)
      .then(function (products) {
        return writeCache("storefront-products", "visible", products);
      });
  }

  function fetchStorefrontProductPage(options) {
    options = options || {};

    return fetchSupabaseProducts(Object.assign({}, options, { returnPage: true }))
      .then(function (pageResult) {
        return attachPromotionBadgesToProducts(pageResult.items).then(function (items) {
          return Object.assign({}, pageResult, { items: items });
        });
      })
      .catch(function () {
        return fetchStorefrontProducts().then(function (products) {
          var categorySlug = normalizeCategorySlug(options.categorySlug || "");
          var search = normalizeSearchQuery(options.search || "");
          var page = Math.max(1, Number(options.page) || 1);
          var perPage = Math.max(1, Math.min(48, Number(options.perPage) || getListingPageSize()));
          var filtered = getVisibleProducts(products).filter(function (product) {
            return (!categorySlug || productMatchesCategorySlug(product, { slug: categorySlug, name: categorySlug })) &&
              (!search || search.length < SMART_SEARCH_MIN_LENGTH || productMatchesKeyword(product, search));
          });
          var sorted = sortListingProducts(filtered, options.sortBy || "");
          var start = (page - 1) * perPage;
          return {
            items: sorted.slice(start, start + perPage),
            total: sorted.length,
            page: page,
            perPage: perPage
          };
        });
      });
  }

  function fetchStorefrontProduct(productId) {
    return fetchDashcodeJson("/products/" + encodeURIComponent(productId))
      .then(extractProduct)
      .then(requireStorefrontVisibleProduct)
      .then(function (product) {
        if (!isUuid(productId)) {
          return product;
        }

        return fetchSupabaseProduct(productId)
          .then(function (supabaseProduct) {
            return requireStorefrontVisibleProduct(Object.assign({}, product, supabaseProduct));
          })
          .catch(function () {
            return product;
          });
      })
      .catch(function (error) {
        debugLog("Dashcode product detail unavailable; loading product from Supabase:", error.message);
        return fetchSupabaseProduct(productId);
      })
      .then(function (product) {
        return attachPromotionBadgesToProducts([product]).then(function (products) {
          return products[0] || product;
        });
      });
  }

  function fetchStorefrontProductBySlug(productSlug) {
    return fetchStorefrontProducts()
      .then(function (products) {
        var match = findProductBySlug(products, productSlug);
        if (!match) {
          throw new Error("Product not found");
        }
        return match;
      })
      .catch(function (error) {
        debugLog("Product slug list lookup unavailable; loading product from Supabase:", error.message);
        return fetchSupabaseProductBySlug(productSlug);
      });
  }

  function fetchCatalogCategories() {
    return fetchSupabaseCategories()
      .catch(function () {
        return fetchDashcodeJson("/categories?active=true")
          .then(function (response) {
            return normalizeCategories(extractList(response));
          });
      })
      .catch(function () {
        return DEFAULT_CATEGORIES.slice();
      })
      .then(function (categories) {
        return categories && categories.length ? categories : DEFAULT_CATEGORIES.slice();
      });
  }

  function getSearchSessionId() {
    var existing = localStorage.getItem(SEARCH_SESSION_KEY);
    if (existing) {
      return existing;
    }

    var nextId = "search-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SEARCH_SESSION_KEY, nextId);
    return nextId;
  }

  function normalizeSearchQuery(query) {
    return String(query || "").replace(/\s+/g, " ").trim();
  }

  function getSearchCategorySlug(form) {
    var categorySelect = form ? form.querySelector('[name="category"]') : null;
    return normalizeCategorySlug(categorySelect ? String(categorySelect.value || "").trim() : "");
  }

  function productMatchesSearchCategory(product, categorySlug) {
    if (!categorySlug) {
      return true;
    }

    return [
      product.category_slug,
      product.categorySlug,
      product.category,
      getProductPrimaryCategory(product),
      getProductSubcategory(product)
    ].some(function (value) {
      return normalizeCategorySlug(readCategoryValue(value)) === categorySlug;
    });
  }

  function sortFallbackSearchProducts(products, query) {
    var normalizedQuery = normalizeSearchQuery(query).toLowerCase();
    return products.slice().sort(function (left, right) {
      function priority(product) {
        var name = getProductName(product).toLowerCase();
        var title = String(product.title || "").toLowerCase();
        var category = String(getProductPrimaryCategory(product) || product.category || "").toLowerCase();
        var tags = getProductTags(product).join(" ").toLowerCase();

        if (name === normalizedQuery || title === normalizedQuery) return 1;
        if (name.indexOf(normalizedQuery) === 0 || title.indexOf(normalizedQuery) === 0) return 2;
        if (category.indexOf(normalizedQuery) !== -1) return 3;
        if (tags.indexOf(normalizedQuery) !== -1) return 4;
        return 5;
      }

      return priority(left) - priority(right) || getProductName(left).localeCompare(getProductName(right));
    });
  }

  function fallbackSmartSearch(query, categorySlug, limit) {
    return fetchStorefrontProducts().then(function (products) {
      return sortFallbackSearchProducts(getVisibleProducts(products).filter(function (product) {
        return productMatchesSearchCategory(product, categorySlug) && productMatchesKeyword(product, query);
      }), query).slice(0, limit || 6);
    });
  }

  function fetchSmartSearchProducts(query, categorySlug, limit) {
    var normalizedQuery = normalizeSearchQuery(query);
    var client = getSupabaseClient();
    var maxResults = limit || 6;

    if (normalizedQuery.length < SMART_SEARCH_MIN_LENGTH) {
      return Promise.resolve([]);
    }

    if (!client || typeof client.rpc !== "function") {
      return fallbackSmartSearch(normalizedQuery, categorySlug, maxResults);
    }

    return client.rpc("search_products", {
      search_query: normalizedQuery,
      category_filter: categorySlug || null,
      limit_count: maxResults
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }

      return normalizeProducts(result.data || []);
    }).catch(function (error) {
      debugLog("Supabase smart search failed; using local fallback:", error.message);
      return fallbackSmartSearch(normalizedQuery, categorySlug, maxResults);
    });
  }

  function trackSearchEvent(query, resultsCount, clickedProductId) {
    var normalizedQuery = normalizeSearchQuery(query);
    var client = getSupabaseClient();

    if (!client || normalizedQuery.length < SMART_SEARCH_MIN_LENGTH) {
      return Promise.resolve();
    }

    return client.from("search_events").insert({
      query: normalizedQuery,
      session_id: getSearchSessionId(),
      auth_user_id: isUuid(getCurrentAuthUserId()) ? getCurrentAuthUserId() : null,
      results_count: Math.max(0, Number(resultsCount) || 0),
      clicked_product_id: isUuid(clickedProductId) ? clickedProductId : null
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }
    }).catch(function (error) {
      debugLog("Search event tracking skipped:", error.message);
    });
  }

  function fetchTrendingSearches(limit) {
    var client = getSupabaseClient();
    var maxTerms = limit || 5;

    if (!client || typeof client.rpc !== "function") {
      return Promise.resolve(SMART_SEARCH_FALLBACK_TERMS.slice(0, maxTerms));
    }

    return client.rpc("get_trending_searches", { limit_count: maxTerms })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var terms = (result.data || []).map(function (row) {
          return normalizeSearchQuery(row.query);
        }).filter(Boolean);

        return terms.length ? terms : SMART_SEARCH_FALLBACK_TERMS.slice(0, maxTerms);
      })
      .catch(function (error) {
        debugLog("Trending search load failed:", error.message);
        return SMART_SEARCH_FALLBACK_TERMS.slice(0, maxTerms);
      });
  }

  function debounce(callback, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        callback.apply(null, args);
      }, delay);
    };
  }

  function deriveInventoryStatus(product) {
    var stock = readNumberValue(product && product.stock, 0);
    var reservedStock = readNumberValue(product && (product.reserved_stock ?? product.reservedStock), 0);
    var availableStock = product && (product.available_stock !== undefined || product.availableStock !== undefined)
      ? readNumberValue(product.available_stock ?? product.availableStock, Math.max(stock - reservedStock, 0))
      : Math.max(stock - reservedStock, 0);
    var threshold = readNumberValue(product && (product.low_stock_threshold ?? product.lowStockThreshold), 5);
    var trackInventory = !product || (product.track_inventory !== false && product.trackInventory !== false);
    var allowBackorder = product && (product.allow_backorder === true || product.allowBackorder === true);

    if (!trackInventory) return "not_tracked";
    if (availableStock <= 0 && !allowBackorder) return "out_of_stock";
    if (availableStock > 0 && availableStock <= threshold) return "low_stock";
    return "in_stock";
  }

  function isStorefrontInventoryAvailable(product) {
    if (!product || typeof product !== "object") {
      return false;
    }

    var trackInventory = product.track_inventory !== false && product.trackInventory !== false;
    var allowBackorder = product.allow_backorder === true || product.allowBackorder === true;

    if (!trackInventory || allowBackorder) {
      return true;
    }

    var stock = readNumberValue(product.stock ?? product.quantity ?? product.inventoryQuantity, 0);
    var reservedStock = readNumberValue(product.reserved_stock ?? product.reservedStock, 0);
    var availableStock = product.available_stock !== undefined || product.availableStock !== undefined
      ? readNumberValue(product.available_stock ?? product.availableStock, Math.max(stock - reservedStock, 0))
      : Math.max(stock - reservedStock, 0);

    return availableStock > 0;
  }

  function normalizeProduct(product) {
    if (!product || typeof product !== "object") {
      return product;
    }

    var productId = getProductIdentifier(product);
    var productName = getProductName(product);
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var images = getProductGallery(product);
    var category =
      readCategoryValue(product.category) ||
      readCategoryValue(product.categoryName) ||
      readCategoryValue(product.category_name) ||
      readCategoryValue(product.categorySlug) ||
      readCategoryValue(product.category_slug);
    var subcategory =
      readCategoryValue(product.subcategory) ||
      readCategoryValue(product.subcategoryName) ||
      readCategoryValue(product.subcategory_name) ||
      readCategoryValue(product.subcategorySlug) ||
      readCategoryValue(product.subcategory_slug);
    var status = String(product.status || "").toLowerCase();
    var stock = readNumberValue(product.stock ?? product.quantity ?? product.inventoryQuantity, 0);
    var reservedStock = readNumberValue(product.reserved_stock ?? product.reservedStock, 0);
    var availableStock = product.available_stock !== undefined || product.availableStock !== undefined
      ? readNumberValue(product.available_stock ?? product.availableStock, Math.max(stock - reservedStock, 0))
      : Math.max(stock - reservedStock, 0);
    var lowStockThreshold = readNumberValue(product.low_stock_threshold ?? product.lowStockThreshold, 5);
    var trackInventory = product.track_inventory !== false && product.trackInventory !== false;
    var allowBackorder = product.allow_backorder === true || product.allowBackorder === true;
    var inventoryStatus = String(product.inventory_status || product.inventoryStatus || "").toLowerCase();
    if (!inventoryStatus && (status === "out_of_stock" || status === "sold_out")) {
      inventoryStatus = "out_of_stock";
    }
    if (!inventoryStatus) {
      inventoryStatus = deriveInventoryStatus({
      stock: stock,
      reserved_stock: reservedStock,
      available_stock: availableStock,
      low_stock_threshold: lowStockThreshold,
      track_inventory: trackInventory,
      allow_backorder: allowBackorder
      });
    }
    var storefrontBadges = getExplicitProductBadgeLabels(product);
    var isVisible =
      product.visible !== false &&
      product.is_visible !== false &&
      product.isVisible !== false &&
      product.is_active !== false &&
      product.isActive !== false &&
      product.active !== false &&
      status !== "draft" &&
      status !== "archived" &&
      status !== "inactive" &&
      status !== "hidden" &&
      status !== "unpublished" &&
      status !== "disabled" &&
      status !== "deleted";

    if (productImage && images.indexOf(productImage) === -1) {
      images.unshift(productImage);
    }

    return Object.assign({}, product, {
      id: product.id || productId,
      productId: product.productId || productId,
      name: productName,
      title: product.title || productName,
      slug: getProductSlug(product) || slugify(productName),
      meta_title: product.meta_title || product.metaTitle || "",
      metaTitle: product.metaTitle || product.meta_title || "",
      meta_description: product.meta_description || product.metaDescription || "",
      metaDescription: product.metaDescription || product.meta_description || "",
      canonical_url: product.canonical_url || product.canonicalUrl || "",
      canonicalUrl: product.canonicalUrl || product.canonical_url || "",
      og_image_url: product.og_image_url || product.ogImageUrl || "",
      ogImageUrl: product.ogImageUrl || product.og_image_url || "",
      image: product.image || productImage,
      img: product.img || productImage,
      imageUrl: product.imageUrl || product.image_url || productImage,
      image_url: product.image_url || productImage,
      images: images,
      badges: storefrontBadges,
      storefrontBadges: storefrontBadges,
      storefront_badges: storefrontBadges,
      category: category,
      categorySlug: product.categorySlug || product.category_slug || slugify(category),
      subcategory: subcategory,
      description: product.description || product.desc || product.subtitle || product.metaDescription || product.meta_description || "",
      desc: product.desc || product.description || product.subtitle || "",
      price: readNumberValue(product.price, 0),
      compareAtPrice: readNumberValue(product.compareAtPrice ?? product.compare_at_price ?? product.oldPrice, 0),
      compare_at_price: readNumberValue(product.compare_at_price ?? product.compareAtPrice ?? product.oldPrice, 0),
      sku: product.sku || (productId ? "SKU-" + String(productId).slice(0, 8).toUpperCase() : ""),
      stock: stock,
      reservedStock: reservedStock,
      reserved_stock: reservedStock,
      availableStock: availableStock,
      available_stock: availableStock,
      lowStockThreshold: lowStockThreshold,
      low_stock_threshold: lowStockThreshold,
      trackInventory: trackInventory,
      track_inventory: trackInventory,
      allowBackorder: allowBackorder,
      allow_backorder: allowBackorder,
      inventoryStatus: inventoryStatus,
      inventory_status: inventoryStatus,
      is_hot: readBooleanValue(product.is_hot ?? product.isHot ?? product.hot),
      isHot: readBooleanValue(product.isHot ?? product.is_hot ?? product.hot),
      is_best_seller: readBooleanValue(product.is_best_seller ?? product.isBestSeller ?? product.best_seller ?? product.bestSeller ?? product.most_selling ?? product.mostSelling),
      isBestSeller: readBooleanValue(product.isBestSeller ?? product.is_best_seller ?? product.best_seller ?? product.bestSeller ?? product.most_selling ?? product.mostSelling),
      is_featured: readBooleanValue(product.is_featured ?? product.isFeatured ?? product.featured),
      isFeatured: readBooleanValue(product.isFeatured ?? product.is_featured ?? product.featured),
      is_new: readBooleanValue(product.is_new ?? product.isNew ?? product.new_arrival ?? product.newArrival),
      isNew: readBooleanValue(product.isNew ?? product.is_new ?? product.new_arrival ?? product.newArrival),
      sales_count: readNumberValue(product.sales_count ?? product.salesCount ?? product.sold_count ?? product.soldCount, 0),
      specifications: normalizeJsonObject(product.specifications),
      faqs: normalizeFaqs(product.faqs),
      delivery_days_min: readNumberValue(product.delivery_days_min ?? product.deliveryDaysMin, 2),
      delivery_days_max: readNumberValue(product.delivery_days_max ?? product.deliveryDaysMax, 7),
      return_policy: product.return_policy || product.returnPolicy || "",
      warranty: product.warranty || "",
      brand: product.brand || "",
      related_product_ids: normalizeRelatedProductIds(product.related_product_ids || product.relatedProductIds),
      visible: isVisible,
      isVisible: isVisible
    });
  }

  function normalizeProducts(products) {
    return (products || []).map(normalizeProduct).filter(Boolean);
  }

  function isActiveRecord(record) {
    var status = String(record && record.status || "").toLowerCase();

    return record &&
      record.visible !== false &&
      record.is_visible !== false &&
      record.isVisible !== false &&
      record.is_active !== false &&
      record.isActive !== false &&
      record.active !== false &&
      status !== "draft" &&
      status !== "archived" &&
      status !== "inactive" &&
      status !== "hidden" &&
      status !== "unpublished" &&
      status !== "disabled" &&
      status !== "deleted";
  }

  function getVisibleProducts(products) {
    return normalizeProducts(products).filter(function (product) {
      return isStorefrontVisibleProduct(product);
    });
  }

  function normalizeStringList(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return uniqueStrings(value.map(function (item) {
        if (item && typeof item === "object") {
          return String(item.label || item.name || item.title || item.value || "").trim();
        }

        return String(item || "").trim();
      }).filter(Boolean));
    }

    if (typeof value === "string") {
      return uniqueStrings(value.split(",").map(function (item) {
        return item.trim();
      }).filter(Boolean));
    }

    if (typeof value === "object") {
      return normalizeStringList(value.label || value.name || value.title || value.value || "");
    }

    return [];
  }

  function getProductTags(product) {
    if (!product || typeof product !== "object") {
      return [];
    }

    return uniqueStrings([]
      .concat(normalizeStringList(product.tags))
      .concat(normalizeStringList(product.product_tags))
      .concat(normalizeStringList(product.productTags))
      .concat(normalizeStringList(product.keywords)));
  }

  function getVisibleProductTags(product) {
    return getProductTags(product).filter(function (tag) {
      return tag.indexOf(CATEGORY_TAG_PREFIX) !== 0 && tag.indexOf(SUBCATEGORY_TAG_PREFIX) !== 0;
    });
  }

  function titleCaseBadge(label) {
    var aliases = {
      "backorder": "Backorder",
      "back ordered": "Backorder",
      "best seller": "Most selling",
      "bestseller": "Most selling",
      "hot": "Hot",
      "hot deal": "Hot",
      "low stock": "Low stock",
      "most selling": "Most selling",
      "new": "New",
      "new arrival": "New",
      "out of stock": "Out of stock",
      "sale": "Sale",
      "sold": "Out of stock",
      "sold out": "Out of stock",
      "top seller": "Most selling",
      "trending": "Trending"
    };
    var normalized = String(label || "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    var key = normalized.toLowerCase();

    if (aliases[key]) {
      return aliases[key];
    }

    return normalized.replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function getBadgeVariant(label) {
    var key = slugify(label);

    if (["out-of-stock", "sold", "sold-out"].indexOf(key) !== -1) return "out";
    if (["low-stock", "limited-stock", "only-few-left"].indexOf(key) !== -1) return "low";
    if (["backorder", "back-ordered"].indexOf(key) !== -1) return "backorder";
    if (["hot", "hot-deal"].indexOf(key) !== -1) return "hot";
    if (["most-selling", "best-seller", "bestseller", "top-seller"].indexOf(key) !== -1) return "best";
    if (["new", "new-arrival"].indexOf(key) !== -1) return "new";
    if (["sale", "deal", "discount", "offer", "coupon", "promo", "promotion", "free-shipping", "combo-offer"].indexOf(key) !== -1 || key.indexOf("use-") === 0) return "sale";
    if (["featured", "staff-pick"].indexOf(key) !== -1) return "featured";
    if (["trending"].indexOf(key) !== -1) return "trending";
    return "default";
  }

  function getExplicitProductBadgeLabels(product) {
    if (!product || typeof product !== "object") {
      return [];
    }

    return uniqueStrings([]
      .concat(normalizeStringList(product.badges))
      .concat(normalizeStringList(product.storefront_badges))
      .concat(normalizeStringList(product.storefrontBadges))
      .concat(normalizeStringList(product.badge_tags))
      .concat(normalizeStringList(product.badgeTags))
      .concat(normalizeStringList(product.product_badges))
      .concat(normalizeStringList(product.productBadges))
      .concat(normalizeStringList(product.promotion_badges))
      .concat(normalizeStringList(product.promotionBadges))
      .concat(normalizeStringList(product.badge))
      .concat(normalizeStringList(product.badge_label))
      .concat(normalizeStringList(product.badgeLabel))
    ).map(titleCaseBadge).filter(Boolean);
  }

  function getProductInventoryStatus(product) {
    if (!product || typeof product !== "object") {
      return "out_of_stock";
    }

    var explicitStatus = String(product.inventory_status || product.inventoryStatus || "").toLowerCase();
    if (explicitStatus) {
      return explicitStatus;
    }

    var status = String(product.status || "").toLowerCase();
    if (status === "out_of_stock" || status === "sold_out") {
      return "out_of_stock";
    }

    return deriveInventoryStatus(product);
  }

  function addStorefrontBadge(badges, label, variant) {
    label = titleCaseBadge(label);
    if (!label) {
      return;
    }

    var key = slugify(label);
    if (badges.some(function (badge) { return badge.key === key; })) {
      return;
    }

    badges.push({
      key: key,
      label: label,
      variant: variant || getBadgeVariant(label)
    });
  }

  function productHasBadgeKeyword(product, keywords) {
    var normalizedKeywords = keywords.map(slugify);
    return getExplicitProductBadgeLabels(product).concat(getProductTags(product)).some(function (label) {
      return normalizedKeywords.indexOf(slugify(label)) !== -1;
    });
  }

  function getDiscountIdentifier(discount) {
    return String(discount && (discount.id || discount._id || discount.code || discount.title) || "").trim();
  }

  function discountListContainsText(list, value) {
    var normalizedValue = slugify(value);
    return normalizeStringList(list).some(function (item) {
      return slugify(item) === normalizedValue;
    });
  }

  function discountListContainsId(list, value) {
    var normalizedValue = String(value || "").trim();
    return normalizeStringList(list).some(function (item) {
      return String(item || "").trim() === normalizedValue;
    });
  }

  function promotionAppliesToProduct(discount, product) {
    discount = normalizeDiscount(discount);
    product = normalizeProduct(product);

    if (!discount || !product || !isDiscountActive(discount)) {
      return false;
    }

    var scope = String(discount.appliesTo || discount.applies_to || discount.targetScope || "all").toLowerCase();
    var productId = getProductIdentifier(product);
    var categorySlug = product.categorySlug || product.category_slug || getProductPrimaryCategory(product) || product.category;

    if (["all", "order", "all_products"].indexOf(scope) !== -1) {
      return true;
    }

    if (["product", "products", "specific_products"].indexOf(scope) !== -1) {
      return discountListContainsId(discount.targetProductIds || discount.product_ids || discount.productIds, productId);
    }

    if (["category", "categories", "specific_categories"].indexOf(scope) !== -1) {
      return discountListContainsText(discount.targetCategorySlugs || discount.category_slugs || discount.categorySlugs, categorySlug);
    }

    if (["tag", "tags"].indexOf(scope) !== -1) {
      return normalizeStringList(discount.targetTags || discount.tags).some(function (tag) {
        return productHasBadgeKeyword(product, [tag]) || getProductTags(product).some(function (productTag) {
          return slugify(productTag) === slugify(tag);
        });
      });
    }

    return false;
  }

  function buildPromotionBadgeLabel(discount) {
    discount = normalizeDiscount(discount);

    if (!discount) {
      return "";
    }

    if (discount.code) {
      return "Use " + discount.code;
    }

    if (discount.title) {
      return discount.title;
    }

    if (discount.discount_type === "free_shipping") {
      return "Free Shipping";
    }

    if (discount.discount_type === "buy_x_get_y") {
      return "Combo Offer";
    }

    return "Offer";
  }

  function attachPromotionBadgesToProducts(products) {
    var normalizedProducts = getVisibleProducts(products || []);

    return fetchStorefrontDiscounts().then(function (discounts) {
      if (!discounts.length) {
        return normalizedProducts;
      }

      return normalizedProducts.map(function (product) {
        var promotionBadges = uniqueStrings(discounts.filter(function (discount) {
          return promotionAppliesToProduct(discount, product);
        }).map(buildPromotionBadgeLabel).filter(Boolean)).slice(0, 2);

        if (!promotionBadges.length) {
          return product;
        }

        return Object.assign({}, product, {
          promotionBadges: promotionBadges,
          promotion_badges: promotionBadges
        });
      });
    }).catch(function () {
      return normalizedProducts;
    });
  }

  function getProductStorefrontBadges(product, options) {
    product = product && product.name ? product : normalizeProduct(product);
    options = options || {};

    var badges = [];
    var availableStock = getAvailableStock(product);
    var inventoryStatus = getProductInventoryStatus(product);
    var compareAtPrice = readNumberValue(product.compareAtPrice ?? product.compare_at_price ?? product.oldPrice ?? product.old_price, 0);
    var price = readNumberValue(product.price, 0);

    if (inventoryStatus === "out_of_stock" && !isBackorderAllowed(product)) {
      addStorefrontBadge(badges, "Out of stock", "out");
    } else if (isInventoryTracked(product) && isBackorderAllowed(product) && availableStock <= 0) {
      addStorefrontBadge(badges, "Backorder", "backorder");
    } else if (inventoryStatus === "low_stock") {
      addStorefrontBadge(badges, "Low stock", "low");
    }

    getExplicitProductBadgeLabels(product).forEach(function (label) {
      addStorefrontBadge(badges, label);
    });

    if (hasProductFlag(product, ["is_hot", "isHot", "hot"]) || productHasBadgeKeyword(product, ["hot", "hot deal"])) {
      addStorefrontBadge(badges, "Hot", "hot");
    }

    if (hasProductFlag(product, ["is_best_seller", "isBestSeller", "best_seller", "bestSeller", "most_selling", "mostSelling", "top_seller", "topSeller", "is_most_selling", "isMostSelling"]) || productHasBadgeKeyword(product, ["most selling", "best seller", "bestseller", "top seller"])) {
      addStorefrontBadge(badges, "Most selling", "best");
    }

    if (hasProductFlag(product, ["is_new", "isNew", "new_arrival", "newArrival"]) || productHasBadgeKeyword(product, ["new", "new arrival"])) {
      addStorefrontBadge(badges, "New", "new");
    }

    if (hasProductFlag(product, ["is_featured", "isFeatured", "featured"]) || productHasBadgeKeyword(product, ["featured", "staff pick"])) {
      addStorefrontBadge(badges, "Featured", "featured");
    }

    if (compareAtPrice > price) {
      addStorefrontBadge(badges, "Sale", "sale");
    }

    return badges.slice(0, options.limit || 2);
  }

  function buildStorefrontBadgeMarkup(product, options) {
    options = options || {};
    var badges = getProductStorefrontBadges(product, options);

    if (!badges.length) {
      return "";
    }

    var className = "storefront-badges" +
      (options.inline ? " storefront-badges--inline" : "") +
      (options.compact ? " storefront-badges--compact" : "");

    return '<div class="' + className + '" aria-label="Product badges">' +
      badges.map(function (badge) {
        return '<span class="storefront-badge storefront-badge--' + escapeAttribute(badge.variant) + '">' + escapeHtml(badge.label) + '</span>';
      }).join("") +
      '</div>';
  }

  function getProductModelOptions(product) {
    if (!product || typeof product !== "object") {
      return [];
    }

    return uniqueStrings([]
      .concat(normalizeStringList(product.models))
      .concat(normalizeStringList(product.model_options))
      .concat(normalizeStringList(product.modelOptions))
      .concat(normalizeStringList(product.model ? [product.model] : [])));
  }

  function getTaggedValue(product, prefix) {
    var match = getProductTags(product).find(function (tag) {
      return tag.indexOf(prefix) === 0;
    });

    return match ? match.slice(prefix.length).trim() : "";
  }

  function getProductPrimaryCategory(product) {
    return getTaggedValue(product, CATEGORY_TAG_PREFIX) ||
      readCategoryValue(product && product.category) ||
      readCategoryValue(product && product.categoryName) ||
      readCategoryValue(product && product.category_name) ||
      readCategoryValue(product && product.categorySlug) ||
      readCategoryValue(product && product.category_slug);
  }

  function getProductSubcategory(product) {
    return getTaggedValue(product, SUBCATEGORY_TAG_PREFIX) ||
      readCategoryValue(product && product.subcategory) ||
      readCategoryValue(product && product.subcategoryName) ||
      readCategoryValue(product && product.subcategory_name) ||
      readCategoryValue(product && product.subcategorySlug) ||
      readCategoryValue(product && product.subcategory_slug);
  }

  function getCurrentFilename() {
    var parts = window.location.pathname.split("/");
    return String(parts[parts.length - 1] || "").toLowerCase();
  }

  function getCategoryPageMeta() {
    if (getCurrentFilename() === "category.html") {
      var params = new URLSearchParams(window.location.search);
      var dynamicSlug = slugify(params.get("slug") || "");
      if (!dynamicSlug) {
        return null;
      }

      var dynamicCategory = DEFAULT_CATEGORIES.find(function (item) {
        return slugify(item.slug || item.name) === dynamicSlug;
      });

      return {
        slug: dynamicSlug,
        name: dynamicCategory ? dynamicCategory.name : dynamicSlug.replace(/-/g, " ")
      };
    }

    var match = getCurrentFilename().match(/^category-(.+)\.html$/);
    if (!match) {
      return null;
    }

    var slug = match[1];
    var category = DEFAULT_CATEGORIES.find(function (item) {
      return slugify(item.slug || item.name) === slug;
    });

    return {
      slug: slug,
      name: category ? category.name : slug.replace(/-/g, " ")
    };
  }

  function applyCategoryPageSeo(categoryPage) {
    if (!categoryPage) {
      return;
    }

    fetchCatalogCategories()
      .then(function (categories) {
        var match = (categories || []).find(function (item) {
          return slugify(item.slug || item.name) === slugify(categoryPage.slug || categoryPage.name);
        });
        applyCategorySeo(match || categoryPage);
      })
      .catch(function () {
        applyCategorySeo(categoryPage);
      });
  }

  function getChipValues() {
    var values = [];

    Array.prototype.slice.call(document.querySelectorAll(".cat-chip")).forEach(function (chip) {
      var value = chip.getAttribute("data-subcat") || chip.textContent || "";
      var normalized = value.trim();
      if (normalized && values.indexOf(normalized) === -1) {
        values.push(normalized);
      }
    });

    return values;
  }

  function normalizeKeyword(value) {
    return String(value || "").trim().toLowerCase();
  }

  function productMatchesKeyword(product, keyword) {
    if (!keyword) {
      return true;
    }

    var haystack = [
      getProductName(product),
      product.description,
      product.sku,
      product.category,
      getProductPrimaryCategory(product),
      getProductSubcategory(product),
      product.subtitle,
      product.brand
    ].concat(getProductTags(product)).join(" ").toLowerCase();

    return haystack.indexOf(normalizeKeyword(keyword)) !== -1;
  }

  function productBelongsToCategoryPage(product, categoryPage, chipValues) {
    if (!categoryPage) {
      return true;
    }

    var primaryCategory = slugify(getProductPrimaryCategory(product));
    var rawCategory = slugify(product.category);
    var subcategory = slugify(getProductSubcategory(product));
    var pageSlug = slugify(categoryPage.slug || categoryPage.name);
    var chipSlugs = (chipValues || []).map(slugify);

    if (primaryCategory === pageSlug || rawCategory === pageSlug) {
      return true;
    }

    if (subcategory && chipSlugs.indexOf(subcategory) !== -1) {
      return true;
    }

    return rawCategory && chipSlugs.indexOf(rawCategory) !== -1;
  }

  function buildListingEmptyState(message) {
    return '<li class="product"><div class="product-info"><h2 class="product__title">' + escapeHtml(message) + '</h2><p class="product-description">Try adjusting the filters or add products from the admin dashboard.</p></div></li>';
  }

  function buildProductSkeletonCards(count) {
    var total = Math.max(1, Number(count) || 4);
    var cards = [];
    for (var index = 0; index < total; index += 1) {
      cards.push(
        '<li class="product product-skeleton-card" aria-hidden="true">' +
          '<div class="product-skeleton-card__image"></div>' +
          '<div class="product-skeleton-card__line short"></div>' +
          '<div class="product-skeleton-card__line"></div>' +
          '<div class="product-skeleton-card__line price"></div>' +
        '</li>'
      );
    }
    return cards.join("");
  }

  function renderProductSkeleton(container, count) {
    if (container) {
      container.innerHTML = buildProductSkeletonCards(count || getListingPageSize());
    }
  }

  function updateListingCount(resultCount, visibleCount, totalCount) {
    if (resultCount) {
      resultCount.textContent = "Showing " + visibleCount + " of " + totalCount + " results";
    }
  }

  function ensureListingPagination(productsList) {
    if (!productsList) {
      return null;
    }

    var existing = productsList.parentNode ? productsList.parentNode.querySelector("[data-product-pagination]") : null;
    if (existing) {
      return existing;
    }

    var pagination = document.createElement("nav");
    pagination.className = "product-pagination";
    pagination.setAttribute("data-product-pagination", "");
    pagination.setAttribute("aria-label", "Product pagination");
    productsList.insertAdjacentElement("afterend", pagination);
    return pagination;
  }

  function renderProductPagination(container, page, total, perPage) {
    if (!container) {
      return;
    }

    var totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(perPage) || 1)));
    page = Math.min(totalPages, Math.max(1, Number(page) || 1));

    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);
    var buttons = [
      '<button type="button" data-product-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? " disabled" : "") + '>Previous</button>'
    ];

    for (var index = start; index <= end; index += 1) {
      buttons.push('<button type="button" data-product-page="' + index + '" class="' + (index === page ? "is-active" : "") + '" aria-current="' + (index === page ? "page" : "false") + '">' + index + "</button>");
    }

    buttons.push('<button type="button" data-product-page="' + Math.min(totalPages, page + 1) + '"' + (page === totalPages ? " disabled" : "") + '>Next</button>');
    container.innerHTML = buttons.join("");
  }

  function formatPriceRange(minValue, maxValue) {
    return formatCurrency(minValue) + " - " + formatCurrency(maxValue);
  }

  function sortListingProducts(products, sortValue) {
    var sorted = products.slice();

    if (sortValue === "price") {
      sorted.sort(function (left, right) {
        return Number(left.price || 0) - Number(right.price || 0);
      });
    } else if (sortValue === "price-desc") {
      sorted.sort(function (left, right) {
        return Number(right.price || 0) - Number(left.price || 0);
      });
    } else if (sortValue === "date") {
      sorted.sort(function (left, right) {
        return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
      });
    } else if (sortValue === "popularity") {
      sorted.sort(function (left, right) {
        var rightSales = readNumberValue(right.sales_count ?? right.salesCount ?? right.sold_count ?? right.soldCount, 0);
        var leftSales = readNumberValue(left.sales_count ?? left.salesCount ?? left.sold_count ?? left.soldCount, 0);
        return (rightSales - leftSales) || (Number(right.stock || 0) - Number(left.stock || 0));
      });
    } else if (sortValue === "rating") {
      sorted.sort(function (left, right) {
        return Number(right.rating || 0) - Number(left.rating || 0);
      });
    }

    return sorted;
  }

  function hasExplicitTrueVisibility(product) {
    return product &&
      (product.visible === true ||
        product.isVisible === true ||
        product.is_visible === true ||
        product.is_active === true ||
        product.isActive === true ||
        product.active === true);
  }

  function hasAnyVisibilityFlag(product) {
    return product && [
      product.visible,
      product.isVisible,
      product.is_visible,
      product.is_active,
      product.isActive,
      product.active
    ].some(function (value) {
      return typeof value === "boolean";
    });
  }

  function isStorefrontVisibleProduct(product) {
    return isActiveRecord(product);
  }

  function requireStorefrontVisibleProduct(product) {
    var normalized = normalizeProduct(product);
    if (!isStorefrontVisibleProduct(normalized)) {
      throw new Error("Product is not available in the store.");
    }

    return normalized;
  }

  function productMatchesCategorySlug(product, category) {
    var categorySlug = slugify(category && (category.slug || category.name));
    if (!categorySlug) {
      return false;
    }

    return [
      product.category_slug,
      product.categorySlug,
      product.category,
      product.categoryName,
      product.category_name,
      getProductPrimaryCategory(product),
      getProductSubcategory(product)
    ].some(function (value) {
      return slugify(readCategoryValue(value)) === categorySlug;
    });
  }

  function normalizeDynamicCategoryProducts(products, category) {
    return normalizeProducts((products || []).filter(function (product) {
      return isStorefrontVisibleProduct(product) && productMatchesCategorySlug(product, category);
    }));
  }

  function fetchSupabaseProductsForCategory(category) {
    var client = getSupabaseClient();
    var categorySlug = slugify(category && (category.slug || category.name));
    var categoryName = category ? category.name : "";

    if (!client || !categorySlug) {
      return Promise.reject(new Error("Supabase is not configured"));
    }

    function queryBySlug() {
      return client.from("products").select("*").eq("category_slug", categorySlug);
    }

    function queryByName() {
      return client.from("products").select("*").eq("category", categoryName);
    }

    function queryAllAndFilter() {
      return client.from("products").select("*").then(function (result) {
        if (result.error) throw result.error;
        return normalizeDynamicCategoryProducts(result.data || [], category);
      });
    }

    return queryBySlug()
      .then(function (result) {
        if (result.error) {
          return queryByName();
        }
        if (result.data && result.data.length) {
          return result;
        }
        return queryByName();
      })
      .then(function (result) {
        if (result.error) {
          return queryAllAndFilter();
        }

        var products = normalizeDynamicCategoryProducts(result.data || [], category);
        return products.length ? products : queryAllAndFilter();
      });
  }

  function fetchDynamicCategoryProducts(category) {
    return fetchSupabaseProductsForCategory(category)
      .catch(function () {
        return fetchDashcodeJson("/products")
          .then(extractProductList)
          .then(function (products) {
            return normalizeDynamicCategoryProducts(products, category);
          });
      })
      .catch(function () {
        return [];
      });
  }

  function buildCategoryStateCard(title, message) {
    return '<li class="product category-state-card"><h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(message || "") + '</p></li>';
  }

  function setupDynamicCategoryPage() {
    var page = document.querySelector("[data-dynamic-category-page]");
    if (!page) {
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var requestedSlug = slugify(params.get("slug") || "");
    var productsList = page.querySelector(".products.three-column");
    var pagination = ensureListingPagination(productsList);
    var resultCount = page.querySelector(".woocommerce-result-count");
    var ordering = page.querySelector(".woocommerce-ordering .orderby");
    var widgetSearchForm = page.querySelector(".shop-sidebar .widget__search");
    var widgetSearchInput = widgetSearchForm ? widgetSearchForm.querySelector("input") : null;
    var priceSlider = document.getElementById("slider-range");
    var priceAmount = document.getElementById("amount");
    var priceFilterButton = page.querySelector(".price-filter-btn");
    var chips = Array.prototype.slice.call(page.querySelectorAll(".cat-chip"));
    var state = {
      category: null,
      products: [],
      search: "",
      activeChip: "",
      sortBy: ordering ? ordering.value : "menu_order",
      priceMin: 0,
      priceMax: 100000,
      page: 1,
      perPage: getListingPageSize()
    };

    if (!productsList) {
      return;
    }

    function setCategoryMeta(category) {
      var title = page.querySelector("[data-category-title]");
      var description = page.querySelector("[data-category-description]");
      var breadcrumb = document.querySelector("[data-category-breadcrumb]");

      applyCategorySeo(category);
      if (title) title.textContent = category.name;
      if (breadcrumb) breadcrumb.textContent = category.name;
      if (description) {
        description.textContent = category.description || "Browse " + category.name + " products from Radios.";
      }
    }

    function renderState(title, message) {
      productsList.innerHTML = buildCategoryStateCard(title, message);
      updateListingCount(resultCount, 0, 0);
    }

    function getBaseProducts() {
      return state.products.filter(function (product) {
        return productMatchesKeyword(product, state.search);
      });
    }

    function renderProducts() {
      var baseProducts = getBaseProducts();
      var filteredProducts = sortListingProducts(baseProducts.filter(function (product) {
        return matchesChip(product) && matchesPrice(product);
      }), state.sortBy);
      var start = (state.page - 1) * state.perPage;
      var visibleProducts = filteredProducts.slice(start, start + state.perPage);

      if (!filteredProducts.length) {
        productsList.innerHTML = buildCategoryStateCard(
          baseProducts.length ? "No products match the selected filters." : "No products available in this category yet.",
          baseProducts.length ? "Try clearing filters or changing the search term." : "Please check back later for new arrivals."
        );
      } else {
        productsList.innerHTML = visibleProducts.map(buildProductCard).join("");
      }

      hydrateProductRatings(productsList);
      enhanceExistingImages(productsList);
      applyWishlistButtonStates();
      updateListingCount(resultCount, filteredProducts.length, baseProducts.length);
      renderProductPagination(pagination, state.page, filteredProducts.length, state.perPage);
    }

    function matchesChip(product) {
      if (!state.activeChip) {
        return true;
      }

      return productMatchesKeyword(product, state.activeChip);
    }

    function matchesPrice(product) {
      var price = Number(product.price) || 0;
      return price >= state.priceMin && price <= state.priceMax;
    }

    function bindEvents() {
      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          var nextValue = chip.getAttribute("data-subcat") || chip.textContent.trim();
          state.activeChip = state.activeChip === nextValue ? "" : nextValue;
          chips.forEach(function (item) { item.classList.remove("active"); });
          if (state.activeChip) chip.classList.add("active");
          state.page = 1;
          renderProducts();
        });
      });

      if (ordering) {
        ordering.addEventListener("change", function () {
          state.sortBy = ordering.value || "menu_order";
          state.page = 1;
          renderProducts();
        });
      }

      if (widgetSearchForm && widgetSearchInput) {
        widgetSearchForm.addEventListener("submit", function (event) {
          event.preventDefault();
          state.search = widgetSearchInput.value.trim();
          state.page = 1;
          renderProducts();
        });
      }

      if (priceAmount) {
        priceAmount.setAttribute("readonly", "readonly");
        priceAmount.value = formatPriceRange(state.priceMin, state.priceMax);
      }

      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slider && priceSlider && priceAmount) {
        var slider = window.jQuery(priceSlider);
        if (slider.hasClass("ui-slider")) {
          slider.slider("destroy");
        }
        slider.slider({
          range: true,
          min: 0,
          max: 100000,
          values: [state.priceMin, state.priceMax],
          slide: function (_event, ui) {
            state.priceMin = ui.values[0];
            state.priceMax = ui.values[1];
            priceAmount.value = formatPriceRange(state.priceMin, state.priceMax);
            state.page = 1;
            renderProducts();
          }
        });
      }

      if (priceFilterButton) {
        priceFilterButton.addEventListener("click", function () {
          state.page = 1;
          renderProducts();
        });
      }

      if (pagination) {
        pagination.addEventListener("click", function (event) {
          var button = event.target.closest("[data-product-page]");
          if (!button || button.disabled) {
            return;
          }
          state.page = Math.max(1, Number(button.getAttribute("data-product-page")) || 1);
          renderProducts();
          productsList.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    bindEvents();

    if (!requestedSlug) {
      renderState("Category not found.", "Please choose a category from the store navigation.");
      return;
    }

    renderProductSkeleton(productsList, state.perPage);

    fetchCatalogCategories()
      .then(function (categories) {
        var category = categories.find(function (item) {
          return slugify(item.slug || item.name) === requestedSlug;
        });

        if (!category) {
          renderState("Category not found.", "Please choose another category from the store navigation.");
          return null;
        }

        state.category = category;
        setCategoryMeta(category);
        return fetchDynamicCategoryProducts(category);
      })
      .then(function (products) {
        if (!state.category || !products) {
          return;
        }

        state.products = products;
        renderProducts();
      })
      .catch(function () {
        renderState("Unable to load this category. Please try again later.", "Refresh the page or return to the shop.");
      });
  }

  function cycleProducts(products, count, offset) {
    var list = getVisibleProducts(products);
    var start = Number(offset) || 0;
    var total = Math.max(0, Number(count) || 0);
    var result = [];

    if (!list.length || !total) {
      return result;
    }

    for (var index = 0; index < total; index += 1) {
      result.push(list[(start + index) % list.length]);
    }

    return result;
  }



  function readCart() {
    try {
      var items = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  function makeLocalSessionId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + window.crypto.randomUUID();
    }

    return prefix + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function getAbandonedCartSessionId() {
    var sessionId = localStorage.getItem(ABANDONED_CART_SESSION_KEY);
    if (!sessionId) {
      sessionId = makeLocalSessionId("cart-");
      localStorage.setItem(ABANDONED_CART_SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  function getAnalyticsSessionId() {
    var sessionId = localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (!sessionId) {
      sessionId = makeLocalSessionId("analytics-");
      localStorage.setItem(ANALYTICS_SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  function readStoredCartCustomer() {
    if (window.RadiosAuth && typeof window.RadiosAuth.readCustomer === "function") {
      var authCustomer = window.RadiosAuth.readCustomer();
      if (authCustomer) return authCustomer;
    }

    try {
      return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null") || {};
    } catch (error) {
      return {};
    }
  }

  function buildTrackedCartCustomer(override) {
    var stored = readStoredCartCustomer();
    var customer = Object.assign({}, stored || {}, override || {});
    var fullName = customer.fullName || customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ");

    return {
      authUserId: customer.authUserId || customer.auth_user_id || (customer.signedIn ? customer.id : ""),
      customerId: customer.customerId || customer.customer_id || "",
      name: fullName || "",
      email: customer.email || customer.customerEmail || "",
      phone: customer.phone || customer.customerPhone || ""
    };
  }

  function normalizeAnalyticsProductId(productId) {
    return isUuid(productId) ? productId : null;
  }

  function trackAnalyticsEvent(eventName, options) {
    options = options || {};
    var client = getSupabaseClient();
    if (!client || !eventName) {
      return Promise.resolve(null);
    }

    var customer = buildTrackedCartCustomer(options.customer);
    var productId = options.productId || options.product_id || (options.product && getProductIdentifier(options.product)) || "";
    var orderId = options.orderId || options.order_id || "";
    var metadata = Object.assign({
      page: getCurrentStorePage(),
      path: window.location.pathname || "",
      search: window.location.search || "",
      product_ref: productId || null,
      order_ref: orderId || null
    }, options.metadata || {});

    return client
      .from("analytics_events")
      .insert({
        event_name: String(eventName),
        session_id: getAnalyticsSessionId(),
        auth_user_id: isUuid(customer.authUserId) ? customer.authUserId : null,
        customer_id: isUuid(customer.customerId) ? customer.customerId : null,
        product_id: normalizeAnalyticsProductId(productId),
        order_id: isUuid(orderId) ? orderId : null,
        metadata: metadata
      })
      .then(function (result) {
        if (result.error) throw result.error;
        return result.data || null;
      })
      .catch(function (error) {
        debugLog("Analytics event skipped:", eventName, error && error.message ? error.message : error);
        return null;
      });
  }

  function getPageAnalyticsType() {
    var page = getCurrentStorePage();
    if (!page || page === "/" || page === "index.html") return "homepage";
    if (page === "shop-left-sidebar.html") return "category";
    if (page === "category.html" || /^category-[a-z0-9-]+\.html$/i.test(page)) return "category";
    if (page === "shop-single.html") return "product";
    if (page === "cart.html") return "cart";
    if (page === "checkout.html") return "checkout";
    return "";
  }

  function setupStorefrontAnalytics() {
    var pageType = getPageAnalyticsType();
    if (!pageType) {
      return;
    }

    var items = readCart();
    trackAnalyticsEvent("page_view", {
      metadata: {
        page_type: pageType,
        cart_items: items.reduce(function (sum, item) { return sum + (Number(item.quantity) || 0); }, 0),
        cart_total: getCartTotal(items)
      }
    });

    if (pageType === "checkout" && items.length) {
      trackAnalyticsEvent("checkout_start", {
        metadata: {
          item_count: items.reduce(function (sum, item) { return sum + (Number(item.quantity) || 0); }, 0),
          subtotal: getCartTotal(items),
          items: buildTrackedCartItems(items)
        }
      });
    }
  }

  function buildTrackedCartItems(items) {
    return (Array.isArray(items) ? items : []).map(function (item) {
      var quantity = Math.max(1, Number(item.quantity) || 1);
      var price = Number(item.price) || 0;
      return {
        productId: String(item.productId || item.id || ""),
        name: item.name || item.title || item.productName || "Product",
        price: price,
        quantity: quantity,
        image: item.image || item.productImage || item.image_url || ""
      };
    }).filter(function (item) {
      return item.productId || item.name;
    });
  }

  function getCurrentStorePage() {
    var path = window.location.pathname || "";
    return path.split("/").pop() || "index.html";
  }

  function logAbandonedCartWarning(error) {
    if (abandonedCartWarningShown) return;
    abandonedCartWarningShown = true;
    debugLog("Abandoned cart tracking is unavailable:", error && error.message ? error.message : error);
  }

  function syncAbandonedCart(items, options) {
    options = options || {};
    var client = getSupabaseClient();
    if (!client) {
      return Promise.resolve(null);
    }

    var lines = buildTrackedCartItems(items || readCart());
    var itemCount = lines.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    var subtotal = lines.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
    var discount = Number(options.discount) || 0;
    var total = options.total !== undefined ? Number(options.total) || 0 : Math.max(0, subtotal - discount);
    var now = new Date().toISOString();
    var customer = buildTrackedCartCustomer(options.customer);
    var status = options.status || (itemCount > 0 ? "open" : "emptied");
    var payload = {
      session_id: getAbandonedCartSessionId(),
      auth_user_id: isUuid(customer.authUserId) ? customer.authUserId : null,
      customer_id: customer.customerId || null,
      customer_name: customer.name || null,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      items: lines,
      item_count: itemCount,
      subtotal: subtotal,
      discount: discount,
      total: total,
      currency: "INR",
      status: status,
      source_page: getCurrentStorePage(),
      last_activity_at: now,
      updated_at: now
    };

    if (options.checkoutStarted || getCurrentStorePage() === "checkout.html") {
      payload.checkout_started_at = now;
    }
    if (options.convertedOrderId) {
      payload.status = "converted";
      payload.converted_order_id = options.convertedOrderId;
      payload.converted_at = now;
    }

    return client
      .from("abandoned_carts")
      .upsert(payload, { onConflict: "session_id" })
      .select("id")
      .maybeSingle()
      .then(function (result) {
        if (result.error) throw result.error;
        return result.data || null;
      })
      .catch(function (error) {
        logAbandonedCartWarning(error);
        return null;
      });
  }

  function scheduleAbandonedCartSync(items, options) {
    window.clearTimeout(abandonedCartSyncTimer);
    abandonedCartSyncTimer = window.setTimeout(function () {
      syncAbandonedCart(items, options);
    }, 650);
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    scheduleAbandonedCartSync(items);
  }
  function getCartTotal(items) {
    return items.reduce(function (sum, item) {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
  }

  function renderMiniCart() {
    var items = readCart();
    var totalQuantity = items.reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
    var totalPrice = getCartTotal(items);

    document.querySelectorAll(".header-cart-link .count, .cart_btn .count, .mobile-header-enhanced__cart .count").forEach(function (countEl) {
      countEl.textContent = String(totalQuantity);
    });

    var cartItemsList = document.querySelector(".cart_items_list");
    if (cartItemsList) {
      if (!items.length) {
        cartItemsList.innerHTML = '<div class="cart_item"><div class="item_content"><h4 class="item_title">Your cart is empty</h4><span class="item_price">Add products from the catalog.</span></div></div>';
      } else {
        cartItemsList.innerHTML = items.map(function (item) {
          return '' +
            '<div class="cart_item">' +
              '<div class="item_image"><img src="' + item.image + '" alt="' + item.name + '"></div>' +
              '<div class="item_content">' +
                '<h4 class="item_title">' + item.name + '</h4>' +
                '<span class="item_price">' + formatCurrency(item.price) + ' x ' + item.quantity + '</span>' +
                '<button type="button" class="remove_btn" data-remove-cart-item="' + item.productId + '"><i class="fal fa-times"></i></button>' +
              '</div>' +
            '</div>';
        }).join("");
      }
    }

    var totalPriceWrap = document.querySelector(".total_price");
    if (totalPriceWrap && totalPriceWrap.children.length > 1) {
      totalPriceWrap.children[1].textContent = formatCurrency(totalPrice);
    }
  }

  function addToCart(product, quantity) {
    var items = readCart();
    var existing = items.find(function (item) {
      return item.productId === product.productId;
    });
    var nextQuantity = Math.max(1, Number(quantity) || 1);

    if (existing) {
      existing.quantity += nextQuantity;
    } else {
      items.push({
        productId: product.productId,
        name: product.name || product.title || "Product",
        price: Number(product.price),
        image: product.image,
        quantity: nextQuantity
      });
    }

    validateCartInventory(items)
      .then(function (validation) {
        if (!validation.ok) {
          showCartFeedback(validation.message || "Requested quantity is not available.");
          return;
        }

        saveCart(items);
        renderMiniCart();
        showCartFeedback((product.name || product.title || "Product") + " added to cart");
        trackAnalyticsEvent("add_to_cart", {
          productId: product.productId,
          metadata: {
            product_name: product.name || product.title || "Product",
            price: Number(product.price) || 0,
            quantity: nextQuantity,
            cart_total: getCartTotal(items)
          }
        });
      })
      .catch(function (error) {
        debugLog("Inventory validation failed while adding to cart:", error.message);
        saveCart(items);
        renderMiniCart();
        showCartFeedback((product.name || product.title || "Product") + " added to cart");
        trackAnalyticsEvent("add_to_cart", {
          productId: product.productId,
          metadata: {
            product_name: product.name || product.title || "Product",
            price: Number(product.price) || 0,
            quantity: nextQuantity,
            cart_total: getCartTotal(items)
          }
        });
      });
  }

  function showCartFeedback(message) {
    var toast = document.querySelector(".cart-feedback-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "cart-feedback-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toast.cartFeedbackTimer);
    toast.cartFeedbackTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function removeCartItem(productId) {
    saveCart(readCart().filter(function (item) {
      return item.productId !== productId;
    }));
    renderMiniCart();
  }

  function updateCartItem(productId, quantity) {
    var items = readCart().map(function (item) {
      if (item.productId === productId) {
        item.quantity = quantity;
      }

      return item;
    }).filter(function (item) {
      return item.quantity > 0;
    });

    saveCart(items);
    renderMiniCart();
  }

  function getAvailableStock(product) {
    product = product || {};
    var stock = readNumberValue(product.stock, 0);
    var reservedStock = readNumberValue(product.reserved_stock ?? product.reservedStock, 0);
    return product.available_stock !== undefined || product.availableStock !== undefined
      ? readNumberValue(product.available_stock ?? product.availableStock, Math.max(stock - reservedStock, 0))
      : Math.max(stock - reservedStock, 0);
  }

  function isInventoryTracked(product) {
    return !product || (product.track_inventory !== false && product.trackInventory !== false);
  }

  function isBackorderAllowed(product) {
    return product && (product.allow_backorder === true || product.allowBackorder === true);
  }

  function canPurchaseProduct(product, quantity) {
    product = normalizeProduct(product);
    if (!isActiveRecord(product)) {
      return false;
    }

    if (getProductInventoryStatus(product) === "out_of_stock" && !isBackorderAllowed(product)) {
      return false;
    }

    if (!isInventoryTracked(product) || isBackorderAllowed(product)) {
      return true;
    }

    return getAvailableStock(product) >= Math.max(1, Number(quantity) || 1);
  }

  function getProductStockMessage(product, quantity) {
    product = normalizeProduct(product);

    if (!isInventoryTracked(product)) {
      return "";
    }

    if (isBackorderAllowed(product)) {
      return "Available on backorder";
    }

    var availableStock = getAvailableStock(product);
    var requested = Math.max(1, Number(quantity) || 1);
    var threshold = readNumberValue(product.low_stock_threshold ?? product.lowStockThreshold, 5);
    var inventoryStatus = getProductInventoryStatus(product);

    if (availableStock <= 0 || inventoryStatus === "out_of_stock") {
      return "This item is out of stock";
    }

    if (requested > availableStock) {
      return "Only " + availableStock + " left in stock";
    }

    if (availableStock <= threshold) {
      return "Only " + availableStock + " left";
    }

    return "In stock";
  }

  function getProductStockMessageClass(product, quantity) {
    product = normalizeProduct(product);

    if (!canPurchaseProduct(product, quantity)) {
      return "is-out-stock";
    }

    if (isInventoryTracked(product) && isBackorderAllowed(product) && getAvailableStock(product) <= 0) {
      return "is-backorder";
    }

    if (getProductInventoryStatus(product) === "low_stock") {
      return "is-low-stock";
    }

    return "is-in-stock";
  }

  function getCurrentAuthUser() {
    var client = getSupabaseClient();
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      return Promise.resolve(null);
    }

    return client.auth.getSession()
      .then(function (result) {
        var session = result && result.data ? result.data.session : null;
        return session && session.user ? session.user : null;
      })
      .catch(function () {
        return null;
      });
  }

  function buildRatingStars(average) {
    var rounded = Math.round(readNumberValue(average, 0));
    var html = "";
    for (var index = 1; index <= 5; index += 1) {
      html += '<i class="' + (index <= rounded ? "fas" : "far") + ' fa-star" aria-hidden="true"></i>';
    }
    return html;
  }

  function summarizeReviews(reviews) {
    var approved = (reviews || []).filter(function (review) {
      return review && review.is_approved === true && String(review.moderation_status || "approved").toLowerCase() === "approved";
    });
    var total = approved.reduce(function (sum, review) {
      return sum + readNumberValue(review.rating, 0);
    }, 0);
    var count = approved.length;

    return {
      average: count ? total / count : 0,
      count: count
    };
  }

  function formatRatingSummary(summary) {
    if (!summary || !summary.count) {
      return "No reviews yet";
    }

    return readNumberValue(summary.average, 0).toFixed(1) + " (" + summary.count + " review" + (summary.count === 1 ? "" : "s") + ")";
  }

  function buildRatingSummaryMarkup(summary) {
    return '<span class="rating-stars" aria-hidden="true">' + buildRatingStars(summary && summary.average) + '</span>' +
      '<span class="rating-summary-text">' + escapeHtml(formatRatingSummary(summary)) + '</span>';
  }

  function fetchApprovedReviews(productId, options) {
    var client = getSupabaseClient();
    if (!client || !isUuid(productId)) {
      return Promise.resolve([]);
    }

    return client
      .from("reviews")
      .select("id,product_id,customer_name,rating,comment,image_urls,is_verified_purchase,is_approved,moderation_status,created_at")
      .eq("product_id", productId)
      .eq("is_approved", true)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }
        return result.data || [];
      })
      .catch(function (error) {
        debugLog("Approved review fetch failed:", error.message);
        if (options && options.throwOnError) {
          throw error;
        }
        return [];
      });
  }

  function fetchReviewStats(productIds) {
    var client = getSupabaseClient();
    var ids = uniqueStrings((productIds || []).filter(isUuid));

    if (!client || !ids.length) {
      return Promise.resolve({});
    }

    return client
      .from("reviews")
      .select("product_id,rating,is_approved,moderation_status")
      .in("product_id", ids)
      .eq("is_approved", true)
      .eq("moderation_status", "approved")
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return (result.data || []).reduce(function (statsByProduct, review) {
          var productId = review.product_id;
          var current = statsByProduct[productId] || { count: 0, total: 0, average: 0 };
          current.count += 1;
          current.total += readNumberValue(review.rating, 0);
          current.average = current.count ? current.total / current.count : 0;
          statsByProduct[productId] = current;
          return statsByProduct;
        }, {});
      })
      .catch(function (error) {
        debugLog("Review stats fetch failed:", error.message);
        return {};
      });
  }

  function renderRatingSummaryElements(statsByProduct, root) {
    Array.prototype.slice.call((root || document).querySelectorAll("[data-product-rating-summary]")).forEach(function (summaryEl) {
      var productId = summaryEl.getAttribute("data-product-rating-summary");
      var summary = statsByProduct && statsByProduct[productId] ? statsByProduct[productId] : { count: 0, average: 0 };
      summaryEl.innerHTML = buildRatingSummaryMarkup(summary);
      summaryEl.classList.toggle("has-reviews", summary.count > 0);
    });
  }

  function hydrateProductRatings(root) {
    var summaryEls = Array.prototype.slice.call((root || document).querySelectorAll("[data-product-rating-summary]"));
    var productIds = uniqueStrings(summaryEls.map(function (summaryEl) {
      return summaryEl.getAttribute("data-product-rating-summary");
    }).filter(Boolean));

    if (!productIds.length) {
      return Promise.resolve({});
    }

    return fetchReviewStats(productIds).then(function (statsByProduct) {
      renderRatingSummaryElements(statsByProduct, root || document);
      return statsByProduct;
    });
  }

  function updateProductRatingSummary(scope, product) {
    var productId = getProductIdentifier(product);
    if (!scope || !productId) {
      return;
    }

    Array.prototype.slice.call(scope.querySelectorAll("[data-product-rating-summary]")).forEach(function (summaryEl) {
      summaryEl.parentNode.removeChild(summaryEl);
    });

    var anchor = scope.querySelector(".product__review, .content .title, .product__title, .title") || scope.querySelector(".content") || scope;
    anchor.insertAdjacentHTML("afterend", '<div class="product-rating-summary" data-product-rating-summary="' + escapeAttribute(productId) + '">' + buildRatingSummaryMarkup(null) + '</div>');
  }

  function buildInventoryCartPayload(items) {
    return (items || [])
      .filter(function (item) {
        return isUuid(item.productId || item.id || item.product_id);
      })
      .map(function (item) {
        return {
          product_id: item.productId || item.id || item.product_id,
          quantity: Math.max(1, Number(item.quantity) || 1)
        };
      });
  }

  function getCurrentAuthUserId() {
    var customer = window.RadiosAuth && typeof window.RadiosAuth.readCustomer === "function"
      ? window.RadiosAuth.readCustomer()
      : null;

    return customer && customer.signedIn ? (customer.authUserId || customer.auth_user_id || "") : "";
  }

  function validateCartInventory(items) {
    var payload = buildInventoryCartPayload(items);
    var client = getSupabaseClient();

    if (!payload.length || !client || typeof client.rpc !== "function") {
      return Promise.resolve({ ok: true, rows: [], message: "" });
    }

    return client.rpc("validate_cart_stock", { p_items: payload }).then(function (result) {
      if (result.error) {
        throw result.error;
      }

      var rows = result.data || [];
      var failed = rows.find(function (row) {
        return row && row.ok === false;
      });

      return {
        ok: !failed,
        rows: rows,
        message: failed ? (failed.message || "Some items are not available in the requested quantity.") : ""
      };
    });
  }

  function reserveCartInventory(items) {
    var payload = buildInventoryCartPayload(items);
    var client = getSupabaseClient();

    if (!payload.length || !client || typeof client.rpc !== "function") {
      return Promise.resolve([]);
    }

    return client.rpc("reserve_cart_stock", {
      p_items: payload,
      p_session_id: getInventorySessionId(),
      p_auth_user_id: getCurrentAuthUserId() || null
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }

      return result.data || [];
    });
  }

  function releaseCartInventory(orderId) {
    var client = getSupabaseClient();
    if (!client || typeof client.rpc !== "function") {
      return Promise.resolve(0);
    }

    return client.rpc("release_stock_reservations", {
      p_session_id: getInventorySessionId(),
      p_order_id: orderId || null
    }).then(function (result) {
      if (result.error) throw result.error;
      return result.data || 0;
    });
  }

  function releaseExpiredInventoryReservations() {
    var client = getSupabaseClient();
    if (!client || typeof client.rpc !== "function") {
      return Promise.resolve(0);
    }

    return client.rpc("release_expired_stock_reservations").then(function (result) {
      if (result.error) throw result.error;
      return result.data || 0;
    });
  }

  function completeOrderInventory(orderId, items) {
    var payload = buildInventoryCartPayload(items);
    var client = getSupabaseClient();

    if (!orderId || !payload.length || !client || typeof client.rpc !== "function") {
      return Promise.resolve(true);
    }

    return client.rpc("complete_order_inventory", {
      p_order_id: orderId,
      p_items: payload,
      p_session_id: getInventorySessionId(),
      p_auth_user_id: getCurrentAuthUserId() || null
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }
      return true;
    });
  }

  function parseStoredJson(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readStoredCustomer() {
    return parseStoredJson(CUSTOMER_KEY, null);
  }

  function readWishlistFallback() {
    return parseStoredJson(WISHLIST_FALLBACK_KEY, []);
  }

  function saveWishlistFallback(productIds) {
    localStorage.setItem(WISHLIST_FALLBACK_KEY, JSON.stringify(uniqueStrings(productIds || [])));
  }

  function getWishlistSessionId() {
    var sessionId = localStorage.getItem(WISHLIST_SESSION_KEY);

    if (!sessionId) {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        sessionId = window.crypto.randomUUID();
      } else {
        sessionId = "guest-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      }
      localStorage.setItem(WISHLIST_SESSION_KEY, sessionId);
    }

    return sessionId;
  }

  function getInventorySessionId() {
    var sessionId = localStorage.getItem(INVENTORY_SESSION_KEY);

    if (!sessionId) {
      sessionId = getWishlistSessionId();
      localStorage.setItem(INVENTORY_SESSION_KEY, sessionId);
    }

    return sessionId;
  }

  function getStoredCustomerId(customer) {
    return (customer && (customer.customerId || customer.customer_id)) || "";
  }

  function getStoredAuthUserId(customer) {
    if (!customer || !customer.signedIn) {
      return "";
    }

    return customer.authUserId || customer.auth_user_id || "";
  }

  function buildWishlistAuthIdentity(userId, customer) {
    return {
      authUserId: userId || "",
      customerId: getStoredCustomerId(customer),
      sessionId: getWishlistSessionId()
    };
  }

  function runWishlistQuery(query) {
    return query.then(function (result) {
      if (result.error) {
        throw result.error;
      }

      return result.data || [];
    });
  }

  function migrateGuestWishlistToAuth(identity) {
    var client = getSupabaseClient();
    if (!client || !identity || !identity.authUserId || !identity.sessionId) {
      return Promise.resolve(identity);
    }

    var migrationMarker = identity.authUserId + ":" + identity.sessionId;
    if (localStorage.getItem(WISHLIST_AUTH_MIGRATION_KEY) === migrationMarker) {
      return Promise.resolve(identity);
    }

    function completeMigration() {
      localStorage.setItem(WISHLIST_AUTH_MIGRATION_KEY, migrationMarker);
      return identity;
    }

    return runWishlistQuery(
      client
        .from("wishlist")
        .select("id,product_id")
        .is("auth_user_id", null)
        .eq("session_id", identity.sessionId)
    )
      .then(function (guestRows) {
        var productIds = uniqueStrings(guestRows.map(function (row) {
          return row.product_id;
        }).filter(Boolean));

        if (!guestRows.length || !productIds.length) {
          return completeMigration();
        }

        return runWishlistQuery(
          client
            .from("wishlist")
            .select("product_id")
            .eq("auth_user_id", identity.authUserId)
            .in("product_id", productIds)
        )
          .then(function (authRows) {
            var existingAuthProductIds = uniqueStrings(authRows.map(function (row) {
              return row.product_id;
            }).filter(Boolean));
            var duplicateGuestIds = [];
            var movableGuestIds = [];

            guestRows.forEach(function (row) {
              if (existingAuthProductIds.indexOf(row.product_id) !== -1) {
                duplicateGuestIds.push(row.id);
              } else {
                movableGuestIds.push(row.id);
              }
            });

            var tasks = [];

            if (duplicateGuestIds.length) {
              tasks.push(runWishlistQuery(
                client
                  .from("wishlist")
                  .delete()
                  .in("id", duplicateGuestIds)
              ));
            }

            if (movableGuestIds.length) {
              tasks.push(runWishlistQuery(
                client
                  .from("wishlist")
                  .update({
                    customer_id: identity.customerId || null,
                    auth_user_id: identity.authUserId,
                    session_id: null
                  })
                  .in("id", movableGuestIds)
              ));
            }

            return Promise.all(tasks).then(completeMigration);
          });
      })
      .catch(function (error) {
        console.warn("[Radios Store] Unable to merge guest wishlist into signed-in account.", error);
        return identity;
      });
  }

  function buildWishlistGuestIdentity() {
    return {
      authUserId: "",
      customerId: "",
      sessionId: getWishlistSessionId()
    };
  }

  function getWishlistIdentity() {
    var customer = readStoredCustomer() || {};
    var client = getSupabaseClient();

    if (client && client.auth && typeof client.auth.getSession === "function") {
      return client.auth.getSession()
        .then(function (result) {
          var session = result && result.data ? result.data.session : null;
          var user = session && session.user ? session.user : null;

          if (user && user.id) {
            return migrateGuestWishlistToAuth(buildWishlistAuthIdentity(user.id, customer));
          }

          return buildWishlistGuestIdentity();
        })
        .catch(function () {
          return buildWishlistGuestIdentity();
        });
    }

    var storedAuthUserId = getStoredAuthUserId(customer);
    if (storedAuthUserId) {
      return migrateGuestWishlistToAuth(buildWishlistAuthIdentity(storedAuthUserId, customer));
    }

    return Promise.resolve(buildWishlistGuestIdentity());
  }

  function applyWishlistIdentityFilter(query, identity) {
    if (identity && identity.authUserId) {
      return query.eq("auth_user_id", identity.authUserId);
    }

    return query
      .is("auth_user_id", null)
      .eq("session_id", identity && identity.sessionId ? identity.sessionId : getWishlistSessionId());
  }

  var wishlistState = {
    productIds: readWishlistFallback()
  };

  function isWishlisted(productId) {
    return wishlistState.productIds.indexOf(String(productId || "")) !== -1;
  }

  function setWishlistState(productIds) {
    wishlistState.productIds = uniqueStrings((productIds || []).map(function (id) {
      return String(id || "");
    }).filter(Boolean));

    saveWishlistFallback(wishlistState.productIds);
    updateWishlistCount(wishlistState.productIds.length);
    applyWishlistButtonStates();
  }

  function setWishlistProductState(productId, active) {
    productId = String(productId || "");
    if (!productId) {
      return;
    }

    var next = wishlistState.productIds.slice();
    var index = next.indexOf(productId);

    if (active && index === -1) {
      next.push(productId);
    } else if (!active && index !== -1) {
      next.splice(index, 1);
    }

    setWishlistState(next);
  }

  function updateWishlistCount(count) {
    document.querySelectorAll(".wishlist-icon .count, .mobile-header-enhanced__wishlist .count, [data-wishlist-count]").forEach(function (countEl) {
      countEl.textContent = String(Math.max(0, Number(count) || 0));
    });
  }

  function applyWishlistButtonStates() {
    document.querySelectorAll("[data-wishlist-toggle]").forEach(function (button) {
      var productId = button.getAttribute("data-wishlist-toggle");
      var active = isWishlisted(productId);
      var icon = button.querySelector("i");

      button.classList.toggle("is-wishlisted", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("title", active ? "Remove from wishlist" : "Add to wishlist");
      button.setAttribute("aria-label", (active ? "Remove from wishlist: " : "Add to wishlist: ") + (button.getAttribute("data-product-name") || "Product"));

      if (icon) {
        icon.classList.toggle("fas", active);
        icon.classList.toggle("far", !active);
      }
    });
  }

  function fetchWishlistRows() {
    var client = getSupabaseClient();
    if (!client) {
      return Promise.reject(new Error("Wishlist storage is unavailable"));
    }

    return getWishlistIdentity().then(function (identity) {
      var query = client
        .from("wishlist")
        .select("id,customer_id,auth_user_id,session_id,product_id,created_at")
        .order("created_at", { ascending: false });

      return applyWishlistIdentityFilter(query, identity).then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return result.data || [];
      });
    });
  }

  function fetchWishlistProducts(productIds) {
    var client = getSupabaseClient();
    var ids = uniqueStrings(productIds || []);

    if (!client || !ids.length) {
      return Promise.resolve([]);
    }

    return client
      .from("products")
      .select("*")
      .in("id", ids)
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        return getVisibleProducts(result.data || []);
      });
  }

  function mapFallbackWishlistProducts(productIds, products) {
    var fallbackIds = uniqueStrings(productIds || []);

    return (products || []).filter(function (product) {
      return fallbackIds.indexOf(getProductIdentifier(product)) !== -1;
    }).map(function (product) {
      return {
        row: {
          product_id: getProductIdentifier(product),
          session_id: getWishlistSessionId(),
          created_at: ""
        },
        product: product
      };
    });
  }

  function fetchFallbackWishlistItems(productIds) {
    var fallbackIds = uniqueStrings(productIds || []);

    if (!fallbackIds.length) {
      return Promise.resolve([]);
    }

    return fetchWishlistProducts(fallbackIds)
      .then(function (products) {
        if (!products.length) {
          throw new Error("No wishlist products found in Supabase");
        }

        return mapFallbackWishlistProducts(fallbackIds, products);
      })
      .catch(function () {
        return fetchDashcodeJson("/products")
          .then(function (response) {
            return mapFallbackWishlistProducts(fallbackIds, extractProductList(response));
          })
          .catch(function () {
            return [];
          });
      });
  }

  function fetchWishlistItems() {
    return fetchWishlistRows()
      .then(function (rows) {
        var productIds = uniqueStrings(rows.map(function (row) {
          return row.product_id;
        }).filter(Boolean));

        if (!productIds.length && readWishlistFallback().length) {
          setWishlistState(readWishlistFallback());
          return fetchFallbackWishlistItems(readWishlistFallback());
        }

        setWishlistState(productIds);

        if (!productIds.length) {
          return [];
        }

        return fetchWishlistProducts(productIds).then(function (products) {
          var productsById = {};
          products.forEach(function (product) {
            productsById[getProductIdentifier(product)] = product;
          });

          return rows.map(function (row) {
            return {
              row: row,
              product: productsById[row.product_id] || null
            };
          }).filter(function (item) {
            return item.product;
          });
        });
      })
      .catch(function (error) {
        console.warn("[Radios Store] Wishlist fetch failed; using local cache.", error);
        var fallbackIds = readWishlistFallback();
        setWishlistState(fallbackIds);

        return fetchFallbackWishlistItems(fallbackIds);
      });
  }

  function syncWishlistToggle(productId, shouldAdd) {
    var client = getSupabaseClient();
    if (!client || !productId) {
      return Promise.reject(new Error("Wishlist storage is unavailable"));
    }

    return getWishlistIdentity().then(function (identity) {
      var existingQuery = client
        .from("wishlist")
        .select("id")
        .eq("product_id", productId)
        .limit(1);

      return applyWishlistIdentityFilter(existingQuery, identity).then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var existing = result.data && result.data[0];

        if (shouldAdd) {
          if (existing) {
            return existing;
          }

          var payload = {
            customer_id: identity.customerId || null,
            auth_user_id: identity.authUserId || null,
            session_id: identity.authUserId ? null : (identity.sessionId || getWishlistSessionId()),
            product_id: productId
          };

          return client
            .from("wishlist")
            .insert(payload)
            .select("id")
            .single()
            .then(function (insertResult) {
              if (insertResult.error && insertResult.error.code !== "23505") {
                throw insertResult.error;
              }
              return insertResult.data || payload;
            });
        }

        var deleteQuery = client
          .from("wishlist")
          .delete()
          .eq("product_id", productId);

        return applyWishlistIdentityFilter(deleteQuery, identity).then(function (deleteResult) {
          if (deleteResult.error) {
            throw deleteResult.error;
          }

          return null;
        });
      });
    });
  }

  function refreshWishlistState() {
    return fetchWishlistRows()
      .then(function (rows) {
        var remoteProductIds = rows.map(function (row) {
          return row.product_id;
        }).filter(Boolean);

        setWishlistState(remoteProductIds.length ? remoteProductIds : readWishlistFallback());
      })
      .catch(function () {
        setWishlistState(readWishlistFallback());
      });
  }

  function buildWishlistAction(product) {
    product = normalizeProduct(product);
    var productId = getProductIdentifier(product);
    var productName = getProductName(product);

    return '<a href="wishlist.html" data-wishlist-toggle="' + escapeAttribute(productId) + '" data-product-name="' + escapeAttribute(productName) + '" aria-pressed="false" title="Add to wishlist"><i class="far fa-heart"></i></a>';
  }

  function buildAddToCartAction(product, productImage, price) {
    var productId = getProductIdentifier(product);
    var productName = getProductName(product);

    if (!canPurchaseProduct(product, 1)) {
      return '<a href="' + getProductUrl(product) + '" class="is-out-of-stock" aria-disabled="true" title="Out of stock"><i class="far fa-ban"></i></a>';
    }

    return '<a href="cart.html" data-add-to-cart="' + escapeAttribute(productId) + '" data-product-name="' + escapeAttribute(productName) + '" data-product-price="' + price + '" data-product-image="' + escapeAttribute(productImage) + '"><i class="far fa-shopping-basket"></i></a>';
  }

  function buildProductCard(product, index) {
    product = normalizeProduct(product);
    var productId = getProductIdentifier(product);
    var productUrl = getProductUrl(product);
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var productName = getProductName(product);
    var categoryLabel = getProductSubcategory(product) || getProductPrimaryCategory(product) || product.category;
    var price = readNumberValue(product.price, 0);
    var stock = getAvailableStock(product);
    var stockMessage = getProductStockMessage(product, 1);
    var stockMessageClass = getProductStockMessageClass(product, 1);
    var oldPriceText = getProductOldPriceText(product, 299);
    var description = product.description || product.desc || product.subtitle || "";

    return '' +
      '<li class="product">' +
        '<div class="product-holder">' +
          buildStorefrontBadgeMarkup(product) +
          '<a href="' + productUrl + '"><img src="' + escapeAttribute(productImage) + '" alt="' + escapeAttribute(productName) + '" ' + buildProductImageAttrs(index || 0) + '></a>' +
          '<ul class="product__action">' +
            '<li><a href="' + productUrl + '"><i class="far fa-compress-alt"></i></a></li>' +
            '<li>' + buildAddToCartAction(product, productImage, price) + '</li>' +
            '<li>' + buildWishlistAction(product) + '</li>' +
          '</ul>' +
        '</div>' +
        '<div class="product-info">' +
          '<div class="product__review ul_li"><span>' + escapeHtml(categoryLabel) + '</span></div>' +
          '<div class="product-rating-summary" data-product-rating-summary="' + escapeAttribute(productId) + '">' + buildRatingSummaryMarkup(null) + '</div>' +
          '<h2 class="product__title"><a href="' + productUrl + '">' + escapeHtml(productName) + '</a></h2>' +
          '<span class="product__available">Available: <span>' + stock + '</span></span>' +
          '<div class="product__progress progress color-primary"><div class="progress-bar" role="progressbar" style="width: ' + Math.min(100, Math.max(0, stock)) + '%"></div></div>' +
          '<span class="product-stock-message ' + stockMessageClass + '">' + escapeHtml(stockMessage) + '</span>' +
          '<h4 class="product__price"><span class="new">' + formatCurrency(price) + '</span><span class="old">' + escapeHtml(oldPriceText) + '</span></h4>' +
          '<p class="product-description">' + escapeHtml(description) + '</p>' +
        '</div>' +
      '</li>';
  }

  /**
   * Extract an array of products from the API response.
   * The Dashcode API returns { status, data: Product[] }
   * Legacy product endpoints may return { items: Product[], pagination }.
   */
  function extractProductList(response) {
    if (Array.isArray(response.data)) {
      return normalizeProducts(response.data);
    }

    if (Array.isArray(response.items)) {
      return normalizeProducts(response.items);
    }

    if (Array.isArray(response)) {
      return normalizeProducts(response);
    }

    return [];
  }

  function extractList(response) {
    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  }

  function readAppliedDiscountCode() {
    return String(localStorage.getItem(APPLIED_DISCOUNT_KEY) || "").trim().toUpperCase();
  }

  function saveAppliedDiscountCode(code) {
    localStorage.setItem(APPLIED_DISCOUNT_KEY, String(code || "").trim().toUpperCase());
  }

  function clearAppliedDiscountCode() {
    localStorage.removeItem(APPLIED_DISCOUNT_KEY);
  }

  function setCouponStatus(form, message, type) {
    if (!form) {
      return;
    }

    var statusEl = form.querySelector(".coupon-feedback");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.className = "coupon-feedback";
      form.appendChild(statusEl);
    }

    statusEl.textContent = message || "";
    statusEl.className = "coupon-feedback" + (type ? " is-" + type : "");
    statusEl.style.marginTop = "12px";
    statusEl.style.fontSize = "14px";
    statusEl.style.color = type === "error" ? "#c62828" : "#1b5e20";
    statusEl.style.display = message ? "block" : "none";
  }

  function normalizeDiscountScope(value) {
    var scope = String(value || "all").toLowerCase();

    if (["product", "products", "specific_products"].indexOf(scope) !== -1) {
      return "specific_products";
    }

    if (["category", "categories", "specific_categories"].indexOf(scope) !== -1) {
      return "specific_categories";
    }

    if (["collection", "collections", "specific_collections"].indexOf(scope) !== -1) {
      return "specific_collections";
    }

    return "all_products";
  }

  function normalizeDiscount(discount) {
    if (!discount || typeof discount !== "object") {
      return discount;
    }

    var promotionType = String(discount.promotionType || discount.promotion_type || discount.method || "").toLowerCase();
    var discountType = String(discount.discountType || discount.discount_type || discount.type || "percentage").toLowerCase();
    var appliesTo = String(discount.appliesTo || discount.applies_to || discount.targetScope || discount.target_scope || "all").toLowerCase();
    var discountCategory = discount.discountCategory || discount.discount_category;
    var value = discount.discountValue ?? discount.discount_value ?? discount.value ?? discount.amount ?? 0;
    var method = String(discount.method || "").toLowerCase();

    if (!discountCategory) {
      if (discountType === "free_shipping") {
        discountCategory = "free_shipping";
      } else if (discountType === "buy_x_get_y" || promotionType === "buy_x_get_y" || promotionType === "combo_offer") {
        discountCategory = "buy_x_get_y";
      } else if (["all", "order", "all_products"].indexOf(appliesTo) !== -1) {
        discountCategory = "order_discount";
      } else {
        discountCategory = "product_discount";
      }
    }

    if (!method) {
      method = ["automatic_discount", "category_offer", "combo_offer", "first_order_offer", "free_shipping", "buy_x_get_y"].indexOf(promotionType) !== -1 || !discount.code
        ? "automatic"
        : "code";
    }

    return Object.assign({}, discount, {
      code: discount.code ? String(discount.code).trim().toUpperCase() : "",
      title: discount.title || discount.name || discount.code || "Promotion",
      description: discount.description || discount.summary || "",
      status: discount.status || (discount.is_active === false || discount.isActive === false ? "inactive" : "active"),
      is_active: discount.is_active !== false && discount.isActive !== false,
      discountCategory: discountCategory,
      discount_type: discountType,
      discountType: discountType,
      discountValue: readNumberValue(value, 0),
      discount_value: readNumberValue(value, 0),
      value: readNumberValue(value, 0),
      type: discountType === "fixed_amount" ? "fixed_amount" : "percentage",
      promotionType: promotionType || (method === "automatic" ? "automatic_discount" : "coupon_code"),
      promotion_type: promotionType || (method === "automatic" ? "automatic_discount" : "coupon_code"),
      appliesTo: appliesTo,
      applies_to: appliesTo,
      method: method,
      valueType: discount.valueType || discount.value_type || discountType,
      targetScope: discount.targetScope || discount.target_scope || normalizeDiscountScope(appliesTo),
      targetProductIds: discount.targetProductIds || discount.target_product_ids || discount.selectedProductIds || discount.selected_product_ids || discount.product_ids || discount.productIds,
      targetCollectionIds: discount.targetCollectionIds || discount.target_collection_ids || discount.collection_ids || discount.collectionIds,
      targetCategorySlugs: discount.targetCategorySlugs || discount.target_category_slugs || discount.category_slugs || discount.categorySlugs,
      targetCategoryIds: discount.targetCategoryIds || discount.target_category_ids || discount.category_ids || discount.categoryIds,
      targetTags: discount.targetTags || discount.target_tags || discount.tags,
      minOrderAmount: discount.minOrderAmount ?? discount.min_order_amount ?? discount.minimum_order_amount,
      minQuantity: discount.minQuantity ?? discount.min_quantity,
      usageLimit: discount.usageLimit ?? discount.usage_limit,
      usedCount: discount.usedCount ?? discount.used_count,
      usageLimitPerCustomer: discount.usageLimitPerCustomer ?? discount.usage_limit_per_customer,
      oncePerCustomer: discount.oncePerCustomer ?? discount.once_per_customer,
      startsAt: discount.startsAt || discount.starts_at,
      endsAt: discount.endsAt || discount.ends_at || discount.expires_at || discount.expiresAt,
      buyQuantity: discount.buyQuantity ?? discount.buy_quantity,
      getQuantity: discount.getQuantity ?? discount.get_quantity,
      buyTargetScope: discount.buyTargetScope || discount.buy_target_scope || normalizeDiscountScope(appliesTo),
      buyProductIds: discount.buyProductIds || discount.buy_product_ids || discount.product_ids || discount.productIds,
      buyCollectionIds: discount.buyCollectionIds || discount.buy_collection_ids || discount.collection_ids || discount.collectionIds,
      buyCategorySlugs: discount.buyCategorySlugs || discount.buy_category_slugs || discount.category_slugs || discount.categorySlugs,
      getTargetScope: discount.getTargetScope || discount.get_target_scope || normalizeDiscountScope(appliesTo),
      getProductIds: discount.getProductIds || discount.get_product_ids || discount.product_ids || discount.productIds,
      getCollectionIds: discount.getCollectionIds || discount.get_collection_ids || discount.collection_ids || discount.collectionIds,
      getCategorySlugs: discount.getCategorySlugs || discount.get_category_slugs || discount.category_slugs || discount.categorySlugs,
      maxDiscount: discount.maxDiscount ?? discount.max_discount ?? discount.maximum_discount_amount,
      isFirstOrderOnly: discount.isFirstOrderOnly ?? discount.is_first_order_only,
      combinesWithProductDiscounts: discount.combinesWithProductDiscounts ?? discount.combines_with_product_discounts ?? discount.combine_with_other_discounts,
      combinesWithOrderDiscounts: discount.combinesWithOrderDiscounts ?? discount.combines_with_order_discounts ?? discount.combine_with_other_discounts,
      combinesWithShippingDiscounts: discount.combinesWithShippingDiscounts ?? discount.combines_with_shipping_discounts ?? discount.combine_with_other_discounts,
      combine_with_other_discounts: discount.combine_with_other_discounts === true
    });
  }

  function isDiscountActive(discount) {
    discount = normalizeDiscount(discount);

    if (!discount || discount.status !== "active" || discount.is_active === false) {
      return false;
    }

    var now = Date.now();
    var startsAt = discount.startsAt ? new Date(discount.startsAt).getTime() : 0;
    var endsAt = discount.endsAt || discount.expiresAt ? new Date(discount.endsAt || discount.expiresAt).getTime() : 0;

    if (startsAt && !Number.isNaN(startsAt) && startsAt > now) {
      return false;
    }

    if (endsAt && !Number.isNaN(endsAt) && endsAt < now) {
      return false;
    }

    return true;
  }

  function buildCollectionProductResolver(products, collections) {
    var byId = {};
    var bySlug = {};

    (collections || []).forEach(function (collection) {
      byId[collection.id] = collection;
      bySlug[collection.slug] = collection;
    });

    function productMatchesCollectionCondition(product, condition) {
      var rawValue =
        condition.field === "title" ? getProductName(product) :
        condition.field === "category" ? getProductPrimaryCategory(product) :
        condition.field === "tag" ? getProductTags(product).join(", ") :
        condition.field === "price" ? String(Number(product.price) || 0) :
        condition.field === "stock" ? String(Number(product.stock) || 0) :
        product.sku || "";

      var left = String(rawValue || "").toLowerCase();
      var right = String(condition.value || "").toLowerCase();

      if (condition.operator === "equals") return left === right;
      if (condition.operator === "not_equals") return left !== right;
      if (condition.operator === "contains") return left.indexOf(right) !== -1;
      if (condition.operator === "not_contains") return left.indexOf(right) === -1;
      if (condition.operator === "starts_with") return left.indexOf(right) === 0;
      if (condition.operator === "ends_with") return left.lastIndexOf(right) === left.length - right.length;
      if (condition.operator === "greater_than") return Number(rawValue) > Number(condition.value);
      if (condition.operator === "less_than") return Number(rawValue) < Number(condition.value);
      return false;
    }

    function getCollectionProducts(collection) {
      if (!collection) {
        return [];
      }

      if (collection.collectionType === "manual") {
        return products.filter(function (product) {
          return (collection.productIds || []).indexOf(getProductIdentifier(product)) !== -1;
        });
      }

      var conditions = (collection.conditions || []).filter(function (condition) {
        return condition && String(condition.value || "").trim();
      });

      if (!conditions.length) {
        return [];
      }

      return products.filter(function (product) {
        var results = conditions.map(function (condition) {
          return productMatchesCollectionCondition(product, condition);
        });
        return collection.conditionsMatch === "any" ? results.some(Boolean) : results.every(Boolean);
      });
    }

    return {
      byId: byId,
      bySlug: bySlug,
      getCollectionProducts: getCollectionProducts
    };
  }

  function resolveScopeProducts(products, collectionsResolver, scope, productIds, collectionIds, categorySlugs) {
    if (scope === "specific_products") {
      return products.filter(function (product) {
        return (productIds || []).indexOf(getProductIdentifier(product)) !== -1;
      });
    }

    if (scope === "specific_collections") {
      var seen = {};
      var collected = [];
      (collectionIds || []).forEach(function (collectionId) {
        collectionsResolver.getCollectionProducts(collectionsResolver.byId[collectionId]).forEach(function (product) {
          var id = getProductIdentifier(product);
          if (!seen[id]) {
            seen[id] = true;
            collected.push(product);
          }
        });
      });
      return collected;
    }

    if (scope === "specific_categories") {
      return products.filter(function (product) {
        return (categorySlugs || []).indexOf(slugify(getProductPrimaryCategory(product))) !== -1;
      });
    }

    return products.slice();
  }

  function calculateDiscountCandidate(discount, cartItems, products, collectionsResolver) {
    discount = normalizeDiscount(discount);

    if (!isDiscountActive(discount)) {
      return null;
    }

    var cartLines = cartItems.map(function (item) {
      var matchedProduct = products.find(function (product) {
        return getProductIdentifier(product) === item.productId;
      });
      return {
        item: item,
        product: matchedProduct || item,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0
      };
    }).filter(function (line) {
      return line.quantity > 0;
    });

    var subtotal = cartLines.reduce(function (sum, line) {
      return sum + (line.price * line.quantity);
    }, 0);
    var totalQuantity = cartLines.reduce(function (sum, line) {
      return sum + line.quantity;
    }, 0);

    if (discount.requirementType === "minimum_purchase_amount" && subtotal < (Number(discount.minOrderAmount) || 0)) {
      return null;
    }

    if (discount.requirementType === "minimum_quantity" && totalQuantity < (Number(discount.minQuantity) || 0)) {
      return null;
    }

    var impact = {
      discountAmount: 0,
      shippingDiscountAmount: 0,
      title: discount.title || discount.code,
      code: discount.code,
      method: discount.method || "code",
      discount: discount
    };

    if (discount.discountCategory === "free_shipping") {
      impact.shippingDiscountAmount = 0;
      return impact;
    }

    if (discount.discountCategory === "buy_x_get_y") {
      var buyScope = discount.buyTargetScope || "all_products";
      var getScope = discount.getTargetScope || "all_products";
      var buyPool = resolveScopeProducts(
        products,
        collectionsResolver,
        buyScope,
        discount.buyProductIds,
        discount.buyCollectionIds,
        discount.buyCategorySlugs
      );
      var getPool = resolveScopeProducts(
        products,
        collectionsResolver,
        getScope,
        discount.getProductIds,
        discount.getCollectionIds,
        discount.getCategorySlugs
      );
      var cartProductIds = cartLines.map(function (line) {
        return getProductIdentifier(line.product);
      });
      var buyIds = buyScope === "all_products" ? cartProductIds : buyPool.map(getProductIdentifier);
      var getIds = getScope === "all_products" ? cartProductIds : getPool.map(getProductIdentifier);
      var buyQty = cartLines.reduce(function (sum, line) {
        return sum + (buyIds.indexOf(getProductIdentifier(line.product)) !== -1 ? line.quantity : 0);
      }, 0);
      var getQty = cartLines.reduce(function (sum, line) {
        return sum + (getIds.indexOf(getProductIdentifier(line.product)) !== -1 ? line.quantity : 0);
      }, 0);
      var buyQuantity = Math.max(1, Number(discount.buyQuantity) || 1);
      var getQuantity = Math.max(1, Number(discount.getQuantity) || 1);
      var buyGetOverlap = cartLines.some(function (line) {
        var productId = getProductIdentifier(line.product);
        return buyIds.indexOf(productId) !== -1 && getIds.indexOf(productId) !== -1;
      });
      var allowedSets = buyGetOverlap
        ? Math.floor(getQty / (buyQuantity + getQuantity))
        : Math.min(Math.floor(buyQty / buyQuantity), Math.floor(getQty / getQuantity));
      if (!allowedSets) {
        return null;
      }

      var discountedUnits = allowedSets * getQuantity;
      var getLines = cartLines.filter(function (line) {
        return getIds.indexOf(getProductIdentifier(line.product)) !== -1;
      }).sort(function (left, right) {
        return left.price - right.price;
      });

      getLines.forEach(function (line) {
        if (discountedUnits <= 0) {
          return;
        }
        var units = Math.min(discountedUnits, line.quantity);
        discountedUnits -= units;
        impact.discountAmount += line.price * units;
      });

      return impact.discountAmount > 0 ? impact : null;
    }

    var eligibleProducts = discount.discountCategory === "order_discount"
      ? products.slice()
      : resolveScopeProducts(
          products,
          collectionsResolver,
          discount.targetScope || "all_products",
          discount.targetProductIds || discount.selectedProductIds,
          discount.targetCollectionIds,
          discount.targetCategorySlugs
        );
    var eligibleIds = eligibleProducts.map(getProductIdentifier);
    var eligibleSubtotal = cartLines.reduce(function (sum, line) {
      return sum + (eligibleIds.indexOf(getProductIdentifier(line.product)) !== -1 ? line.price * line.quantity : 0);
    }, 0);

    if (!eligibleSubtotal) {
      return null;
    }

    if (discount.type === "percentage") {
      impact.discountAmount = eligibleSubtotal * ((Number(discount.value) || 0) / 100);
    } else {
      impact.discountAmount = Number(discount.value) || 0;
    }

    if (Number(discount.maxDiscount) > 0) {
      impact.discountAmount = Math.min(impact.discountAmount, Number(discount.maxDiscount));
    }

    impact.discountAmount = Math.min(impact.discountAmount, eligibleSubtotal);
    return impact.discountAmount > 0 ? impact : null;
  }

  function isAutomaticDiscountMethod(discount) {
    discount = normalizeDiscount(discount);
    var method = String(discount && discount.method || "code").toLowerCase();

    if (method === "automatic") {
      return true;
    }

    if (
      discount &&
      discount.discountCategory === "buy_x_get_y" &&
      discount.autoApply !== false &&
      discount.appliesAutomatically !== false
    ) {
      return true;
    }

    return false;
  }

  function combineDiscountCandidates(primary, secondary) {
    if (!primary) return secondary;
    if (!secondary) return primary;

    var primaryCategory = primary.discount.discountCategory;
    var secondaryCategory = secondary.discount.discountCategory;
    var primaryAllows =
      (secondaryCategory === "product_discount" && primary.discount.combinesWithProductDiscounts) ||
      (secondaryCategory === "order_discount" && primary.discount.combinesWithOrderDiscounts) ||
      (secondaryCategory === "free_shipping" && primary.discount.combinesWithShippingDiscounts);
    var secondaryAllows =
      (primaryCategory === "product_discount" && secondary.discount.combinesWithProductDiscounts) ||
      (primaryCategory === "order_discount" && secondary.discount.combinesWithOrderDiscounts) ||
      (primaryCategory === "free_shipping" && secondary.discount.combinesWithShippingDiscounts);

    if (!primaryAllows || !secondaryAllows) {
      return (primary.discountAmount + primary.shippingDiscountAmount) >= (secondary.discountAmount + secondary.shippingDiscountAmount)
        ? primary
        : secondary;
    }

    return {
      discountAmount: primary.discountAmount + secondary.discountAmount,
      shippingDiscountAmount: primary.shippingDiscountAmount + secondary.shippingDiscountAmount,
      title: [primary.title, secondary.title].join(" + "),
      code: primary.code || secondary.code,
      method: secondary.method === "code" ? secondary.method : primary.method,
      discount: secondary.discount
    };
  }

  function evaluateCartDiscounts(cartItems, products, collections, discounts, appliedCode) {
    var collectionsResolver = buildCollectionProductResolver(products, collections);
    var normalizedDiscounts = (discounts || []).map(normalizeDiscount);
    var automaticCandidates = normalizedDiscounts
      .filter(function (discount) {
        return isAutomaticDiscountMethod(discount);
      })
      .map(function (discount) {
        return calculateDiscountCandidate(discount, cartItems, products, collectionsResolver);
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return (right.discountAmount + right.shippingDiscountAmount) - (left.discountAmount + left.shippingDiscountAmount);
      });
    var bestAutomatic = automaticCandidates[0] || null;
    var codeCandidate = null;

    if (appliedCode) {
      var matched = normalizedDiscounts.find(function (discount) {
        return String(discount.code || "").toUpperCase() === appliedCode;
      });
      codeCandidate = matched ? calculateDiscountCandidate(matched, cartItems, products, collectionsResolver) : null;
    }

    var selected = combineDiscountCandidates(bestAutomatic, codeCandidate);

    return {
      appliedCode: appliedCode,
      selectedDiscount: selected,
      collectionsResolver: collectionsResolver
    };
  }

  function fetchSupabaseCollections() {
    var client = getSupabaseClient();
    if (!client) {
      return Promise.reject(new Error("Supabase collections are unavailable"));
    }

    return client
      .from("collections")
      .select("*")
      .then(function (result) {
        if (result.error) throw result.error;
        return (result.data || [])
          .filter(isActiveRecord)
          .sort(function (left, right) {
            return readNumberValue(left.sort_order ?? left.sortOrder, 0) - readNumberValue(right.sort_order ?? right.sortOrder, 0);
          });
      });
  }

  function fetchStorefrontCollections() {
    return fetchDashcodeJson("/collections?active=true")
      .then(extractList)
      .then(function (collections) {
        return collections.length ? collections : fetchSupabaseCollections();
      })
      .catch(function (error) {
        debugLog("Dashcode collections unavailable; loading collections from Supabase:", error.message);
        return fetchSupabaseCollections().catch(function () { return []; });
      });
  }

  function loadMerchandisingData() {
    return Promise.all([
      fetchStorefrontProducts().catch(function () { return []; }),
      fetchStorefrontCollections(),
      fetchStorefrontDiscounts()
    ]).then(function (results) {
      return {
        products: getVisibleProducts(results[0]),
        collections: results[1],
        discounts: results[2]
      };
    });
  }

  function getCurrentCustomerEmail(fallbackEmail) {
    if (fallbackEmail) {
      return String(fallbackEmail || "").trim();
    }

    var customer = window.RadiosAuth && typeof window.RadiosAuth.readCustomer === "function"
      ? window.RadiosAuth.readCustomer()
      : null;

    return String(customer && (customer.email || customer.customerEmail) || localStorage.getItem("radios-customer-email") || "").trim();
  }

  function findProductForCartItem(item, products) {
    var itemId = String(item && (item.productId || item.product_id || item.id) || "");
    return (products || []).find(function (product) {
      return String(getProductIdentifier(product)) === itemId;
    }) || null;
  }

  function buildPromotionCartItems(cartItems, products) {
    return (cartItems || []).map(function (item) {
      var product = findProductForCartItem(item, products) || item || {};
      var productId = item.productId || item.product_id || item.id || getProductIdentifier(product);
      var categorySlug = product.categorySlug || product.category_slug || item.categorySlug || item.category_slug || getProductPrimaryCategory(product) || item.category || "";
      var collectionIds = normalizeStringList(product.collection_ids || product.collectionIds || item.collection_ids || item.collectionIds);

      return {
        product_id: isUuid(productId) ? productId : null,
        product_ref: productId || "",
        name: item.name || item.title || getProductName(product),
        price: readNumberValue(item.price ?? product.price, 0),
        quantity: Math.max(1, readNumberValue(item.quantity, 1)),
        category: getProductPrimaryCategory(product) || item.category || "",
        category_slug: normalizeCategorySlug(categorySlug),
        category_id: product.category_id || product.categoryId || item.category_id || item.categoryId || null,
        collection_ids: collectionIds,
        tags: getProductTags(product).concat(normalizeStringList(item.tags))
      };
    });
  }

  function normalizePromotionValidationRow(row, cartItems, products, appliedCode, subtotal, options) {
    row = row || {};
    options = options || {};

    var isValid = row.is_valid === true;
    var itemDiscountAmount = isValid ? readNumberValue(row.discount_amount, 0) : 0;
    var shippingDiscountAmount = isValid && row.discount_type === "free_shipping"
      ? Math.max(0, readNumberValue(options.deliveryCharge, 0))
      : 0;
    var discount = row.discount_id ? normalizeDiscount({
      id: row.discount_id,
      code: row.discount_code || appliedCode,
      title: row.title,
      discount_type: row.discount_type,
      promotion_type: row.promotion_type,
      applies_to: row.applies_to,
      is_active: true
    }) : null;
    var selected = isValid && discount ? {
      discountAmount: itemDiscountAmount,
      shippingDiscountAmount: shippingDiscountAmount,
      title: row.title || row.discount_code || "Promotion",
      code: row.discount_code || appliedCode || "",
      method: appliedCode ? "code" : "automatic",
      discount: discount
    } : null;
    var message = row.message || "";
    var type = "";

    if (isValid) {
      if (appliedCode) {
        message = row.message && row.applies_to === "category" ? row.message : "Coupon " + appliedCode + " applied successfully.";
      } else if (selected) {
        message = row.message || (selected.title + " applied automatically.");
      }
      type = "success";
    } else if (appliedCode) {
      type = "error";
      message = message || "Coupon " + appliedCode + " is not applicable for the current cart.";
    }

    return {
      appliedCode: appliedCode,
      discountAmount: itemDiscountAmount,
      discountId: row.discount_id || "",
      evaluation: {
        selectedDiscount: selected,
        source: "supabase_rpc"
      },
      message: message,
      promotionCartItems: buildPromotionCartItems(cartItems, products),
      selectedDiscount: selected,
      shippingDiscountAmount: shippingDiscountAmount,
      subtotal: subtotal,
      total: Math.max(0, subtotal - itemDiscountAmount),
      type: type
    };
  }

  function validateDiscountWithSupabase(cartItems, products, appliedCode, subtotal, options) {
    var client = getSupabaseClient();
    if (!client || typeof client.rpc !== "function") {
      return Promise.reject(new Error("Supabase promotion RPC is unavailable"));
    }

    var payload = buildPromotionCartItems(cartItems, products);
    return client.rpc("validate_discount", {
      coupon_code: appliedCode || null,
      cart_items: payload,
      order_subtotal: subtotal,
      auth_user_id: isUuid(options && options.authUserId) ? options.authUserId : (isUuid(getCurrentAuthUserId()) ? getCurrentAuthUserId() : null),
      customer_email: getCurrentCustomerEmail(options && options.customerEmail) || null
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }

      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return normalizePromotionValidationRow(row, cartItems, products, appliedCode, subtotal, options);
    });
  }

  function buildDiscountStatus(evaluation, appliedCode) {
    var selected = evaluation && evaluation.selectedDiscount;
    var selectedRule = selected && selected.discount;
    var hasDiscount = selected && (selected.discountAmount > 0 || selected.shippingDiscountAmount > 0);
    var selectedAutomatically = hasDiscount && (
      selected.method === "automatic" ||
      (!appliedCode && selectedRule && selectedRule.discountCategory === "buy_x_get_y")
    );

    if (selectedAutomatically) {
      return {
        message: (selected.title || "Discount") + " applied automatically.",
        type: "success"
      };
    }

    if (appliedCode && hasDiscount) {
      return {
        message: "Coupon " + appliedCode + " applied successfully.",
        type: "success"
      };
    }

    if (appliedCode && !hasDiscount) {
      return {
        message: "Coupon " + appliedCode + " is not applicable for the current cart.",
        type: "error"
      };
    }

    return {
      message: "",
      type: ""
    };
  }

  function evaluateSharedCartDiscounts(cartItems, appliedCode, options) {
    var items = Array.isArray(cartItems) ? cartItems : readCart();
    var code = String(appliedCode || "").trim().toUpperCase() || readAppliedDiscountCode();
    var subtotal = getCartTotal(items);
    options = options || {};

    return loadMerchandisingData().then(function (data) {
      return validateDiscountWithSupabase(items, data.products, code, subtotal, options)
        .catch(function (error) {
          debugLog("Supabase promotion validation unavailable; using storefront fallback:", error.message);
          var evaluation = evaluateCartDiscounts(items, data.products, data.collections, data.discounts, code);
          var selected = evaluation.selectedDiscount;
          var discountAmount = selected ? selected.discountAmount : 0;
          var shippingDiscountAmount = selected ? selected.shippingDiscountAmount : 0;
          var status = buildDiscountStatus(evaluation, code);

          return {
            appliedCode: code,
            discountAmount: discountAmount,
            discountId: selected && selected.discount ? getDiscountIdentifier(selected.discount) : "",
            evaluation: evaluation,
            message: status.message,
            promotionCartItems: buildPromotionCartItems(items, data.products),
            selectedDiscount: selected,
            shippingDiscountAmount: shippingDiscountAmount,
            subtotal: subtotal,
            total: Math.max(0, subtotal - discountAmount),
            type: status.type
          };
        });
    });
  }

  function finalizeDiscountRedemption(orderId, cartItems, options) {
    options = options || {};
    var client = getSupabaseClient();
    var evaluation = options.evaluation || {};
    var selected = evaluation.selectedDiscount || (evaluation.evaluation && evaluation.evaluation.selectedDiscount);
    var discountId = evaluation.discountId || (selected && selected.discount ? selected.discount.id : "");

    if (!client || typeof client.rpc !== "function" || !isUuid(orderId) || !discountId) {
      return Promise.resolve(null);
    }

    return client.rpc("finalize_discount_redemption", {
      coupon_code: evaluation.appliedCode || readAppliedDiscountCode() || null,
      cart_items: evaluation.promotionCartItems || buildPromotionCartItems(cartItems, options.products || []),
      order_subtotal: getCartTotal(cartItems || []),
      order_id: orderId,
      auth_user_id: isUuid(options.authUserId) ? options.authUserId : (isUuid(getCurrentAuthUserId()) ? getCurrentAuthUserId() : null),
      customer_email: getCurrentCustomerEmail(options.customerEmail) || null
    }).then(function (result) {
      if (result.error) {
        throw result.error;
      }
      return result.data;
    }).catch(function (error) {
      debugLog("Promotion redemption recording skipped:", error.message);
      return null;
    });
  }

  function buildCategoryAnchor(category) {
    var icon = category.icon || "fas fa-tag";
    return '<li><a href="' + categoryUrl(category) + '"><span><i class="' + escapeAttribute(icon) + '"></i></span>' + escapeHtml(category.name) + "</a></li>";
  }

  function renderCategories(categories) {
    var nativeSelect = document.getElementById("category");
    if (nativeSelect) {
      nativeSelect.innerHTML = '<option value="">All Categories</option>' + categories.map(function (category) {
        return '<option value="' + escapeAttribute(category.slug || slugify(category.name)) + '">' + escapeHtml(category.name) + "</option>";
      }).join("");
    }

    var customMenu = document.getElementById("customCategoryMenu");
    if (customMenu) {
      customMenu.innerHTML = '<li class="custom-category-dropdown__item is-active" data-value="" role="option" tabindex="-1">All Categories</li>' + categories.map(function (category) {
        return '<li class="custom-category-dropdown__item" data-value="' + escapeAttribute(category.slug || slugify(category.name)) + '" role="option" tabindex="-1">' + escapeHtml(category.name) + "</li>";
      }).join("");
    }

    document.querySelectorAll(".header__cat .category").forEach(function (list) {
      list.innerHTML = categories.map(buildCategoryAnchor).join("");
    });

    document.querySelectorAll(".category-box ul").forEach(function (list) {
      list.innerHTML = categories.map(function (category) {
        return '<li class="cat-item-has-children category-row"><a href="' + categoryUrl(category) + '"><i class="' + escapeAttribute(category.icon || "fas fa-tag") + ' cat-icon"></i>' + escapeHtml(category.name) + "</a></li>";
      }).join("");
    });

    var mobileMenu = document.getElementById("mobile-menu-active");
    if (mobileMenu) {
      var allowedMobileHrefs = {
        "index.html": true,
        "shop-left-sidebar.html": true,
        "my-orders.html": true,
        "track-order.html": true,
        "cart.html": true,
        "checkout.html": true,
        "account.html": true,
        "contact.html": true
      };

      Array.prototype.slice.call(mobileMenu.children).forEach(function (item) {
        var directLink = Array.prototype.slice.call(item.children).filter(function (child) {
          return child.tagName && child.tagName.toLowerCase() === "a";
        })[0];
        var href = directLink ? String(directLink.getAttribute("href") || "").replace(/^\.?\//, "") : "";
        var isExpectedGroup = item.classList.contains("radios-mobile-nav__section") ||
          item.classList.contains("radios-mobile-nav__divider") ||
          item.classList.contains("radios-mobile-nav__category-group");

        if (item.hasAttribute("data-dynamic-category") || (!isExpectedGroup && directLink && !allowedMobileHrefs[href])) {
          item.parentNode.removeChild(item);
        }
      });
    }

    var mobileCategoryMenu = document.getElementById("mobile-category-menu");
    if (mobileCategoryMenu) {
      mobileCategoryMenu.innerHTML = categories.map(function (category) {
        return '<li data-dynamic-category><a href="' + categoryUrl(category) + '">' + escapeHtml(category.name) + "</a></li>";
      }).join("");
    }

    window.dispatchEvent(new CustomEvent("radios:categories-rendered"));

    document.querySelectorAll(".product-cat__content").forEach(function (content, index) {
      var category = categories[index];
      var title = content.querySelector(".title");
      var list = content.querySelector("ul");

      if (!category) {
        content.style.display = "none";
        return;
      }

      content.style.display = "";
      if (title) title.textContent = category.name;
      if (list) {
        list.innerHTML = '<li><a href="' + categoryUrl(category) + '">' + escapeHtml(category.description || "Shop category") + "</a></li>";
      }

      var categoryItem = content.closest(".product-cat__item");
      var categoryImage = category.imageUrl || category.image_url || category.bannerUrl || category.banner_url;
      if (categoryItem && categoryImage) {
        categoryItem.querySelectorAll(".product-cat__images img").forEach(function (image) {
          image.src = categoryImage;
          image.alt = category.name;
        });
        categoryItem.querySelectorAll(".product-cat__images a").forEach(function (anchor) {
          anchor.setAttribute("href", categoryUrl(category));
        });
      }
    });

    document.querySelectorAll(".footer__widget a").forEach(function (anchor) {
      var matched = categories.find(function (category) {
        return anchor.textContent.trim().toLowerCase() === category.name.toLowerCase();
      });
      if (matched) {
        anchor.setAttribute("href", categoryUrl(matched));
      }
    });

    normalizeStaticCategoryLinks();
  }

  function setupCategoryDropdownDelegation() {
    var customMenu = document.getElementById("customCategoryMenu");
    if (!customMenu || customMenu.getAttribute("data-dynamic-bound") === "true") {
      return;
    }

    customMenu.setAttribute("data-dynamic-bound", "true");
    customMenu.addEventListener("click", function (event) {
      var item = event.target.closest(".custom-category-dropdown__item");
      var dropdown = document.getElementById("customCategoryDropdown");
      var textEl = dropdown ? dropdown.querySelector(".custom-category-dropdown__text") : null;
      var nativeSelect = document.getElementById("category");
      if (!item) return;

      event.preventDefault();
      customMenu.querySelectorAll(".custom-category-dropdown__item").forEach(function (node) {
        node.classList.remove("is-active");
      });
      item.classList.add("is-active");
      if (textEl) textEl.textContent = item.textContent;
      if (nativeSelect) {
        nativeSelect.value = item.getAttribute("data-value") || "";
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (dropdown) dropdown.classList.remove("is-open", "is-closing");
    });
  }

  function setupDynamicCategories() {
    var hasCategoryUi = document.querySelector(".header__cat .category") ||
      document.getElementById("category") ||
      document.getElementById("customCategoryMenu") ||
      document.getElementById("mobile-category-menu") ||
      document.querySelector(".category-box ul");

    if (!hasCategoryUi) {
      return;
    }

    renderCategories(DEFAULT_CATEGORIES);
    setupCategoryDropdownDelegation();

    fetchCatalogCategories()
      .then(function (categories) {
        if (!categories.length) {
          return;
        }
        renderCategories(categories);
      })
      .catch(function (error) {
        debugLog("Category load failed:", error.message);
      });
  }

  function getBannerFallbackHref(sectionKey) {
    var fallbacks = {
      hero: "shop-left-sidebar.html",
      category_promo: "category.html?slug=household-items",
      mid_offer: "category.html?slug=electronics",
      deals: "category.html?slug=electronics",
      trending: "category.html?slug=mobile-accessories",
      bottom_promo: "shop-left-sidebar.html"
    };

    return fallbacks[sectionKey] || "shop-left-sidebar.html";
  }

  function getBannerProductId(banner) {
    var product = banner && (banner.product || banner.productData || banner.product_data);
    return (banner && (banner.productId || banner.product_id || banner.productID)) ||
      (product && typeof product === "object" ? getProductIdentifier(product) : product) ||
      "";
  }

  function getBannerProduct(banner) {
    var product = banner && (banner.product || banner.productData || banner.product_data);
    return product && typeof product === "object" ? product : null;
  }

  function getBannerButtonHref(banner, sectionKey) {
    var productId = getBannerProductId(banner);
    var product = getBannerProduct(banner);
    var categoryValue = banner && (
      banner.categorySlug ||
      banner.category_slug ||
      banner.category ||
      banner.categoryName ||
      banner.category_name
    );
    var explicitHref = banner && (
      banner.buttonLink ||
      banner.button_link ||
      banner.buttonUrl ||
      banner.button_url ||
      banner.link ||
      banner.url
    );

    if (product || productId) {
      return getProductUrl(product || productId);
    }

    if (categoryValue && isPlaceholderHref(explicitHref)) {
      var categoryLabel = readCategoryValue(categoryValue);
      return categoryUrl({ slug: categoryLabel, name: categoryLabel });
    }

    return resolveStorefrontHref(explicitHref, getBannerFallbackHref(sectionKey));
  }

  function getBannerImageUrl(banner) {
    return resolveImageUrl(
      banner && (
        banner.image_url ||
        banner.imageUrl ||
        banner.banner_url ||
        banner.bannerUrl ||
        banner.image ||
        banner.desktopImage ||
        banner.desktop_image ||
        banner.backgroundImage ||
        banner.background_image
      )
    );
  }

  function normalizeHomepageBanners(banners, sectionKey) {
    return (banners || [])
      .filter(isActiveRecord)
      .filter(function (banner) {
        var bannerSection = banner.section_key || banner.sectionKey || banner.banner_type || banner.bannerType || banner.section || "";
        return !sectionKey || !bannerSection || String(bannerSection).toLowerCase() === String(sectionKey).toLowerCase();
      })
      .sort(function (left, right) {
        return readNumberValue(left.sort_order ?? left.sortOrder, 0) - readNumberValue(right.sort_order ?? right.sortOrder, 0);
      });
  }

  function fetchSupabaseHomepageBanners(sectionKey) {
    var cacheSuffix = sectionKey || "all";
    var cachedBanners = readCache("homepage-banners", cacheSuffix, BANNERS_CACHE_TTL_MS);
    if (cachedBanners) {
      return Promise.resolve(normalizeHomepageBanners(cachedBanners, sectionKey));
    }

    var client = getSupabaseClient();
    if (!client) {
      return Promise.reject(new Error("Supabase homepage banners are unavailable"));
    }

    return client
      .from("homepage_banners")
      .select("id,title,subtitle,image_url,banner_url,button_text,button_link,section_key,sort_order,is_active,active,visible,status,product_id,category_slug,updated_at,created_at")
      .limit(24)
      .then(function (result) {
        if (result.error) {
          return client.from("homepage_banners").select("*").limit(24);
        }
        return result;
      })
      .then(function (result) {
        if (result.error) throw result.error;
        return writeCache("homepage-banners", cacheSuffix, normalizeHomepageBanners(result.data || [], sectionKey));
      });
  }

  function fetchStorefrontHomepageBanners(sectionKey) {
    var endpoint = "/homepage-banners?active=true";
    if (sectionKey) {
      endpoint += "&section_key=" + encodeURIComponent(sectionKey);
    }

    return fetchDashcodeJson(endpoint)
      .then(extractList)
      .then(function (banners) {
        return banners.length ? normalizeHomepageBanners(banners, sectionKey) : fetchSupabaseHomepageBanners(sectionKey);
      })
      .catch(function (error) {
        debugLog("Dashcode homepage banners unavailable; loading banners from Supabase:", error.message);
        return fetchSupabaseHomepageBanners(sectionKey).catch(function () { return []; });
      });
  }

  function buildHeroSlide(banner, index) {
    var buttonLink = getBannerButtonHref(banner, "hero");
    var imageUrl = getBannerImageUrl(banner);

    return '' +
      '<div class="hero-slider__slide' + (index === 0 ? " active" : "") + '" data-link="' + escapeAttribute(buttonLink) + '">' +
        '<img src="' + escapeAttribute(imageUrl) + '" alt="' + escapeAttribute(banner.title) + '" ' + buildImageAttrs({ index: index, eagerCount: 1, priority: index === 0, width: 1440, height: 620 }) + '>' +
        '<div class="hero-slider__overlay">' +
          '<div class="hero-slider__content">' +
            '<p class="hero-slider__heading-top">' + escapeHtml(banner.subtitle || "Discover our") + '</p>' +
            '<h2 class="hero-slider__main-heading">' + escapeHtml(banner.title) + '</h2>' +
            '<p class="hero-slider__sub-text">' + escapeHtml(banner.subtitle || "") + '</p>' +
            '<div class="hero-slider__cta-wrap">' +
              '<a href="' + escapeAttribute(buttonLink) + '" class="hero-slider__cta">' + escapeHtml(banner.buttonText || "Shop Now") + '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function initializeDynamicHeroSlider(slider) {
    if (typeof slider._radiosHeroCleanup === "function") {
      slider._radiosHeroCleanup();
    }

    var slides = slider.querySelectorAll(".hero-slider__slide");
    var dots = slider.querySelectorAll(".hero-slider__dot");
    var prevBtn = document.getElementById("sliderPrev");
    var nextBtn = document.getElementById("sliderNext");
    var currentIndex = 0;
    var timer = null;

    if (!slides.length || !dots.length || !prevBtn || !nextBtn) {
      return;
    }

    function goToSlide(index) {
      slides[currentIndex].classList.remove("active");
      dots[currentIndex].classList.remove("active");
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add("active");
      dots[currentIndex].classList.add("active");
    }

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        goToSlide(currentIndex + 1);
      }, 3000);
    }

    prevBtn.onclick = function () {
      goToSlide(currentIndex - 1);
      restart();
    };

    nextBtn.onclick = function () {
      goToSlide(currentIndex + 1);
      restart();
    };

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        goToSlide(Number(dot.getAttribute("data-slide")) || 0);
        restart();
      });
    });

    slider._radiosHeroCleanup = function () {
      if (timer) clearInterval(timer);
      prevBtn.onclick = null;
      nextBtn.onclick = null;
    };

    restart();
  }

  function setupDynamicHeroBanners() {
    var slider = document.getElementById("heroSlider");
    if (!slider) {
      return;
    }

    fetchStorefrontHomepageBanners("hero")
      .then(function (banners) {
        banners = banners.filter(getBannerImageUrl);
        var track = slider.querySelector(".hero-slider__track");
        var dots = document.getElementById("sliderDots");

        if (!banners.length || !track || !dots) {
          return;
        }

        track.innerHTML = banners.map(buildHeroSlide).join("");
        dots.innerHTML = banners.map(function (_banner, index) {
          return '<button class="hero-slider__dot' + (index === 0 ? " active" : "") + '" data-slide="' + index + '" aria-label="Go to slide ' + (index + 1) + '"></button>';
        }).join("");
        initializeDynamicHeroSlider(slider);
      })
      .catch(function (error) {
        debugLog("Homepage banner load failed:", error.message);
      });
  }

  function setBackgroundImage(element, imageUrl) {
    if (!element || !imageUrl) {
      return;
    }

    element.setAttribute("data-background", imageUrl);
    element.style.backgroundImage = 'url("' + imageUrl + '")';
  }

  function updateButtonLink(scope, href, text, fallbackHref) {
    var button = scope.querySelector(".banner__btn a, .add-banner__btn, .thm-btn");
    if (!button) {
      return;
    }

    button.setAttribute("href", resolveStorefrontHref(href, fallbackHref));
    if (!text) return;

    var spans = button.querySelectorAll(".btn-wrap span");
    if (spans.length) {
      spans.forEach(function (span) {
        span.textContent = text;
      });
    } else {
      button.textContent = text;
    }
  }

  function applyBannerToSection(sectionKey, banner) {
    var target = document.querySelector('[data-banner-section="' + sectionKey + '"]');
    if (!target || !banner) {
      return;
    }

    var imageUrl = getBannerImageUrl(banner);
    setBackgroundImage(target, imageUrl);

    var title = target.querySelector("h2, h3");
    var subtitle = target.querySelector("p, .add-banner__content span:first-child, .rd-banner__content span:first-child");
    var image = target.querySelector(".thumb img, .add-banner__img img, .rd-banner__img img, .icon img");
    var price = target.querySelector(".price");
    var buttonText = banner.buttonText || banner.button_text;
    var bannerPrice = readNumberValue(banner.price ?? banner.offerPrice ?? banner.offer_price ?? banner.amount, 0);

    if (title && banner.title) title.innerHTML = escapeHtml(banner.title);
    if (subtitle && banner.subtitle) subtitle.textContent = banner.subtitle;
    if (image && imageUrl) {
      image.src = imageUrl;
      image.alt = banner.title || "Promotional banner";
    }
    if (price && bannerPrice > 0) price.textContent = formatCurrency(bannerPrice);

    updateButtonLink(target, getBannerButtonHref(banner, sectionKey), buttonText, getBannerFallbackHref(sectionKey));
  }

  function setupHomepagePromoFallbacks() {
    ["category_promo", "mid_offer", "deals", "trending"].forEach(function (sectionKey) {
      var target = document.querySelector('[data-banner-section="' + sectionKey + '"]');
      if (!target) {
        return;
      }

      var button = target.querySelector(".banner__btn a, .add-banner__btn, .thm-btn");
      if (button) {
        updateButtonLink(target, button.getAttribute("href"), "", getBannerFallbackHref(sectionKey));
      }

      var price = target.querySelector(".price");
      if (price && price.textContent.indexOf("$") !== -1) {
        price.textContent = formatCurrency(sectionKey === "mid_offer" ? 14999 : 9999);
      }
    });

    var shippingText = document.querySelector(".add__text > span");
    if (shippingText && shippingText.textContent.indexOf("$") !== -1) {
      shippingText.innerHTML = '<span>10%</span> Free Shipping On All Orders Over <span>' + formatCurrency(999) + '</span>';
    }
  }

  function setupDynamicSectionBanners() {
    var sections = ["category_promo", "mid_offer", "deals", "trending", "bottom_promo"];
    if (!sections.some(function (sectionKey) {
      return document.querySelector('[data-banner-section="' + sectionKey + '"]');
    })) {
      return;
    }

    fetchStorefrontHomepageBanners("")
      .then(function (banners) {
        if (!banners.length) {
          return;
        }

        sections.forEach(function (sectionKey) {
          var sectionBanners = banners.filter(function (banner) {
            return (banner.sectionKey || banner.section_key || banner.bannerType || banner.banner_type) === sectionKey;
          });
          if (sectionBanners.length) {
            applyBannerToSection(sectionKey, sectionBanners[0]);
          }
        });
      })
      .catch(function (error) {
        debugLog("Section banner load failed:", error.message);
      });
  }

  function refreshHomepageBanners() {
    setupDynamicHeroBanners();
    setupDynamicSectionBanners();
  }

  function setupHomepageBannerRealtime() {
    var client = getSupabaseClient();
    var hasHomepageBanners =
      document.getElementById("heroSlider") ||
      document.querySelector("[data-banner-section]");

    if (!client || !hasHomepageBanners || window.radiosHomepageBannerChannel) {
      return;
    }

    var refreshTimer = null;
    window.radiosHomepageBannerChannel = client
      .channel("radios-homepage-banners")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "homepage_banners" },
        function () {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(refreshHomepageBanners, 250);
        }
      )
      .subscribe(function (status) {
        debugLog("Homepage banner realtime status:", status);
      });
  }

  /**
   * Extract a single product from the API response.
   * The Dashcode API returns { status, data: Product }
   * Legacy product endpoints may return the product directly.
   */
  function extractProduct(response) {
    if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
      return normalizeProduct(response.data);
    }

    return normalizeProduct(response);
  }

  function formatProductDetailLabel(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function getProductSpecifications(product) {
    var specs = Object.assign({}, normalizeJsonObject(product && product.specifications));
    if (product && product.brand && !specs.Brand && !specs.brand) {
      specs.Brand = product.brand;
    }
    if (product && product.warranty && !specs.Warranty && !specs.warranty) {
      specs.Warranty = product.warranty;
    }
    return specs;
  }

  function getProductFaqs(product) {
    return normalizeFaqs(product && product.faqs);
  }

  function getProductDeliveryRange(product) {
    var minDays = Math.max(0, readNumberValue(product && (product.delivery_days_min ?? product.deliveryDaysMin), 2));
    var maxDays = Math.max(minDays, readNumberValue(product && (product.delivery_days_max ?? product.deliveryDaysMax), 7));
    return { min: minDays, max: maxDays };
  }

  function renderProductGallery(product) {
    product = normalizeProduct(product);
    var wrap = document.querySelector(".product-single-wrap");
    if (!wrap) {
      return;
    }

    var productName = getProductName(product);
    var gallery = getProductGallery(product);
    if (!gallery.length) {
      gallery = [IMAGE_PLACEHOLDER];
    }

    wrap.classList.add("product-gallery-live");
    wrap.innerHTML =
      '<div class="product-gallery-main" data-product-gallery-main>' +
        '<button type="button" class="product-gallery-main__button" data-gallery-open aria-label="Open image gallery">' +
          '<img src="' + escapeAttribute(gallery[0]) + '" alt="' + escapeAttribute(productName) + '" data-gallery-main-image ' + buildImageAttrs({ priority: true, width: 640, height: 640 }) + '>' +
        '</button>' +
      '</div>' +
      '<div class="shop_thumb_tab product-gallery-thumbs" data-product-gallery-thumbs role="listbox" aria-label="Product images">' +
        gallery.map(function (image, index) {
          return '<button type="button" class="product-gallery-thumb' + (index === 0 ? " is-active" : "") + '" data-gallery-thumb="' + index + '" aria-label="Show image ' + (index + 1) + '"><img src="' + escapeAttribute(image) + '" alt="' + escapeAttribute(productName) + ' thumbnail" ' + buildImageAttrs({ index: index, width: 96, height: 96 }) + '></button>';
        }).join("") +
      '</div>';

    bindProductGallery(wrap, gallery, productName);
  }

  function ensureProductGalleryModal() {
    var modal = document.getElementById("productGalleryModal");
    if (modal) {
      return modal;
    }

    document.body.insertAdjacentHTML("beforeend",
      '<div id="productGalleryModal" class="product-gallery-modal" aria-hidden="true">' +
        '<button type="button" class="product-gallery-modal__backdrop" data-gallery-modal-close aria-label="Close image"></button>' +
        '<div class="product-gallery-modal__dialog" role="dialog" aria-modal="true" aria-label="Product image">' +
          '<button type="button" class="product-gallery-modal__close" data-gallery-modal-close aria-label="Close image"><i class="far fa-times" aria-hidden="true"></i></button>' +
          '<button type="button" class="product-gallery-modal__nav product-gallery-modal__nav--prev" data-gallery-modal-prev aria-label="Previous image"><i class="far fa-chevron-left" aria-hidden="true"></i></button>' +
          '<img src="' + escapeAttribute(IMAGE_PLACEHOLDER) + '" alt="Product image" data-gallery-modal-image ' + buildImageAttrs({ width: 960, height: 960 }) + '>' +
          '<button type="button" class="product-gallery-modal__nav product-gallery-modal__nav--next" data-gallery-modal-next aria-label="Next image"><i class="far fa-chevron-right" aria-hidden="true"></i></button>' +
        '</div>' +
      '</div>'
    );

    modal = document.getElementById("productGalleryModal");
    modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-gallery-modal-close]")) {
        closeProductGalleryModal();
      }
    });
    modal.querySelector("[data-gallery-modal-prev]").addEventListener("click", function () {
      moveProductGalleryModal(-1);
    });
    modal.querySelector("[data-gallery-modal-next]").addEventListener("click", function () {
      moveProductGalleryModal(1);
    });

    document.addEventListener("keydown", function (event) {
      if (!modal.classList.contains("is-open")) {
        return;
      }
      if (event.key === "Escape") closeProductGalleryModal();
      if (event.key === "ArrowLeft") moveProductGalleryModal(-1);
      if (event.key === "ArrowRight") moveProductGalleryModal(1);
    });

    return modal;
  }

  function openProductGalleryModal(images, index, productName) {
    var modal = ensureProductGalleryModal();
    modal._images = images;
    modal._index = index || 0;
    modal._productName = productName || "Product image";
    updateProductGalleryModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("product-gallery-modal-open");
  }

  function updateProductGalleryModal() {
    var modal = document.getElementById("productGalleryModal");
    if (!modal || !modal._images || !modal._images.length) {
      return;
    }
    var image = modal.querySelector("[data-gallery-modal-image]");
    var src = modal._images[modal._index] || modal._images[0];
    if (image) {
      image.src = src;
      image.alt = modal._productName || "Product image";
    }
  }

  function moveProductGalleryModal(direction) {
    var modal = document.getElementById("productGalleryModal");
    if (!modal || !modal._images || !modal._images.length) {
      return;
    }
    modal._index = (modal._index + direction + modal._images.length) % modal._images.length;
    updateProductGalleryModal();
  }

  function closeProductGalleryModal() {
    var modal = document.getElementById("productGalleryModal");
    if (!modal) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("product-gallery-modal-open");
  }

  function bindProductGallery(wrap, gallery, productName) {
    var mainImage = wrap.querySelector("[data-gallery-main-image]");
    var mainButton = wrap.querySelector("[data-gallery-open]");
    var thumbs = Array.prototype.slice.call(wrap.querySelectorAll("[data-gallery-thumb]"));
    var activeIndex = 0;
    var touchStartX = null;
    var suppressNextClick = false;

    function setImage(index) {
      activeIndex = (index + gallery.length) % gallery.length;
      if (mainImage) {
        mainImage.src = gallery[activeIndex];
        mainImage.alt = productName;
      }
      thumbs.forEach(function (button, buttonIndex) {
        button.classList.toggle("is-active", buttonIndex === activeIndex);
      });
    }

    thumbs.forEach(function (button) {
      button.addEventListener("click", function () {
        setImage(Number(button.getAttribute("data-gallery-thumb")) || 0);
      });
    });

    if (mainButton) {
      mainButton.addEventListener("click", function () {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        openProductGalleryModal(gallery, activeIndex, productName);
      });
      mainButton.addEventListener("touchstart", function (event) {
        touchStartX = event.touches && event.touches[0] ? event.touches[0].clientX : null;
      }, { passive: true });
      mainButton.addEventListener("touchend", function (event) {
        if (touchStartX === null || !event.changedTouches || !event.changedTouches[0]) {
          return;
        }
        var delta = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) > 36) {
          suppressNextClick = true;
          setImage(activeIndex + (delta < 0 ? 1 : -1));
        }
      }, { passive: true });
    }
  }

  function renderDeliveryEstimate(product) {
    var details = document.querySelector(".product-details");
    var optionWrap = details ? details.querySelector(".product-option") : null;
    if (!details || !optionWrap) {
      return;
    }

    var range = getProductDeliveryRange(product);
    var canPurchase = canPurchaseProduct(product, 1);
    var existing = details.querySelector(".product-delivery-estimate");
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "product-delivery-estimate";
      optionWrap.insertAdjacentElement("beforebegin", existing);
    }

    existing.innerHTML =
      '<div class="product-delivery-estimate__header">' +
        '<strong>Delivery Estimate</strong>' +
        '<span data-delivery-message>' + (canPurchase ? 'Estimated delivery in ' + range.min + '-' + range.max + ' days' : 'Out of Stock') + '</span>' +
      '</div>' +
      '<form class="product-delivery-estimate__form" data-delivery-form novalidate>' +
        '<input type="text" name="delivery_pincode" inputmode="numeric" autocomplete="postal-code" maxlength="10" placeholder="Enter PIN code" aria-label="Delivery PIN code">' +
        '<button type="button" data-delivery-check>Check</button>' +
      '</form>' +
      '<div class="product-delivery-estimate__feedback" data-delivery-feedback aria-live="polite"></div>';

    var form = existing.querySelector("[data-delivery-form]");
    var message = existing.querySelector("[data-delivery-message]");
    var input = form ? form.querySelector("input") : null;
    var button = existing.querySelector("[data-delivery-check]");
    var feedback = existing.querySelector("[data-delivery-feedback]");

    function setDeliveryFeedback(text, state) {
      if (!feedback) {
        return;
      }
      feedback.textContent = text || "";
      feedback.className = "product-delivery-estimate__feedback" + (state ? " is-" + state : "");
    }

    function checkDeliveryEstimate(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (!message || !input) {
        return;
      }

      if (!canPurchase) {
        message.textContent = "Out of Stock";
        setDeliveryFeedback("Delivery estimate is unavailable because this product is out of stock.", "error");
        return;
      }

      var pincode = input.value.replace(/\D/g, "").slice(0, 6);
      input.value = pincode;

      if (!pincode) {
        message.textContent = "Estimated delivery in " + range.min + "-" + range.max + " days";
        setDeliveryFeedback("Enter a 6 digit PIN code to check the delivery estimate for your area.", "error");
        input.focus();
        return;
      }

      if (pincode.length !== 6) {
        setDeliveryFeedback("Enter a valid 6 digit PIN code.", "error");
        input.focus();
        return;
      }

      message.textContent = "Estimated delivery in " + range.min + "-" + range.max + " days";
      setDeliveryFeedback("Delivery available for PIN " + pincode + ". Estimated delivery in " + range.min + "-" + range.max + " days.", "success");
    }

    if (form) {
      form.addEventListener("submit", checkDeliveryEstimate);
    }
    if (button) {
      button.addEventListener("click", checkDeliveryEstimate);
    }
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          checkDeliveryEstimate(event);
        }
      });
    }
  }

  function renderProductPromotions(product) {
    var details = document.querySelector(".product-details");
    if (!details) {
      return;
    }

    var existing = details.querySelector(".product-promotions-box");
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "product-promotions-box";
      var insertAfter = details.querySelector(".product-delivery-estimate") || details.querySelector(".product-stock-message") || details.querySelector(".price");
      if (insertAfter) {
        insertAfter.insertAdjacentElement("afterend", existing);
      } else {
        details.insertBefore(existing, details.firstChild);
      }
    }

    existing.innerHTML = '<strong>Available Offers</strong><span>Checking offers...</span>';

    fetchStorefrontDiscounts().then(function (discounts) {
      var offers = discounts.filter(function (discount) {
        return promotionAppliesToProduct(discount, product);
      }).slice(0, 3);

      if (!offers.length) {
        existing.style.display = "none";
        existing.innerHTML = "";
        return;
      }

      existing.style.display = "";
      existing.innerHTML =
        '<strong>Available Offers</strong>' +
        '<ul>' + offers.map(function (discount) {
          discount = normalizeDiscount(discount);
          var code = discount.code ? '<b>' + escapeHtml(discount.code) + '</b>' : '';
          var minOrder = readNumberValue(discount.minOrderAmount ?? discount.minimum_order_amount, 0);
          var note = minOrder > 0 ? ' on orders above ' + formatCurrency(minOrder) : '';
          return '<li>' + code + '<span>' + escapeHtml(discount.title || buildPromotionBadgeLabel(discount)) + escapeHtml(note) + '</span></li>';
        }).join('') + '</ul>';
    }).catch(function () {
      existing.style.display = "none";
      existing.innerHTML = "";
    });
  }

  function bindProductQuantity(product) {
    var input = document.querySelector(".product-details .product-count");
    if (!input) {
      return;
    }

    var maxQty = Math.max(1, getAvailableStock(product));
    var allowBackorder = isBackorderAllowed(product);

    input.setAttribute("inputmode", "numeric");
    input.setAttribute("min", "1");
    if (!allowBackorder) {
      input.setAttribute("max", String(maxQty));
    } else {
      input.removeAttribute("max");
    }

    function normalizeQuantity() {
      var quantity = Math.max(1, Math.floor(readNumberValue(input.value, 1)));
      if (!allowBackorder) {
        quantity = Math.min(quantity, maxQty);
      }
      input.value = String(quantity);
    }

    input.addEventListener("change", normalizeQuantity);
    input.addEventListener("blur", normalizeQuantity);
    normalizeQuantity();
  }

  function renderProductTabs(product) {
    var detailsTab = document.getElementById("tb-01");
    var specsTab = document.getElementById("tb-02");
    var supportTab = document.getElementById("tb-03");
    var specButton = document.getElementById("tab-two");
    var supportButton = document.getElementById("pills-profile-tab");
    var productName = getProductName(product);
    var productDescription = product.description || product.desc || product.subtitle || "Live product details from the Radios catalog.";
    var specs = getProductSpecifications(product);
    var specKeys = Object.keys(specs);
    var faqs = getProductFaqs(product);

    var descButton = document.getElementById("pills-home-tab");
    if (descButton) descButton.textContent = "Description";
    if (specButton) specButton.textContent = "Specifications";
    if (supportButton) supportButton.textContent = "FAQs & Support";

    if (detailsTab) {
      detailsTab.innerHTML =
        '<div class="product-detail-tab-section">' +
          '<h4>Description</h4>' +
          '<p>' + escapeHtml(productDescription) + '</p>' +
        '</div>';
    }

    if (specsTab) {
      if (specKeys.length) {
        specsTab.innerHTML =
          '<div class="product-specifications">' +
            '<h4>Specifications</h4>' +
            '<dl>' + specKeys.map(function (key) {
              return '<div><dt>' + escapeHtml(formatProductDetailLabel(key)) + '</dt><dd>' + escapeHtml(specs[key]) + '</dd></div>';
            }).join("") + '</dl>' +
          '</div>';
        if (specButton && specButton.parentNode) specButton.parentNode.style.display = "";
      } else {
        specsTab.innerHTML = "";
        if (specButton && specButton.parentNode) specButton.parentNode.style.display = "none";
      }
    }

    if (supportTab) {
      supportTab.innerHTML =
        (faqs.length ? '<div class="product-faqs"><h4>FAQs</h4>' + faqs.map(function (faq, index) {
          return '<details class="product-faq" ' + (index === 0 ? "open" : "") + '><summary>' + escapeHtml(faq.question) + '</summary><p>' + escapeHtml(faq.answer) + '</p></details>';
        }).join("") + '</div>' : '') +
        '<div class="contact-info__content product-support-panel">' +
          '<h3>Need help with ' + escapeHtml(productName) + '?</h3>' +
          '<p>Contact Radios support for product questions, checkout help, order tracking, or returns. Include your order number if this product is part of an existing order.</p>' +
          (product.return_policy ? '<p><strong>Returns:</strong> ' + escapeHtml(product.return_policy) + '</p>' : '') +
          (product.warranty ? '<p><strong>Warranty:</strong> ' + escapeHtml(product.warranty) + '</p>' : '') +
          '<a class="thm-btn thm-btn__2 no-icon" href="contact.html"><span class="btn-wrap"><span>Contact Support</span><span>Contact Support</span></span></a>' +
        '</div>';
    }
  }

  function updateRecentlyViewedProducts(product) {
    var productId = getProductIdentifier(product);
    if (!productId) {
      return [];
    }

    var current = [];
    try {
      current = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
    } catch (error) {
      current = [];
    }

    current = uniqueStrings([productId].concat(current.filter(function (id) {
      return id !== productId;
    }))).slice(0, 8);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(current));
    return current;
  }

  function readRecentlyViewedProductIds(currentProductId) {
    try {
      return uniqueStrings(JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"))
        .filter(function (id) { return id && id !== currentProductId; })
        .slice(0, 8);
    } catch (error) {
      return [];
    }
  }

  function fetchProductsByIds(productIds) {
    var ids = uniqueStrings(productIds || []);
    var client = getSupabaseClient();
    var uuidIds = ids.filter(isUuid);

    if (!ids.length) {
      return Promise.resolve([]);
    }

    if (client && uuidIds.length) {
      return client.from("products").select("*").in("id", uuidIds).then(function (result) {
        if (result.error) {
          throw result.error;
        }
        var products = getVisibleProducts(result.data || []);
        return ids.map(function (id) {
          return products.find(function (product) { return getProductIdentifier(product) === id; });
        }).filter(Boolean);
      }).catch(function () {
        return fetchStorefrontProducts().then(function (products) {
          return ids.map(function (id) {
            return products.find(function (product) { return getProductIdentifier(product) === id; });
          }).filter(Boolean);
        });
      });
    }

    return fetchStorefrontProducts().then(function (products) {
      return ids.map(function (id) {
        return products.find(function (product) { return getProductIdentifier(product) === id; });
      }).filter(Boolean);
    });
  }

  function ensureProductSection(sectionId, title, afterSelector) {
    var existing = document.getElementById(sectionId);
    if (existing) {
      return existing;
    }

    var anchor = document.querySelector(afterSelector) || document.querySelector(".shop-single-section .container");
    if (!anchor) {
      return null;
    }

    anchor.insertAdjacentHTML("afterend",
      '<div class="row product-live-section-row" id="' + sectionId + '">' +
        '<div class="col col-xs-12">' +
          '<div class="product-live-section">' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<div class="shop-area"><ul class="products clearfix product-live-scroll" data-product-live-list></ul></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    return document.getElementById(sectionId);
  }

  function renderProductCardSection(section, products, emptyMessage) {
    if (!section) {
      return;
    }

    var list = section.querySelector("[data-product-live-list]");
    if (!list) {
      return;
    }

    if (!products || !products.length) {
      list.innerHTML = '<li class="product"><div class="product-info"><h2 class="product__title">' + escapeHtml(emptyMessage || "No products available") + '</h2></div></li>';
      return;
    }

    list.innerHTML = products.map(buildProductCard).join("");
    hydrateProductRatings(list);
    applyWishlistButtonStates();
    enhanceExistingImages(list);
  }

  function fetchRelatedProductsForProduct(product) {
    var productId = getProductIdentifier(product);
    var manualIds = normalizeRelatedProductIds(product.related_product_ids || product.relatedProductIds).filter(function (id) {
      return id !== productId;
    });

    if (manualIds.length) {
      return fetchProductsByIds(manualIds).then(function (products) {
        return products.slice(0, 4);
      });
    }

    return fetchStorefrontProducts().then(function (allProducts) {
      var currentCategory = slugify(product.categorySlug || product.category_slug || getProductPrimaryCategory(product) || product.category);
      var related = allProducts.filter(function (p) {
        return getProductIdentifier(p) !== productId &&
          slugify(p.categorySlug || p.category_slug || getProductPrimaryCategory(p) || p.category) === currentCategory;
      }).slice(0, 4);

      if (related.length < 4) {
        var others = allProducts.filter(function (p) {
          return getProductIdentifier(p) !== productId &&
            !related.some(function (r) { return getProductIdentifier(r) === getProductIdentifier(p); });
        });
        related = related.concat(others).slice(0, 4);
      }

      return related;
    });
  }

  function renderRecentlyViewedProducts(currentProduct) {
    var ids = readRecentlyViewedProductIds(getProductIdentifier(currentProduct));
    var section = ensureProductSection("recentlyViewedProductsSection", "Recently Viewed", "#relatedProductsSection");
    if (!section) {
      return Promise.resolve();
    }

    if (!ids.length) {
      section.style.display = "none";
      return Promise.resolve();
    }

    section.style.display = "";
    return fetchProductsByIds(ids).then(function (products) {
      if (!products.length) {
        section.style.display = "none";
        return;
      }
      renderProductCardSection(section, products.slice(0, 8), "No recently viewed products yet");
    });
  }

  function setupProductListing() {
    if (document.querySelector("[data-dynamic-category-page]")) {
      return;
    }

    var productsList = document.querySelector(".shop-section .products.three-column");
    if (!productsList) {
      return;
    }

    var resultCount = document.querySelector(".woocommerce-result-count");
    var sidebar = document.querySelector(".shop-sidebar");
    var chips = Array.prototype.slice.call(document.querySelectorAll(".cat-chip"));
    var chipValues = getChipValues();
    var categoryPage = getCategoryPageMeta();
    var ordering = document.querySelector(".woocommerce-ordering .orderby");
    var widgetSearchForm = document.querySelector(".shop-sidebar .widget__search");
    var widgetSearchInput = widgetSearchForm ? widgetSearchForm.querySelector("input") : null;
    var priceSlider = document.getElementById("slider-range");
    var priceAmount = document.getElementById("amount");
    var priceFilterButton = document.querySelector(".price-filter-btn");
    var categoryLinks = Array.prototype.slice.call(document.querySelectorAll(".widget__category a"));
    var fallbackMarkup = productsList.innerHTML;
    var pagination = ensureListingPagination(productsList);
    var params = new URLSearchParams(window.location.search);
    var search = params.get("search") || "";
    var collectionSlug = params.get("collection") || "";
    var state = {
      products: [],
      smartSearchProducts: null,
      collections: [],
      search: search,
      activeChip: "",
      activeCategory: "",
      activeCollection: collectionSlug,
      sortBy: ordering ? ordering.value : "menu_order",
      priceMin: 0,
      priceMax: 100000,
      page: 1,
      perPage: getListingPageSize(),
      totalCount: 0
    };

    applyCategoryPageSeo(categoryPage);

    function prepareSidebarFilters() {
      if (sidebar) {
        Array.prototype.slice.call(sidebar.querySelectorAll(".widget")).forEach(function (widget) {
          var title = widget.querySelector(".widget__title span");
          var label = title ? title.textContent.trim().toLowerCase() : "";
          if (label === "color" || label === "brands" || label === "tags") {
            widget.parentNode.removeChild(widget);
          }
        });

        categoryLinks.forEach(function (link) {
          var label = String(link.textContent || "").trim();
          var matchedCategory = DEFAULT_CATEGORIES.find(function (category) {
            return normalizeKeyword(category.name) === normalizeKeyword(label);
          });

          if (matchedCategory) {
            link.setAttribute("href", categoryUrl(matchedCategory));
            link.setAttribute("data-category-name", matchedCategory.name);
          }
        });
      }

      var priceTitle = sidebar ? sidebar.querySelector(".widget_price_filter .widget__title span") : null;
      if (priceTitle) {
        priceTitle.textContent = "Price Filtering (INR)";
      }

      if (priceAmount) {
        priceAmount.setAttribute("readonly", "readonly");
        priceAmount.value = formatPriceRange(state.priceMin, state.priceMax);
      }

      if (widgetSearchInput && search) {
        widgetSearchInput.value = search;
      }
    }

    function matchesActiveCategory(product) {
      if (!state.activeCategory) {
        return true;
      }

      return slugify(getProductPrimaryCategory(product)) === slugify(state.activeCategory);
    }

    function matchesActiveChip(product) {
      if (!state.activeChip) {
        return true;
      }

      var productSubcategory = getProductSubcategory(product);
      if (productSubcategory && slugify(productSubcategory) === slugify(state.activeChip)) {
        return true;
      }

      if (slugify(product.category) === slugify(state.activeChip)) {
        return true;
      }

      return productMatchesKeyword(product, state.activeChip);
    }

    function matchesPrice(product) {
      var price = Number(product.price) || 0;
      return price >= state.priceMin && price <= state.priceMax;
    }

    function matchesSearch(product) {
      if (normalizeSearchQuery(state.search).length < SMART_SEARCH_MIN_LENGTH) {
        return true;
      }
      return productMatchesKeyword(product, state.search);
    }

    function getListingSearchCategorySlug() {
      if (state.activeCategory) {
        return normalizeCategorySlug(state.activeCategory);
      }

      if (categoryPage && (categoryPage.slug || categoryPage.name)) {
        return normalizeCategorySlug(categoryPage.slug || categoryPage.name);
      }

      return "";
    }

    function getBaseProducts() {
      var collectionResolver = buildCollectionProductResolver(state.products, state.collections);
      var activeCollection = state.activeCollection ? collectionResolver.bySlug[state.activeCollection] : null;
      var collectionIds = activeCollection
        ? collectionResolver.getCollectionProducts(activeCollection).map(getProductIdentifier)
        : null;
      var sourceProducts = state.smartSearchProducts || state.products;
      var usingSmartSearch = Boolean(state.search && state.smartSearchProducts);

      return sourceProducts.filter(function (product) {
        if (collectionIds && collectionIds.indexOf(getProductIdentifier(product)) === -1) {
          return false;
        }

        return productBelongsToCategoryPage(product, categoryPage, chipValues) &&
          matchesActiveCategory(product) &&
          (usingSmartSearch ? true : matchesSearch(product));
      });
    }

    function renderListing() {
      var baseProducts = getBaseProducts();
      var filteredProducts = sortListingProducts(baseProducts.filter(function (product) {
        return matchesActiveChip(product) && matchesPrice(product);
      }), state.sortBy);

      if (!filteredProducts.length) {
        productsList.innerHTML = buildListingEmptyState(baseProducts.length ? "No products match the selected filters" : "No products available in this category yet");
      } else {
        productsList.innerHTML = filteredProducts.map(buildProductCard).join("");
      }

      hydrateProductRatings(productsList);
      enhanceExistingImages(productsList);
      updateListingCount(resultCount, filteredProducts.length, Math.max(state.totalCount, baseProducts.length));
      renderProductPagination(pagination, state.page, Math.max(state.totalCount, filteredProducts.length), state.perPage);
    }

    function loadListingPage(page) {
      var query = normalizeSearchQuery(state.search);
      state.search = query;
      state.page = Math.max(1, Number(page) || 1);
      renderProductSkeleton(productsList, state.perPage);

      return Promise.all([
        fetchStorefrontProductPage({
          page: state.page,
          perPage: state.perPage,
          categorySlug: getListingSearchCategorySlug(),
          search: query,
          sortBy: state.sortBy
        }),
        fetchStorefrontCollections()
      ])
        .then(function (responses) {
          var pageResult = responses[0] || { items: [], total: 0 };
          state.products = getVisibleProducts(pageResult.items || []);
          state.totalCount = Number(pageResult.total) || state.products.length;
          state.collections = responses[1] || [];
          if (query && query.length >= SMART_SEARCH_MIN_LENGTH) {
            trackSearchEvent(query, state.totalCount, null);
          }
          renderListing();
        })
        .catch(function (error) {
          debugLog("Product listing load failed:", error.message);
          productsList.innerHTML = fallbackMarkup;
          updateListingCount(resultCount, productsList.querySelectorAll(".product").length, productsList.querySelectorAll(".product").length);
        });
    }

    function runListingSearch() {
      return loadListingPage(1);
    }

    function bindFilterEvents() {
      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          var nextValue = chip.getAttribute("data-subcat") || chip.textContent.trim();
          state.activeChip = state.activeChip === nextValue ? "" : nextValue;
          chips.forEach(function (item) {
            item.classList.remove("active");
          });
          if (state.activeChip) {
            chip.classList.add("active");
          }
          state.page = 1;
          renderListing();
        });
      });

      if (ordering) {
        ordering.addEventListener("change", function () {
          state.sortBy = ordering.value || "menu_order";
          loadListingPage(1);
        });
      }

      if (widgetSearchForm && widgetSearchInput) {
        widgetSearchForm.addEventListener("submit", function (event) {
          event.preventDefault();
          state.search = widgetSearchInput.value.trim();
          loadListingPage(1);
        });
      }

      categoryLinks.forEach(function (link) {
        link.addEventListener("click", function (event) {
          if (getCurrentFilename() !== "shop-left-sidebar.html") {
            return;
          }

          event.preventDefault();
          state.activeCategory = link.getAttribute("data-category-name") || String(link.textContent || "").trim();
          loadListingPage(1);
        });
      });

      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slider && priceSlider && priceAmount) {
        var slider = window.jQuery(priceSlider);
        if (slider.hasClass("ui-slider")) {
          slider.slider("destroy");
        }

        slider.slider({
          range: true,
          min: 0,
          max: 100000,
          values: [state.priceMin, state.priceMax],
          slide: function (_event, ui) {
            state.priceMin = ui.values[0];
            state.priceMax = ui.values[1];
            priceAmount.value = formatPriceRange(state.priceMin, state.priceMax);
            state.page = 1;
            renderListing();
          }
        });
      }

      if (priceFilterButton) {
        priceFilterButton.addEventListener("click", function () {
          state.page = 1;
          renderListing();
        });
      }

      if (pagination) {
        pagination.addEventListener("click", function (event) {
          var button = event.target.closest("[data-product-page]");
          if (!button || button.disabled) {
            return;
          }
          loadListingPage(Number(button.getAttribute("data-product-page")) || 1).then(function () {
            productsList.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
      }
    }

    prepareSidebarFilters();
    bindFilterEvents();
    loadListingPage(1);
  }

  function populateProductDetails(product) {
    product = normalizeProduct(product);
    var titleEl = document.querySelector(".product-details h2");
    var descEl = document.querySelector(".product-details p");
    var currentPriceEl = document.querySelector(".product-details .price .current");
    var oldPriceEl = document.querySelector(".product-details .price .old");
    var modelWrap = document.querySelector(".product-details .model-option-wrap");
    var modelList = modelWrap ? modelWrap.querySelector(".model-option") : null;
    var categoryEl = document.querySelector(".product_meta .posted_in");
    var tagsEl = document.querySelector(".product_meta .tagged_as");
    var addButton = document.querySelector(".add-to-cart-btn button");
    var productRow = document.querySelector(".product-option .product-row");
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var productId = getProductIdentifier(product);
    var categoryName = getProductPrimaryCategory(product) || product.category;
    var price = readNumberValue(product.price, 0);
    var stockMessage = getProductStockMessage(product, 1);
    var stockMessageClass = getProductStockMessageClass(product, 1);
    var canPurchase = canPurchaseProduct(product, 1);
    var compareAtPrice = readNumberValue(product.compareAtPrice ?? product.compare_at_price ?? product.oldPrice ?? product.old_price, 0);
    var oldPriceText = compareAtPrice > price ? formatCurrency(compareAtPrice) : (product.sku ? "SKU: " + product.sku : "SKU unavailable");
    var categoryLink = DEFAULT_CATEGORIES.find(function (category) {
      return slugify(category.name) === slugify(categoryName);
    });
    var modelOptions = getProductModelOptions(product);
    var visibleTags = getVisibleProductTags(product);
    var productName = getProductName(product);
    var productDescription = product.description || product.desc || product.subtitle || "Live product details from the Radios catalog.";
    var breadcrumbEnd = document.querySelector(".radiosbcrumb-end span");
    var ratingText = document.querySelector(".product-details .rating span");
    if (titleEl) {
      titleEl.textContent = productName;
    }

    var detailBadgeWrap = document.querySelector(".product-details .product-detail-badges");
    if (!detailBadgeWrap && titleEl) {
      detailBadgeWrap = document.createElement("div");
      detailBadgeWrap.className = "product-detail-badges";
      titleEl.insertAdjacentElement("afterend", detailBadgeWrap);
    }
    if (detailBadgeWrap) {
      detailBadgeWrap.innerHTML = buildStorefrontBadgeMarkup(product, { inline: true, limit: 3 });
      detailBadgeWrap.style.display = detailBadgeWrap.innerHTML ? "" : "none";
    }

    applyProductSeo(product);
    preferVisibleProductSlugUrl(product);

    if (breadcrumbEnd) {
      breadcrumbEnd.textContent = productName;
    }

    renderProductGallery(product);

    if (ratingText) {
      ratingText.textContent = categoryName || "Radios catalog product";
    }

    if (descEl) {
      descEl.textContent = productDescription;
    }

    if (currentPriceEl) {
      currentPriceEl.textContent = formatCurrency(price);
    }

    if (oldPriceEl) {
      oldPriceEl.textContent = oldPriceText;
    }

    var priceWrap = document.querySelector(".product-details .price");
    var stockStatusEl = document.querySelector(".product-details .product-stock-message");
    if (!stockStatusEl && priceWrap) {
      stockStatusEl = document.createElement("div");
      stockStatusEl.className = "product-stock-message";
      priceWrap.insertAdjacentElement("afterend", stockStatusEl);
    }
    if (stockStatusEl) {
      stockStatusEl.textContent = stockMessage;
      stockStatusEl.className = "product-stock-message " + stockMessageClass;
    }

    renderDeliveryEstimate(product);
    renderProductPromotions(product);

    if (modelWrap && modelList) {
      if (modelOptions.length) {
        modelWrap.style.display = "";
        modelList.innerHTML = modelOptions.map(function (model, index) {
          return '<li' + (index === 0 ? ' class="active"' : "") + '>' + escapeHtml(model) + "</li>";
        }).join("");
      } else {
        modelWrap.style.display = "none";
      }
    }

    if (categoryEl && categoryName) {
      categoryEl.style.display = "";
      categoryEl.innerHTML = 'Categories: <a href="' + (categoryLink ? categoryUrl(categoryLink) : ('shop-left-sidebar.html?search=' + encodeURIComponent(categoryName))) + '">' + escapeHtml(categoryName) + "</a>";
    } else if (categoryEl) {
      categoryEl.style.display = "none";
    }

    if (tagsEl && visibleTags.length) {
      tagsEl.style.display = "";
      tagsEl.innerHTML = "Tags: " + visibleTags.map(function (tag) {
        return '<a href="shop-left-sidebar.html?search=' + encodeURIComponent(tag) + '">' + escapeHtml(tag) + "</a>";
      }).join(", ");
    } else if (tagsEl) {
      tagsEl.style.display = "none";
    }

    if (addButton) {
      addButton.setAttribute("type", "button");
      if (canPurchase) {
        addButton.setAttribute("data-add-to-cart", productId);
      } else {
        addButton.removeAttribute("data-add-to-cart");
      }
      addButton.setAttribute("data-product-name", getProductName(product));
      addButton.setAttribute("data-product-price", price);
      addButton.setAttribute("data-product-image", productImage);
      addButton.disabled = !canPurchase;
      addButton.classList.toggle("is-out-of-stock", !canPurchase);
      if (addButton.getAttribute("data-product-detail-cart-bound") !== "true") {
        addButton.setAttribute("data-product-detail-cart-bound", "true");
        addButton.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          handleAddToCartTarget(addButton);
        });
      }
      var primarySpan = addButton.querySelector(".btn-wrap span");
      if (primarySpan) {
        primarySpan.textContent = canPurchase ? "Add To Cart" : "Out Of Stock";
      }
      var spans = addButton.querySelectorAll(".btn-wrap span");
      spans.forEach(function (span) {
        span.textContent = canPurchase ? "Add To Cart" : "Out Of Stock";
      });
    }

    if (productRow && productId) {
      var wishlistWrap = productRow.querySelector(".product-wishlist-btn");
      if (!wishlistWrap) {
        wishlistWrap = document.createElement("div");
        wishlistWrap.className = "product-wishlist-btn";
        productRow.appendChild(wishlistWrap);
      }

      wishlistWrap.innerHTML = '<a href="wishlist.html" class="product-detail-wishlist" data-wishlist-toggle="' + escapeAttribute(productId) + '" data-product-name="' + escapeAttribute(getProductName(product)) + '" aria-pressed="false"><i class="far fa-heart" aria-hidden="true"></i><span>Wishlist</span></a>';
      applyWishlistButtonStates();
    }

    bindProductQuantity(product);
    renderProductTabs(product);

    var shareUrl = encodeURIComponent(window.location.href);
    var shareText = encodeURIComponent(productName + " on Radios");
    var shareLinks = document.querySelectorAll(".product-share-wrap a");
    if (shareLinks[0]) shareLinks[0].href = "https://www.facebook.com/sharer/sharer.php?u=" + shareUrl;
    if (shareLinks[1]) shareLinks[1].href = "https://www.instagram.com/";
    if (shareLinks[2]) shareLinks[2].href = "https://twitter.com/intent/tweet?url=" + shareUrl + "&text=" + shareText;
    if (shareLinks[3]) shareLinks[3].href = "https://www.linkedin.com/sharing/share-offsite/?url=" + shareUrl;
  }

  function ensureProductReviewsSection() {
    var existing = document.getElementById("productReviewsSection");
    if (existing) {
      return existing;
    }

    var singleInfo = document.querySelector(".shop-single-section .single-product-info");
    var anchorRow = singleInfo ? singleInfo.closest(".row") : null;
    if (!anchorRow) {
      return null;
    }

    anchorRow.insertAdjacentHTML("afterend",
      '<div class="row product-reviews-row">' +
        '<div class="col col-xs-12">' +
          '<section id="productReviewsSection" class="product-reviews-live" aria-labelledby="productReviewsTitle">' +
            '<div class="product-reviews-live__header">' +
              '<div>' +
                '<span class="product-reviews-live__eyebrow">Customer Reviews</span>' +
                '<h3 id="productReviewsTitle">Reviews</h3>' +
              '</div>' +
              '<div class="product-reviews-live__summary" data-product-review-summary>No reviews yet</div>' +
            '</div>' +
            '<div class="product-reviews-live__body">' +
              '<div class="product-reviews-live__list" data-product-review-list>Loading reviews...</div>' +
              '<aside class="product-reviews-live__form" data-product-review-form>Checking review eligibility...</aside>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>'
    );

    return document.getElementById("productReviewsSection");
  }

  function formatReviewDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function updateProductDetailRating(productId, stats) {
    var ratingWrap = document.querySelector(".product-details .rating");
    var summaryWrap = document.querySelector("[data-product-review-summary]");
    var summary = stats && stats[productId] ? stats[productId] : { count: 0, average: 0 };

    if (ratingWrap) {
      ratingWrap.innerHTML = buildRatingSummaryMarkup(summary);
    }

    if (summaryWrap) {
      summaryWrap.innerHTML = buildRatingSummaryMarkup(summary);
    }
  }

  function renderReviewImages(imageUrls) {
    imageUrls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 3) : [];
    if (!imageUrls.length) {
      return "";
    }

    return '<div class="review-card__images">' + imageUrls.map(function (url) {
      return '<a href="' + escapeAttribute(url) + '" target="_blank" rel="noopener"><img src="' + escapeAttribute(url) + '" alt="Review image" ' + buildImageAttrs({ width: 96, height: 96 }) + '></a>';
    }).join("") + '</div>';
  }

  function renderApprovedReviews(productId, reviews) {
    var list = document.querySelector("[data-product-review-list]");
    if (!list) {
      return;
    }

    if (!reviews.length) {
      list.innerHTML = '<div class="product-reviews-empty">No reviews yet. Verified buyers can share feedback after delivery.</div>';
      return;
    }

    list.innerHTML = reviews.map(function (review) {
      return '' +
        '<article class="review-card">' +
          '<div class="review-card__head">' +
            '<div>' +
              '<strong>' + escapeHtml(review.customer_name || "Radios customer") + '</strong>' +
              '<div class="review-card__rating">' + buildRatingStars(review.rating) + '</div>' +
            '</div>' +
            '<div class="review-card__meta">' +
              (review.is_verified_purchase ? '<span class="verified-purchase-badge">Verified Purchase</span>' : '') +
              '<time>' + escapeHtml(formatReviewDate(review.created_at)) + '</time>' +
            '</div>' +
          '</div>' +
          '<p>' + escapeHtml(review.comment || "") + '</p>' +
          renderReviewImages(review.image_urls) +
        '</article>';
    }).join("");
  }

  function isDeliveredOrder(order) {
    var statusText = [
      order && order.order_status,
      order && order.status,
      order && order.shipping_status,
      order && order.fulfillment_status,
      order && order.tracking_status
    ].join(" ").toLowerCase();

    return statusText.indexOf("delivered") !== -1 || Boolean(order && order.delivered_at);
  }

  function fetchReviewEligibility(product, user) {
    var client = getSupabaseClient();
    var productId = getProductIdentifier(product);

    if (!client || !user || !user.id || !isUuid(productId)) {
      return Promise.resolve({ allowed: false, reason: "auth" });
    }

    return client
      .from("orders")
      .select("id,order_number,status,order_status,shipping_status,fulfillment_status,tracking_status,delivered_at,customer_name,customer_email")
      .eq("auth_user_id", user.id)
      .then(function (ordersResult) {
        if (ordersResult.error) {
          throw ordersResult.error;
        }

        var deliveredOrders = (ordersResult.data || []).filter(isDeliveredOrder);
        var deliveredOrderIds = deliveredOrders.map(function (order) { return order.id; }).filter(Boolean);
        if (!deliveredOrderIds.length) {
          return { allowed: false, reason: "not_purchased" };
        }

        return client
          .from("order_items")
          .select("order_id,product_id,product_name")
          .in("order_id", deliveredOrderIds)
          .eq("product_id", productId)
          .then(function (itemsResult) {
            if (itemsResult.error) {
              throw itemsResult.error;
            }

            var matchingItems = itemsResult.data || [];
            if (!matchingItems.length) {
              return { allowed: false, reason: "not_purchased" };
            }

            var matchingOrderIds = uniqueStrings(matchingItems.map(function (item) { return item.order_id; }).filter(Boolean));
            return client
              .from("reviews")
              .select("id,order_id,moderation_status")
              .eq("auth_user_id", user.id)
              .eq("product_id", productId)
              .in("order_id", matchingOrderIds)
              .then(function (reviewsResult) {
                if (reviewsResult.error) {
                  throw reviewsResult.error;
                }

                var reviewedOrderIds = uniqueStrings((reviewsResult.data || []).map(function (review) { return review.order_id; }).filter(Boolean));
                var availableOrderId = matchingOrderIds.find(function (orderId) {
                  return reviewedOrderIds.indexOf(orderId) === -1;
                });

                if (!availableOrderId) {
                  return { allowed: false, reason: "duplicate" };
                }

                var order = deliveredOrders.find(function (item) { return item.id === availableOrderId; }) || deliveredOrders[0];
                return { allowed: true, order: order, orderId: availableOrderId };
              });
          });
      })
      .catch(function (error) {
        debugLog("Review eligibility check failed:", error.message);
        return { allowed: false, reason: "error", message: error.message };
      });
  }

  function validateReviewImages(files) {
    var allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    var selectedFiles = Array.prototype.slice.call(files || []);

    if (selectedFiles.length > 3) {
      throw new Error("Please upload no more than 3 review images.");
    }

    selectedFiles.forEach(function (file) {
      if (allowedTypes.indexOf(file.type) === -1) {
        throw new Error("Review images must be JPG, PNG, or WebP files.");
      }
      if (file.size > 3 * 1024 * 1024) {
        throw new Error("Each review image must be 3MB or smaller.");
      }
    });

    return selectedFiles;
  }

  function getReviewCustomerName(user) {
    var stored = readStoredCustomer() || {};
    var metadata = user && user.user_metadata ? user.user_metadata : {};
    var email = user && user.email ? user.email : stored.email || "";
    return stored.fullName ||
      [stored.firstName, stored.lastName].filter(Boolean).join(" ") ||
      metadata.full_name ||
      metadata.name ||
      (email ? email.split("@")[0].replace(/[._-]+/g, " ") : "Radios customer");
  }

  function uploadReviewImages(files, user, productId) {
    var client = getSupabaseClient();
    var selectedFiles = validateReviewImages(files);

    if (!client || !selectedFiles.length) {
      return Promise.resolve([]);
    }

    return Promise.all(selectedFiles.map(function (file, index) {
      var extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      var path = user.id + "/" + productId + "/" + Date.now() + "-" + index + "." + extension;
      return client.storage
        .from("review-images")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false
        })
        .then(function (uploadResult) {
          if (uploadResult.error) {
            throw uploadResult.error;
          }
          return client.storage.from("review-images").getPublicUrl(path).data.publicUrl;
        });
    }));
  }

  function buildReviewForm(product, user, eligibility) {
    var productId = getProductIdentifier(product);
    return '' +
      '<h4>Write a verified review</h4>' +
      '<p class="review-form-note">Share your experience after delivery. Reviews are published after approval.</p>' +
      '<form class="verified-review-form" data-verified-review-form data-product-id="' + escapeAttribute(productId) + '" data-order-id="' + escapeAttribute(eligibility.orderId) + '">' +
        '<div class="review-rating-input" role="radiogroup" aria-label="Rating">' +
          [1, 2, 3, 4, 5].map(function (rating) {
            return '<button type="button" data-review-rating="' + rating + '" aria-checked="' + (rating === 5 ? "true" : "false") + '" class="' + (rating <= 5 ? "is-active" : "") + '"><i class="fas fa-star" aria-hidden="true"></i><span class="sr-only">' + rating + ' stars</span></button>';
          }).join("") +
        '</div>' +
        '<input type="hidden" name="rating" value="5">' +
        '<textarea name="comment" rows="5" maxlength="1200" placeholder="Write your review" required></textarea>' +
        '<label class="review-image-upload"><span>Review images</span><input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple><small>Optional. Up to 3 images, 3MB each.</small></label>' +
        '<div class="review-form-status" data-review-form-status></div>' +
        '<button type="submit" class="thm-btn thm-btn__2 no-icon"><span class="btn-wrap"><span>Submit Review</span><span>Submit Review</span></span></button>' +
      '</form>';
  }

  function setReviewFormStatus(form, message, type) {
    var status = form ? form.querySelector("[data-review-form-status]") : null;
    if (!status) {
      return;
    }
    status.textContent = message || "";
    status.className = "review-form-status" + (type ? " is-" + type : "");
  }

  function bindReviewForm(product, user) {
    var form = document.querySelector("[data-verified-review-form]");
    if (!form) {
      return;
    }

    form.querySelectorAll("[data-review-rating]").forEach(function (button) {
      button.addEventListener("click", function () {
        var rating = Number(button.getAttribute("data-review-rating")) || 5;
        form.querySelector('[name="rating"]').value = String(rating);
        form.querySelectorAll("[data-review-rating]").forEach(function (item) {
          var itemRating = Number(item.getAttribute("data-review-rating")) || 0;
          item.classList.toggle("is-active", itemRating <= rating);
          item.setAttribute("aria-checked", itemRating === rating ? "true" : "false");
        });
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var client = getSupabaseClient();
      var submitButton = form.querySelector('[type="submit"]');
      var productId = form.getAttribute("data-product-id");
      var orderId = form.getAttribute("data-order-id");
      var rating = Math.min(5, Math.max(1, Number(form.querySelector('[name="rating"]').value) || 5));
      var comment = (form.querySelector('[name="comment"]').value || "").trim();
      var fileInput = form.querySelector('[name="images"]');

      if (!client || !user || !user.id) {
        setReviewFormStatus(form, "Please sign in before submitting a review.", "error");
        return;
      }

      if (!comment) {
        setReviewFormStatus(form, "Please write a short review before submitting.", "error");
        return;
      }

      try {
        validateReviewImages(fileInput ? fileInput.files : []);
      } catch (error) {
        setReviewFormStatus(form, error.message, "error");
        return;
      }

      submitButton.disabled = true;
      setReviewFormStatus(form, "Submitting your review...", "success");

      uploadReviewImages(fileInput ? fileInput.files : [], user, productId)
        .then(function (imageUrls) {
          return client
            .from("reviews")
            .insert({
              product_id: productId,
              order_id: orderId,
              auth_user_id: user.id,
              customer_name: getReviewCustomerName(user),
              customer_email: user.email || "",
              rating: rating,
              comment: comment,
              image_urls: imageUrls,
              is_verified_purchase: true,
              is_approved: false,
              moderation_status: "pending",
              status: "pending"
            })
            .select("id")
            .single();
        })
        .then(function (result) {
          if (result.error) {
            throw result.error;
          }

          form.reset();
          setReviewFormStatus(form, "Your review is awaiting approval", "success");
          var formWrap = document.querySelector("[data-product-review-form]");
          if (formWrap) {
            formWrap.innerHTML = '<div class="review-form-state is-success"><strong>Your review is awaiting approval</strong><p>Thanks for sharing your experience. Radios will publish it after moderation.</p></div>';
          }
        })
        .catch(function (error) {
          var message = error && error.code === "23505"
            ? "You have already submitted a review for this delivered order."
            : (error.message || "Unable to submit your review right now.");
          setReviewFormStatus(form, message, "error");
        })
        .then(function () {
          submitButton.disabled = false;
        });
    });
  }

  function renderReviewEligibility(product) {
    var formWrap = document.querySelector("[data-product-review-form]");
    if (!formWrap) {
      return Promise.resolve();
    }

    formWrap.innerHTML = '<div class="review-form-state">Checking review eligibility...</div>';

    return getCurrentAuthUser().then(function (user) {
      if (!user) {
        formWrap.innerHTML = '<div class="review-form-state"><strong>Sign in to review</strong><p>Only verified buyers can review this product.</p><a href="account.html?redirect=' + encodeURIComponent(getProductUrl(product)) + '">Sign in</a></div>';
        return;
      }

      return fetchReviewEligibility(product, user).then(function (eligibility) {
        if (eligibility.allowed) {
          formWrap.innerHTML = buildReviewForm(product, user, eligibility);
          bindReviewForm(product, user);
          return;
        }

        if (eligibility.reason === "duplicate") {
          formWrap.innerHTML = '<div class="review-form-state"><strong>Review already submitted</strong><p>Your review for this delivered purchase is already recorded.</p></div>';
          return;
        }

        if (eligibility.reason === "error") {
          formWrap.innerHTML = '<div class="review-form-state"><strong>Unable to check review eligibility</strong><p>Please refresh the page or contact Radios support if this continues.</p></div>';
          return;
        }

        formWrap.innerHTML = '<div class="review-form-state"><strong>Only verified buyers can review this product</strong><p>Reviews open after a delivered order for this item is linked to your Radios account.</p></div>';
      });
    });
  }

  function renderProductReviews(product) {
    var productId = getProductIdentifier(product);
    var section = ensureProductReviewsSection();
    if (!section || !isUuid(productId)) {
      return;
    }

    fetchApprovedReviews(productId, { throwOnError: true }).then(function (reviews) {
      var summary = summarizeReviews(reviews);
      var stats = {};
      stats[productId] = summary;
      updateProductDetailRating(productId, stats);
      renderApprovedReviews(productId, reviews);
      applyProductSeo(product, reviews);
      hydrateProductRatings(document);
    }).catch(function () {
      var list = document.querySelector("[data-product-review-list]");
      if (list) {
        list.innerHTML = '<div class="product-reviews-empty is-error">Unable to load reviews right now.</div>';
      }
    });

    renderReviewEligibility(product);
  }

  function setupProductDetail() {
    var productDetailsWrap = document.querySelector(".shop-single-section .product-details");
    if (!productDetailsWrap) {
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var productId = params.get("id") || params.get("_id") || params.get("productId");
    var productSlug = params.get("slug");

    debugLog("Product detail page opened with query:", window.location.search || "(empty)");
    debugLog("Resolved product id:", productId || "(missing)");
    debugLog("Resolved product slug:", productSlug || "(missing)");

    if (!productId && !productSlug) {
      debugLog("No product id or slug found in URL. Falling back to first visible product.");
      fetchStorefrontProducts()
        .then(function (response) {
          var products = getVisibleProducts(response);
          if (products[0]) {
            var fallbackId = getProductIdentifier(products[0]);
            var fallbackSlug = getProductSlug(products[0]);
            debugLog("Redirecting to fallback product:", fallbackSlug || fallbackId);
            window.location.search = fallbackSlug ? "?slug=" + encodeURIComponent(fallbackSlug) : "?id=" + encodeURIComponent(fallbackId);
          } else {
            productDetailsWrap.innerHTML = "<h2>Unable to load product</h2><p>No products are available yet.</p>";
          }
        })
        .catch(function (error) {
          debugLog("Failed to fetch fallback product:", error.message);
          productDetailsWrap.innerHTML = "<h2>Unable to load product</h2><p>" + error.message + "</p>";
        });
      return;
    }

    debugLog("Fetching product from API:", productSlug ? "slug:" + productSlug : API_BASE + "/products/" + productId);
    (productSlug ? fetchStorefrontProductBySlug(productSlug) : fetchStorefrontProduct(productId))
      .then(function (product) {
        debugLog("Product loaded successfully:", product);
        populateProductDetails(product);
        renderProductReviews(product);
        updateRecentlyViewedProducts(product);
        trackAnalyticsEvent("product_view", {
          productId: getProductIdentifier(product),
          metadata: {
            product_name: getProductName(product),
            category: getProductPrimaryCategory(product) || product.category || "",
            price: readNumberValue(product.price, 0)
          }
        });

        var relatedWrap = document.querySelector(".shop-single-section .realted-porduct");
        var relatedRow = relatedWrap ? relatedWrap.closest(".row") : null;
        if (relatedRow) {
          relatedRow.id = "relatedProductsSection";
        }

        var relatedList = document.querySelector("#relatedProductsSection .products.clearfix, .shop-single-section .products.clearfix");
        if (relatedList) {
          renderProductSkeleton(relatedList, 4);
        }

        return new Promise(function (resolve, reject) {
          runWhenVisible(relatedRow || productDetailsWrap, function () {
            fetchRelatedProductsForProduct(product)
              .then(function (relatedProducts) {
                resolve({ product: product, relatedProducts: relatedProducts });
              })
              .catch(reject);
          });
        });
      })
      .then(function (payload) {
        var relatedList = document.querySelector("#relatedProductsSection .products.clearfix, .shop-single-section .products.clearfix");
        if (relatedList) {
          relatedList.classList.add("product-live-scroll");
        }
        if (relatedList && payload.relatedProducts.length) {
          relatedList.innerHTML = payload.relatedProducts.map(buildProductCard).join("");
          hydrateProductRatings(relatedList);
          enhanceExistingImages(relatedList);
          applyWishlistButtonStates();
        } else if (relatedList) {
          relatedList.innerHTML = '<li class="product"><div class="product-info"><h2 class="product__title">No related products available yet</h2><p class="product-description"><a href="shop-left-sidebar.html">Browse the full Radios catalog</a> for more options.</p></div></li>';
        }

        return renderRecentlyViewedProducts(payload.product);
      })
      .catch(function (error) {
        debugLog("Failed to load product:", error.message);
        var notFound = /not found/i.test(error.message || "");
        productDetailsWrap.innerHTML = "<h2>" + (notFound ? "Product not found" : "Unable to load product") + "</h2><p>" + (notFound ? "This product is no longer available in the Radios storefront." : error.message) + "</p>";
        var galleryWrap = document.querySelector(".product-single-wrap");
        if (galleryWrap) {
          galleryWrap.innerHTML = '<div class="product-detail-empty-state">Product image unavailable</div>';
        }
      });
  }

  function renderCartPage() {
    var modernCartItems = document.getElementById("cartItemsContainer");
    if (modernCartItems) {
      renderModernCartPage(modernCartItems);
      return;
    }

    var cartTableBody = document.querySelector(".woocommerce-cart .shop_table.cart tbody");
    if (!cartTableBody) {
      return;
    }

    var items = readCart();
    var totalsTable = document.querySelector(".cart_totals .shop_table");
    var couponInput = document.querySelector('.woocommerce-cart [name="coupon_code"]');
    var appliedCode = readAppliedDiscountCode();

    if (couponInput && appliedCode && !couponInput.value) {
      couponInput.value = appliedCode;
    }

    if (!items.length) {
      clearAppliedDiscountCode();
      cartTableBody.innerHTML = '<tr><td colspan="6">Your cart is empty. <a href="shop-left-sidebar.html">Browse products</a></td></tr>';
      if (totalsTable) {
        totalsTable.innerHTML = '<tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">' + formatCurrency(0) + '</td></tr>';
      }
      return;
    }

    cartTableBody.innerHTML = items.map(function (item) {
      var subtotal = item.price * item.quantity;
      return '' +
        '<tr class="cart_single">' +
          '<td class="product-remove"><a href="cart.html" class="remove" data-remove-cart-item="' + item.productId + '">&times;</a></td>' +
          '<td class="product-thumbnail"><a href="shop-single.html?id=' + item.productId + '"><img width="57" height="70" src="' + item.image + '" alt="' + item.name + '"></a></td>' +
          '<td class="product-name" data-title="Product"><a href="shop-single.html?id=' + item.productId + '">' + item.name + '</a></td>' +
          '<td class="product-price" data-title="Price">' + formatCurrency(item.price) + '</td>' +
          '<td class="product-quantity" data-title="Quantity"><div class="quantity"><input type="number" min="1" value="' + item.quantity + '" class="product-count input-text qty text form-control" data-cart-qty="' + item.productId + '"></div></td>' +
          '<td class="product-subtotal" data-title="Total">' + formatCurrency(subtotal) + '</td>' +
        '</tr>';
    }).join("") + '<tr><td colspan="6" class="actions"><a class="thm-btn thm-btn__2 br-0 no-icon" href="checkout.html"><span class="btn-wrap"><span>Proceed To Checkout</span><span>Proceed To Checkout</span></span></a></td></tr>';

    if (totalsTable) {
      var subtotal = getCartTotal(items);
      totalsTable.innerHTML = '' +
        '<tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">' + formatCurrency(subtotal) + '</td></tr>' +
        '<tr class="shipping"><th>Shipping</th><td data-title="Shipping">Free Shipping</td></tr>' +
        '<tr class="order-total"><th>Total</th><td data-title="Total">' + formatCurrency(subtotal) + '</td></tr>';
    }

    evaluateSharedCartDiscounts(items, appliedCode)
      .then(function (result) {
        if (appliedCode && !result.selectedDiscount) {
          clearAppliedDiscountCode();
          if (couponInput) {
            couponInput.value = "";
          }
        }

        if (!totalsTable) {
          return;
        }

        var subtotal = getCartTotal(items);
        var discountAmount = readNumberValue(result.discountAmount, 0) + readNumberValue(result.shippingDiscountAmount, 0);
        var total = Math.max(0, subtotal - discountAmount);
        var rows = [
          '<tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">' + formatCurrency(subtotal) + '</td></tr>',
          '<tr class="shipping"><th>Shipping</th><td data-title="Shipping">Free Shipping</td></tr>'
        ];

        if (result.selectedDiscount && (discountAmount > 0 || readNumberValue(result.shippingDiscountAmount, 0) > 0)) {
          rows.push(
            '<tr class="cart-discount"><th>Discount</th><td data-title="Discount">-' + formatCurrency(discountAmount) +
            '<div class="text-muted small">' + escapeHtml(result.selectedDiscount.title || result.selectedDiscount.code || "Discount applied") + '</div></td></tr>'
          );
        } else if (appliedCode) {
          rows.push('<tr class="cart-discount"><th>Discount</th><td data-title="Discount">Code not applicable</td></tr>');
        }

        rows.push('<tr class="order-total"><th>Total</th><td data-title="Total">' + formatCurrency(total) + '</td></tr>');
        totalsTable.innerHTML = rows.join("");
      })
      .catch(function (error) {
        debugLog("Cart discount evaluation failed:", error.message);
      });
  }

  function updateModernOrderSummary(values) {
    values = values || {};
    var subtotal = Number(values.subtotal) || 0;
    var discountAmount = Number(values.discountAmount) || 0;
    var total = Math.max(0, subtotal - discountAmount);
    var subtotalEl = document.getElementById("cartSubtotal");
    var discountEl = document.getElementById("cartDiscount");
    var deliveryEl = document.getElementById("cartDelivery");
    var totalEl = document.getElementById("cartTotal");
    var discountRow = document.getElementById("cartDiscountRow");

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (discountEl) discountEl.textContent = discountAmount > 0 ? "-" + formatCurrency(discountAmount) : formatCurrency(0);
    if (deliveryEl) deliveryEl.textContent = "Free";
    if (totalEl) totalEl.textContent = formatCurrency(total);

    if (discountRow) {
      var existingNote = discountRow.querySelector(".summary-note");
      if (existingNote) {
        existingNote.remove();
      }

      if (values.note) {
        var note = document.createElement("small");
        note.className = "summary-note";
        note.textContent = values.note;
        discountRow.appendChild(note);
      }
    }
  }

  function renderModernCartPage(itemsContainer) {
    var items = readCart();
    var summaryPanel = document.getElementById("orderSummaryPanel");
    var couponForm = document.querySelector(".cart-page-modern__coupon");
    var couponInput = couponForm ? couponForm.querySelector('[name="coupon_code"]') : null;
    var appliedCode = readAppliedDiscountCode();

    if (couponInput && appliedCode && !couponInput.value) {
      couponInput.value = appliedCode;
    }

    if (!items.length) {
      clearAppliedDiscountCode();
      itemsContainer.innerHTML = '' +
        '<div class="cart-empty-state">' +
          '<h2>Your cart is empty</h2>' +
          '<p>Add products to your cart and they will appear here.</p>' +
          '<a href="shop-left-sidebar.html" class="cart-empty-state__button">Start Shopping</a>' +
        '</div>';
      if (summaryPanel) {
        summaryPanel.hidden = true;
        summaryPanel.classList.add("is-hidden");
      }
      updateModernOrderSummary({ subtotal: 0, discountAmount: 0 });
      return;
    }

    if (summaryPanel) {
      summaryPanel.hidden = false;
      summaryPanel.classList.remove("is-hidden");
    }

    itemsContainer.innerHTML = items.map(function (item) {
      var productId = escapeAttribute(item.productId);
      var name = escapeHtml(item.name || "Product");
      var safeName = escapeAttribute(item.name || "Product");
      var image = escapeAttribute(item.image || IMAGE_PLACEHOLDER);
      var price = Number(item.price) || 0;
      var quantity = Math.max(1, Number(item.quantity) || 1);
      var subtotal = price * quantity;
      var productUrl = "shop-single.html?id=" + encodeURIComponent(item.productId);

      return '' +
        '<div class="cart-item-card" data-product-id="' + productId + '">' +
          '<button type="button" class="cart-remove-btn" data-remove-cart-item="' + productId + '" aria-label="Remove ' + safeName + '">' +
            '<i class="fal fa-times" aria-hidden="true"></i>' +
          '</button>' +
          '<a class="cart-item-image" href="' + productUrl + '">' +
            '<img src="' + image + '" alt="' + safeName + '">' +
          '</a>' +
          '<div class="cart-item-info">' +
            '<h3><a href="' + productUrl + '">' + name + '</a></h3>' +
            '<p class="cart-item-price"><span>Price</span><strong>' + formatCurrency(price) + '</strong></p>' +
            '<div class="quantity-control" aria-label="Quantity">' +
              '<button type="button" class="qty-minus" data-cart-qty-step="-1" data-product-id="' + productId + '" aria-label="Decrease quantity">-</button>' +
              '<input type="number" class="qty-input" min="1" value="' + quantity + '" data-cart-qty="' + productId + '" aria-label="Quantity for ' + safeName + '">' +
              '<button type="button" class="qty-plus" data-cart-qty-step="1" data-product-id="' + productId + '" aria-label="Increase quantity">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item-subtotal">' +
            '<span>Subtotal</span>' +
            '<strong>' + formatCurrency(subtotal) + '</strong>' +
          '</div>' +
        '</div>';
    }).join("");

    updateModernOrderSummary({
      subtotal: getCartTotal(items),
      discountAmount: 0,
      note: appliedCode ? "Checking coupon..." : ""
    });

    validateCartInventory(items)
      .then(function (validation) {
        var checkoutLink = document.querySelector("#orderSummaryPanel .checkout-btn");
        if (checkoutLink) {
          checkoutLink.classList.toggle("is-disabled", !validation.ok);
          checkoutLink.setAttribute("aria-disabled", validation.ok ? "false" : "true");
        }

        if (!validation.ok) {
          updateModernOrderSummary({
            subtotal: getCartTotal(items),
            discountAmount: 0,
            note: validation.message
          });
        }
      })
      .catch(function (error) {
        debugLog("Cart inventory validation failed:", error.message);
      });

    evaluateSharedCartDiscounts(items, appliedCode)
      .then(function (result) {
        if (appliedCode && !result.selectedDiscount) {
          clearAppliedDiscountCode();
          if (couponInput) {
            couponInput.value = "";
          }
        }

        var discountAmount = readNumberValue(result.discountAmount, 0) + readNumberValue(result.shippingDiscountAmount, 0);
        var note = "";
        if (result.selectedDiscount && (discountAmount > 0 || readNumberValue(result.shippingDiscountAmount, 0) > 0)) {
          note = result.selectedDiscount.title || result.selectedDiscount.code || "Discount applied";
          if (couponForm) {
            setCouponStatus(couponForm, appliedCode ? "Coupon " + appliedCode + " applied successfully." : note + " applied automatically.", "success");
          }
        } else if (appliedCode) {
          note = "Code not applicable";
          if (couponForm) {
            setCouponStatus(couponForm, "Coupon " + appliedCode + " is not applicable for the current cart.", "error");
          }
        } else if (couponForm) {
          setCouponStatus(couponForm, "", "");
        }

        updateModernOrderSummary({
          subtotal: getCartTotal(items),
          discountAmount: discountAmount,
          note: note
        });
      })
      .catch(function (error) {
        debugLog("Cart discount evaluation failed:", error.message);
        if (couponForm) {
          setCouponStatus(couponForm, "Unable to reach the discount service. Please try again later.", "error");
        }
      });
  }

  function renderWishlistSummary(count) {
    var totalEl = document.getElementById("wishlistTotalCount");
    var labelEl = document.getElementById("wishlistSummaryLabel");

    if (totalEl) {
      totalEl.textContent = String(count);
    }

    if (labelEl) {
      labelEl.textContent = count === 1 ? "1 saved product" : count + " saved products";
    }
  }

  function buildWishlistItemCard(item) {
    var product = normalizeProduct(item.product);
    var productId = getProductIdentifier(product);
    var productUrl = getProductUrl(product);
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var productName = getProductName(product);
    var categoryLabel = getProductSubcategory(product) || getProductPrimaryCategory(product) || product.category || "Catalog";
    var price = readNumberValue(product.price, 0);
    var stock = getAvailableStock(product);
    var stockLabel = canPurchaseProduct(product, 1) ? getProductStockMessage(product, 1) : "Out of stock";
    var addToCartAction = canPurchaseProduct(product, 1)
      ? '<a href="cart.html" class="wishlist-add-cart" data-add-to-cart="' + escapeAttribute(productId) + '" data-product-name="' + escapeAttribute(productName) + '" data-product-price="' + price + '" data-product-image="' + escapeAttribute(productImage) + '">Add to Cart</a>'
      : '<span class="wishlist-add-cart is-out-of-stock" aria-disabled="true">Out of Stock</span>';

    return '' +
      '<article class="wishlist-item-card" data-product-id="' + escapeAttribute(productId) + '">' +
        '<button type="button" class="wishlist-remove-btn" data-remove-wishlist-item="' + escapeAttribute(productId) + '" aria-label="Remove ' + escapeAttribute(productName) + '">' +
          '<i class="fal fa-times" aria-hidden="true"></i>' +
        '</button>' +
        '<a class="wishlist-item-image" href="' + productUrl + '">' +
          '<img src="' + escapeAttribute(productImage) + '" alt="' + escapeAttribute(productName) + '">' +
        '</a>' +
        '<div class="wishlist-item-info">' +
          '<span class="wishlist-item-category">' + escapeHtml(categoryLabel) + '</span>' +
          '<h3><a href="' + productUrl + '">' + escapeHtml(productName) + '</a></h3>' +
          '<div class="wishlist-item-meta">' +
            '<span>' + formatCurrency(price) + '</span>' +
            '<span class="' + (stock > 0 ? "is-in-stock" : "is-out-stock") + '">' + stockLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="wishlist-item-actions">' +
          addToCartAction +
          '<a href="' + productUrl + '" class="wishlist-view-product">View Product</a>' +
        '</div>' +
      '</article>';
  }

  function renderWishlistPage() {
    var container = document.getElementById("wishlistItemsContainer");
    var summaryPanel = document.getElementById("wishlistSummaryPanel");

    if (!container) {
      return;
    }

    container.innerHTML = '<div class="wishlist-loading-state">Loading wishlist...</div>';
    if (summaryPanel) {
      summaryPanel.hidden = true;
    }

    fetchWishlistItems()
      .then(function (items) {
        renderWishlistSummary(items.length);

        if (!items.length) {
          container.innerHTML = '' +
            '<div class="wishlist-empty-state">' +
              '<h2>Your wishlist is empty</h2>' +
              '<p>Save products you love and they will appear here.</p>' +
              '<a href="shop-left-sidebar.html" class="wishlist-empty-state__button">Start Shopping</a>' +
            '</div>';
          if (summaryPanel) {
            summaryPanel.hidden = true;
          }
          return;
        }

        if (summaryPanel) {
          summaryPanel.hidden = false;
        }

        container.innerHTML = items.map(buildWishlistItemCard).join("");
      })
      .catch(function () {
        renderWishlistSummary(0);
        container.innerHTML = '' +
          '<div class="wishlist-empty-state">' +
            '<h2>Unable to load wishlist</h2>' +
            '<p>Please refresh the page or continue shopping.</p>' +
            '<a href="shop-left-sidebar.html" class="wishlist-empty-state__button">Continue Shopping</a>' +
          '</div>';
      });
  }

  function renderCheckoutReview() {
    var reviewTable = document.querySelector(".woocommerce-checkout-review-order-table");
    if (!reviewTable) {
      return;
    }

    var items = readCart();
    var subtotal = getCartTotal(items);
    var couponForm = document.querySelector(".checkout_coupon");
    var appliedCode = readAppliedDiscountCode();
    var tbodyMarkup = items.map(function (item) {
      return '<tr class="cart_item"><td class="product-name">' + item.name + ' <strong class="product-quantity">&times; ' + item.quantity + '</strong></td><td class="product-total">' + formatCurrency(item.price * item.quantity) + '</td></tr>';
    }).join("");

    reviewTable.innerHTML = '' +
      '<thead><tr><th class="product-name">Product</th><th class="product-total">Total</th></tr></thead>' +
      '<tbody>' + tbodyMarkup + '</tbody>' +
      '<tfoot>' +
        '<tr class="cart-subtotal"><th>Subtotal</th><td>' + formatCurrency(subtotal) + '</td></tr>' +
        '<tr class="shipping"><th>Shipping</th><td>Free Shipping</td></tr>' +
        '<tr class="order-total"><th>Total</th><td><strong>' + formatCurrency(subtotal) + '</strong></td></tr>' +
      '</tfoot>';

    evaluateSharedCartDiscounts(items, appliedCode)
      .then(function (result) {
        var discountAmount = readNumberValue(result.discountAmount, 0) + readNumberValue(result.shippingDiscountAmount, 0);
        var total = Math.max(0, subtotal - discountAmount);
        var footerRows = [
          '<tr class="cart-subtotal"><th>Subtotal</th><td>' + formatCurrency(subtotal) + '</td></tr>',
          '<tr class="shipping"><th>Shipping</th><td>Free Shipping</td></tr>'
        ];

        if (result.selectedDiscount && (discountAmount > 0 || readNumberValue(result.shippingDiscountAmount, 0) > 0)) {
          footerRows.push('<tr class="cart-discount"><th>Discount</th><td>-' + formatCurrency(discountAmount) + "</td></tr>");
        }

        if (couponForm) {
          var selectedRule = result.selectedDiscount && result.selectedDiscount.discount;
          var selectedAutomatically =
            result.selectedDiscount &&
            (
              result.selectedDiscount.method === "automatic" ||
              (!appliedCode && selectedRule && selectedRule.discountCategory === "buy_x_get_y")
            );

          if (selectedAutomatically) {
            setCouponStatus(couponForm, (result.selectedDiscount.title || "Discount") + " applied automatically.", "success");
          } else if (appliedCode && result.selectedDiscount) {
            setCouponStatus(couponForm, "Coupon " + appliedCode + " applied successfully.", "success");
          } else if (appliedCode && !result.selectedDiscount) {
            setCouponStatus(couponForm, "Coupon " + appliedCode + " is not applicable for the current cart.", "error");
          } else {
            setCouponStatus(couponForm, "", "");
          }
        }

        footerRows.push('<tr class="order-total"><th>Total</th><td><strong>' + formatCurrency(total) + "</strong></td></tr>");
        reviewTable.innerHTML =
          '<thead><tr><th class="product-name">Product</th><th class="product-total">Total</th></tr></thead>' +
          '<tbody>' + tbodyMarkup + "</tbody>" +
          '<tfoot>' + footerRows.join("") + "</tfoot>";
      })
      .catch(function (error) {
        debugLog("Checkout discount evaluation failed:", error.message);
        if (couponForm) {
          setCouponStatus(couponForm, "Unable to reach the discount service. Please try again later.", "error");
        }
      });
  }

  function readCheckoutCustomer(form) {
    function getValue(selector) {
      var field = form.querySelector(selector);
      return field ? field.value.trim() : "";
    }

    function getRawValue(selector) {
      var field = form.querySelector(selector);
      return field ? field.value : "";
    }

    return {
      firstName: getValue('[name="billing_first_name"]'),
      lastName: getValue('[name="billing_last_name"]'),
      email: getValue('[name="billing_email"]'),
      phone: getValue('[name="billing_phone"]'),
      addressLine1: getValue('[name="billing_address_1"]'),
      addressLine2: getValue('[name="billing_address_2"]'),
      city: getValue('[name="billing_city"]'),
      state: getValue('[name="billing_state"], [name="billing_company"]'),
      country: getRawValue('[name="billing_country"]'),
      zipCode: getValue('[name="billing_postcode"]') || getValue('[name="billing_postcode8"]')
    };
  }

  function setupCheckout() {
    var checkoutForm = document.querySelector("form.checkout.woocommerce-checkout");
    if (!checkoutForm) {
      return;
    }

    var couponForm = document.querySelector(".checkout_coupon");
    var couponInput = couponForm ? couponForm.querySelector('[name="coupon_code"]') : null;

    if (couponInput && readAppliedDiscountCode() && !couponInput.value) {
      couponInput.value = readAppliedDiscountCode();
    }

    renderCheckoutReview();

    var savedCustomer = localStorage.getItem(CUSTOMER_KEY);
    if (savedCustomer) {
      try {
        var customer = JSON.parse(savedCustomer);
        Object.keys(customer).forEach(function (key) {
          var fieldMap = {
            firstName: "billing_first_name",
            lastName: "billing_last_name",
            email: "billing_email",
            phone: "billing_phone",
            addressLine1: "billing_address_1",
            addressLine2: "billing_address_2",
            city: "billing_city",
            state: "billing_company",
            country: "billing_country",
            zipCode: "billing_postcode"
          };
          var field = checkoutForm.querySelector('[name="' + fieldMap[key] + '"]');
          if (field && customer[key]) {
            field.value = customer[key];
          }
        });
      } catch (error) {}
    }

    if (couponForm) {
      couponForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var nextCode = couponInput ? couponInput.value.trim().toUpperCase() : "";
        if (!nextCode) {
          clearAppliedDiscountCode();
          setCouponStatus(couponForm, "", "");
        } else {
          saveAppliedDiscountCode(nextCode);
          setCouponStatus(couponForm, "Checking coupon " + nextCode + "...", "success");
        }
        renderCartPage();
        renderCheckoutReview();
      });
    }

    checkoutForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var cart = readCart();
      if (!cart.length) {
        window.alert("Your cart is empty.");
        return;
      }

      var customer = readCheckoutCustomer(checkoutForm);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
      localStorage.setItem("radios-customer-email", customer.email);

      loadMerchandisingData()
        .then(function (data) {
          var evaluation = evaluateCartDiscounts(cart, data.products, data.collections, data.discounts, readAppliedDiscountCode());
          var discountAmount = evaluation.selectedDiscount ? evaluation.selectedDiscount.discountAmount : 0;
          var subtotal = getCartTotal(cart);
          return fetchDashcodeJson("/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              customer: customer,
              products: cart.map(function (item) {
                return {
                  productId: item.productId,
                  name: item.name,
                  price: item.price,
                  image: item.image,
                  quantity: item.quantity
                };
              }),
              pricing: {
                subtotal: subtotal,
                discount: discountAmount,
                deliveryCharge: 0,
                total: Math.max(0, subtotal - discountAmount)
              },
              paymentMethod: "cod",
              deliveryMethod: "standard",
              discount: evaluation.selectedDiscount ? {
                code: evaluation.selectedDiscount.code,
                title: evaluation.selectedDiscount.title,
                discountAmount: discountAmount
              } : null
            })
          });
        })
        .then(function (order) {
          saveCart([]);
          clearAppliedDiscountCode();
          renderMiniCart();
          window.alert("Order placed successfully. Order ID: " + order.orderId);
          window.location.href = "my-orders.html";
        })
        .catch(function (error) {
          window.alert(error.message || "Unable to place order");
        });
    });
  }

  function setupCartCouponForm() {
    var cartForm = document.querySelector(".woocommerce-cart-form");
    if (!cartForm) {
      return;
    }

    var couponInput = cartForm.querySelector('[name="coupon_code"]');
    var couponButton = Array.prototype.slice.call(cartForm.querySelectorAll('button[type="submit"]')).find(function (button) {
      return /apply coupon/i.test(button.textContent || "");
    });

    if (couponInput && readAppliedDiscountCode() && !couponInput.value) {
      couponInput.value = readAppliedDiscountCode();
    }

    if (couponButton) {
      couponButton.addEventListener("click", function (event) {
        event.preventDefault();
        var nextCode = couponInput ? couponInput.value.trim().toUpperCase() : "";
        if (!nextCode) {
          clearAppliedDiscountCode();
        } else {
          saveAppliedDiscountCode(nextCode);
        }
        renderCartPage();
      });
    }

    cartForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var nextCode = couponInput ? couponInput.value.trim().toUpperCase() : "";
      if (!nextCode) {
        clearAppliedDiscountCode();
      } else {
        saveAppliedDiscountCode(nextCode);
      }
      renderCartPage();
    });
  }

  function handleAddToCartTarget(addTarget) {
    if (!addTarget) {
      return;
    }

    var quantityScope = addTarget.closest(".product-option") || document;
    var quantityInput = quantityScope.querySelector(".product-count") || document.querySelector(".product-count");
    var quantity = quantityInput ? Math.max(1, Number(quantityInput.value) || 1) : 1;

    addToCart({
      productId: addTarget.getAttribute("data-add-to-cart"),
      name: addTarget.getAttribute("data-product-name"),
      price: addTarget.getAttribute("data-product-price"),
      image: addTarget.getAttribute("data-product-image")
    }, quantity);
  }

  document.addEventListener("click", function (event) {
    var disabledCheckoutLink = event.target.closest(".checkout-btn.is-disabled");
    if (disabledCheckoutLink) {
      event.preventDefault();
      showCartFeedback("Please update your cart before checkout.");
      return;
    }

    var wishlistTarget = event.target.closest("[data-wishlist-toggle]");
    if (wishlistTarget) {
      event.preventDefault();
      var wishlistProductId = wishlistTarget.getAttribute("data-wishlist-toggle");
      var wasWishlisted = isWishlisted(wishlistProductId);
      var shouldAddToWishlist = !wasWishlisted;
      setWishlistProductState(wishlistProductId, shouldAddToWishlist);
      trackAnalyticsEvent(shouldAddToWishlist ? "wishlist_add" : "wishlist_remove", {
        productId: wishlistProductId,
        metadata: {
          product_name: wishlistTarget.getAttribute("data-product-name") || "",
          source: "wishlist_toggle"
        }
      });

      syncWishlistToggle(wishlistProductId, shouldAddToWishlist)
        .catch(function (error) {
          console.warn("[Radios Store] Wishlist update failed.", error);
          setWishlistProductState(wishlistProductId, wasWishlisted);
        })
        .then(function () {
          renderWishlistPage();
        });
      return;
    }

    var removeWishlistTarget = event.target.closest("[data-remove-wishlist-item]");
    if (removeWishlistTarget) {
      event.preventDefault();
      var removeWishlistProductId = removeWishlistTarget.getAttribute("data-remove-wishlist-item");
      setWishlistProductState(removeWishlistProductId, false);
      trackAnalyticsEvent("wishlist_remove", {
        productId: removeWishlistProductId,
        metadata: {
          source: "wishlist_page_remove"
        }
      });
      syncWishlistToggle(removeWishlistProductId, false)
        .catch(function () {
          setWishlistProductState(removeWishlistProductId, false);
        })
        .then(function () {
          renderWishlistPage();
        });
      return;
    }

    var addTarget = event.target.closest("[data-add-to-cart]");
    if (addTarget) {
      event.preventDefault();
      handleAddToCartTarget(addTarget);
      return;
    }

    var quantityStepTarget = event.target.closest("[data-cart-qty-step]");
    if (quantityStepTarget) {
      event.preventDefault();
      var stepProductId = quantityStepTarget.getAttribute("data-product-id");
      var step = Number(quantityStepTarget.getAttribute("data-cart-qty-step")) || 0;
      var item = readCart().find(function (cartItem) {
        return cartItem.productId === stepProductId;
      });
      var currentQuantity = item ? Math.max(1, Number(item.quantity) || 1) : 1;
      updateCartItem(stepProductId, Math.max(1, currentQuantity + step));
      renderCartPage();
      return;
    }

    var removeTarget = event.target.closest("[data-remove-cart-item]");
    if (removeTarget) {
      event.preventDefault();
      removeCartItem(removeTarget.getAttribute("data-remove-cart-item"));
      renderCartPage();
    }
  });

  document.addEventListener("change", function (event) {
    var quantityField = event.target.closest("[data-cart-qty]");
    if (!quantityField) {
      return;
    }

    updateCartItem(quantityField.getAttribute("data-cart-qty"), Math.max(1, Number(quantityField.value) || 1));
    renderCartPage();
  });

  function updateProductLink(anchor, productOrId) {
    if (anchor && productOrId) {
      anchor.setAttribute("href", getProductUrl(productOrId));
    }
  }

  function updateProductLinks(scope, selector, productOrId) {
    if (!scope || !productOrId) {
      return;
    }

    scope.querySelectorAll(selector).forEach(function (anchor) {
      updateProductLink(anchor, productOrId);
    });
  }

  function parseVisiblePrice(text) {
    var normalized = String(text || "").replace(/,/g, "");
    var match = normalized.match(/(\d+(?:\.\d+)?)/);

    return match ? Number(match[1]) : 0;
  }

  function createStaticProductId(name, image, index) {
    var slug = String(name || image || "product")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    return "static-" + (slug || "product") + "-" + index;
  }

  function getStaticCardProduct(card, index) {
    var titleLink = card.querySelector(".title a, .product__title a, h3 a, h4 a");
    var image = card.querySelector(".thumb img, .product__img img, .rd-product__img img, .image img, img");
    var priceNode = card.querySelector(".product__price, .price");
    var stockNode = card.querySelector(".product__available span");
    var categoryNode = card.querySelector(".product__review span, .product-category-label");
    var name = titleLink ? titleLink.textContent.replace(/\s+/g, " ").trim() : "Product";
    var imageSrc = image ? image.getAttribute("src") : IMAGE_PLACEHOLDER;
    var stock = stockNode ? parseVisiblePrice(stockNode.textContent) : 999;

    return {
      productId: createStaticProductId(name, imageSrc, index),
      name: name || "Product",
      price: parseVisiblePrice(priceNode ? priceNode.textContent : ""),
      image: imageSrc || IMAGE_PLACEHOLDER,
      category: categoryNode ? categoryNode.textContent.replace(/\s+/g, " ").trim() : "",
      stock: stock,
      available_stock: stock
    };
  }

  function hydrateStaticCartActionLinks(root) {
    var actionLists = Array.prototype.slice.call((root || document).querySelectorAll(".product__action")).filter(function (list) {
      var addLink = list.querySelector("li:nth-child(2) a");
      return addLink && !addLink.getAttribute("data-add-to-cart");
    });

    actionLists.forEach(function (list, index) {
      var addLink = list.querySelector("li:nth-child(2) a");
      var card = list.closest(".product, .tab-product__item, .product__item, .recent-product__item, .hot-deal__item, .rd-product__single, .rd-monthly__item, .tx-product");

      if (!addLink || !card) {
        return;
      }

      var product = getStaticCardProduct(card, index);
      var productId = getProductIdentifier(product);

      updateProductLinks(card, ".thumb a, .product__img a, .rd-product__img a, .image > a, .product-holder > a", productId);
      updateProductLink(card.querySelector(".title a, .product__title a, h3 a, h4 a"), productId);
      updateProductLink(list.querySelector("li:nth-child(1) a"), product);
      updateAddToCartAction(list, "li:nth-child(2) a", product);
      updateWishlistAction(list, "li:nth-child(3) a", product);
    });

    applyWishlistButtonStates();
  }

  function hydrateStaticProductDetailCartAction() {
    var addButton = document.querySelector(".add-to-cart-btn button");
    if (!addButton || addButton.getAttribute("data-add-to-cart")) {
      return;
    }

    var params = new URLSearchParams(window.location.search || "");
    var titleEl = document.querySelector(".product-details h2");
    var priceEl = document.querySelector(".product-details .price .current, .product-details .price");
    var imageEl = document.querySelector(".product_details_img img, .shop_thumb_tab img");
    var name = titleEl ? titleEl.textContent.replace(/\s+/g, " ").trim() : "Product";
    var image = imageEl ? imageEl.getAttribute("src") : IMAGE_PLACEHOLDER;
    var productId = params.get("id") || params.get("slug") || createStaticProductId(name, image, 0);

    addButton.setAttribute("type", "button");
    addButton.setAttribute("data-add-to-cart", productId);
    addButton.setAttribute("data-product-name", name || "Product");
    addButton.setAttribute("data-product-price", parseVisiblePrice(priceEl ? priceEl.textContent : ""));
    addButton.setAttribute("data-product-image", image || IMAGE_PLACEHOLDER);
    addButton.setAttribute("aria-label", "Add " + (name || "Product") + " to cart");
    addButton.setAttribute("title", "Add to cart");
  }

  function updateProductImage(scope, selector, product) {
    var image = scope.querySelector(selector);
    if (!image) {
      return;
    }

    image.src = getProductImage(product) || IMAGE_PLACEHOLDER;
    image.alt = getProductName(product);
  }

  function updateProductImages(scope, selector, product) {
    if (!scope) {
      return;
    }

    scope.querySelectorAll(selector).forEach(function (image) {
      image.src = getProductImage(product) || IMAGE_PLACEHOLDER;
      image.alt = getProductName(product);
      image.setAttribute("decoding", "async");
      image.setAttribute("loading", "lazy");
      if (!image.getAttribute("onerror")) {
        image.setAttribute("onerror", imageFallbackAttribute());
      }
    });
  }

  function updateAddToCartAction(scope, selector, product) {
    var target = scope.querySelector(selector);
    if (!target) {
      return;
    }

    target.classList.toggle("is-out-of-stock", !canPurchaseProduct(product, 1));

    if (!canPurchaseProduct(product, 1)) {
      target.setAttribute("href", getProductUrl(product));
      target.removeAttribute("data-add-to-cart");
      target.setAttribute("aria-disabled", "true");
      target.setAttribute("aria-label", getProductName(product) + " is out of stock");
      target.setAttribute("title", "Out of stock");
      return;
    }

    target.setAttribute("href", "cart.html");
    target.setAttribute("data-add-to-cart", getProductIdentifier(product));
    target.setAttribute("data-product-name", escapeAttribute(getProductName(product)));
    target.setAttribute("data-product-price", Number(product.price) || 0);
    target.setAttribute("data-product-image", getProductImage(product) || IMAGE_PLACEHOLDER);
    target.removeAttribute("aria-disabled");
    target.setAttribute("aria-label", "Add " + getProductName(product) + " to cart");
    target.setAttribute("title", "Add to cart");
  }

  function updateWishlistAction(scope, selector, product) {
    var target = scope.querySelector(selector);
    if (!target) {
      return;
    }

    target.setAttribute("href", "wishlist.html");
    target.setAttribute("data-wishlist-toggle", getProductIdentifier(product));
    target.setAttribute("data-product-name", getProductName(product));
    target.setAttribute("aria-pressed", "false");
    target.setAttribute("title", "Add to wishlist");
    target.setAttribute("aria-label", "Add " + getProductName(product) + " to wishlist");

    var icon = target.querySelector("i");
    if (icon) {
      icon.classList.remove("fas");
      icon.classList.add("far", "fa-heart");
    }
  }

  function updatePriceMarkup(scope, selector, product, oldValue) {
    var priceEl = scope.querySelector(selector);
    if (!priceEl) {
      return;
    }

    var currentPrice = formatCurrency(product.price);
    if (priceEl.querySelector(".old") || priceEl.querySelector(".old-price")) {
      var oldClass = priceEl.querySelector(".old") ? "old" : "old-price";
      priceEl.innerHTML = '<span class="new">' + currentPrice + '</span><span class="' + oldClass + '">' + oldValue + "</span>";
      return;
    }

    priceEl.textContent = currentPrice;
  }

  function updateProductBadges(scope, product, options) {
    if (!scope || !product) {
      return;
    }

    Array.prototype.slice.call(scope.querySelectorAll(".storefront-badges")).forEach(function (badgeWrap) {
      badgeWrap.parentNode.removeChild(badgeWrap);
    });

    Array.prototype.slice.call(scope.querySelectorAll(".badge-skew, .product__badge, .rd-monthly__item .badge, .tx-product__item .badge")).forEach(function (legacyBadge) {
      legacyBadge.style.display = "none";
    });

    var badgeMarkup = buildStorefrontBadgeMarkup(product, options);
    if (!badgeMarkup) {
      return;
    }

    var anchor = scope.querySelector(".product-holder, .product__img, .thumb, .rd-product__img, .image") || scope;
    anchor.insertAdjacentHTML("afterbegin", badgeMarkup);
  }

  function fillTabProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector(".title a");
    var reviewWrap = card.querySelector(".product__review");
    var priceEl = card.querySelector(".price");

    updateProductLinks(card, ".thumb a", product);
    updateProductImages(card, ".thumb img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    if (reviewWrap) {
      reviewWrap.innerHTML = '<span class="product-category-label">' + (product.category || "Catalog") + "</span>";
    }

    if (priceEl) {
      priceEl.textContent = formatCurrency(product.price);
    }

    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);
    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function fillStandardProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector(".product__title a, .title a");
    var reviewText = card.querySelector(".product__review span:last-child");
    var stockWrap = card.querySelector(".product__available span");
    var progressBar = card.querySelector(".progress-bar");
    var description = card.querySelector(".product-description");

    updateProductLinks(card, ".product__img a, .thumb a, .product-holder > a", product);
    updateProductImages(card, ".product__img img, .thumb img, .product-holder img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    if (reviewText) {
      reviewText.textContent = product.category || "Featured Product";
    }

    updatePriceMarkup(card, ".product__price, .price", product, getProductOldPriceText(product, 299));
    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);

    if (stockWrap) {
      stockWrap.textContent = String(Number(product.stock) || 0);
    }

    if (progressBar) {
      var stockPercent = Math.min(100, Math.max(8, Number(product.stock) || 0));
      progressBar.style.width = stockPercent + "%";
      progressBar.setAttribute("aria-valuenow", String(stockPercent));
    }

    if (description) {
      description.textContent = product.description || "";
    }

    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function fillRecentProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector("h3 a");

    updateProductLinks(card, ".thumb a", product);
    updateProductImages(card, ".thumb img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    updatePriceMarkup(card, ".product__price", product, getProductOldPriceText(product, 199));
    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);
    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function fillHotDealProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector(".title a");
    var reviewText = card.querySelector(".product__review span:last-child");

    updateProductLinks(card, ".thumb a", product);
    updateProductImages(card, ".thumb img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    if (reviewText) {
      reviewText.textContent = product.category || "Hot Deal";
    }

    updatePriceMarkup(card, ".product__price", product, getProductOldPriceText(product, 249));
    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);
    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function fillCompactMonthlyProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector(".title a");
    var reviewText = card.querySelector(".product__review span:last-child");
    var stockWrap = card.querySelector(".product__available span");
    var progressBar = card.querySelector(".progress-bar");

    updateProductLinks(card, ".rd-product__img a", product);
    updateProductImages(card, ".rd-product__img img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    if (reviewText) {
      reviewText.textContent = product.category || "Featured";
    }

    updatePriceMarkup(card, ".product__price", product, getProductOldPriceText(product, 299));
    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);

    if (stockWrap) {
      stockWrap.textContent = String(Number(product.stock) || 0);
    }

    if (progressBar) {
      var stockPercent = Math.min(100, Math.max(8, Number(product.stock) || 0));
      progressBar.style.width = stockPercent + "%";
      progressBar.setAttribute("aria-valuenow", String(stockPercent));
    }

    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function fillMonthlyHeroProductCard(card, product) {
    var productId = getProductIdentifier(product);
    var titleLink = card.querySelector(".title a");
    var stockValues = card.querySelectorAll(".product__available span");
    var progressBar = card.querySelector(".progress-bar");

    updateProductLinks(card, ".image > a", product);
    updateProductImages(card, ".image img", product);
    updateProductLink(titleLink, product);

    if (titleLink) {
      titleLink.textContent = getProductName(product);
    }

    updatePriceMarkup(card, ".product__price", product, getProductOldPriceText(product, 349));
    updateProductLink(card.querySelector(".product__action li:nth-child(1) a"), product);
    updateAddToCartAction(card, ".product__action li:nth-child(2) a", product);
    updateWishlistAction(card, ".product__action li:nth-child(3) a", product);

    stockValues.forEach(function (stockEl) {
      stockEl.textContent = String(Number(product.stock) || 0);
    });

    if (progressBar) {
      var stockPercent = Math.min(100, Math.max(8, Number(product.stock) || 0));
      progressBar.style.width = stockPercent + "%";
      progressBar.setAttribute("aria-valuenow", String(stockPercent));
    }

    updateProductBadges(card, product, { compact: true });
    updateProductRatingSummary(card, product);
  }

  function hydrateTabProductSections(products) {
    var cards = document.querySelectorAll(".tab-product .tab-pane .tab-product__item");
    var mappedProducts = cycleProducts(products, cards.length, 0);

    cards.forEach(function (card, index) {
      fillTabProductCard(card, mappedProducts[index]);
    });
  }

  function hydrateTrendingProductSlider(products) {
    var cards = document.querySelectorAll(".rd-slide-product .rd-product__slide .product__item");
    var mappedProducts = cycleProducts(products, cards.length, 4);

    cards.forEach(function (card, index) {
      fillStandardProductCard(card, mappedProducts[index]);
    });
  }

  function hydrateRdTabProductSections(products) {
    var panes = document.querySelectorAll(".rd-tab-product .tab-pane");
    var productOffset = 0;

    panes.forEach(function (pane) {
      var smallCards = pane.querySelectorAll(".rd-product__item");
      var featureImages = pane.querySelectorAll(".rd-product__middle .tab-pane img, .rd-product__middle .nav-link img");
      var featureTitle = pane.querySelector(".rd-product__middle .content .title a");
      var featurePrice = pane.querySelector(".rd-product__middle .content .product__price");
      var featureAvailable = pane.querySelector(".rd-product__middle .content .product__available span");
      var featureProgress = pane.querySelector(".rd-product__middle .content .progress-bar");
      var featureWrap = pane.querySelector(".rd-product__middle");
      var paneProducts = cycleProducts(products, smallCards.length + Math.max(1, featureImages.length), productOffset);
      var featureProduct = paneProducts[smallCards.length] || paneProducts[0];

      smallCards.forEach(function (card, index) {
        fillStandardProductCard(card, paneProducts[index]);
      });

      if (featureProduct) {
        featureImages.forEach(function (imageEl, index) {
          var imageProduct = paneProducts[smallCards.length + index] || featureProduct;
          imageEl.src = getProductImage(imageProduct);
          imageEl.alt = getProductName(imageProduct);
        });

        if (featureTitle) {
          featureTitle.textContent = getProductName(featureProduct);
          featureTitle.setAttribute("href", getProductUrl(featureProduct));
        }

        if (featurePrice) {
          featurePrice.innerHTML = '<span class="new">' + formatCurrency(featureProduct.price) + '</span><span class="old">' + (featureProduct.category || "Featured") + "</span>";
        }

        if (featureAvailable) {
          featureAvailable.textContent = String(Number(featureProduct.stock) || 0);
        }

        if (featureProgress) {
          var featurePercent = Math.min(100, Math.max(10, Number(featureProduct.stock) || 0));
          featureProgress.style.width = featurePercent + "%";
          featureProgress.setAttribute("aria-valuenow", String(featurePercent));
        }

        if (featureWrap) {
          updateProductBadges(featureWrap, featureProduct, { compact: true });
        }
      }

      productOffset += smallCards.length + 1;
    });
  }

  function hydrateFeaturedDealProducts(products) {
    var hotDealCards = document.querySelectorAll(".hot-deal__slide .hot-deal__item");
    var monthlyCompactCards = document.querySelectorAll(".rd-monthly-products .rd-product__single");
    var monthlyHeroCards = document.querySelectorAll(".rd-monthly-products .rd-monthly__item");
    var hotDealProducts = cycleProducts(products, hotDealCards.length, 18);
    var monthlyCompactProducts = cycleProducts(products, monthlyCompactCards.length, 21);
    var monthlyHeroProducts = cycleProducts(products, monthlyHeroCards.length, 35);

    hotDealCards.forEach(function (card, index) {
      fillHotDealProductCard(card, hotDealProducts[index]);
    });

    monthlyCompactCards.forEach(function (card, index) {
      fillCompactMonthlyProductCard(card, monthlyCompactProducts[index]);
    });

    monthlyHeroCards.forEach(function (card, index) {
      fillMonthlyHeroProductCard(card, monthlyHeroProducts[index]);
    });
  }

  function hydrateRecentProductSections(products) {
    var cards = document.querySelectorAll(".recent-product .tab-pane .recent-product__item");
    var mappedProducts = cycleProducts(products, cards.length, 12);

    cards.forEach(function (card, index) {
      fillRecentProductCard(card, mappedProducts[index]);
    });
  }

  function hydrateLooseHomepageActionLinks(products) {
    var actionLists = Array.prototype.slice.call(document.querySelectorAll("main .product__action")).filter(function (list) {
      var addLink = list.querySelector("li:nth-child(2) a");
      return addLink && !addLink.getAttribute("data-add-to-cart");
    });
    var mappedProducts = cycleProducts(products, actionLists.length, 16);

    actionLists.forEach(function (list, index) {
      var product = mappedProducts[index];
      if (!product) {
        return;
      }

      var productId = getProductIdentifier(product);

      updateProductLink(list.querySelector("li:nth-child(1) a"), product);
      updateAddToCartAction(list, "li:nth-child(2) a", product);
      updateWishlistAction(list, "li:nth-child(3) a", product);
    });

    applyWishlistButtonStates();
  }

  function hydrateExistingHomepageProducts(products) {
    if (!document.querySelector(".tab-product")) {
      return;
    }

    hydrateTabProductSections(products);
    hydrateTrendingProductSlider(products);
    hydrateRdTabProductSections(products);
    hydrateFeaturedDealProducts(products);
    hydrateRecentProductSections(products);
    hydrateLooseHomepageActionLinks(products);
    hydrateStaticCartActionLinks(document);
    hydrateProductRatings(document);
  }

  function buildHomepageProductCard(product, index) {
    product = normalizeProduct(product);
    var productId = getProductIdentifier(product);
    var productUrl = getProductUrl(product);
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var displayName = getProductName(product);
    var safeName = escapeAttribute(displayName);
    var price = readNumberValue(product.price, 0);
    var stockMessage = getProductStockMessage(product, 1);
    var stockMessageClass = getProductStockMessageClass(product, 1);

    return '' +
      '<div class="tab-product__item tx-product text-center">' +
        '<div class="thumb">' +
          buildStorefrontBadgeMarkup(product, { compact: true }) +
          '<a href="' + productUrl + '"><img src="' + escapeAttribute(productImage) + '" alt="' + safeName + '" ' + buildProductImageAttrs(index || 0, { width: 320, height: 320 }) + '></a>' +
        '</div>' +
        '<div class="content">' +
          '<div class="product__review ul_li_center">' +
            '<span class="product-category-label">' + escapeHtml(product.category || '') + '</span>' +
          '</div>' +
          '<div class="product-rating-summary" data-product-rating-summary="' + escapeAttribute(productId) + '">' + buildRatingSummaryMarkup(null) + '</div>' +
          '<h3 class="title"><a href="' + productUrl + '">' + escapeHtml(displayName) + '</a></h3>' +
          '<span class="price">' + formatCurrency(price) + '</span>' +
          '<span class="product-stock-message ' + stockMessageClass + '">' + escapeHtml(stockMessage) + '</span>' +
        '</div>' +
        '<ul class="product__action">' +
          '<li><a href="' + productUrl + '"><i class="far fa-compress-alt"></i></a></li>' +
          '<li>' + buildAddToCartAction(product, productImage, price) + '</li>' +
          '<li>' + buildWishlistAction(product) + '</li>' +
        '</ul>' +
      '</div>';
  }

  function buildFeaturedProductCard(product, index) {
    product = normalizeProduct(product);
    var productId = getProductIdentifier(product);
    var productUrl = getProductUrl(product);
    var productImage = getProductImage(product) || IMAGE_PLACEHOLDER;
    var displayName = getProductName(product);
    var safeName = escapeAttribute(displayName);
    var price = readNumberValue(product.price, 0);
    var stock = getAvailableStock(product);
    var stockPercent = Math.min(100, Math.max(5, stock));
    var stockMessage = getProductStockMessage(product, 1);
    var stockMessageClass = getProductStockMessageClass(product, 1);

    return '' +
      '<div class="col-lg-3 col-md-6 mt-30">' +
        '<div class="product__item text-center">' +
          '<div class="thumb">' +
            buildStorefrontBadgeMarkup(product, { compact: true }) +
            '<a href="' + productUrl + '"><img src="' + escapeAttribute(productImage) + '" alt="' + safeName + '" ' + buildProductImageAttrs(index || 0, { width: 320, height: 320 }) + '></a>' +
          '</div>' +
          '<div class="content">' +
            '<h3 class="title"><a href="' + productUrl + '">' + escapeHtml(displayName) + '</a></h3>' +
            '<div class="product-rating-summary" data-product-rating-summary="' + escapeAttribute(productId) + '">' + buildRatingSummaryMarkup(null) + '</div>' +
            '<span class="price">' + formatCurrency(price) + '</span>' +
            '<div class="product__stock mt-10">' +
              '<span class="product__available">Available: <span>' + stock + '</span></span>' +
              '<span class="product-stock-message ' + stockMessageClass + '">' + escapeHtml(stockMessage) + '</span>' +
              '<div class="product__progress progress mb-0 mt-2 color-primary" style="height:8px">' +
                '<div class="progress-bar" role="progressbar" style="width: ' + stockPercent + '%"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<ul class="product__action">' +
            '<li><a href="' + productUrl + '"><i class="far fa-compress-alt"></i></a></li>' +
            '<li>' + buildAddToCartAction(product, productImage, price) + '</li>' +
            '<li>' + buildWishlistAction(product) + '</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  }

  function renderHomepageSection(containerId, products, cardBuilder) {
    var container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    var builder = cardBuilder || buildHomepageProductCard;

    if (!products || !products.length) {
      container.innerHTML = '<div class="text-center py-4"><p>No products available yet.</p><a href="shop-left-sidebar.html" class="thm-btn mt-3"><span class="btn-wrap"><span>Browse Shop</span><span>Browse Shop</span></span></a></div>';
      return;
    }

    container.innerHTML = products.map(builder).join("");
    hydrateProductRatings(container);
    applyWishlistButtonStates();
    enhanceExistingImages(container);
  }

  function setupCategoryPageFilters() {
    var sidebar = document.querySelector(".shop-sidebar");
    var priceAmount = document.getElementById("amount");

    if (!document.querySelector(".category-filter-bar") && !document.querySelector(".woocommerce-content-inner .products") && !sidebar) {
      return;
    }

    if (sidebar) {
      Array.prototype.slice.call(sidebar.querySelectorAll(".widget")).forEach(function (widget) {
        var title = widget.querySelector(".widget__title span");
        var label = title ? title.textContent.trim().toLowerCase() : "";
        if (label === "color" || label === "brands" || label === "tags") {
          widget.parentNode.removeChild(widget);
        }
      });
    }

    var priceTitle = sidebar ? sidebar.querySelector(".widget_price_filter .widget__title span") : null;
    if (priceTitle) {
      priceTitle.textContent = "Price Filtering (₹)";
    }

    if (priceAmount) {
      priceAmount.setAttribute("readonly", "readonly");
      priceAmount.value = "₹0 - ₹1,00,000";
    }

    return;

    var cards = Array.prototype.slice.call(document.querySelectorAll(".woocommerce-content-inner .products .product"));
    if (!cards.length) {
      return;
    }

    var activeChip = "";
    var priceRange = { min: 0, max: 100000 };

    function parsePrice(text) {
      var normalized = String(text || "").replace(/,/g, "");
      var match = normalized.match(/(\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : 0;
    }

    function cardMatchesChip(card) {
      if (!activeChip) {
        return true;
      }

      var content = card.textContent.toLowerCase();
      return content.indexOf(activeChip.toLowerCase()) !== -1;
    }

    function cardMatchesPrice(card) {
      var priceNode = card.querySelector(".product__price .new, .product__price, .price");
      var price = parsePrice(priceNode ? priceNode.textContent : card.textContent);
      return price >= priceRange.min && price <= priceRange.max;
    }

    function updateResultsCount(visibleCount) {
      if (resultCount) {
        resultCount.textContent = "Showing " + visibleCount + " of " + cards.length + " results";
      }
    }

    function applyCategoryFilters() {
      var visibleCount = 0;

      cards.forEach(function (card) {
        var isVisible = cardMatchesChip(card) && cardMatchesPrice(card);
        card.style.display = isVisible ? "" : "none";
        if (isVisible) {
          visibleCount += 1;
        }
      });

      updateResultsCount(visibleCount);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeChip = chip.getAttribute("data-subcat") || chip.textContent.trim();
        chips.forEach(function (item) {
          item.classList.remove("active");
        });
        chip.classList.add("active");
        applyCategoryFilters();
      });
    });

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slider && priceSlider && priceAmount) {
      window.jQuery(priceSlider).slider({
        range: true,
        min: 0,
        max: 100000,
        values: [0, 100000],
        slide: function (event, ui) {
          priceRange.min = ui.values[0];
          priceRange.max = ui.values[1];
          priceAmount.value = "₹" + ui.values[0].toLocaleString("en-IN") + " - ₹" + ui.values[1].toLocaleString("en-IN");
          applyCategoryFilters();
        }
      });
    }

    applyCategoryFilters();
  }

  function getSmartSearchForms() {
    return uniqueStrings(Array.prototype.slice.call(document.querySelectorAll(
      ".header__search-box, .header-mobile-search form, .mobile-header-enhanced__search, .shop-sidebar .widget__search"
    )).filter(function (form) {
      return form && form.querySelector && form.querySelector('input[name="search"], input[type="search"], input[type="text"]');
    }));
  }

  function ensureSmartSearchDropdown(form) {
    var dropdown = form.querySelector(".smart-search-dropdown");
    if (dropdown) {
      return dropdown;
    }

    dropdown = document.createElement("div");
    dropdown.className = "smart-search-dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Search suggestions");
    form.classList.add("smart-search-form");
    form.appendChild(dropdown);
    return dropdown;
  }

  function closeSmartSearchDropdown(dropdown) {
    if (!dropdown) {
      return;
    }

    dropdown.classList.remove("is-open");
    dropdown.innerHTML = "";
  }

  function setSmartSearchActiveOption(dropdown, nextIndex) {
    var options = Array.prototype.slice.call(dropdown.querySelectorAll("[data-smart-option]"));
    if (!options.length) {
      return -1;
    }

    var boundedIndex = nextIndex;
    if (boundedIndex < 0) boundedIndex = options.length - 1;
    if (boundedIndex >= options.length) boundedIndex = 0;

    options.forEach(function (option, index) {
      option.classList.toggle("is-active", index === boundedIndex);
    });

    options[boundedIndex].focus({ preventScroll: true });
    return boundedIndex;
  }

  function buildSmartSearchSuggestion(product, index) {
    var productId = getProductIdentifier(product);
    var productUrl = getProductUrl(product);
    var productName = getProductName(product);
    var image = getProductImage(product) || IMAGE_PLACEHOLDER;
    var category = getProductPrimaryCategory(product) || product.category || "Catalog";

    return '' +
      '<a class="smart-search-suggestion" href="' + escapeAttribute(productUrl) + '" data-smart-option data-smart-suggestion data-product-id="' + escapeAttribute(productId) + '" data-index="' + index + '">' +
        '<img src="' + escapeAttribute(image) + '" alt="' + escapeAttribute(productName) + '" ' + buildImageAttrs({ index: index, eagerCount: 3, width: 64, height: 64 }) + '>' +
        '<span class="smart-search-suggestion__body">' +
          '<strong>' + escapeHtml(productName) + '</strong>' +
          '<span>' + escapeHtml(category) + '</span>' +
        '</span>' +
        '<span class="smart-search-suggestion__price">' + formatCurrency(product.price) + '</span>' +
      '</a>';
  }

  function renderSmartSearchLoading(dropdown) {
    dropdown.innerHTML =
      '<div class="smart-search-state smart-search-state--loading">' +
        '<span class="smart-search-skeleton"></span>' +
        '<span class="smart-search-skeleton"></span>' +
        '<span class="smart-search-skeleton"></span>' +
      '</div>';
    dropdown.classList.add("is-open");
  }

  function renderSmartSearchEmpty(dropdown, message) {
    dropdown.innerHTML = '<div class="smart-search-state">' + escapeHtml(message || "No products found") + '</div>';
    dropdown.classList.add("is-open");
  }

  function renderSmartSearchTrending(dropdown, terms) {
    dropdown.innerHTML =
      '<div class="smart-search-trending">' +
        '<div class="smart-search-dropdown__title">Trending Searches</div>' +
        '<div class="smart-search-trending__terms">' +
          (terms || SMART_SEARCH_FALLBACK_TERMS).map(function (term, index) {
            return '<button type="button" data-smart-option data-smart-trending="' + escapeAttribute(term) + '" data-index="' + index + '">' + escapeHtml(term) + '</button>';
          }).join("") +
        '</div>' +
      '</div>';
    dropdown.classList.add("is-open");
  }

  function renderSmartSearchSuggestions(dropdown, products) {
    if (!products.length) {
      renderSmartSearchEmpty(dropdown, "No products found");
      return;
    }

    dropdown.innerHTML =
      '<div class="smart-search-dropdown__title">Product Suggestions</div>' +
      products.slice(0, 6).map(buildSmartSearchSuggestion).join("");
    dropdown.classList.add("is-open");
  }

  function setupSmartSearchForms() {
    var forms = getSmartSearchForms();
    if (!forms.length) {
      return;
    }

    if (!document.documentElement.getAttribute("data-smart-search-click-bound")) {
      document.documentElement.setAttribute("data-smart-search-click-bound", "true");
      document.addEventListener("click", function (event) {
        if (event.target.closest(".smart-search-form")) {
          return;
        }
        document.querySelectorAll(".smart-search-dropdown").forEach(closeSmartSearchDropdown);
      });
    }

    forms.forEach(function (form) {
      if (form.getAttribute("data-smart-search-bound") === "true") {
        return;
      }

      var input = form.querySelector('input[name="search"], input[type="search"], input[type="text"]');
      var categorySelect = form.querySelector('[name="category"]');
      var dropdown = ensureSmartSearchDropdown(form);
      var state = {
        activeIndex: -1,
        lastTrackedQuery: "",
        products: [],
        query: ""
      };

      function openTrending() {
        state.activeIndex = -1;
        fetchTrendingSearches(5).then(function (terms) {
          if (normalizeSearchQuery(input.value)) {
            return;
          }
          renderSmartSearchTrending(dropdown, terms);
        });
      }

      function runSearch() {
        var query = normalizeSearchQuery(input.value);
        var categorySlug = getSearchCategorySlug(form);
        state.query = query;
        state.activeIndex = -1;

        if (!query) {
          openTrending();
          return;
        }

        if (query.length < SMART_SEARCH_MIN_LENGTH) {
          renderSmartSearchEmpty(dropdown, "Type at least 2 characters");
          return;
        }

        renderSmartSearchLoading(dropdown);
        fetchSmartSearchProducts(query, categorySlug, 6).then(function (products) {
          if (state.query !== query) {
            return;
          }

          state.products = products;
          renderSmartSearchSuggestions(dropdown, products);

          if (state.lastTrackedQuery !== query) {
            state.lastTrackedQuery = query;
            trackSearchEvent(query, products.length, null);
          }
        }).catch(function () {
          renderSmartSearchEmpty(dropdown, "Search is temporarily unavailable");
        });
      }

      var debouncedSearch = debounce(runSearch, SMART_SEARCH_DEBOUNCE_MS);

      form.setAttribute("data-smart-search-bound", "true");
      input.setAttribute("autocomplete", "off");
      input.addEventListener("focus", function () {
        if (normalizeSearchQuery(input.value)) {
          runSearch();
        } else {
          openTrending();
        }
      });
      input.addEventListener("input", debouncedSearch);

      if (categorySelect) {
        categorySelect.addEventListener("change", function () {
          if (document.activeElement === input || dropdown.classList.contains("is-open")) {
            runSearch();
          }
        });
      }

      dropdown.addEventListener("click", function (event) {
        var trending = event.target.closest("[data-smart-trending]");
        var suggestion = event.target.closest("[data-smart-suggestion]");

        if (trending) {
          input.value = trending.getAttribute("data-smart-trending") || "";
          input.focus();
          runSearch();
          return;
        }

        if (suggestion) {
          event.preventDefault();
          var productId = suggestion.getAttribute("data-product-id");
          var href = suggestion.getAttribute("href");
          trackSearchEvent(input.value, state.products.length, productId).then(function () {
            window.location.href = href;
          });
        }
      });

      form.addEventListener("keydown", function (event) {
        if (!dropdown.classList.contains("is-open")) {
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          state.activeIndex = setSmartSearchActiveOption(dropdown, state.activeIndex + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          state.activeIndex = setSmartSearchActiveOption(dropdown, state.activeIndex - 1);
        } else if (event.key === "Enter") {
          var active = dropdown.querySelector("[data-smart-option].is-active");
          if (active) {
            event.preventDefault();
            active.click();
          }
        } else if (event.key === "Escape") {
          closeSmartSearchDropdown(dropdown);
          input.focus();
        }
      });
    });
  }

  function setupHeaderSearchForms() {
    var forms = document.querySelectorAll(".header__search-box, .header-mobile-search form, .mobile-header-enhanced__search");
    if (!forms.length) {
      return;
    }

    forms.forEach(function (form) {
      if (form.getAttribute("data-search-bound") === "true") {
        return;
      }

      form.setAttribute("data-search-bound", "true");
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (event.isTrusted === false) {
          return;
        }

        var input = form.querySelector('input[name="search"], input[type="search"], input[type="text"]');
        var categorySelect = form.querySelector('[name="category"]');
        var query = input ? String(input.value || "").trim() : "";
        var categorySlug = categorySelect ? String(categorySelect.value || "").trim() : "";
        var target = categorySlug ? "category.html" : "shop-left-sidebar.html";
        var params = new URLSearchParams();

        if (!query && !categorySlug) {
          return;
        }

        if (categorySlug) {
          params.set("slug", normalizeCategorySlug(categorySlug));
        }

        if (query) {
          params.set("search", query);
          trackSearchEvent(query, 0, null);
        }

        window.location.href = target + (params.toString() ? "?" + params.toString() : "");
      });
    });
  }

  function setupHomepage() {
    var newArrivalsContainer = document.getElementById("homepage-new-arrivals");
    var hasLegacyPlaceholders = !!newArrivalsContainer;
    var hasHomepageShell = !!document.querySelector(".tab-product");
    if (!hasLegacyPlaceholders && !hasHomepageShell) {
      return;
    }

    debugLog("Setting up homepage with dynamic products");

    var sectionIds = ["homepage-new-arrivals", "homepage-trending", "homepage-featured", "homepage-deals"];
    if (hasLegacyPlaceholders) {
      sectionIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.innerHTML = buildProductSkeletonCards(id === "homepage-deals" ? 4 : 8);
        }
      });
    }

    function renderHomepageSectionWhenVisible(id, products, builder) {
      var el = document.getElementById(id);
      if (!el) {
        return;
      }
      runWhenVisible(el, function () {
        renderHomepageSection(id, products, builder);
      });
    }

    fetchStorefrontProducts()
      .then(function (response) {
        var allProducts = getVisibleProducts(response);

        debugLog("Homepage loaded " + allProducts.length + " products from API");

        if (!allProducts.length) {
          if (hasLegacyPlaceholders) {
            sectionIds.forEach(function (id) {
              renderHomepageSection(id, [], null);
            });
          }
          return;
        }

        // New Arrivals — show all products
        if (hasLegacyPlaceholders) {
          renderHomepageSection("homepage-new-arrivals", allProducts.slice(0, 10), buildHomepageProductCard);

        // Trending — show a selection
        renderHomepageSectionWhenVisible("homepage-trending", allProducts.slice(0, 8), buildHomepageProductCard);

        // Featured — show with stock info using featured card builder
        renderHomepageSectionWhenVisible("homepage-featured", allProducts.slice(0, 8), buildFeaturedProductCard);

        // Hot Deals — show first few products
        renderHomepageSectionWhenVisible("homepage-deals", allProducts.slice(0, 4), buildHomepageProductCard);
        }
        hydrateExistingHomepageProducts(allProducts);
      })
      .catch(function (error) {
        debugLog("Homepage product load failed:", error.message);
        if (hasLegacyPlaceholders) {
          sectionIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
              el.innerHTML = '<div class="text-center py-4"><p style="color:#999">Unable to load products. Please try again later.</p></div>';
            }
          });
        }
      });
  }

  function enhanceExistingImages(root) {
    var scope = root || document;
    var images = Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll("img") : []);

    images.forEach(function (image, index) {
      var isHero = Boolean(image.closest && image.closest(".hero-slider__slide.active, .xb-hero, .hero__area, .mobile-header-enhanced__logo, .header__logo, .radios-footer__logo"));
      if (!image.getAttribute("loading")) {
        image.setAttribute("loading", isHero || index < 4 ? "eager" : "lazy");
      }
      if (!image.getAttribute("decoding")) {
        image.setAttribute("decoding", "async");
      }
      if (!image.getAttribute("onerror")) {
        image.setAttribute("onerror", imageFallbackAttribute());
      }
      if (!image.getAttribute("width") && image.naturalWidth) {
        image.setAttribute("width", String(image.naturalWidth));
      }
      if (!image.getAttribute("height") && image.naturalHeight) {
        image.setAttribute("height", String(image.naturalHeight));
      }
    });
  }

  window.RadiosAbandonedCart = {
    sync: syncAbandonedCart,
    schedule: scheduleAbandonedCartSync,
    trackCheckout: function (items, options) {
      options = Object.assign({}, options || {}, { checkoutStarted: true, status: "open" });
      return syncAbandonedCart(items, options);
    },
    markConverted: function (orderId, items, options) {
      options = Object.assign({}, options || {}, { convertedOrderId: orderId, status: "converted" });
      return syncAbandonedCart(items, options);
    },
    getSessionId: getAbandonedCartSessionId
  };

  window.RadiosAnalytics = {
    getSessionId: getAnalyticsSessionId,
    trackEvent: trackAnalyticsEvent
  };

  window.RadiosDiscounts = {
    clearCode: clearAppliedDiscountCode,
    evaluateCart: evaluateSharedCartDiscounts,
    finalizeRedemption: finalizeDiscountRedemption,
    formatCurrency: formatCurrency,
    getCartTotal: getCartTotal,
    readCart: readCart,
    readCode: readAppliedDiscountCode,
    saveCart: saveCart,
    saveCode: saveAppliedDiscountCode
  };

  window.RadiosInventory = {
    validateCart: validateCartInventory,
    reserveCart: reserveCartInventory,
    releaseCart: releaseCartInventory,
    releaseExpired: releaseExpiredInventoryReservations,
    completeOrder: completeOrderInventory,
    getSessionId: getInventorySessionId,
    getStockMessage: getProductStockMessage,
    getBadges: getProductStorefrontBadges,
    canPurchase: canPurchaseProduct
  };

  document.addEventListener("DOMContentLoaded", function () {
    applyDefaultSeo();
    enhanceExistingImages();
    setupStaticCategoryLinkGuard();
    setupStorefrontAnalytics();
    setupHeaderSearchForms();
    setupDynamicCategories();
    setupSmartSearchForms();
    setupDynamicHeroBanners();
    releaseExpiredInventoryReservations().catch(function (error) {
      debugLog("Expired stock reservation cleanup skipped:", error.message);
    });
    renderMiniCart();
    scheduleAbandonedCartSync(readCart());
    hydrateStaticCartActionLinks(document);
    hydrateStaticProductDetailCartAction();
    setupHomepagePromoFallbacks();
    setupHomepage();
    setupCategoryPageFilters();
    setupDynamicCategoryPage();
    setupProductListing();
    setupCartCouponForm();
    setupProductDetail();
    setupDynamicSectionBanners();
    setupHomepageBannerRealtime();
    renderCartPage();
    refreshWishlistState();
    renderWishlistPage();
    setupCheckout();
  });
})();
