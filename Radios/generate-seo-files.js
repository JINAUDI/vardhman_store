#!/usr/bin/env node
/* Generate sitemap.xml and robots.txt from the live Supabase catalog. */

const fs = require("fs");
const path = require("path");

const radiosRoot = __dirname;

function readSupabaseConfig() {
  const configPath = path.join(radiosRoot, "assets", "js", "supabase-config.js");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const source = fs.readFileSync(configPath, "utf8");
  const urlMatch = source.match(/RADIOS_SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = source.match(/RADIOS_SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
  return {
    url: urlMatch ? urlMatch[1] : "",
    anonKey: keyMatch ? keyMatch[1] : ""
  };
}

function trimSlashes(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isActiveRecord(record) {
  const status = String(record && record.status || "").toLowerCase();
  return record &&
    record.visible !== false &&
    record.is_visible !== false &&
    record.is_active !== false &&
    record.active !== false &&
    !["draft", "hidden", "archived", "inactive", "unpublished", "disabled", "deleted"].includes(status);
}

function lastModified(record) {
  const value = record.updated_at || record.created_at || new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

async function supabaseFetch(config, table, select) {
  const url = `${trimSlashes(config.url)}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  const response = await fetch(url, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`${table} fetch failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function buildUrl(siteUrl, loc, lastmod, priority) {
  return [
    "  <url>",
    `    <loc>${escapeXml(`${trimSlashes(siteUrl)}/${String(loc || "").replace(/^\/+/g, "")}`)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    "    <changefreq>daily</changefreq>",
    `    <priority>${priority}</priority>`,
    "  </url>"
  ].join("\n");
}

async function main() {
  const configFile = readSupabaseConfig();
  const config = {
    url: process.env.RADIOS_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || configFile.url,
    anonKey: process.env.RADIOS_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || configFile.anonKey
  };
  const siteUrl = trimSlashes(
    process.env.RADIOS_SITE_URL ||
    process.env.NEXT_PUBLIC_RADIOS_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STORE_URL ||
    "https://radios.example"
  );

  if (!config.url || !config.anonKey) {
    throw new Error("Missing Supabase URL or anon key.");
  }

  const [products, categories] = await Promise.all([
    supabaseFetch(config, "products", "id,title,name,slug,visible,is_active,status,updated_at,created_at"),
    supabaseFetch(config, "categories", "id,name,slug,is_active,visible,status,sort_order,updated_at,created_at")
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    buildUrl(siteUrl, "index.html", today, "1.0"),
    buildUrl(siteUrl, "shop-left-sidebar.html", today, "0.8"),
    buildUrl(siteUrl, "about.html", today, "0.5"),
    buildUrl(siteUrl, "contact.html", today, "0.5")
  ];

  categories
    .filter(isActiveRecord)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
    .forEach((category) => {
      const slug = category.slug || slugify(category.name || category.id);
      if (slug) {
        urls.push(buildUrl(siteUrl, `category.html?slug=${encodeURIComponent(slug)}`, lastModified(category), "0.7"));
      }
    });

  products
    .filter(isActiveRecord)
    .forEach((product) => {
      const slug = product.slug || slugify(product.title || product.name || product.id);
      const identifier = slug
        ? `shop-single.html?slug=${encodeURIComponent(slug)}`
        : `shop-single.html?id=${encodeURIComponent(product.id)}`;
      urls.push(buildUrl(siteUrl, identifier, lastModified(product), "0.9"));
    });

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    ""
  ].join("\n");

  fs.writeFileSync(path.join(radiosRoot, "sitemap.xml"), sitemap, "utf8");
  fs.writeFileSync(path.join(radiosRoot, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, "utf8");
  console.log(`Generated ${urls.length} sitemap URLs for ${siteUrl}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
