"use client";

import { useEffect, useState } from "react";
import { api, Order } from "../../lib/api";
import AdminGuard from "../../components/AdminGuard";
import { restoreOrderInventory } from "../../lib/inventory";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  async function loadOrders(nextPage = page) {
    setLoading(true);
    try {
      const response = await api.getOrders(`?page=${nextPage}&limit=${pageSize}`);
      setOrders(response.items);
      setTotalPages(response.pagination?.totalPages || 1);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(1).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load orders.");
      setLoading(false);
    });
  }, []);

  function getOrderId(order: Order) {
    return order.id || order._id;
  }

  function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  async function handleStatusChange(order: Order, status: Order["status"]) {
    const orderId = getOrderId(order);
    try {
      setMessage("Updating order...");
      await api.updateOrder(orderId, { status });

      if (["cancelled", "refunded", "returned"].includes(status) && isUuid(orderId)) {
        await restoreOrderInventory(orderId, `Order marked ${status} from dashboard`);
      }

      setMessage("Order updated.");
      await loadOrders(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update order.");
    }
  }

  return (
    <AdminGuard permission="view_orders">
      <h1>Orders</h1>
      {message ? <p role="status">{message}</p> : null}
      {loading ? <p>Loading orders...</p> : null}
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={getOrderId(order)}>
              <td>{order.orderId}</td>
              <td>{order.customer.firstName} {order.customer.lastName}</td>
              <td>{order.status}</td>
              <td>{order.total}</td>
              <td>
                <select
                  value={order.status}
                  onChange={(event) => handleStatusChange(order, event.target.value as Order["status"])}
                  aria-label={`Update ${order.orderId} status`}
                >
                  <option value="pending">Pending</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="returned">Returned</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => loadOrders(Math.max(1, page - 1))} disabled={loading || page <= 1}>
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" onClick={() => loadOrders(Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages}>
          Next
        </button>
      </div>
    </AdminGuard>
  );
}
