"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import AdminGuard from "../../components/AdminGuard";
import {
  createPromotion,
  deletePromotion,
  getPromotionDashboardData,
  updatePromotion,
  type DiscountType,
  type PromotionDiscount,
  type PromotionProductOption,
  type PromotionRedemption,
  type PromotionType
} from "../../lib/promotions";

type FilterMode = "all" | "active" | "expired" | "scheduled" | "coupon" | "automatic" | "category" | "first_order";

type PromotionForm = {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  promotion_type: PromotionType;
  applies_to: string;
  product_ids: string;
  category_slugs: string;
  collection_ids: string;
  tags: string;
  minimum_order_amount: string;
  maximum_discount_amount: string;
  usage_limit: string;
  usage_limit_per_customer: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  is_first_order_only: boolean;
  buy_quantity: string;
  get_quantity: string;
  combine_with_other_discounts: boolean;
};

const promotionTypes: PromotionType[] = [
  "coupon_code",
  "automatic_discount",
  "category_offer",
  "combo_offer",
  "first_order_offer",
  "free_shipping",
  "buy_x_get_y"
];

const discountTypes: DiscountType[] = ["percentage", "fixed_amount", "free_shipping", "buy_x_get_y"];
const scopes = ["all", "category", "product", "collection", "tag"];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyForm(): PromotionForm {
  return {
    id: "",
    code: "",
    title: "",
    description: "",
    discount_type: "percentage",
    discount_value: "10",
    promotion_type: "coupon_code",
    applies_to: "all",
    product_ids: "",
    category_slugs: "",
    collection_ids: "",
    tags: "",
    minimum_order_amount: "0",
    maximum_discount_amount: "",
    usage_limit: "",
    usage_limit_per_customer: "1",
    starts_at: toInputDate(new Date().toISOString()),
    expires_at: "",
    is_active: true,
    is_first_order_only: false,
    buy_quantity: "2",
    get_quantity: "1",
    combine_with_other_discounts: false
  };
}

function formFromPromotion(promotion: PromotionDiscount): PromotionForm {
  return {
    id: promotion.id,
    code: promotion.code || "",
    title: promotion.title || "",
    description: promotion.description || "",
    discount_type: promotion.discount_type || "percentage",
    discount_value: String(promotion.discount_value ?? 0),
    promotion_type: promotion.promotion_type || "coupon_code",
    applies_to: promotion.applies_to || "all",
    product_ids: (promotion.product_ids || []).join(", "),
    category_slugs: (promotion.category_slugs || []).join(", "),
    collection_ids: (promotion.collection_ids || []).join(", "),
    tags: (promotion.tags || []).join(", "),
    minimum_order_amount: String(promotion.minimum_order_amount ?? 0),
    maximum_discount_amount: promotion.maximum_discount_amount == null ? "" : String(promotion.maximum_discount_amount),
    usage_limit: promotion.usage_limit == null ? "" : String(promotion.usage_limit),
    usage_limit_per_customer: String(promotion.usage_limit_per_customer ?? 1),
    starts_at: toInputDate(promotion.starts_at),
    expires_at: toInputDate(promotion.expires_at),
    is_active: promotion.is_active !== false,
    is_first_order_only: promotion.is_first_order_only === true,
    buy_quantity: String(promotion.buy_quantity ?? 2),
    get_quantity: String(promotion.get_quantity ?? 1),
    combine_with_other_discounts: promotion.combine_with_other_discounts === true
  };
}

function promotionValue(promotion: PromotionDiscount) {
  if (promotion.discount_type === "percentage") return `${promotion.discount_value}%`;
  if (promotion.discount_type === "fixed_amount") return formatMoney(promotion.discount_value);
  if (promotion.discount_type === "free_shipping") return "Free shipping";
  return `Buy ${promotion.buy_quantity || 1} Get ${promotion.get_quantity || 1}`;
}

function promotionStatus(promotion: PromotionDiscount) {
  const now = Date.now();
  const startsAt = promotion.starts_at ? new Date(promotion.starts_at).getTime() : 0;
  const expiresAt = promotion.expires_at ? new Date(promotion.expires_at).getTime() : 0;

  if (promotion.is_active === false) return "Inactive";
  if (startsAt && startsAt > now) return "Scheduled";
  if (expiresAt && expiresAt < now) return "Expired";
  return "Active";
}

