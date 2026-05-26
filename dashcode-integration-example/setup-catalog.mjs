/**
 * Supabase catalog setup helper.
 *
 * This script verifies whether the categories, homepage_banners, collections,
 * and discounts tables
 * exist and prints the SQL file to run when they do not. Supabase's REST API
 * cannot create tables, so DDL still needs to be run in the Supabase SQL editor.
 *
 * Run: node setup-catalog.mjs
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const schemaPath = path.join(process.cwd(), "supabase-catalog-schema.sql");

if (!url || !key) {
  console.error("Supabase environment variables are missing.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function tableExists(tableName) {
  const { error } = await supabase.from(tableName).select("id").limit(1);
  return !error;
}

async function main() {
  console.log("Checking Supabase catalog tables...");

  const checks = [
    ["categories", await tableExists("categories")],
    ["homepage_banners", await tableExists("homepage_banners")],
    ["collections", await tableExists("collections")],
    ["discounts", await tableExists("discounts")],
  ];

  checks.forEach(([name, ready]) => {
    console.log(`${name}: ${ready ? "ready" : "missing"}`);
  });

  if (checks.every(([, ready]) => ready)) {
    console.log("Catalog tables are ready.");
    return;
  }

  console.log("");
  console.log("Run this SQL in Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard/project/jonnadaoxbpicvmdumuo/sql");
  console.log("");
  console.log(fs.readFileSync(schemaPath, "utf8"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
