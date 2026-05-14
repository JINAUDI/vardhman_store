# Vardhman Store Admin Panel

This folder is a standalone Next.js admin dashboard for the Vardhman Store ecommerce project. It can be deployed directly to Vercel from the same GitHub repository as the storefront.

## Vercel deployment

Create a new Vercel project from `JINAUDI/vardhman_store` and use these settings:

- Root Directory: `dashcode-integration-example`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave blank

Recommended project/domain split:

- Storefront project root: `Radios`
- Admin project root: `dashcode-integration-example`
- Storefront domain: `vardhmanstore.com`
- Admin domain: `admin.vardhmanstore.com`

## Expected env

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-host.example.com/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_RADIOS_STOREFRONT_URL=https://your-storefront-domain.example.com
NEXT_PUBLIC_STOREFRONT_PRODUCT_ROUTE=shop-single.html
```

`NEXT_PUBLIC_API_BASE_URL` must point to the deployed Express/API service. The storefront URL is used by admin actions such as "view product on store".

## What is included

- Product list loading from the shared API with Supabase inventory fields merged into the table
- Create / update / delete handlers
- Visibility toggle handler
- Order list loading
- Wishlist analytics loading from Supabase
- Supabase Auth admin login at `/auth/login`
- Admin route guard that checks `public.admin_users`
- Role gates for admin, manager, and staff permissions
- Supabase Storage upload helpers for product, banner, and category images
- Product image and gallery upload controls that save `image_url` and `images`
- Product detail content controls for gallery ordering, specifications, FAQs, delivery windows, warranty, returns, brand, and manual related products
- Inventory page at `/inventory` for stock, reserved stock, low stock filters, thresholds, backorder toggles, and inventory logs
- Product table inventory display for stock, reserved stock, available stock, status, manual stock adjustment, and realtime refresh from `public.products`
- Product table storefront badge toggles for Hot, Most selling, New, and Featured labels consumed by the Radios storefront
- Order status restore hook that calls Supabase inventory restoration when an order is cancelled/refunded/returned
- Reviews moderation page at `/reviews` for pending, approved, rejected, verified purchase, and rating filters
- Review approval, rejection, deletion, image preview, admin notes, and approved-rating statistics
- Search analytics page at `/search-analytics` for most searched queries, zero-result searches, clicked products, conversion hints, and frequently searched products
- Product table `search_keywords` editing so admins can improve storefront search matches without changing product titles
- Discounts and promotions page at `/promotions` for coupon codes, automatic offers, category/product rules, first-order offers, combo offers, free shipping, usage limits, date windows, active toggles, and redemption history
- Business analytics page at `/analytics` and `/en/ecommerce/backend/analytics` for revenue, orders, conversion funnel, abandoned carts, retention, wishlist, and sales trend reporting from Supabase

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build check

```bash
npm run build
```

The build should complete before connecting or redeploying the Vercel admin project.

## Admin auth setup

Create the admin as a Supabase Auth user first, then insert that user's UID into `public.admin_users`.
The dashboard guard allows only rows where `auth_user_id` matches the current Supabase Auth user and `is_active = true`.

## Storage setup

Run `../supabase-storage-safe.sql` in the Supabase SQL editor. It creates the public `product-images`, `banner-images`, and `category-images` buckets, adds image URL columns when the matching tables exist, and allows only active `admin` or `manager` users from `public.admin_users` to upload, update, or delete objects.

The product page uploads the main product image to `product-images` and stores the public URL in `products.image_url`. Multiple gallery uploads are stored in `products.images`.

## Inventory setup

Run `../supabase-inventory-safe.sql` in the Supabase SQL editor. It adds stock reservations, inventory logs, product inventory fields, status triggers, and RPC functions used by Radios checkout and the Dashcode inventory page.

## Storefront badge setup

Run `../supabase-storefront-badges.sql` if badge flags should be stored in Supabase. The Radios storefront reads those fields from Dashcode `/api/products` when available and falls back to the same Supabase `public.products` rows directly.

## Reviews setup

Run `../supabase-reviews-safe.sql` in the Supabase SQL editor. It creates the review moderation schema, the public `review-images` bucket, verified purchase insert policies, admin moderation policies, and the helper functions used by the Radios storefront review form.

## Smart search setup

Run `../supabase-smart-search-safe.sql` in the Supabase SQL editor. It adds product search keywords, a weighted search vector, typo-tolerant `search_products` RPC, search event tracking, trending search RPC, and admin policies for Dashcode search analytics.

## Product detail setup

Run `../supabase-product-detail-safe.sql` in the Supabase SQL editor. It adds gallery, specification, FAQ, delivery estimate, warranty, return policy, brand, and related product fields consumed by `shop-single.html` and editable from the Dashcode product table.

## Promotions setup

Run `../supabase-promotions-safe.sql` in the Supabase SQL editor. It extends `public.discounts`, adds `public.discount_redemptions`, adds order promotion columns, creates the `validate_discount` and `finalize_discount_redemption` RPCs used by checkout, and protects discount management behind active Dashcode admin users.

## Analytics setup

Run `../supabase-analytics-dashboard-safe.sql` in the Supabase SQL editor. It creates `public.analytics_events`, adds storefront insert policies, admin read policies, event indexes, and reporting views for daily revenue, top products, wishlist products, conversion funnel, and customer retention.