function validateForm(form: PromotionForm) {
  const errors: string[] = [];
  const value = Number(form.discount_value);
  const minOrder = numberOrNull(form.minimum_order_amount);
  const usageLimit = numberOrNull(form.usage_limit);
  const perCustomer = numberOrNull(form.usage_limit_per_customer);
  const startsAt = toIsoOrNull(form.starts_at);
  const expiresAt = toIsoOrNull(form.expires_at);

  if (!form.title.trim()) errors.push("Title is required.");
  if (form.promotion_type === "coupon_code" && !form.code.trim()) errors.push("Coupon code is required for coupon promotions.");
  if (["percentage", "fixed_amount"].includes(form.discount_type) && (!Number.isFinite(value) || value <= 0)) errors.push("Discount value must be greater than zero.");
  if (form.discount_type === "percentage" && value > 100) errors.push("Percentage discounts cannot exceed 100.");
  if (form.applies_to === "category" && splitList(form.category_slugs).length === 0) errors.push("Add at least one category slug for a category offer.");
  if (form.applies_to === "product" && splitList(form.product_ids).length === 0) errors.push("Add at least one product for a product offer.");
  if (form.applies_to === "collection" && splitList(form.collection_ids).length === 0) errors.push("Add at least one collection id for a collection offer.");
  if (form.applies_to === "tag" && splitList(form.tags).length === 0) errors.push("Add at least one tag for a tag offer.");
  if (minOrder != null && minOrder < 0) errors.push("Minimum order amount cannot be negative.");
  if (usageLimit != null && usageLimit < 1) errors.push("Usage limit must be at least 1.");
  if (perCustomer != null && perCustomer < 1) errors.push("Per-customer usage limit must be at least 1.");
  if (expiresAt && startsAt && new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) errors.push("Expiry must be after the start date.");
  if (["buy_x_get_y", "combo_offer"].includes(form.promotion_type) || form.discount_type === "buy_x_get_y") {
    if (Number(form.buy_quantity) < 1 || Number(form.get_quantity) < 1) errors.push("Buy and get quantities must be at least 1.");
  }

  return errors;
}

function buildPayload(form: PromotionForm) {
  const productIds = splitList(form.product_ids);
  const collectionIds = splitList(form.collection_ids);
  const categorySlugs = splitList(form.category_slugs).map(slugify);
  const tags = splitList(form.tags);
  const isFirstOrder = form.is_first_order_only || form.promotion_type === "first_order_offer";

  return {
    code: form.promotion_type === "coupon_code" ? form.code.trim().toUpperCase() : null,
    title: form.title.trim(),
    description: form.description.trim() || null,
    discount_type: form.promotion_type === "free_shipping"
      ? "free_shipping"
      : ["combo_offer", "buy_x_get_y"].includes(form.promotion_type)
        ? "buy_x_get_y"
        : form.discount_type,
    discount_value: Number(form.discount_value) || 0,
    promotion_type: form.promotion_type,
    applies_to: form.applies_to,
    product_ids: productIds,
    category_slugs: categorySlugs,
    collection_ids: collectionIds,
    tags,
    minimum_order_amount: numberOrNull(form.minimum_order_amount) || 0,
    maximum_discount_amount: numberOrNull(form.maximum_discount_amount),
    usage_limit: numberOrNull(form.usage_limit),
    usage_limit_per_customer: numberOrNull(form.usage_limit_per_customer) || 1,
    starts_at: toIsoOrNull(form.starts_at),
    expires_at: toIsoOrNull(form.expires_at),
    is_active: form.is_active,
    is_first_order_only: isFirstOrder,
    buy_quantity: Math.max(1, Number(form.buy_quantity) || 1),
    get_quantity: Math.max(1, Number(form.get_quantity) || 1),
    combine_with_other_discounts: form.combine_with_other_discounts
  };
}

