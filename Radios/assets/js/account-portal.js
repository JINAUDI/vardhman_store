(function () {
  "use strict";

  var app = document.querySelector("[data-account-page]");
  if (!app) return;

  var page = app.getAttribute("data-account-page") || "dashboard";
  var mount = app.querySelector("[data-account-mount]") || app;
  var state = {
    user: null,
    customer: null,
    profile: null,
    addresses: [],
    orders: [],
    wishlistCount: 0,
    reviews: [],
    returns: [],
    notifications: [],
    purchasedProducts: []
  };

  var navItems = [
    ["account-dashboard.html", "Dashboard", "dashboard"],
    ["profile.html", "Profile", "profile"],
    ["addresses.html", "Addresses", "addresses"],
    ["my-orders.html", "Orders", "orders"],
    ["wishlist.html", "Wishlist", "wishlist"],
    ["my-reviews.html", "Reviews", "reviews"],
    ["returns.html", "Returns", "returns"],
    ["customer-notifications.html", "Notifications", "notifications"]
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").trim();
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function labelize(value) {
    return normalize(value || "pending").replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function getClient() {
    return window.RadiosAuth && window.RadiosAuth.getSupabaseClient ? window.RadiosAuth.getSupabaseClient() : null;
  }

  function getCustomerName() {
    return state.profile && state.profile.full_name ||
      state.customer && (window.RadiosAuth && window.RadiosAuth.getFullName ? window.RadiosAuth.getFullName(state.customer) : state.customer.fullName) ||
      state.user && state.user.email ||
      "Customer";
  }

  function redirectToLogin() {
    var current = window.location.pathname.split("/").pop() || "account-dashboard.html";
    window.location.href = "account.html?redirect=" + encodeURIComponent(current);
  }

  function setLoading() {
    mount.innerHTML = '<div class="radios-account-loading">Loading your account...</div>';
  }

  function setError(message) {
    mount.innerHTML = '<div class="radios-account-empty"><strong>Something went wrong</strong><p>' + escapeHtml(message) + '</p></div>';
  }

  function statusClass(status) {
    var normalized = normalize(status).toLowerCase();
    if (["delivered", "approved", "refunded", "read", "approved"].indexOf(normalized) !== -1) return " is-success";
    if (["cancelled", "rejected", "failed"].indexOf(normalized) !== -1) return " is-danger";
    return "";
  }

  function accountLayout(title, copy, content) {
    var email = state.profile && state.profile.email || state.customer && state.customer.email || state.user && state.user.email || "";
    var nav = navItems.map(function (item) {
      var active = item[2] === page || (page === "orders" && item[2] === "orders");
      return '<a href="' + item[0] + '" class="' + (active ? "is-active" : "") + '">' + item[1] + '</a>';
    }).join("");

    return '' +
      '<div class="radios-account-shell">' +
        '<aside class="radios-account-sidebar">' +
          '<div class="radios-account-user"><strong>' + escapeHtml(getCustomerName()) + '</strong><span>' + escapeHtml(email) + '</span></div>' +
          '<nav class="radios-account-nav">' + nav + '</nav>' +
        '</aside>' +
        '<main class="radios-account-main">' +
          '<nav class="radios-account-mobile-tabs">' + nav + '</nav>' +
          '<header class="radios-account-header"><span>Radios Account</span><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(copy) + '</p></header>' +
          content +
        '</main>' +
      '</div>';
  }

  function supabaseSelect(table, select, builder) {
    var client = getClient();
    if (!client) return Promise.reject(new Error("Account service is unavailable."));
    var query = client.from(table).select(select || "*");
    if (builder) query = builder(query);
    return query.then(function (result) {
      if (result.error) throw result.error;
      return result.data || [];
    });
  }

  function getProfile() {
    var client = getClient();
    var metadata = state.user.user_metadata || {};
    var payload = {
      auth_user_id: state.user.id,
      full_name: state.customer && (state.customer.fullName || state.customer.name) || metadata.full_name || metadata.name || "",
      email: state.user.email,
      phone: state.customer && state.customer.phone || metadata.phone || "",
      is_active: true
    };

    return client.from("customers")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select("id,auth_user_id,full_name,email,phone,avatar_url,is_active,created_at,updated_at")
      .single()
      .then(function (result) {
        if (result.error) throw result.error;
        state.profile = result.data;
        if (window.RadiosAuth && window.RadiosAuth.persistCustomer) {
          state.customer = window.RadiosAuth.persistCustomer({
            authUserId: state.user.id,
            customerId: result.data.id,
            fullName: result.data.full_name,
            email: result.data.email,
            phone: result.data.phone,
            signedIn: true
          });
        }
      });
  }

  function loadAddresses() {
    return supabaseSelect("customer_addresses", "*", function (query) {
      return query.eq("auth_user_id", state.user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    }).then(function (rows) {
      state.addresses = rows;
    }).catch(function () {
      state.addresses = [];
    });
  }

  function loadOrders() {
    return supabaseSelect("orders", "id,auth_user_id,customer_id,order_number,tracking_id,status,order_status,payment_status,total,created_at,customer_email,customer_name", function (query) {
      var email = state.user.email || "";
      return query.or("auth_user_id.eq." + state.user.id + ",customer_email.eq." + email).order("created_at", { ascending: false });
    }).then(function (rows) {
      state.orders = rows;
    }).catch(function () {
      state.orders = [];
    });
  }

  function loadWishlistCount() {
    return supabaseSelect("wishlist", "id", function (query) {
      return query.eq("auth_user_id", state.user.id);
    }).then(function (rows) {
      state.wishlistCount = rows.length;
    }).catch(function () {
      state.wishlistCount = 0;
    });
  }

  function loadNotifications() {
    return supabaseSelect("customer_notifications", "*", function (query) {
      return query.eq("auth_user_id", state.user.id).order("created_at", { ascending: false });
    }).then(function (rows) {
      state.notifications = rows;
    }).catch(function () {
      state.notifications = [];
    });
  }

  function loadReturns() {
    return supabaseSelect("return_requests", "*", function (query) {
      return query.eq("auth_user_id", state.user.id).order("created_at", { ascending: false });
    }).then(function (rows) {
      state.returns = rows;
    }).catch(function () {
      state.returns = [];
    });
  }

  function loadReviews() {
    return supabaseSelect("reviews", "id,auth_user_id,order_id,product_id,rating,title,comment,status,created_at,updated_at", function (query) {
      return query.eq("auth_user_id", state.user.id).order("created_at", { ascending: false });
    }).then(function (rows) {
      state.reviews = rows;
    }).catch(function () {
      state.reviews = [];
    });
  }

  function loadPurchasedProducts() {
    var client = getClient();
    var orderIds = state.orders.map(function (order) { return order.id; }).filter(Boolean);
    if (!orderIds.length) {
      state.purchasedProducts = [];
      return Promise.resolve();
    }

    return client.from("order_items")
      .select("order_id,product_id,product_name")
      .in("order_id", orderIds)
      .then(function (result) {
        if (result.error) throw result.error;
        var seen = {};
        state.purchasedProducts = (result.data || []).filter(function (item) {
          if (!item.product_id || seen[item.product_id]) return false;
          seen[item.product_id] = true;
          return true;
        });
      }).catch(function () {
        state.purchasedProducts = [];
      });
  }

  function loadCommon() {
    return Promise.all([
      loadAddresses(),
      loadOrders(),
      loadWishlistCount(),
      loadNotifications(),
      loadReturns(),
      loadReviews()
    ]).then(loadPurchasedProducts);
  }

  function renderDashboard() {
    var latest = state.orders[0];
    var unread = state.notifications.filter(function (item) { return !item.is_read; }).length;
    var delivered = state.orders.filter(function (order) {
      return normalize(order.order_status || order.status).toLowerCase() === "delivered";
    }).length;

    mount.innerHTML = accountLayout("Account Dashboard", "Manage your profile, saved addresses, orders, returns, and account alerts.", '' +
      '<section class="radios-account-grid">' +
        '<a class="radios-account-card" href="my-orders.html"><strong>' + state.orders.length + '</strong><span>Total orders</span></a>' +
        '<a class="radios-account-card" href="wishlist.html"><strong>' + state.wishlistCount + '</strong><span>Wishlist items</span></a>' +
        '<a class="radios-account-card" href="customer-notifications.html"><strong>' + unread + '</strong><span>Unread notifications</span></a>' +
        '<a class="radios-account-card" href="addresses.html"><strong>' + state.addresses.length + '</strong><span>Saved addresses</span></a>' +
        '<a class="radios-account-card" href="my-reviews.html"><strong>' + state.reviews.length + '</strong><span>Product reviews</span></a>' +
        '<a class="radios-account-card" href="returns.html"><strong>' + state.returns.length + '</strong><span>Return requests</span></a>' +
      '</section>' +
      '<section class="radios-account-panel"><h2>Latest Order</h2>' +
        (latest ? '<div class="radios-account-row"><div class="radios-account-row-head"><strong>' + escapeHtml(latest.tracking_id || latest.order_number || latest.id) + '</strong><span class="radios-account-status' + statusClass(latest.order_status || latest.status) + '">' + labelize(latest.order_status || latest.status) + '</span></div><p>Total ' + formatCurrency(latest.total) + ' / ' + delivered + ' delivered orders overall</p><div class="radios-account-actions"><a class="radios-account-button" href="track-order.html?tracking_id=' + encodeURIComponent(latest.tracking_id || latest.order_number || "") + '">Track Order</a><a class="radios-account-button is-secondary" href="my-orders.html">View Orders</a></div></div>' : '<div class="radios-account-empty">Your order history will appear here after checkout.</div>') +
      '</section>');
  }

  function renderProfile(message) {
    var profile = state.profile || {};
    mount.innerHTML = accountLayout("Profile", "Update your contact details used for checkout and customer support.", '' +
      (message ? '<p class="radios-account-message">' + escapeHtml(message) + '</p>' : '') +
      '<form class="radios-account-form" data-profile-form>' +
        '<div class="radios-account-fields">' +
          '<label class="radios-account-field"><span>Full name</span><input name="full_name" value="' + escapeHtml(profile.full_name || "") + '" required></label>' +
          '<label class="radios-account-field"><span>Phone</span><input name="phone" value="' + escapeHtml(profile.phone || "") + '" inputmode="numeric"></label>' +
          '<label class="radios-account-field"><span>Email</span><input value="' + escapeHtml(profile.email || state.user.email || "") + '" disabled></label>' +
          '<label class="radios-account-field"><span>Avatar</span><input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
        '</div>' +
        '<div class="radios-account-actions"><button class="radios-account-button" type="submit">Save Profile</button></div>' +
      '</form>' +
      '<section class="radios-account-panel radios-account-danger-zone">' +
        '<h2>Delete Account</h2>' +
        '<p>Delete your profile, saved addresses, wishlist, reviews, returns, and account notifications. Past orders may remain in store records for billing and support.</p>' +
        '<div class="radios-account-actions"><button class="radios-account-button is-danger" type="button" data-delete-account>Delete My Account</button></div>' +
      '</section>');

    mount.querySelector("[data-profile-form]").addEventListener("submit", saveProfile);
    mount.querySelector("[data-delete-account]").addEventListener("click", deleteCustomerAccount);
  }

  function saveProfile(event) {
    event.preventDefault();
    var client = getClient();
    var form = event.currentTarget;
    var data = new FormData(form);
    var fullName = normalize(data.get("full_name"));
    var phone = normalize(data.get("phone"));
    var file = data.get("avatar");

    function updateProfile(avatarUrl) {
      return client.from("customers")
        .update({
          full_name: fullName,
          phone: phone,
          avatar_url: avatarUrl || state.profile.avatar_url || null
        })
        .eq("auth_user_id", state.user.id)
        .select("id,auth_user_id,full_name,email,phone,avatar_url,is_active,created_at,updated_at")
        .single()
        .then(function (result) {
          if (result.error) throw result.error;
          state.profile = result.data;
          if (window.RadiosAuth && window.RadiosAuth.persistCustomer) {
            state.customer = window.RadiosAuth.persistCustomer({
              authUserId: state.user.id,
              customerId: result.data.id,
              fullName: result.data.full_name,
              email: result.data.email,
              phone: result.data.phone,
              signedIn: true
            });
          }
          renderProfile("Profile updated successfully.");
        });
    }

    if (file && file.name && client.storage) {
      var path = state.user.id + "/" + Date.now() + "-" + file.name.replace(/[^a-z0-9._-]/gi, "-");
      client.storage.from("customer-avatars").upload(path, file, { upsert: true })
        .then(function (upload) {
          if (upload.error) throw upload.error;
          return client.storage.from("customer-avatars").getPublicUrl(path).data.publicUrl;
        })
        .then(updateProfile)
        .catch(function () {
          return updateProfile(null);
        });
    } else {
      updateProfile(null).catch(function (error) {
        renderProfile(error.message || "Profile update failed.");
      });
    }
  }

  function deleteCustomerAccount() {
    var client = getClient();
    if (!client || !client.rpc) {
      renderProfile("Account deletion is not available right now.");
      return;
    }

    var confirmation = window.prompt("Type DELETE to permanently delete your account.");
    if (confirmation !== "DELETE") {
      renderProfile("Account deletion cancelled.");
      return;
    }

    var finalConfirm = window.confirm("This permanently deletes your account profile and signs you out. Continue?");
    if (!finalConfirm) {
      renderProfile("Account deletion cancelled.");
      return;
    }

    var button = mount.querySelector("[data-delete-account]");
    if (button) {
      button.disabled = true;
      button.textContent = "Deleting...";
    }

    client.rpc("delete_my_customer_account")
      .then(function (result) {
        if (result.error) throw result.error;
        if (window.RadiosAuth && window.RadiosAuth.clearCustomer) {
          window.RadiosAuth.clearCustomer();
        }
        return client.auth && client.auth.signOut ? client.auth.signOut() : null;
      })
      .catch(function (error) {
        if (error && /user_not_found|not found|JWT/i.test(error.message || "")) {
          return null;
        }
        throw error;
      })
      .then(function () {
        window.alert("Your account has been deleted.");
        window.location.href = "index.html";
      })
      .catch(function (error) {
        renderProfile(error.message || "Account deletion failed. Please try again.");
      });
  }

  function addressForm(row) {
    row = row || {};
    return '' +
      '<form class="radios-account-form" data-address-form data-address-id="' + escapeHtml(row.id || "") + '">' +
        '<div class="radios-account-fields">' +
          '<label class="radios-account-field"><span>Full name</span><input name="full_name" value="' + escapeHtml(row.full_name || getCustomerName()) + '" required></label>' +
          '<label class="radios-account-field"><span>Phone</span><input name="phone" value="' + escapeHtml(row.phone || state.profile.phone || "") + '" required></label>' +
          '<label class="radios-account-field is-wide"><span>House / Flat / Building</span><input name="address_line1" value="' + escapeHtml(row.address_line1 || "") + '" required></label>' +
          '<label class="radios-account-field is-wide"><span>Street / Area</span><input name="address_line2" value="' + escapeHtml(row.address_line2 || "") + '"></label>' +
          '<label class="radios-account-field"><span>City</span><input name="city" value="' + escapeHtml(row.city || "") + '" required></label>' +
          '<label class="radios-account-field"><span>State</span><input name="state" value="' + escapeHtml(row.state || "") + '" required></label>' +
          '<label class="radios-account-field"><span>PIN Code</span><input name="pincode" value="' + escapeHtml(row.pincode || "") + '" required></label>' +
          '<label class="radios-account-field"><span>Type</span><select name="address_type"><option value="home">Home</option><option value="work">Work</option><option value="other">Other</option></select></label>' +
        '</div>' +
        '<label class="radios-account-field" style="margin-top:12px"><span><input type="checkbox" name="is_default" ' + (row.is_default ? "checked" : "") + '> Set as default address</span></label>' +
        '<div class="radios-account-actions"><button class="radios-account-button" type="submit">' + (row.id ? "Update Address" : "Add Address") + '</button></div>' +
      '</form>';
  }

  function renderAddresses(message) {
    mount.innerHTML = accountLayout("Addresses", "Save delivery addresses and choose the default one for checkout.", '' +
      (message ? '<p class="radios-account-message">' + escapeHtml(message) + '</p>' : '') +
      '<section class="radios-account-panel"><h2>Saved Addresses</h2>' +
        (state.addresses.length ? '<div class="radios-account-list">' + state.addresses.map(function (row) {
          return '<div class="radios-account-row"><div class="radios-account-row-head"><strong>' + labelize(row.address_type || "home") + '</strong>' + (row.is_default ? '<span class="radios-account-status is-success">Default</span>' : '') + '</div><p>' + escapeHtml([row.full_name, row.phone, row.address_line1, row.address_line2, row.city, row.state, row.pincode].filter(Boolean).join(", ")) + '</p><div class="radios-account-actions"><button class="radios-account-button is-secondary" type="button" data-edit-address="' + row.id + '">Edit</button><button class="radios-account-button is-secondary" type="button" data-default-address="' + row.id + '">Set Default</button><button class="radios-account-button is-danger" type="button" data-delete-address="' + row.id + '">Delete</button></div></div>';
        }).join("") + '</div>' : '<div class="radios-account-empty">No saved addresses yet.</div>') +
      '</section><section class="radios-account-panel"><h2 id="addressFormTitle">Add Address</h2>' + addressForm() + '</section>');

    mount.querySelector("[data-address-form]").addEventListener("submit", saveAddress);
    mount.querySelectorAll("[data-edit-address]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = state.addresses.find(function (item) { return item.id === button.getAttribute("data-edit-address"); });
        var panel = button.closest(".radios-account-main").querySelector("#addressFormTitle").parentNode;
        panel.innerHTML = '<h2 id="addressFormTitle">Edit Address</h2>' + addressForm(row);
        panel.querySelector("[data-address-form]").addEventListener("submit", saveAddress);
      });
    });
    mount.querySelectorAll("[data-default-address]").forEach(function (button) {
      button.addEventListener("click", function () { setDefaultAddress(button.getAttribute("data-default-address")); });
    });
    mount.querySelectorAll("[data-delete-address]").forEach(function (button) {
      button.addEventListener("click", function () { deleteAddress(button.getAttribute("data-delete-address")); });
    });
  }

  function saveAddress(event) {
    event.preventDefault();
    var client = getClient();
    var form = event.currentTarget;
    var data = new FormData(form);
    var id = form.getAttribute("data-address-id");
    var payload = {
      auth_user_id: state.user.id,
      customer_id: state.profile.id,
      full_name: normalize(data.get("full_name")),
      phone: normalize(data.get("phone")),
      address_line1: normalize(data.get("address_line1")),
      address_line2: normalize(data.get("address_line2")),
      city: normalize(data.get("city")),
      state: normalize(data.get("state")),
      pincode: normalize(data.get("pincode")),
      country: "India",
      address_type: normalize(data.get("address_type")) || "home",
      is_default: data.get("is_default") === "on" || !state.addresses.length
    };
    var request = id ? client.from("customer_addresses").update(payload).eq("id", id) : client.from("customer_addresses").insert(payload);
    request.then(function (result) {
      if (result.error) throw result.error;
      return loadAddresses();
    }).then(function () {
      renderAddresses("Address saved successfully.");
    }).catch(function (error) {
      renderAddresses(error.message || "Address save failed.");
    });
  }

  function setDefaultAddress(id) {
    getClient().from("customer_addresses").update({ is_default: true }).eq("id", id).then(function (result) {
      if (result.error) throw result.error;
      return loadAddresses();
    }).then(function () {
      renderAddresses("Default address updated.");
    });
  }

  function deleteAddress(id) {
    getClient().from("customer_addresses").delete().eq("id", id).then(function (result) {
      if (result.error) throw result.error;
      return loadAddresses();
    }).then(function () {
      renderAddresses("Address deleted.");
    });
  }

  function renderReviews(message) {
    mount.innerHTML = accountLayout("My Reviews", "Review products you have purchased and track approval status.", '' +
      (message ? '<p class="radios-account-message">' + escapeHtml(message) + '</p>' : '') +
      '<section class="radios-account-panel"><h2>Your Reviews</h2>' +
        (state.reviews.length ? '<div class="radios-account-list">' + state.reviews.map(function (row) {
          return '<div class="radios-account-row"><div class="radios-account-row-head"><strong>' + escapeHtml(row.title || "Product review") + '</strong><span class="radios-account-status">' + labelize(row.status || "pending") + '</span></div><p>Rating: ' + escapeHtml(row.rating || "-") + '/5</p><p>' + escapeHtml(row.comment || "") + '</p><div class="radios-account-actions"><button class="radios-account-button is-danger" type="button" data-delete-review="' + row.id + '">Delete</button></div></div>';
        }).join("") + '</div>' : '<div class="radios-account-empty">You have not submitted reviews yet.</div>') +
      '</section><section class="radios-account-panel"><h2>Write a Review</h2>' +
        (state.purchasedProducts.length ? '<form class="radios-account-form" data-review-form><div class="radios-account-fields"><label class="radios-account-field is-wide"><span>Purchased product</span><select name="product_id">' + state.purchasedProducts.map(function (item) { return '<option value="' + escapeHtml(item.product_id) + '" data-order-id="' + escapeHtml(item.order_id) + '">' + escapeHtml(item.product_name || item.product_id) + '</option>'; }).join("") + '</select></label><label class="radios-account-field"><span>Rating</span><select name="rating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label><label class="radios-account-field"><span>Title</span><input name="title" required></label><label class="radios-account-field is-wide"><span>Review</span><textarea name="comment" required></textarea></label></div><div class="radios-account-actions"><button class="radios-account-button" type="submit">Submit Review</button></div></form>' : '<div class="radios-account-empty">Purchased products will appear here after delivery.</div>') +
      '</section>');

    var form = mount.querySelector("[data-review-form]");
    if (form) form.addEventListener("submit", saveReview);
    mount.querySelectorAll("[data-delete-review]").forEach(function (button) {
      button.addEventListener("click", function () { deleteReview(button.getAttribute("data-delete-review")); });
    });
  }

  function saveReview(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var select = form.querySelector("[name='product_id']");
    var option = select.options[select.selectedIndex];
    var payload = {
      auth_user_id: state.user.id,
      product_id: normalize(data.get("product_id")),
      order_id: option ? option.getAttribute("data-order-id") : null,
      rating: Number(data.get("rating")) || 5,
      title: normalize(data.get("title")),
      comment: normalize(data.get("comment")),
      status: "pending"
    };
    getClient().from("reviews").insert(payload).then(function (result) {
      if (result.error) throw result.error;
      return loadReviews();
    }).then(function () {
      renderReviews("Review submitted. It will appear after approval.");
    }).catch(function (error) {
      renderReviews(error.message || "Review submission failed.");
    });
  }

  function deleteReview(id) {
    getClient().from("reviews").delete().eq("id", id).then(function (result) {
      if (result.error) throw result.error;
      return loadReviews();
    }).then(function () {
      renderReviews("Review deleted.");
    });
  }

  function renderReturns(message) {
    var deliveredOrders = state.orders.filter(function (order) {
      return normalize(order.order_status || order.status).toLowerCase() === "delivered";
    });
    mount.innerHTML = accountLayout("Returns", "Request returns for eligible delivered orders and follow each request.", '' +
      (message ? '<p class="radios-account-message">' + escapeHtml(message) + '</p>' : '') +
      '<section class="radios-account-panel"><h2>Return Requests</h2>' +
        (state.returns.length ? '<div class="radios-account-list">' + state.returns.map(function (row) {
          return '<div class="radios-account-row"><div class="radios-account-row-head"><strong>' + escapeHtml(row.customer_name || getCustomerName()) + '</strong><span class="radios-account-status' + statusClass(row.status) + '">' + labelize(row.status) + '</span></div><p>' + escapeHtml(row.reason || "") + '</p>' + (row.admin_note ? '<p>Admin note: ' + escapeHtml(row.admin_note) + '</p>' : '') + '<p>Requested ' + formatDate(row.created_at) + '</p></div>';
        }).join("") + '</div>' : '<div class="radios-account-empty">No return requests yet.</div>') +
      '</section><section class="radios-account-panel"><h2>Request Return</h2>' +
        (deliveredOrders.length ? '<form class="radios-account-form" data-return-form><div class="radios-account-fields"><label class="radios-account-field is-wide"><span>Delivered order</span><select name="order_id">' + deliveredOrders.map(function (order) { return '<option value="' + escapeHtml(order.id) + '">' + escapeHtml(order.tracking_id || order.order_number || order.id) + ' - ' + formatCurrency(order.total) + '</option>'; }).join("") + '</select></label><label class="radios-account-field is-wide"><span>Reason</span><textarea name="reason" required></textarea></label></div><div class="radios-account-actions"><button class="radios-account-button" type="submit">Submit Return Request</button></div></form>' : '<div class="radios-account-empty">Delivered orders eligible for return will appear here.</div>') +
      '</section>');
    var form = mount.querySelector("[data-return-form]");
    if (form) form.addEventListener("submit", saveReturn);
  }

  function saveReturn(event) {
    event.preventDefault();
    var data = new FormData(event.currentTarget);
    var orderId = normalize(data.get("order_id"));
    var order = state.orders.find(function (item) { return item.id === orderId; });
    var payload = {
      order_id: orderId,
      auth_user_id: state.user.id,
      customer_name: getCustomerName(),
      customer_email: state.user.email,
      reason: normalize(data.get("reason")),
      status: "requested"
    };
    getClient().from("return_requests").insert(payload).then(function (result) {
      if (result.error) throw result.error;
      return getClient().from("customer_notifications").insert({
        auth_user_id: state.user.id,
        title: "Return request submitted",
        message: "Your return request for " + ((order && (order.tracking_id || order.order_number)) || "your order") + " has been received.",
        type: "return",
        is_read: false
      });
    }).then(loadReturns).then(loadNotifications).then(function () {
      renderReturns("Return request submitted.");
    }).catch(function (error) {
      renderReturns(error.message || "Return request failed.");
    });
  }

  function renderNotifications(message) {
    mount.innerHTML = accountLayout("Notifications", "Read order updates, return updates, and account alerts.", '' +
      (message ? '<p class="radios-account-message">' + escapeHtml(message) + '</p>' : '') +
      '<section class="radios-account-panel"><h2>Account Alerts</h2>' +
        (state.notifications.length ? '<div class="radios-account-list">' + state.notifications.map(function (row) {
          return '<div class="radios-account-row"><div class="radios-account-row-head"><strong>' + escapeHtml(row.title) + '</strong><span class="radios-account-status' + (row.is_read ? " is-success" : "") + '">' + (row.is_read ? "Read" : "Unread") + '</span></div><p>' + escapeHtml(row.message || "") + '</p><p>' + formatDate(row.created_at) + '</p>' + (!row.is_read ? '<div class="radios-account-actions"><button class="radios-account-button is-secondary" type="button" data-read-notification="' + row.id + '">Mark Read</button></div>' : '') + '</div>';
        }).join("") + '</div><div class="radios-account-actions"><button class="radios-account-button" type="button" data-read-all>Mark All Read</button></div>' : '<div class="radios-account-empty">No notifications yet.</div>') +
      '</section>');
    mount.querySelectorAll("[data-read-notification]").forEach(function (button) {
      button.addEventListener("click", function () { markNotificationRead(button.getAttribute("data-read-notification")); });
    });
    var readAll = mount.querySelector("[data-read-all]");
    if (readAll) readAll.addEventListener("click", markAllNotificationsRead);
  }

  function markNotificationRead(id) {
    getClient().from("customer_notifications").update({ is_read: true }).eq("id", id).then(function (result) {
      if (result.error) throw result.error;
      return loadNotifications();
    }).then(function () {
      renderNotifications("Notification marked as read.");
    });
  }

  function markAllNotificationsRead() {
    getClient().from("customer_notifications").update({ is_read: true }).eq("auth_user_id", state.user.id).then(function (result) {
      if (result.error) throw result.error;
      return loadNotifications();
    }).then(function () {
      renderNotifications("All notifications marked as read.");
    });
  }

  function renderCurrentPage() {
    if (page === "profile") return renderProfile();
    if (page === "addresses") return renderAddresses();
    if (page === "reviews") return renderReviews();
    if (page === "returns") return renderReturns();
    if (page === "notifications") return renderNotifications();
    return renderDashboard();
  }

  function init() {
    setLoading();
    var client = getClient();
    if (!client || !window.RadiosAuth) {
      setError("Account service is not configured.");
      return;
    }

    window.RadiosAuth.refreshSessionCustomer()
      .then(function (customer) {
        if (!customer || !customer.signedIn) {
          redirectToLogin();
          return Promise.reject(new Error("AUTH_REQUIRED"));
        }
        state.customer = customer;
        return client.auth.getUser();
      })
      .then(function (result) {
        if (!result || !result.data || !result.data.user) {
          redirectToLogin();
          return Promise.reject(new Error("AUTH_REQUIRED"));
        }
        state.user = result.data.user;
        return getProfile();
      })
      .then(loadCommon)
      .then(renderCurrentPage)
      .catch(function (error) {
        if (error && error.message === "AUTH_REQUIRED") return;
        setError(error && error.message ? error.message : "Unable to load account.");
      });
  }

  init();
})();
