/**
 * Supabase Products Table Setup Script
 *
 * Creates the products table with the schema expected by the app,
 * enables RLS with appropriate policies, and inserts sample data.
 *
 * Run: node setup-supabase.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jonnadaoxbpicvmdumuo.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvbm5hZGFveGJwaWN2bWR1bXVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2MDk3MCwiZXhwIjoyMDkyOTM2OTcwfQ.zwI2uwouusRtSHJzVZe7YI14W0hUGxk85WkOnRqq1-4";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Step 1: Check if table exists by trying to query it
async function checkTable() {
  console.log("Checking if products table exists...");
  const { data, error } = await supabase.from("products").select("id").limit(1);

  if (error) {
    if (
      error.code === "PGRST204" ||
      error.code === "42P01" ||
      error.message?.includes("products") ||
      error.code === "PGRST205"
    ) {
      console.log("Products table does NOT exist. It needs to be created via Supabase Dashboard.");
      return false;
    }
    console.log("Query error:", error.code, error.message);
    return false;
  }

  console.log("Products table EXISTS. Current rows:", data?.length ?? 0);
  return true;
}

// Step 2: Insert sample products
async function insertSampleProducts() {
  console.log("\nInserting sample products...");

  const sampleProducts = [
    {
      name: "Wireless Earbuds Pro",
      description:
        "Premium wireless earbuds with active noise cancellation, 36-hour battery life, and crystal-clear audio. IPX5 water resistant.",
      price: 1999,
      compare_at_price: 2999,
      sku: "SKU-EARBUDS-001",
      stock: 25,
      category: "Electronics",
      image: "/images/all-img/p-1.png",
      visible: true,
      featured: true,
      status: "active",
      low_stock_threshold: 5,
      tags: ["audio", "wireless", "electronics"],
      slug: "wireless-earbuds-pro",
    },
    {
      name: "Organic Protein Powder",
      description:
        "Plant-based organic protein powder with 25g protein per serving. Available in chocolate and vanilla flavors.",
      price: 2499,
      compare_at_price: 3499,
      sku: "SKU-PROTEIN-002",
      stock: 15,
      category: "Health & Beauty",
      image: "/images/all-img/p-2.png",
      visible: true,
      featured: false,
      status: "active",
      low_stock_threshold: 5,
      tags: ["health", "protein", "organic"],
      slug: "organic-protein-powder",
    },
    {
      name: "Professional Hair Dryer",
      description:
        "Ionic hair dryer with 3 heat settings, cool shot button, and ceramic tourmaline technology for frizz-free styling.",
      price: 1499,
      compare_at_price: 1999,
      sku: "SKU-HAIRDRYER-003",
      stock: 10,
      category: "Health & Beauty",
      image: "/images/all-img/p-3.png",
      visible: true,
      featured: false,
      status: "active",
      low_stock_threshold: 3,
      tags: ["beauty", "hair", "styling"],
      slug: "professional-hair-dryer",
    },
    {
      name: "Smart Watch Ultra",
      description:
        "Advanced fitness tracker with AMOLED display, heart rate monitor, SpO2 sensor, and 7-day battery life.",
      price: 4999,
      compare_at_price: 6999,
      sku: "SKU-WATCH-004",
      stock: 20,
      category: "Electronics",
      image: "/images/all-img/p-4.png",
      visible: true,
      featured: true,
      status: "active",
      low_stock_threshold: 5,
      tags: ["wearable", "fitness", "smartwatch"],
      slug: "smart-watch-ultra",
    },
    {
      name: "Handmade Ceramic Mug Set",
      description:
        "Set of 4 artisan ceramic mugs, each uniquely handcrafted. Dishwasher and microwave safe. 350ml capacity.",
      price: 899,
      compare_at_price: null,
      sku: "SKU-MUG-005",
      stock: 30,
      category: "Home & Garden",
      image: "/images/all-img/p-5.png",
      visible: true,
      featured: false,
      status: "active",
      low_stock_threshold: 10,
      tags: ["home", "kitchen", "handmade"],
      slug: "handmade-ceramic-mug-set",
    },
  ];

  const { data, error } = await supabase
    .from("products")
    .insert(sampleProducts)
    .select();

  if (error) {
    console.error("Insert error:", error.code, error.message);
    return;
  }

  console.log(`Successfully inserted ${data.length} sample products!`);
  data.forEach((p) => console.log(`  - ${p.name} (${p.id})`));
}

// Step 3: Verify
async function verifyProducts() {
  console.log("\nVerifying products...");
  const { data, error, count } = await supabase
    .from("products")
    .select("id, name, price, category, visible, stock", { count: "exact" });

  if (error) {
    console.error("Verify error:", error.code, error.message);
    return;
  }

  console.log(`Total products in table: ${count}`);
  if (data) {
    data.forEach((p) =>
      console.log(
        `  [${p.visible ? "✓" : "✗"}] ${p.name} — ₹${p.price} — ${p.category} — stock: ${p.stock}`
      )
    );
  }
}

// Main
async function main() {
  console.log("=== Supabase Products Table Setup ===\n");
  console.log("Project:", SUPABASE_URL);
  console.log("");

  const exists = await checkTable();

  if (!exists) {
    console.log("\n========================================");
    console.log("ACTION REQUIRED: Create the products table");
    console.log("========================================");
    console.log("\nGo to your Supabase Dashboard:");
    console.log("  https://supabase.com/dashboard/project/jonnadaoxbpicvmdumuo/sql");
    console.log("\nPaste and run this SQL:\n");
    console.log(`
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create products table
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text,
  description text default '',
  price numeric not null default 0,
  compare_at_price numeric,
  sku text default '',
  stock integer default 0,
  low_stock_threshold integer default 10,
  category text default 'General',
  tags text[] default '{}',
  image text default '/images/all-img/p-1.png',
  images text[],
  visible boolean default true,
  featured boolean default false,
  status text default 'active' check (status in ('active', 'draft', 'archived')),
  meta_title text,
  meta_description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.products enable row level security;

-- Allow public read access
create policy "Allow public read access"
  on public.products
  for select
  using (true);

-- Allow service role full access
create policy "Allow service role full access"
  on public.products
  for all
  using (true)
  with check (true);
`);
    console.log("\nAfter creating the table, run this script again to insert sample data.");
    return;
  }

  // Table exists — check if it has data
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  if (count === 0) {
    await insertSampleProducts();
  } else {
    console.log(`Table already has ${count} products. Skipping sample data insert.`);
  }

  await verifyProducts();
  console.log("\n✅ Setup complete! Your products table is ready.");
}

main().catch(console.error);
