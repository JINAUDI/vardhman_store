"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import {
  deleteReview,
  getProductReviewStats,
  getReviews,
  updateReviewModeration,
  type ProductReviewStats,
  type ReviewModerationStatus,
  type ReviewProduct,
  type ReviewRow
} from "../../lib/reviews";

type FilterMode = "all" | ReviewModerationStatus | "verified";

function firstValue<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function productName(review: ReviewRow) {
  const product = firstValue<ReviewProduct>(review.products);
  return product?.title || product?.name || review.product_id || "Product";
}

function customerName(review: ReviewRow) {
  return review.customer_name || review.customer_email || review.auth_user_id || "Customer";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ratingLabel(rating: number) {
  return `${rating} ${rating === 1 ? "star" : "stars"}`;
}

function ratingStars(rating: number) {
  const value = Math.min(5, Math.max(1, Number(rating || 5)));
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} style={{ color: index < value ? "#f79009" : "#d0d5dd" }}>
      {index < value ? "\u2605" : "\u2606"}
    </span>
  ));
}

function statusStyle(status: ReviewModerationStatus) {
  if (status === "approved") return { background: "#ecfdf3", color: "#067647" };
  if (status === "rejected") return { background: "#fef3f2", color: "#b42318" };
  return { background: "#fffaeb", color: "#b54708" };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState<Record<string, ProductReviewStats>>({});
  const [filter, setFilter] = useState<FilterMode>("pending");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadReviews() {
    setLoading(true);
    try {
      const [nextReviews, nextStats] = await Promise.all([getReviews(), getProductReviewStats()]);
      setReviews(nextReviews);
      setStats(nextStats);
      setNotes(
        nextReviews.reduce<Record<string, string>>((nextNotes, review) => {
          nextNotes[review.id] = review.admin_note || "";
          return nextNotes;
        }, {})
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load reviews.");
      setLoading(false);
    });
  }, []);

  const visibleReviews = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "verified" ? review.is_verified_purchase : review.moderation_status === filter);
      const matchesRating = ratingFilter === "all" || review.rating === Number(ratingFilter);
      const haystack = [productName(review), customerName(review), review.comment, review.customer_email]
        .join(" ")
        .toLowerCase();
      return matchesFilter && matchesRating && (!term || haystack.includes(term));
    });
  }, [filter, ratingFilter, reviews, search]);

  async function moderate(review: ReviewRow, status: ReviewModerationStatus) {
    setMessage("Saving review...");
    const updated = await updateReviewModeration(review.id, status, notes[review.id] || "");
    setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, ...updated } : item)));
    setMessage(`Review ${statusLabel(status).toLowerCase()}.`);
    setStats(await getProductReviewStats());
  }

  async function saveNote(review: ReviewRow) {
    setMessage("Saving note...");
    const updated = await updateReviewModeration(review.id, review.moderation_status, notes[review.id] || "");
    setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, ...updated } : item)));
    setMessage("Admin note saved.");
  }

  async function removeReview(review: ReviewRow) {
    if (!window.confirm("Delete this review? This is intended for spam or abusive reviews.")) return;
    setMessage("Deleting review...");
    await deleteReview(review.id);
    setReviews((current) => current.filter((item) => item.id !== review.id));
    setMessage("Review deleted.");
    setStats(await getProductReviewStats());
  }

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Reviews</h1>
      <p>Moderate verified purchase reviews before they appear on the Radios storefront.</p>
      {message ? <p role="status">{message}</p> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product, customer, or comment"
          aria-label="Search reviews"
        />
        {(["pending", "approved", "rejected", "verified", "all"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            aria-pressed={filter === mode}
          >
            {mode === "all" ? "All" : statusLabel(mode)}
          </button>
        ))}
        <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} aria-label="Filter by rating">
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>{ratingLabel(rating)}</option>
          ))}
        </select>
        <button type="button" onClick={() => loadReviews()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? <p>Loading reviews...</p> : null}
      {!loading && visibleReviews.length === 0 ? <p>No reviews match the current filters.</p> : null}

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Customer</th>
            <th>Rating</th>
            <th>Review</th>
            <th>Images</th>
            <th>Status</th>
            <th>Product Stats</th>
            <th>Admin Note</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleReviews.map((review) => {
            const productStats = stats[review.product_id];
            return (
              <tr key={review.id}>
                <td>
                  <strong>{productName(review)}</strong>
                  <div>{review.product_id}</div>
                </td>
                <td>
                  <strong>{customerName(review)}</strong>
                  <div>{review.is_verified_purchase ? "Verified Purchase" : "Unverified"}</div>
                  <div>{new Date(review.created_at).toLocaleString()}</div>
                </td>
                <td aria-label={ratingLabel(review.rating)}>{ratingStars(review.rating)}</td>
                <td style={{ minWidth: 240 }}>{review.comment || "-"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(review.image_urls || []).slice(0, 3).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Review" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 6 }} />
                      </a>
                    ))}
                  </div>
                </td>
                <td>
                  <span style={{ ...statusStyle(review.moderation_status), borderRadius: 999, padding: "6px 10px", fontWeight: 700 }}>
                    {statusLabel(review.moderation_status)}
                  </span>
                </td>
                <td>
                  {productStats ? `${productStats.average.toFixed(1)} from ${productStats.count} approved` : "No approved reviews"}
                </td>
                <td>
                  <textarea
                    value={notes[review.id] || ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))}
                    rows={3}
                    aria-label={`Admin note for ${productName(review)}`}
                  />
                  <button type="button" onClick={() => saveNote(review)}>Save Note</button>
                </td>
                <td>
                  <button type="button" onClick={() => moderate(review, "approved")}>Approve</button>
                  <button type="button" onClick={() => moderate(review, "rejected")}>Reject</button>
                  <button type="button" onClick={() => removeReview(review)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AdminGuard>
  );
}
