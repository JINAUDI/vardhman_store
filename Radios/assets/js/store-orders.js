(function () {
  "use strict";

  var API_BASE = window.RADIOS_API_BASE || localStorage.getItem("radios-api-base") || "http://localhost:5000/api";
  var email = "";
  var authUserId = "";
  var signedInCustomer = null;
  var currentOrders = [];
  var ordersList = document.getElementById("moOrdersList");
  var emptyState = document.getElementById("moEmptyState");
  var resultsCount = document.getElementById("moResultsCount");
  var summaryEls = {
    total: document.getElementById("moTotalOrders"),
    pending: document.getElementById("moPendingOrders"),
    delivered: document.getElementById("moDeliveredOrders"),
    cancelled: document.getElementById("moCancelledOrders"),
    latest: document.getElementById("moLatestOrder"),
    spend: document.getElementById("moSpendTotal")
  };

  if (!ordersList) {
    return;
  }

  function fetchJson(endpoint) {
    return fetch(API_BASE + endpoint).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          throw new Error(data.message || "Failed to load orders");
        }

        return data;
      });
    });
  }

  function getSupabaseClient() {
    if (!window.supabase || !window.RADIOS_SUPABASE_URL || !window.RADIOS_SUPABASE_ANON_KEY) {
      return null;
    }

    window.radiosSupabase = window.radiosSupabase || window.supabase.createClient(window.RADIOS_SUPABASE_URL, window.RADIOS_SUPABASE_ANON_KEY);
    return window.radiosSupabase;
  }

  function normalizeSupabaseStatus(order) {
    return String(order.order_status || order.status || order.tracking_status || "pending").toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  }

  function labelize(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (match) { return match.toUpperCase(); });
  }

  function isCancellable(order) {
    return ["pending", "confirmed", "processing"].indexOf(order.status) !== -1;
  }

  function getDashboardApiCandidates() {
    return uniqueStrings([
      window.RADIOS_DASHBOARD_API_BASE,
      localStorage.getItem("radios-dashboard-api-base"),
      "http://127.0.0.1:3000/api",
      "http://localhost:3000/api",
      API_BASE
    ]);
  }

  function uniqueStrings(values) {
    return values.filter(function (value, index) {
      return value && values.indexOf(value) === index;
    });
  }

  async function updateOrderViaDashboardApi(orderId, payload) {
    var candidates = getDashboardApiCandidates();
    var lastError = null;

    for (var i = 0; i < candidates.length; i += 1) {
      var base = String(candidates[i] || "").replace(/\/$/, "");
      if (!base) continue;

      try {
        var response = await fetch(base + "/orders/" + encodeURIComponent(orderId), {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        var data = await response.json().catch(function () { return null; });
        if (response.ok && data && data.data) {
          return data.data;
        }
        lastError = new Error((data && data.message) || "Unable to update order.");
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unable to update order.");
  }

  async function cancelOrder(orderId) {
    var order = currentOrders.find(function (item) { return item.orderId === orderId; });
    if (!order || !isCancellable(order)) {
      return;
    }

    var reason = window.prompt("Reason for cancelling this order", "Customer requested cancellation");
    if (reason === null) {
      return;
    }

    await updateOrderViaDashboardApi(orderId, {
      status: "cancelled",
      cancellation_reason: reason || "Customer requested cancellation",
      cancelled_by: "customer"
    });
    await loadOrders();
  }

  function fetchSupabaseOrders() {
    var client = getSupabaseClient();
    if (!client || !email) {
      return Promise.reject(new Error("Sign in to view your orders"));
    }

    function buildQuery(includeTrackingColumns, includeAuthColumn, includeLifecycleColumns) {
      var selectColumns = includeTrackingColumns
        ? "id, auth_user_id, tracking_id, tracking_status, order_number, status, customer_name, customer_email, customer_phone, delivery_address, city, state, total, created_at, estimated_delivery_date"
        : "id, auth_user_id, order_number, status, customer_name, customer_email, customer_phone, delivery_address, city, state, total, created_at";

      if (includeLifecycleColumns) {
        selectColumns += ", order_status, payment_status, fulfillment_status, refund_status, invoice_number, courier_name, courier_tracking_number, cancellation_reason, admin_notes";
      }

      if (!includeAuthColumn) {
        selectColumns = selectColumns.replace("auth_user_id, ", "");
      }

      var query = client
      .from("orders")
      .select(selectColumns)
      .order("created_at", { ascending: false });

      if (includeAuthColumn && authUserId && email) {
        query = query.or("auth_user_id.eq." + authUserId + ",customer_email.eq." + email);
      } else if (includeAuthColumn && authUserId) {
        query = query.eq("auth_user_id", authUserId);
      } else {
        query = query.eq("customer_email", email);
      }

      return query;
    }

    function loadItemsForRows(rows) {
      var ids = rows.map(function (order) { return order.id; });

      if (!ids.length) {
        return [];
      }

      return client
        .from("order_items")
        .select("order_id, product_name, quantity, price, total")
        .in("order_id", ids)
        .then(function (itemsResult) {
          if (itemsResult.error) throw itemsResult.error;

          var itemsByOrder = {};
          (itemsResult.data || []).forEach(function (item) {
            itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || [];
            itemsByOrder[item.order_id].push({
              name: item.product_name || "Product",
              quantity: item.quantity || 1,
              price: item.price || 0,
              total: item.total || 0,
              image: "assets/img/product/img_01.png"
            });
          });

          return rows.map(function (order) {
            return {
              orderId: order.id,
              tracking_id: order.tracking_id,
              trackingId: order.tracking_id || order.order_number,
              orderNumber: order.order_number,
              status: normalizeSupabaseStatus(order),
              paymentStatus: order.payment_status || "pending",
              fulfillmentStatus: order.fulfillment_status || order.shipping_status || "unfulfilled",
              refundStatus: order.refund_status || "none",
              invoiceNumber: order.invoice_number || "",
              courierName: order.courier_name || "",
              courierTrackingNumber: order.courier_tracking_number || "",
              cancellationReason: order.cancellation_reason || "",
              adminNotes: order.admin_notes || "",
              createdAt: order.created_at,
              total: order.total || 0,
              customer: {
                email: order.customer_email || "",
                city: order.city || "",
                state: order.state || ""
              },
              products: itemsByOrder[order.id] || [{ name: "Order items", quantity: 1, price: order.total || 0, total: order.total || 0, image: "assets/img/product/img_01.png" }]
            };
          });
        });
    }

    return buildQuery(true, true, true).then(function (ordersResult) {
      if (!ordersResult.error) {
        return loadItemsForRows(ordersResult.data || []);
      }

      var message = String(ordersResult.error.message || "").toLowerCase();
      var missingTracking = message.indexOf("tracking_id") !== -1 || message.indexOf("estimated_delivery_date") !== -1;
      var missingAuth = message.indexOf("auth_user_id") !== -1;
      var missingLifecycle = message.indexOf("order_status") !== -1 || message.indexOf("fulfillment_status") !== -1 || message.indexOf("invoice_number") !== -1 || message.indexOf("schema cache") !== -1;

      if (!missingTracking && !missingAuth && !missingLifecycle) {
        throw ordersResult.error;
      }

      return buildQuery(!missingTracking, !missingAuth, !missingLifecycle).then(function (fallbackResult) {
        if (fallbackResult.error) throw fallbackResult.error;
        return loadItemsForRows(fallbackResult.data || []);
      });
    });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function getTrackingId(order) {
    return order.tracking_id || order.trackingId || order.orderNumber || (!isUuid(order.orderId) ? order.orderId : "") || "Tracking pending";
  }

  function renderSummary(orders) {
    var pending = orders.filter(function (order) { return ["pending", "confirmed", "processing"].indexOf(order.status) !== -1; }).length;
    var delivered = orders.filter(function (order) { return order.status === "delivered"; }).length;
    var cancelled = orders.filter(function (order) { return order.status === "cancelled"; }).length;
    var spend = orders.reduce(function (sum, order) { return sum + (order.total || 0); }, 0);
    var latest = orders[0] ? getTrackingId(orders[0]) : "--";

    if (summaryEls.total) summaryEls.total.textContent = String(orders.length);
    if (summaryEls.pending) summaryEls.pending.textContent = String(pending);
    if (summaryEls.delivered) summaryEls.delivered.textContent = String(delivered);
    if (summaryEls.cancelled) summaryEls.cancelled.textContent = String(cancelled);
    if (summaryEls.latest) summaryEls.latest.textContent = latest;
    if (summaryEls.spend) summaryEls.spend.textContent = formatCurrency(spend);
  }

  function resetSummary() {
    if (summaryEls.total) summaryEls.total.textContent = "0";
    if (summaryEls.pending) summaryEls.pending.textContent = "0";
    if (summaryEls.delivered) summaryEls.delivered.textContent = "0";
    if (summaryEls.cancelled) summaryEls.cancelled.textContent = "0";
    if (summaryEls.latest) summaryEls.latest.textContent = "--";
    if (summaryEls.spend) summaryEls.spend.textContent = formatCurrency(0);
  }

  function showEmptyState(titleText, copyText, buttonText, buttonHref) {
    resetSummary();
    if (resultsCount) resultsCount.textContent = "0 orders shown";
    if (ordersList) ordersList.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";

    var title = document.getElementById("moEmptyTitle");
    var copy = document.getElementById("moEmptyCopy");
    var button = emptyState ? emptyState.querySelector("a") : null;

    if (title) title.textContent = titleText;
    if (copy) copy.textContent = copyText;
    if (button) {
      button.textContent = buttonText;
      button.setAttribute("href", buttonHref);
    }
  }

  function showSignInState() {
    signedInCustomer = null;
    email = "";
    authUserId = "";
    showEmptyState(
      "Sign in to view your orders",
      "Use your Radios account so we can show only the orders connected to your email.",
      "Sign In",
      "account.html?redirect=my-orders.html"
    );
    window.setTimeout(function () {
      window.location.href = "account.html?redirect=my-orders.html";
    }, 700);
  }

  function renderOrders(orders) {
    currentOrders = orders;
    renderSummary(orders);
    resultsCount.textContent = orders.length + " orders shown";

    if (!orders.length) {
      emptyState.style.display = "block";
      ordersList.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";
    ordersList.innerHTML = orders.map(function (order) {
      var firstItem = order.products[0];
      var trackingId = getTrackingId(order);
      var trackHref = trackingId !== "Tracking pending" ? "track-order.html?tracking_id=" + encodeURIComponent(trackingId) : "track-order.html";
      var cancelButton = isCancellable(order) ? '<button class="mo-btn mo-btn-secondary" type="button" data-cancel-order="' + order.orderId + '">Cancel Order</button>' : '';
      return '' +
        '<article class="mo-order-card">' +
          '<div class="mo-order-top">' +
            '<div><strong>' + trackingId + '</strong><span>Placed on ' + formatDate(order.createdAt) + '</span><small>' + order.customer.email + '</small></div>' +
            '<span class="mo-status ' + order.status + '">' + labelize(order.status) + '</span>' +
          '</div>' +
          '<div class="mo-order-body">' +
            '<div class="mo-order-thumb"><img src="' + (firstItem.image || "assets/img/product/img_01.png") + '" alt="' + firstItem.name + '"></div>' +
            '<div class="mo-order-copy">' +
              '<h3>' + firstItem.name + '</h3>' +
              '<div class="mo-order-meta">Items: ' + order.products.length + '</div>' +
              '<div class="mo-order-meta">Payment: ' + labelize(order.paymentStatus) + ' | Fulfillment: ' + labelize(order.fulfillmentStatus) + '</div>' +
              (order.invoiceNumber ? '<div class="mo-order-meta">Invoice: ' + order.invoiceNumber + '</div>' : '') +
              '<div class="mo-order-delivery">Ship to: ' + order.customer.city + ", " + order.customer.state + '</div>' +
              '<div class="mo-order-price"><strong>' + formatCurrency(order.total) + '</strong></div>' +
            '</div>' +
            '<div class="mo-action-row"><a class="mo-btn mo-btn-primary" href="' + trackHref + '">Track Order</a>' + cancelButton + '</div>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  function loadOrders() {
    if (!email) {
      showSignInState();
      return Promise.resolve();
    }

    return fetchSupabaseOrders()
      .then(function (orders) {
        renderOrders(orders);
      })
      .catch(function () {
        return fetchJson("/orders?email=" + encodeURIComponent(email));
      })
      .then(function (response) {
        if (response && response.items) {
          renderOrders(response.items || []);
        }
      })
      .catch(function (error) {
        showEmptyState("Orders unavailable", error.message, "Try Again", "my-orders.html");
      });
  }

  if (window.RadiosAuth && typeof window.RadiosAuth.refreshSessionCustomer === "function") {
    window.RadiosAuth.refreshSessionCustomer()
      .then(function (customer) {
        signedInCustomer = customer;
        email = customer && customer.signedIn ? customer.email : "";
        authUserId = customer && customer.signedIn ? (customer.authUserId || customer.auth_user_id || customer.id || "") : "";
        loadOrders();
      })
      .catch(showSignInState);
  } else {
    showSignInState();
  }

  ordersList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-cancel-order]");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Cancelling...";
    cancelOrder(button.getAttribute("data-cancel-order"))
      .catch(function (error) {
        button.disabled = false;
        button.textContent = "Cancel Order";
        showEmptyState("Cancellation unavailable", error.message || "We could not cancel this order right now.", "View Orders", "my-orders.html");
      });
  });
})();
