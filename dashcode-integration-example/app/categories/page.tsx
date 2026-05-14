"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import { getCategories, updateCategorySeo, type CategoryRow, type CategorySeoPayload } from "../../lib/categories";

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryName(category: CategoryRow) {
  return category.name || "Category";
}

function seoTitle(category: CategoryRow) {
  return category.meta_title || `${categoryName(category)} - Radios`;
}

function seoDescription(category: CategoryRow) {
  return category.meta_description || category.description || `Browse ${categoryName(category)} products from Radios.`;
}

function titleWarning(value: string) {
  return value.length > 60 ? "Meta title is longer than 60 characters." : "";
}

function descriptionWarning(value: string) {
  return value.length > 155 ? "Meta description is longer than 155 characters." : "";
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const storeBaseUrl =
    process.env.NEXT_PUBLIC_RADIOS_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STORE_URL ||
    "http://127.0.0.1:5500/Radios";

  function getCategoryUrl(category: CategoryRow) {
    const baseUrl = storeBaseUrl.trim().replace(/\/+$/g, "");
    const slug = category.slug || slugify(categoryName(category));
    return `${baseUrl}/category.html?slug=${encodeURIComponent(slug)}`;
  }

  async function loadCategories() {
    setLoading(true);
    try {
      setCategories(await getCategories());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load categories.");
      setLoading(false);
    });
  }, []);

  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((category) => {
      const haystack = [category.name, category.slug, category.description, category.meta_title, category.meta_description]
        .join(" ")
        .toLowerCase();
      return !term || haystack.includes(term);
    });
  }, [categories, search]);

  async function saveCategory(category: CategoryRow, payload: Partial<CategorySeoPayload>) {
    try {
      setMessage("Saving category SEO...");
      const updated = await updateCategorySeo(category.id, payload);
      setCategories((current) => current.map((item) => (item.id === category.id ? { ...item, ...updated } : item)));
      setMessage("Category SEO saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save category SEO.");
    }
  }

  if (loading) {
    return <div>Loading categories...</div>;
  }

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Categories</h1>
      <p>Edit category slugs and search preview metadata used by the Radios storefront.</p>
      {message ? <p role="status">{message}</p> : null}
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search categories"
        aria-label="Search categories"
        style={{ marginBottom: 16, maxWidth: 320 }}
      />
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Status</th>
            <th>SEO</th>
            <th>Preview</th>
            <th>Store</th>
          </tr>
        </thead>
        <tbody>
          {visibleCategories.map((category) => {
            const previewTitle = seoTitle(category);
            const previewDescription = seoDescription(category);
            return (
              <tr key={category.id}>
                <td>
                  <strong>{categoryName(category)}</strong>
                  <div style={{ color: "#667085", fontSize: 12 }}>{category.description || "No description"}</div>
                </td>
                <td>{category.is_active === false ? "Inactive" : "Active"}</td>
                <td>
                  <div style={{ display: "grid", gap: 10, minWidth: 280 }}>
                    <label>
                      Slug
                      <input
                        defaultValue={category.slug || slugify(categoryName(category))}
                        onBlur={(event) => saveCategory(category, { slug: slugify(event.target.value || categoryName(category)) })}
                      />
                    </label>
                    <label>
                      Meta Title
                      <input
                        defaultValue={category.meta_title || ""}
                        onBlur={(event) => saveCategory(category, { meta_title: event.target.value.trim() })}
                        placeholder={`${categoryName(category)} - Radios`}
                      />
                      {titleWarning(previewTitle) ? <small style={{ color: "#b54708" }}>{titleWarning(previewTitle)}</small> : null}
                    </label>
                    <label>
                      Meta Description
                      <textarea
                        defaultValue={category.meta_description || ""}
                        onBlur={(event) => saveCategory(category, { meta_description: event.target.value.trim() })}
                        rows={3}
                      />
                      {descriptionWarning(previewDescription) ? <small style={{ color: "#b54708" }}>{descriptionWarning(previewDescription)}</small> : null}
                    </label>
                    <label>
                      Canonical URL
                      <input
                        defaultValue={category.canonical_url || ""}
                        onBlur={(event) => saveCategory(category, { canonical_url: event.target.value.trim() })}
                        placeholder={getCategoryUrl(category)}
                      />
                    </label>
                    <label>
                      OpenGraph Image URL
                      <input
                        defaultValue={category.og_image_url || ""}
                        onBlur={(event) => saveCategory(category, { og_image_url: event.target.value.trim() })}
                      />
                    </label>
                  </div>
                </td>
                <td>
                  <div style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: 10, background: "#fff", maxWidth: 360 }}>
                    <strong style={{ display: "block", color: "#1a0dab" }}>{previewTitle}</strong>
                    <span style={{ color: "#067647", fontSize: 12 }}>{getCategoryUrl(category)}</span>
                    <p style={{ margin: "4px 0 0", color: "#475467" }}>{previewDescription}</p>
                  </div>
                </td>
                <td>
                  <a href={getCategoryUrl(category)} target="_blank" rel="noreferrer">
                    View Category
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