function productName(product: PromotionProductOption) {
  return product.title || product.name || product.sku || product.id;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionDiscount[]>([]);
  const [redemptions, setRedemptions] = useState<PromotionRedemption[]>([]);
  const [products, setProducts] = useState<PromotionProductOption[]>([]);
  const [form, setForm] = useState<PromotionForm>(emptyForm());
  const [selectedProduct, setSelectedProduct] = useState("");
  const [filter, setFilter] = useState<FilterMode>("active");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadPromotions() {
    setLoading(true);
    const data = await getPromotionDashboardData();
    setPromotions(data.promotions);
    setRedemptions(data.redemptions);
    setProducts(data.products);
    setLoading(false);
  }

  useEffect(() => {
    loadPromotions().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load promotions.");
      setLoading(false);
    });
  }, []);

  const redemptionsByDiscount = useMemo(() => {
    return redemptions.reduce<Record<string, PromotionRedemption[]>>((groups, redemption) => {
      groups[redemption.discount_id] = groups[redemption.discount_id] || [];
      groups[redemption.discount_id].push(redemption);
      return groups;
    }, {});
  }, [redemptions]);

  const visiblePromotions = useMemo(() => {
    return promotions.filter((promotion) => {
      const status = promotionStatus(promotion).toLowerCase();
      if (filter === "all") return true;
      if (filter === "active") return status === "active";
      if (filter === "expired") return status === "expired";
      if (filter === "scheduled") return status === "scheduled";
      if (filter === "coupon") return promotion.promotion_type === "coupon_code" || Boolean(promotion.code);
      if (filter === "automatic") return promotion.promotion_type === "automatic_discount" || !promotion.code;
      if (filter === "category") return promotion.promotion_type === "category_offer" || promotion.applies_to === "category";
      if (filter === "first_order") return promotion.is_first_order_only === true || promotion.promotion_type === "first_order_offer";
      return true;
    });
  }, [filter, promotions]);

  function updateField<Key extends keyof PromotionForm>(key: Key, value: PromotionForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addSelectedProduct() {
    if (!selectedProduct) return;
    const currentIds = splitList(form.product_ids);
    if (!currentIds.includes(selectedProduct)) {
      updateField("product_ids", [...currentIds, selectedProduct].join(", "));
    }
    setSelectedProduct("");
  }

  async function submitPromotion(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (nextErrors.length) return;

    try {
      setSaving(true);
      setMessage(form.id ? "Updating promotion..." : "Creating promotion...");
      const payload = buildPayload(form);
      if (form.id) {
        await updatePromotion(form.id, payload);
      } else {
        await createPromotion(payload);
      }
      setForm(emptyForm());
      setErrors([]);
      setMessage("Promotion saved.");
      await loadPromotions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePromotion(promotion: PromotionDiscount) {
    setMessage("Updating promotion...");
    await updatePromotion(promotion.id, { is_active: promotion.is_active === false });
    setMessage("Promotion updated.");
    await loadPromotions();
  }

  async function removePromotion(promotion: PromotionDiscount) {
    if (!window.confirm("Delete this promotion? Existing orders and redemption history will remain.")) return;
    setMessage("Deleting promotion...");
    await deletePromotion(promotion.id);
    setMessage("Promotion deleted.");
    await loadPromotions();
  }

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Discounts and Promotions</h1>
      <p>Create coupon codes, automatic offers, category promotions, combo offers, first-order offers, and free shipping rules for the Radios storefront.</p>
      {message ? <p role="status">{message}</p> : null}

      <form onSubmit={submitPromotion} style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: 16, margin: "18px 0" }}>
        <h2>{form.id ? "Edit Promotion" : "Create Promotion"}</h2>
        {errors.length ? (
          <div role="alert" style={{ color: "#b42318", marginBottom: 12 }}>
            {errors.map((error) => <div key={error}>{error}</div>)}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>Title<input value={form.title} onChange={(event) => updateField("title", event.target.value)} /></label>
          <label>Coupon Code<input value={form.code} onChange={(event) => updateField("code", event.target.value.toUpperCase())} disabled={form.promotion_type !== "coupon_code"} /></label>
          <label>Promotion Type<select value={form.promotion_type} onChange={(event) => updateField("promotion_type", event.target.value as PromotionType)}>{promotionTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
          <label>Discount Type<select value={form.discount_type} onChange={(event) => updateField("discount_type", event.target.value as DiscountType)}>{discountTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
          <label>Discount Value<input type="number" min="0" value={form.discount_value} onChange={(event) => updateField("discount_value", event.target.value)} disabled={form.discount_type === "free_shipping"} /></label>
          <label>Applies To<select value={form.applies_to} onChange={(event) => updateField("applies_to", event.target.value)}>{scopes.map((scope) => <option key={scope} value={scope}>{label(scope)}</option>)}</select></label>
          <label>Minimum Order<input type="number" min="0" value={form.minimum_order_amount} onChange={(event) => updateField("minimum_order_amount", event.target.value)} /></label>
          <label>Maximum Discount Cap<input type="number" min="0" value={form.maximum_discount_amount} onChange={(event) => updateField("maximum_discount_amount", event.target.value)} /></label>
          <label>Total Usage Limit<input type="number" min="1" value={form.usage_limit} onChange={(event) => updateField("usage_limit", event.target.value)} /></label>
          <label>Per-Customer Limit<input type="number" min="1" value={form.usage_limit_per_customer} onChange={(event) => updateField("usage_limit_per_customer", event.target.value)} /></label>
          <label>Starts At<input type="datetime-local" value={form.starts_at} onChange={(event) => updateField("starts_at", event.target.value)} /></label>
          <label>Expires At<input type="datetime-local" value={form.expires_at} onChange={(event) => updateField("expires_at", event.target.value)} /></label>
          <label>Buy Quantity<input type="number" min="1" value={form.buy_quantity} onChange={(event) => updateField("buy_quantity", event.target.value)} /></label>
          <label>Get Quantity<input type="number" min="1" value={form.get_quantity} onChange={(event) => updateField("get_quantity", event.target.value)} /></label>
        </div>

        <label style={{ display: "block", marginTop: 12 }}>Description<textarea rows={3} value={form.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        <label style={{ display: "block", marginTop: 12 }}>Category Slugs<input value={form.category_slugs} onChange={(event) => updateField("category_slugs", event.target.value)} placeholder="electronics, mobile-accessories" /></label>
        <label style={{ display: "block", marginTop: 12 }}>Collection IDs<input value={form.collection_ids} onChange={(event) => updateField("collection_ids", event.target.value)} /></label>
        <label style={{ display: "block", marginTop: 12 }}>Tags<input value={form.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="best seller, summer" /></label>
        <label style={{ display: "block", marginTop: 12 }}>Product IDs<input value={form.product_ids} onChange={(event) => updateField("product_ids", event.target.value)} /></label>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} aria-label="Select product to add">
            <option value="">Select product</option>
            {products.map((product) => <option key={product.id} value={product.id}>{productName(product)}</option>)}
          </select>
          <button type="button" onClick={addSelectedProduct}>Add Product</button>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          <label><input type="checkbox" checked={form.is_active} onChange={(event) => updateField("is_active", event.target.checked)} /> Active</label>
          <label><input type="checkbox" checked={form.is_first_order_only} onChange={(event) => updateField("is_first_order_only", event.target.checked)} /> First order only</label>
          <label><input type="checkbox" checked={form.combine_with_other_discounts} onChange={(event) => updateField("combine_with_other_discounts", event.target.checked)} /> Combine with other discounts</label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving..." : form.id ? "Update Promotion" : "Create Promotion"}</button>
          <button type="button" onClick={() => { setForm(emptyForm()); setErrors([]); }}>Reset</button>
        </div>
      </form>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        {(["active", "expired", "scheduled", "coupon", "automatic", "category", "first_order", "all"] as FilterMode[]).map((mode) => (
          <button key={mode} type="button" onClick={() => setFilter(mode)} aria-pressed={filter === mode}>
            {mode === "all" ? "All" : label(mode)}
          </button>
        ))}
        <button type="button" onClick={() => loadPromotions()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      {loading ? <p>Loading promotions...</p> : null}
      {!loading && visiblePromotions.length === 0 ? <p>No promotions match the selected filter.</p> : null}

      <table>
        <thead>
          <tr>
            <th>Promotion</th>
            <th>Rule</th>
            <th>Window</th>
            <th>Usage</th>
            <th>Redemptions</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visiblePromotions.map((promotion) => {
            const rows = redemptionsByDiscount[promotion.id] || [];
            const latest = rows[0];
            return (
              <tr key={promotion.id}>
                <td>
                  <strong>{promotion.title || promotion.code || "Promotion"}</strong>
                  <div>{promotion.code ? `Code: ${promotion.code}` : "Automatic"}</div>
                  <div>{promotion.description || "-"}</div>
                </td>
                <td>
                  <div>{label(promotion.promotion_type)} - {promotionValue(promotion)}</div>
                  <div>Applies to {label(promotion.applies_to || "all")}</div>
                  <div>Minimum {formatMoney(promotion.minimum_order_amount || 0)}</div>
                  {promotion.maximum_discount_amount ? <div>Cap {formatMoney(promotion.maximum_discount_amount)}</div> : null}
                  {promotion.is_first_order_only ? <div>First order only</div> : null}
                </td>
                <td>
                  <div>Starts {promotion.starts_at ? new Date(promotion.starts_at).toLocaleString() : "Now"}</div>
                  <div>Expires {promotion.expires_at ? new Date(promotion.expires_at).toLocaleString() : "No expiry"}</div>
                </td>
                <td>
                  <div>{promotion.used_count || 0}{promotion.usage_limit ? ` of ${promotion.usage_limit}` : " used"}</div>
                  <div>{promotion.usage_limit_per_customer || 1} per customer</div>
                </td>
                <td>
                  <strong>{rows.length}</strong>
                  {latest ? <div>Latest: {latest.customer_email || latest.auth_user_id || "Customer"} saved {formatMoney(latest.discount_amount || 0)}</div> : <div>No redemptions yet</div>}
                </td>
                <td>{promotionStatus(promotion)}</td>
                <td>
                  <button type="button" onClick={() => setForm(formFromPromotion(promotion))}>Edit</button>
                  <button type="button" onClick={() => togglePromotion(promotion)}>{promotion.is_active === false ? "Activate" : "Deactivate"}</button>
                  <button type="button" onClick={() => removePromotion(promotion)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AdminGuard>
  );
}
