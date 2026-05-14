"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { api, Product } from "../../lib/api";
import AdminGuard from "../../components/AdminGuard";
import { saveSupabaseProductImages, uploadProductGallery, uploadProductImage, type ProductImageFields } from "../../lib/storage";
import { getSupabaseBrowserClient } from "../../lib/admin-auth";
import { adjustProductStock, getInventoryProducts, type InventoryProduct } from "../../lib/inventory";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [imagePreviewById, setImagePreviewById] = useState<Record<string, string>>({});
  const [stockAdjustments, setStockAdjustments] = useState<Record<string, string>>({});
  const storeBaseUrl =
    process.env.NEXT_PUBLIC_RADIOS_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STORE_URL ||
    "http://127.0.0.1:5500/Radios";
  const storeProductRoute =
    process.env.NEXT_PUBLIC_STOREFRONT_PRODUCT_ROUTE || "shop-single.html";

  function getProductId(product: Product & { id?: string }) {
    if (product.id && isUuid(product.id)) return product.id;
    return product._id || product.id || "";
  }

  function getProductName(product: Product) {
    return product.name || product.title || "Product";
  }

  function getProductImage(product: Product) {
    return product.image_url || product.image || product.images?.[0] || "";
  }

  function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function getNumber(value: unknown, fallback = 0) {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
  }

  function slugify(value: string) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function seoDescription(product: Product) {
    return product.meta_description || product.description || `${getProductName(product)} is available from Radios.`;
  }

  function seoPreviewTitle(product: Product) {
    return product.meta_title || `${getProductName(product)} - Radios`;
  }

  function seoTitleWarning(value: string) {
    return value.length > 60 ? "Meta title is longer than 60 characters." : "";
  }

  function seoDescriptionWarning(value: string) {
    return value.length > 155 ? "Meta description is longer than 155 characters." : "";
  }

  function getAvailableStock(product: Product) {
    if (typeof product.available_stock === "number") return product.available_stock;
    return Math.max(getNumber(product.stock) - getNumber(product.reserved_stock), 0);
  }

  function getInventoryStatus(product: Product) {
    if (product.track_inventory === false) return "not_tracked";
    if (product.inventory_status) return product.inventory_status;
    const availableStock = getAvailableStock(product);
    if (availableStock <= 0 && product.allow_backorder !== true) return "out_of_stock";
    if (availableStock <= getNumber(product.low_stock_threshold, 5)) return "low_stock";
    return "in_stock";
  }

  function statusLabel(status: string) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function statusStyle(status: string) {
    const colorByStatus: Record<string, { color: string; background: string }> = {
      in_stock: { color: "#067647", background: "#ecfdf3" },
      low_stock: { color: "#b54708", background: "#fffaeb" },
      out_of_stock: { color: "#b42318", background: "#fef3f2" },
      not_tracked: { color: "#344054", background: "#f2f4f7" }
    };
    return colorByStatus[status] || colorByStatus.not_tracked;
  }

  function activeBadgeFlags(product: Product) {
    return {
      is_hot: Boolean(product.is_hot || product.isHot),
      is_best_seller: Boolean(product.is_best_seller || product.isBestSeller),
      is_new: Boolean(product.is_new || product.isNew),
      is_featured: Boolean(product.is_featured || product.isFeatured)
    };
  }

  function getStorefrontBadges(product: Product) {
    const badges: string[] = [];
    const inventoryStatus = getInventoryStatus(product);
    const flags = activeBadgeFlags(product);
    const explicitBadges = Array.isArray(product.badges)
      ? product.badges
      : typeof product.badges === "string"
        ? String(product.badges).split(",").map((badge) => badge.trim()).filter(Boolean)
        : [];

    if (inventoryStatus === "out_of_stock") badges.push("Out of stock");
    if (inventoryStatus === "low_stock") badges.push("Low stock");
    if (product.allow_backorder && getAvailableStock(product) <= 0) badges.push("Backorder");
    if (flags.is_hot) badges.push("Hot");
    if (flags.is_best_seller) badges.push("Most selling");
    if (flags.is_new) badges.push("New");
    if (flags.is_featured) badges.push("Featured");
    explicitBadges.forEach((badge) => {
      if (badge && !badges.includes(badge)) badges.push(badge);
    });

    return badges.slice(0, 4);
  }

  function badgeStyle(label: string) {
    const key = label.toLowerCase();
    if (key.includes("out")) return { color: "#b42318", background: "#fef3f2" };
    if (key.includes("low")) return { color: "#b54708", background: "#fffaeb" };
    if (key.includes("hot")) return { color: "#b42318", background: "#fff1f3" };
    if (key.includes("most")) return { color: "#5925dc", background: "#f4f3ff" };
    if (key.includes("new")) return { color: "#067647", background: "#ecfdf3" };
    return { color: "#175cd3", background: "#eff8ff" };
  }

  async function saveSupabaseBadgeFields(product: Product, payload: Partial<Product>) {
    const supabase = getSupabaseBrowserClient();
    const productId = [product.id, product._id].find((value) => isUuid(value || ""));
    let query = supabase.from("products").update(payload);

    if (productId) {
      query = query.eq("id", productId);
    } else if (product.slug) {
      query = query.eq("slug", product.slug);
    } else {
      throw new Error("No Supabase id or slug is available for this product.");
    }

    const { error } = await query.select("id").limit(1);
    if (error) throw error;
  }

  async function saveProductBadgeFields(product: Product, payload: Partial<Product>) {
    const apiProductId = product._id && !isUuid(product._id) ? product._id : product.id && !isUuid(product.id) ? product.id : "";
    const productHasSupabaseTarget = Boolean([product.id, product._id].some((value) => isUuid(value || "")) || product.slug);
    const updates: Promise<unknown>[] = [];

    if (apiProductId) updates.push(api.updateProduct(apiProductId, payload));
    if (productHasSupabaseTarget) updates.push(saveSupabaseBadgeFields(product, payload));
    if (!updates.length) throw new Error("No dashboard or Supabase product target is available for badge updates.");

    const results = await Promise.allSettled(updates);
    if (results.every((result) => result.status === "rejected")) {
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      throw rejected?.reason || new Error("Badge update failed.");
    }
  }

  async function saveProductSearchKeywords(product: Product, searchKeywords: string) {
    const payload = { search_keywords: searchKeywords.trim() };
    const apiProductId = product._id && !isUuid(product._id) ? product._id : product.id && !isUuid(product.id) ? product.id : "";
    const productHasSupabaseTarget = Boolean([product.id, product._id].some((value) => isUuid(value || "")) || product.slug);
    const updates: Promise<unknown>[] = [];

    if (apiProductId) updates.push(api.updateProduct(apiProductId, payload).catch(() => undefined));
    if (productHasSupabaseTarget) updates.push(saveSupabaseBadgeFields(product, payload));
    if (!updates.length) throw new Error("No dashboard or Supabase product target is available for search keyword updates.");

    await Promise.all(updates);
  }

  async function saveProductDetailFields(product: Product, payload: Partial<Product>) {
    const apiProductId = product._id && !isUuid(product._id) ? product._id : product.id && !isUuid(product.id) ? product.id : "";
    const productHasSupabaseTarget = Boolean([product.id, product._id].some((value) => isUuid(value || "")) || product.slug);
    const updates: Promise<unknown>[] = [];

    if (apiProductId) updates.push(api.updateProduct(apiProductId, payload).catch(() => undefined));
    if (productHasSupabaseTarget) updates.push(saveSupabaseBadgeFields(product, payload));
    if (!updates.length) throw new Error("No dashboard or Supabase product target is available for product detail updates.");

    await Promise.all(updates);
  }

  function normalizeSpecifications(value: Product["specifications"]) {
    if (!value) return {};
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    return typeof value === "object" && !Array.isArray(value) ? value as Record<string, string> : {};
  }

  function normalizeFaqs(value: Product["faqs"]) {
    if (!value) return [];
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return [];
      }
    }
    return Array.isArray(value)
      ? value.filter((faq) => faq && (faq.question || faq.answer)).map((faq) => ({
          question: faq.question || "",
          answer: faq.answer || ""
        }))
      : [];
  }

  function getRelatedProducts(product: Product) {
    const ids = new Set(product.related_product_ids || []);
    return products.filter((item) => ids.has(getProductId(item)));
  }

  function inventoryToProduct(product: InventoryProduct): Product {
    return {
      _id: product.id,
      id: product.id,
      name: product.name || product.title || product.sku || "Product",
      title: product.title || product.name || product.sku || "Product",
      slug: product.slug || slugify(product.title || product.name || product.sku || product.id),
      meta_title: product.meta_title || "",
      meta_description: product.meta_description || "",
      canonical_url: product.canonical_url || "",
      og_image_url: product.og_image_url || "",
      price: 0,
      sku: product.sku || "",
      stock: product.stock,
      reserved_stock: product.reserved_stock,
      available_stock: product.available_stock,
      low_stock_threshold: product.low_stock_threshold,
      track_inventory: product.track_inventory,
      allow_backorder: product.allow_backorder,
      inventory_status: product.inventory_status,
      category: product.category || product.category_slug || "",
      category_slug: product.category_slug || "",
      badges: product.badges || [],
      tags: product.tags || [],
      search_keywords: product.search_keywords || "",
      specifications: product.specifications || {},
      faqs: product.faqs || [],
      delivery_days_min: product.delivery_days_min || 2,
      delivery_days_max: product.delivery_days_max || 7,
      return_policy: product.return_policy || "",
      warranty: product.warranty || "",
      brand: product.brand || "",
      related_product_ids: product.related_product_ids || [],
      is_hot: Boolean(product.is_hot),
      is_best_seller: Boolean(product.is_best_seller),
      is_featured: Boolean(product.is_featured),
      is_new: Boolean(product.is_new),
      sales_count: product.sales_count || 0,
      compare_at_price: product.compare_at_price || 0,
      description: "",
      visible: true,
      createdAt: product.updated_at || ""
    };
  }

  function mergeInventory(productsList: Product[], inventoryProducts: InventoryProduct[]) {
    const inventoryById = new Map(inventoryProducts.map((product) => [product.id, product] as const));
    const inventoryBySku = new Map(
      inventoryProducts
        .filter((product) => product.sku)
        .map((product) => [String(product.sku).trim().toLowerCase(), product] as const)
    );
    const merged = productsList.map((product) => {
      const productId = getProductId(product);
      const inventory = inventoryById.get(productId) || inventoryBySku.get(String(product.sku || "").trim().toLowerCase());
      if (!inventory) return product;
      return {
        ...product,
        id: inventory.id,
        slug: inventory.slug || product.slug,
        meta_title: inventory.meta_title || product.meta_title,
        meta_description: inventory.meta_description || product.meta_description,
        canonical_url: inventory.canonical_url || product.canonical_url,
        og_image_url: inventory.og_image_url || product.og_image_url,
        stock: inventory.stock,
        reserved_stock: inventory.reserved_stock,
        available_stock: inventory.available_stock,
        low_stock_threshold: inventory.low_stock_threshold,
        track_inventory: inventory.track_inventory,
        allow_backorder: inventory.allow_backorder,
        inventory_status: inventory.inventory_status,
        badges: inventory.badges || product.badges,
        tags: inventory.tags || product.tags,
        search_keywords: inventory.search_keywords || product.search_keywords,
        specifications: inventory.specifications || product.specifications,
        faqs: inventory.faqs || product.faqs,
        delivery_days_min: inventory.delivery_days_min || product.delivery_days_min,
        delivery_days_max: inventory.delivery_days_max || product.delivery_days_max,
        return_policy: inventory.return_policy || product.return_policy,
        warranty: inventory.warranty || product.warranty,
        brand: inventory.brand || product.brand,
        related_product_ids: inventory.related_product_ids || product.related_product_ids,
        is_hot: Boolean(inventory.is_hot),
        is_best_seller: Boolean(inventory.is_best_seller),
        is_featured: Boolean(inventory.is_featured),
        is_new: Boolean(inventory.is_new),
        sales_count: inventory.sales_count || product.sales_count,
        compare_at_price: inventory.compare_at_price || product.compare_at_price
      };
    });

    const existingIds = new Set(productsList.map(getProductId));
    const existingSkus = new Set(productsList.map((product) => String(product.sku || "").trim().toLowerCase()).filter(Boolean));
    inventoryProducts.forEach((product) => {
      const sku = String(product.sku || "").trim().toLowerCase();
      if (!existingIds.has(product.id) && (!sku || !existingSkus.has(sku))) merged.push(inventoryToProduct(product));
    });

    return merged;
  }

  function getStoreUrl(product: Product & { id?: string }) {
    const baseUrl = storeBaseUrl.trim().replace(/\/+$/g, "");
    const route = storeProductRoute.replace(/^\/+|\/+$/g, "");
    const productSlug = product.slug?.trim();
    const productId = getProductId(product);
    if (route.endsWith(".html")) {
      return productSlug
        ? `${baseUrl}/${route}?slug=${encodeURIComponent(productSlug)}`
        : `${baseUrl}/${route}?id=${encodeURIComponent(productId)}`;
    }

    const identifier = productSlug || productId;
    return `${baseUrl}/${route}/${encodeURIComponent(identifier)}`;
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const [apiResult, inventoryResult] = await Promise.allSettled([
        api.getProducts("?includeHidden=true&limit=50"),
        getInventoryProducts()
      ]);

      const apiItems = apiResult.status === "fulfilled" ? apiResult.value.items : [];
      const inventoryItems = inventoryResult.status === "fulfilled" ? inventoryResult.value : [];

      if (apiResult.status === "rejected" && inventoryResult.status === "rejected") {
        throw apiResult.reason;
      }

      setProducts(apiItems.length ? mergeInventory(apiItems, inventoryItems) : inventoryItems.map(inventoryToProduct));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null = null;

    try {
      const supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel("dashboard-products-inventory")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
          loadProducts();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    return () => {
      if (channel) {
        getSupabaseBrowserClient().removeChannel(channel);
      }
    };
  }, []);

  async function handleDelete(id: string) {
    await api.deleteProduct(id);
    await loadProducts();
  }

  async function handleDuplicate(product: Product) {
    const copySuffix = Date.now();
    await api.createProduct({
      ...product,
      sku: `${product.sku}-COPY-${copySuffix}`,
      slug: product.slug ? `${product.slug}-copy-${copySuffix}` : undefined,
      name: `${getProductName(product)} Copy`,
      title: `${getProductName(product)} Copy`
    });
    await loadProducts();
  }

  async function handleToggle(product: Product) {
    await api.toggleVisibility(getProductId(product), !product.visible);
    await loadProducts();
  }

  function previewSelectedImage(productId: string, file: File) {
    if (typeof URL === "undefined") return;
    setImagePreviewById((current) => ({
      ...current,
      [productId]: URL.createObjectURL(file)
    }));
  }

  function clearImagePreview(productId: string) {
    setImagePreviewById((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  async function handleMainImageChange(product: Product, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const productId = getProductId(product);
    if (!productId) return;

    setUploadError("");
    setUploadingKey(`${productId}:main`);
    previewSelectedImage(productId, file);

    try {
      const uploaded = await uploadProductImage(file, {
        folder: product.slug || productId,
        slug: getProductName(product),
        oldUrl: product.image_url || product.image,
        deleteOld: false
      });

      const payload: ProductImageFields = {
        image_url: uploaded.url,
        image: uploaded.url
      };

      await saveSupabaseProductImages(product, payload);
      await api.updateProduct(productId, payload).catch(() => undefined);
      await loadProducts();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingKey("");
      clearImagePreview(productId);
    }
  }

  async function handleGalleryChange(product: Product, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const productId = getProductId(product);
    if (!productId) return;

    setUploadError("");
    setUploadingKey(`${productId}:gallery`);
    previewSelectedImage(productId, files[0]);

    try {
      const uploaded = await uploadProductGallery(files, {
        folder: product.slug || productId,
        slug: getProductName(product)
      });
      const uploadedUrls = uploaded.map((image) => image.url);
      const nextImages = [...(product.images || []), ...uploadedUrls];

      const payload: ProductImageFields = {
        images: nextImages,
        image_url: product.image_url || uploadedUrls[0],
        image: product.image || uploadedUrls[0]
      };

      await saveSupabaseProductImages(product, payload);
      await api.updateProduct(productId, payload).catch(() => undefined);
      await loadProducts();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gallery upload failed");
    } finally {
      setUploadingKey("");
      clearImagePreview(productId);
    }
  }

  async function handleRemoveGalleryImage(product: Product, imageUrl: string) {
    const productId = getProductId(product);
    if (!productId) return;

    const nextImages = (product.images || []).filter((image) => image !== imageUrl);
    const payload: ProductImageFields = {
      images: nextImages,
      image_url: product.image_url === imageUrl ? nextImages[0] || product.image || "" : product.image_url,
      image: product.image === imageUrl ? nextImages[0] || product.image_url || "" : product.image
    };

    await saveSupabaseProductImages(product, payload);
    await api.updateProduct(productId, payload).catch(() => undefined);
    await loadProducts();
  }

  async function handleStockAdjust(product: Product) {
    const productId = getProductId(product);
    const quantityChange = Number(stockAdjustments[productId] || 0);
    if (!productId || !quantityChange) return;

    if (!isUuid(productId)) {
      setUploadError("This product is not linked to a Supabase product ID, so stock cannot be adjusted here.");
      return;
    }

    setUploadError("");
    await adjustProductStock(productId, quantityChange, "Product table stock adjustment");
    setStockAdjustments((current) => ({ ...current, [productId]: "" }));
    await loadProducts();
  }

  async function handleBadgeToggle(product: Product, field: "is_hot" | "is_best_seller" | "is_new" | "is_featured") {
    setUploadError("");
    const currentFlags = activeBadgeFlags(product);
    const payload: Partial<Product> = {};
    payload[field] = !currentFlags[field];

    try {
      await saveProductBadgeFields(product, payload);
      await loadProducts();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Badge update failed");
    }
  }

  async function handleSearchKeywordsSave(product: Product, value: string) {
    const nextValue = value.trim();
    const currentValue = String(product.search_keywords || "").trim();
    if (nextValue === currentValue) return;

    setUploadError("");
    try {
      await saveProductSearchKeywords(product, nextValue);
      await loadProducts();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Search keyword update failed");
    }
  }

  async function handleDetailFieldSave(product: Product, payload: Partial<Product>) {
    setUploadError("");
    try {
      await saveProductDetailFields(product, payload);
      await loadProducts();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Product detail update failed");
    }
  }

  async function handleGalleryReorder(product: Product, fromIndex: number, toIndex: number) {
    const images = [...(product.images || [])];
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= images.length || toIndex >= images.length) return;
    const [moved] = images.splice(fromIndex, 1);
    images.splice(toIndex, 0, moved);
    await handleDetailFieldSave(product, { images, image_url: images[0] || product.image_url, image: images[0] || product.image });
  }

  async function handleSpecSave(product: Product, previousKey: string, nextKey: string, nextValue: string) {
    const specs = { ...normalizeSpecifications(product.specifications) };
    delete specs[previousKey];
    if (nextKey.trim() && nextValue.trim()) {
      specs[nextKey.trim()] = nextValue.trim();
    }
    await handleDetailFieldSave(product, { specifications: specs });
  }

  async function handleFaqSave(product: Product, index: number, field: "question" | "answer", value: string) {
    const faqs = normalizeFaqs(product.faqs);
    faqs[index] = faqs[index] || { question: "", answer: "" };
    faqs[index][field] = value;
    await handleDetailFieldSave(product, { faqs: faqs.filter((faq) => faq.question.trim() || faq.answer.trim()) });
  }

  async function handleRelatedAdd(product: Product, relatedProductId: string) {
    if (!relatedProductId) return;
    const nextIds = Array.from(new Set([...(product.related_product_ids || []), relatedProductId])).filter((id) => id !== getProductId(product));
    await handleDetailFieldSave(product, { related_product_ids: nextIds });
  }

  async function handleRelatedRemove(product: Product, relatedProductId: string) {
    await handleDetailFieldSave(product, {
      related_product_ids: (product.related_product_ids || []).filter((id) => id !== relatedProductId)
    });
  }

  if (loading) {
    return <div>Loading products...</div>;
  }

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Products</h1>
      {uploadError ? (
        <p role="alert" style={{ color: "#b42318", marginBottom: 12 }}>
          {uploadError}
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Inventory</th>
            <th>Search Keywords</th>
            <th>Product Detail</th>
            <th>SEO</th>
            <th>Store Badges</th>
            <th>Visible</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const productId = getProductId(product);
            const currentImage = imagePreviewById[productId] || getProductImage(product);
            const isUploading = uploadingKey.startsWith(`${productId}:`);
            const specs = normalizeSpecifications(product.specifications);
            const faqs = normalizeFaqs(product.faqs);
            const relatedProducts = getRelatedProducts(product);
            const previewTitle = seoPreviewTitle(product);
            const previewDescription = seoDescription(product);

            return (
              <tr key={productId}>
                <td>
                  {currentImage ? (
                    <img
                      src={currentImage}
                      alt={getProductName(product)}
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb" }}
                    />
                  ) : (
                    <span>No image</span>
                  )}
                  {product.images?.length ? (
                    <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>{product.images.length} gallery images</div>
                  ) : null}
                </td>
                <td>{getProductName(product)}</td>
                <td>{product.sku}</td>
                <td>{product.price}</td>
                <td>
                  <div>
                    <strong>{getNumber(product.stock)}</strong> stock
                  </div>
                  <div style={{ fontSize: 12, color: "#667085" }}>
                    Reserved: {getNumber(product.reserved_stock)} / Available: {getAvailableStock(product)}
                  </div>
                  <span
                    style={{
                      ...statusStyle(getInventoryStatus(product)),
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    {statusLabel(getInventoryStatus(product))}
                  </span>
                </td>
                <td>
                  <textarea
                    defaultValue={product.search_keywords || ""}
                    onBlur={(event) => handleSearchKeywordsSave(product, event.target.value)}
                    placeholder="headphones, charger, baby care"
                    aria-label={`Search keywords for ${getProductName(product)}`}
                    rows={3}
                    style={{ minWidth: 180 }}
                  />
                </td>
                <td>
                  <details>
                    <summary>Gallery, specs, FAQs</summary>
                    <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
                      <label>
                        Brand
                        <input
                          defaultValue={product.brand || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { brand: event.target.value.trim() })}
                        />
                      </label>
                      <label>
                        Warranty
                        <input
                          defaultValue={product.warranty || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { warranty: event.target.value.trim() })}
                        />
                      </label>
                      <label>
                        Return Policy
                        <textarea
                          defaultValue={product.return_policy || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { return_policy: event.target.value.trim() })}
                          rows={2}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <label>
                          Min Days
                          <input
                            type="number"
                            min={0}
                            defaultValue={product.delivery_days_min ?? 2}
                            onBlur={(event) => {
                              const minDays = Math.max(0, Number(event.target.value) || 0);
                              handleDetailFieldSave(product, {
                                delivery_days_min: minDays,
                                delivery_days_max: Math.max(minDays, Number(product.delivery_days_max || 7))
                              });
                            }}
                            style={{ width: 90 }}
                          />
                        </label>
                        <label>
                          Max Days
                          <input
                            type="number"
                            min={0}
                            defaultValue={product.delivery_days_max ?? 7}
                            onBlur={(event) => handleDetailFieldSave(product, { delivery_days_max: Math.max(Number(product.delivery_days_min || 0), Number(event.target.value) || 0) })}
                            style={{ width: 90 }}
                          />
                        </label>
                      </div>

                      <strong>Gallery Order</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {(product.images || []).map((imageUrl, index) => (
                          <div
                            key={imageUrl}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleGalleryReorder(product, Number(event.dataTransfer.getData("text/plain")), index)}
                            style={{ border: "1px solid #d0d5dd", borderRadius: 6, padding: 4, width: 86 }}
                          >
                            <img src={imageUrl} alt="" style={{ width: 76, height: 58, objectFit: "cover", borderRadius: 4 }} />
                            <button type="button" onClick={() => handleDetailFieldSave(product, { image_url: imageUrl, image: imageUrl })}>Primary</button>
                            <button type="button" onClick={() => handleGalleryReorder(product, index, Math.max(0, index - 1))}>Up</button>
                            <button type="button" onClick={() => handleGalleryReorder(product, index, Math.min((product.images || []).length - 1, index + 1))}>Down</button>
                          </div>
                        ))}
                      </div>

                      <strong>Specifications</strong>
                      {Object.entries(specs).map(([key, value]) => (
                        <div key={key} style={{ display: "grid", gap: 4, gridTemplateColumns: "1fr 1fr auto" }}>
                          <input
                            defaultValue={key}
                            aria-label="Specification name"
                            onBlur={(event) => handleSpecSave(product, key, event.target.value, String(value || ""))}
                          />
                          <input
                            defaultValue={String(value || "")}
                            aria-label="Specification value"
                            onBlur={(event) => handleSpecSave(product, key, key, event.target.value)}
                          />
                          <button type="button" onClick={() => handleSpecSave(product, key, "", "")}>Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleDetailFieldSave(product, { specifications: { ...specs, "New Field": "" } })}>
                        Add Specification
                      </button>

                      <strong>FAQs</strong>
                      {faqs.map((faq, index) => (
                        <div key={`${faq.question}-${index}`} style={{ display: "grid", gap: 6 }}>
                          <input
                            defaultValue={faq.question}
                            placeholder="Question"
                            onBlur={(event) => handleFaqSave(product, index, "question", event.target.value)}
                          />
                          <textarea
                            defaultValue={faq.answer}
                            placeholder="Answer"
                            rows={2}
                            onBlur={(event) => handleFaqSave(product, index, "answer", event.target.value)}
                          />
                          <button type="button" onClick={() => handleDetailFieldSave(product, { faqs: faqs.filter((_, faqIndex) => faqIndex !== index) })}>
                            Remove FAQ
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => handleDetailFieldSave(product, { faqs: [...faqs, { question: "", answer: "" }] })}>
                        Add FAQ
                      </button>

                      <strong>Manual Related Products</strong>
                      <select defaultValue="" onChange={(event) => handleRelatedAdd(product, event.target.value)}>
                        <option value="">Select related product</option>
                        {products.filter((item) => getProductId(item) !== productId).map((item) => (
                          <option key={getProductId(item)} value={getProductId(item)}>{getProductName(item)}</option>
                        ))}
                      </select>
                      {relatedProducts.map((item) => (
                        <div key={getProductId(item)}>
                          {getProductName(item)}
                          <button type="button" onClick={() => handleRelatedRemove(product, getProductId(item))}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </details>
                </td>
                <td>
                  <details>
                    <summary>Slug & meta</summary>
                    <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
                      <label>
                        Product Slug
                        <input
                          defaultValue={product.slug || slugify(getProductName(product))}
                          onBlur={(event) => handleDetailFieldSave(product, { slug: slugify(event.target.value || getProductName(product)) })}
                          placeholder="wireless-earbuds"
                        />
                      </label>
                      <label>
                        Meta Title
                        <input
                          defaultValue={product.meta_title || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { meta_title: event.target.value.trim() })}
                          placeholder={`${getProductName(product)} - Radios`}
                        />
                        {seoTitleWarning(previewTitle) ? <small style={{ color: "#b54708" }}>{seoTitleWarning(previewTitle)}</small> : null}
                      </label>
                      <label>
                        Meta Description
                        <textarea
                          defaultValue={product.meta_description || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { meta_description: event.target.value.trim() })}
                          placeholder="Short search result description"
                          rows={3}
                        />
                        {seoDescriptionWarning(previewDescription) ? <small style={{ color: "#b54708" }}>{seoDescriptionWarning(previewDescription)}</small> : null}
                      </label>
                      <label>
                        Canonical URL
                        <input
                          defaultValue={product.canonical_url || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { canonical_url: event.target.value.trim() })}
                          placeholder={getStoreUrl(product)}
                        />
                      </label>
                      <label>
                        OpenGraph Image URL
                        <input
                          defaultValue={product.og_image_url || ""}
                          onBlur={(event) => handleDetailFieldSave(product, { og_image_url: event.target.value.trim() })}
                          placeholder={getProductImage(product)}
                        />
                      </label>
                      <div style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: 10, background: "#fff" }}>
                        <strong style={{ display: "block", color: "#1a0dab" }}>{previewTitle}</strong>
                        <span style={{ color: "#067647", fontSize: 12 }}>{getStoreUrl(product)}</span>
                        <p style={{ margin: "4px 0 0", color: "#475467" }}>{previewDescription}</p>
                      </div>
                    </div>
                  </details>
                </td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {getStorefrontBadges(product).length ? (
                      getStorefrontBadges(product).map((badge) => (
                        <span
                          key={badge}
                          style={{
                            ...badgeStyle(badge),
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          {badge}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#667085", fontSize: 12 }}>No merchandising badges</span>
                    )}
                  </div>
                  {[
                    ["is_hot", "Hot"],
                    ["is_best_seller", "Most selling"],
                    ["is_new", "New"],
                    ["is_featured", "Featured"]
                  ].map(([field, label]) => {
                    const active = activeBadgeFlags(product)[field as "is_hot" | "is_best_seller" | "is_new" | "is_featured"];
                    return (
                      <button
                        key={field}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleBadgeToggle(product, field as "is_hot" | "is_best_seller" | "is_new" | "is_featured")}
                        disabled={isUploading}
                        style={{
                          marginRight: 6,
                          marginBottom: 6,
                          border: active ? "1px solid #175cd3" : "1px solid #d0d5dd",
                          background: active ? "#eff8ff" : "#fff",
                          color: active ? "#175cd3" : "#344054",
                          borderRadius: 6,
                          padding: "4px 8px"
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </td>
                <td>{product.visible ? "Yes" : "No"}</td>
                <td>
                  <button onClick={() => handleToggle(product)} disabled={isUploading}>Toggle Visibility</button>
                  <button onClick={() => handleDuplicate(product)} disabled={isUploading}>Duplicate</button>
                  <button onClick={() => handleDelete(productId)} disabled={isUploading}>Delete</button>
                  <label style={{ display: "inline-block", marginRight: 8, cursor: isUploading ? "wait" : "pointer" }}>
                    {uploadingKey === `${productId}:main` ? "Uploading..." : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => handleMainImageChange(product, event)}
                      disabled={isUploading}
                      style={{ display: "none" }}
                    />
                  </label>
                  <label style={{ display: "inline-block", marginRight: 8, cursor: isUploading ? "wait" : "pointer" }}>
                    {uploadingKey === `${productId}:gallery` ? "Uploading..." : "Add gallery"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => handleGalleryChange(product, event)}
                      disabled={isUploading}
                      style={{ display: "none" }}
                    />
                  </label>
                  {(product.images || []).slice(0, 3).map((imageUrl, index) => (
                    <button key={imageUrl} onClick={() => handleRemoveGalleryImage(product, imageUrl)} disabled={isUploading}>
                      Remove gallery {index + 1}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={stockAdjustments[productId] || ""}
                    onChange={(event) => setStockAdjustments((current) => ({ ...current, [productId]: event.target.value }))}
                    placeholder="+/- stock"
                    aria-label={`Adjust stock for ${getProductName(product)}`}
                    style={{ width: 90 }}
                  />
                  <button onClick={() => handleStockAdjust(product)} disabled={isUploading || !stockAdjustments[productId]}>
                    Update Stock
                  </button>
                  <a href={getStoreUrl(product)} target="_blank" rel="noreferrer">
                    View on Store
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AdminGuard>
  );
}
