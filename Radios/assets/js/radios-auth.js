(function () {
  "use strict";

  var CUSTOMER_KEY = "radios-customer";
  var CUSTOMER_EMAIL_KEY = "radios-customer-email";
  var CUSTOMER_ID_KEY = "radios-customer-id";

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readCustomer() {
    return parseJson(localStorage.getItem(CUSTOMER_KEY), null);
  }

  function splitName(value) {
    var parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ")
    };
  }

  function getFullName(customer) {
    if (!customer) {
      return "";
    }

    return customer.fullName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
      customer.name ||
      "";
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value) {
    return String(value || "").trim();
  }

  function getSupabaseClient() {
    if (!window.supabase || !window.RADIOS_SUPABASE_URL || !window.RADIOS_SUPABASE_ANON_KEY) {
      return null;
    }

    window.radiosSupabase = window.radiosSupabase || window.supabase.createClient(
      window.RADIOS_SUPABASE_URL,
      window.RADIOS_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return window.radiosSupabase;
  }

  function getCurrentSession() {
    var client = getSupabaseClient();
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      return Promise.resolve(null);
    }

    return client.auth.getSession().then(function (result) {
      return result && result.data ? result.data.session : null;
    });
  }

  function getCurrentUser() {
    return getCurrentSession().then(function (session) {
      return session && session.user ? session.user : null;
    });
  }

  function buildCustomerFromUser(user, fallback) {
    fallback = fallback || {};
    var metadata = user && user.user_metadata ? user.user_metadata : {};
    var fullName = metadata.full_name || metadata.fullName || metadata.name || getFullName(fallback);
    var email = normalizeEmail(user && user.email) || normalizeEmail(fallback.email);

    if (!fullName && email) {
      fullName = email.split("@")[0].replace(/[._-]+/g, " ");
    }

    var nameParts = splitName(fullName);
    var provider = user && user.app_metadata ? user.app_metadata.provider : "";

    return {
      id: user && user.id ? user.id : fallback.id,
      authUserId: user && user.id ? user.id : fallback.authUserId,
      customerId: fallback.customerId || fallback.customer_id || "",
      firstName: metadata.first_name || metadata.firstName || fallback.firstName || nameParts.firstName,
      lastName: metadata.last_name || metadata.lastName || fallback.lastName || nameParts.lastName,
      fullName: fullName || getFullName(fallback),
      email: email,
      phone: normalizePhone(metadata.phone || user && user.phone || fallback.phone || ""),
      addressLine1: fallback.addressLine1 || "",
      addressLine2: fallback.addressLine2 || "",
      city: fallback.city || "",
      state: fallback.state || "",
      country: fallback.country || "India",
      zipCode: fallback.zipCode || fallback.pinCode || "",
      authProvider: provider || fallback.authProvider || "email",
      signedIn: true,
      updatedAt: new Date().toISOString()
    };
  }

  function persistCustomer(customer) {
    var existing = readCustomer() || {};
    var nameParts = splitName(customer.fullName || getFullName(customer) || getFullName(existing));
    var next = Object.assign({}, existing, customer, {
      firstName: customer.firstName || existing.firstName || nameParts.firstName,
      lastName: customer.lastName || existing.lastName || nameParts.lastName,
      fullName: customer.fullName || getFullName(customer) || getFullName(existing),
      email: normalizeEmail(customer.email || existing.email),
      country: customer.country || existing.country || "India",
      customerId: customer.customerId || customer.customer_id || existing.customerId || "",
      updatedAt: new Date().toISOString()
    });

    if (customer.signedIn === false) {
      delete next.authUserId;
      if (!customer.id) {
        delete next.id;
      }
    }

    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next));
    if (next.email) {
      localStorage.setItem(CUSTOMER_EMAIL_KEY, next.email);
    }
    if (next.signedIn && (next.authUserId || next.id)) {
      localStorage.setItem(CUSTOMER_ID_KEY, next.authUserId || next.id);
    } else {
      localStorage.removeItem(CUSTOMER_ID_KEY);
    }

    try {
      window.dispatchEvent(new CustomEvent("radios:customer-updated", { detail: next }));
    } catch (error) {
      // CustomEvent can fail in older browsers. The stored profile is still updated.
    }

    return next;
  }

  function persistUser(user) {
    return persistCustomer(buildCustomerFromUser(user, readCustomer()));
  }

  function syncCustomerProfile(customer) {
    var client = getSupabaseClient();
    var authUserId = customer && (customer.authUserId || customer.auth_user_id);

    if (!client || !authUserId) {
      return Promise.resolve(customer || null);
    }

    var payload = {
      auth_user_id: authUserId,
      full_name: getFullName(customer),
      email: normalizeEmail(customer.email),
      phone: normalizePhone(customer.phone),
      is_active: true
    };

    return client
      .from("customers")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select("id,auth_user_id,full_name,email,phone,is_active")
      .single()
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        var row = result.data || {};
        return persistCustomer(Object.assign({}, customer, {
          id: authUserId,
          authUserId: row.auth_user_id || authUserId,
          customerId: row.id || customer.customerId || "",
          fullName: row.full_name || getFullName(customer),
          email: normalizeEmail(row.email || customer.email),
          phone: normalizePhone(row.phone || customer.phone),
          signedIn: true
        }));
      })
      .catch(function (error) {
        console.warn("[RadiosAuth] Customer profile sync failed.", error);
        return customer || null;
      });
  }

  function upsertCustomerProfileFromUser(user, extra) {
    var customer = buildCustomerFromUser(user, Object.assign({}, readCustomer() || {}, extra || {}));
    return syncCustomerProfile(persistCustomer(customer));
  }

  function clearCustomer() {
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(CUSTOMER_EMAIL_KEY);
    localStorage.removeItem(CUSTOMER_ID_KEY);

    try {
      window.dispatchEvent(new CustomEvent("radios:customer-updated", { detail: null }));
    } catch (error) {
      // No-op.
    }
  }

  function refreshSessionCustomer() {
    return getCurrentSession().then(function (session) {
      if (!session || !session.user) {
        var stored = readCustomer();
        if (stored && stored.signedIn) {
          clearCustomer();
        }
        return null;
      }

      return syncCustomerProfile(persistUser(session.user));
    });
  }

  function signOut() {
    var client = getSupabaseClient();
    var done = function () {
      clearCustomer();
      return null;
    };

    if (!client || !client.auth || typeof client.auth.signOut !== "function") {
      return Promise.resolve(done());
    }

    return client.auth.signOut().then(done, done);
  }

  function getRedirectTarget(fallback) {
    var params = new URLSearchParams(window.location.search);
    var target = params.get("redirect") || params.get("next") || fallback || "";

    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.indexOf("//") === 0 || target.indexOf("\\") !== -1) {
      return "";
    }

    return target;
  }

  function setAuthButtonText(link, text) {
    if (!link) {
      return;
    }

    var spans = link.querySelectorAll(".btn-wrap span");
    if (spans.length) {
      spans.forEach(function (span) {
        span.textContent = text;
      });
    } else {
      link.textContent = text;
    }
  }

  function applyHeaderAuthState(customer) {
    var signedIn = Boolean(customer && customer.signedIn && customer.email);
    var displayName = signedIn ? (getFullName(customer) || customer.email) : "";
    var shortName = displayName && displayName.length > 20 ? displayName.slice(0, 17) + "..." : displayName;

    document.querySelectorAll(".header__icons .icon a").forEach(function (link) {
      var image = link.querySelector('img[src*="user.svg"]');
      if (image) {
        link.setAttribute("href", signedIn ? "account.html" : "account.html");
        link.setAttribute("title", signedIn ? displayName : "Account");
        image.setAttribute("alt", signedIn ? displayName : "Account");
      }
    });

    document.querySelectorAll(".login-sign-btn").forEach(function (wrap) {
      var link = wrap.querySelector("a");
      if (link) {
        link.setAttribute("href", "account.html");
        setAuthButtonText(link, signedIn ? shortName : "Login / Sign Up");
      }

      var logout = wrap.querySelector("[data-radios-header-logout]");
      if (signedIn) {
        if (!logout) {
          logout = document.createElement("button");
          logout.type = "button";
          logout.className = "radios-header-auth-logout";
          logout.setAttribute("data-radios-header-logout", "true");
          logout.textContent = "Logout";
          wrap.appendChild(logout);
        }
        logout.onclick = function () {
          signOut().then(function () {
            applyHeaderAuthState(null);
            if (/account\.html$/i.test(window.location.pathname)) {
              window.location.href = "account.html";
            }
          });
        };
      } else if (logout) {
        logout.remove();
      }
    });

    document.querySelectorAll("[data-mobile-auth-link]").forEach(function (link) {
      var label = link.querySelector("[data-mobile-auth-label]") || link;
      link.setAttribute("href", "account.html");
      link.setAttribute("title", signedIn ? displayName : "Login / Sign Up");
      label.textContent = signedIn ? "Account" : "Login / Sign Up";
    });
  }

  function initHeaderAuthState() {
    applyHeaderAuthState(readCustomer());
    refreshSessionCustomer().then(applyHeaderAuthState, function () {
      applyHeaderAuthState(readCustomer());
    });

    var client = getSupabaseClient();
    if (client && client.auth && typeof client.auth.onAuthStateChange === "function") {
      client.auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_OUT" || !session || !session.user) {
          clearCustomer();
          applyHeaderAuthState(null);
          return;
        }

        syncCustomerProfile(persistUser(session.user)).then(applyHeaderAuthState, function () {
          applyHeaderAuthState(readCustomer());
        });
      });
    }

    window.addEventListener("radios:customer-updated", function (event) {
      applyHeaderAuthState(event.detail);
    });
  }

  window.RadiosAuth = {
    keys: {
      customer: CUSTOMER_KEY,
      customerEmail: CUSTOMER_EMAIL_KEY,
      customerId: CUSTOMER_ID_KEY
    },
    buildCustomerFromUser: buildCustomerFromUser,
    clearCustomer: clearCustomer,
    getCurrentSession: getCurrentSession,
    getCurrentUser: getCurrentUser,
    getFullName: getFullName,
    getRedirectTarget: getRedirectTarget,
    getSupabaseClient: getSupabaseClient,
    applyHeaderAuthState: applyHeaderAuthState,
    initHeaderAuthState: initHeaderAuthState,
    persistCustomer: persistCustomer,
    persistUser: persistUser,
    readCustomer: readCustomer,
    refreshSessionCustomer: refreshSessionCustomer,
    syncCustomerProfile: syncCustomerProfile,
    upsertCustomerProfileFromUser: upsertCustomerProfileFromUser,
    signOut: signOut
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeaderAuthState);
  } else {
    initHeaderAuthState();
  }
})();
