# Radios Ecommerce Website - QA Testing Guide

Prepared for: Testing Team  
Prepared by: Development Team  
Project package: `radios-html-package`  
Prepared on: 14 May 2026  
Scope: Customer storefront, customer account area, Dashcode admin panel, backend APIs, and Supabase data integrations

## 1. Purpose

This document defines the functional testing scope for the Radios ecommerce website. It is intended to help the QA team test the customer-facing storefront and the admin panel in a structured, page-wise manner.

The document focuses on:

- Customer shopping journey from browsing to checkout.
- Customer account, order tracking, wishlist, reviews, returns, and notifications.
- Admin dashboard functions, with detailed coverage for catalog, inventory, promotions, reviews, analytics, and order management.
- Backend API and Supabase integration points that must be verified during end-to-end testing.
- Regression areas that can be impacted when product, stock, promotion, order, or account data changes.

## 2. Application Scope

### 2.1 Customer Storefront

Source folder: `Radios`

The storefront is a static HTML/CSS/JavaScript ecommerce website connected to:

- Shared Express API for catalog and orders.
- Supabase for auth, categories, products, wishlist, reviews, inventory, promotions, analytics, customer accounts, and tracking data.
- Browser local storage/session storage for cart, customer details, applied discount code, wishlist fallback, tracking helpers, analytics session IDs, and API base URL.

### 2.2 Admin Panel

Source folder: `dashcode-integration-example`

The admin panel is a Next.js/Dashcode integration sample. It includes admin login, admin route protection, role gates, product management, category SEO, order status updates, inventory control, promotion management, review moderation, wishlist insights, search analytics, and business analytics.

### 2.3 Backend API

Source folder: `backend`

The backend is an Express API using MongoDB/Mongoose models for products, orders, collections, and discounts. It exposes catalog/order endpoints consumed by storefront and admin integrations.

### 2.4 Supabase SQL Setup

Root SQL scripts define Supabase tables, policies, storage buckets, RPC functions, analytics views, inventory logic, review moderation, search tracking, promotions, SEO, and customer account support.

Important setup scripts include:

- `supabase-final-safe-schema.sql`
- `supabase-auth-safe.sql`
- `supabase-customer-accounts-safe.sql`
- `supabase-inventory-safe.sql`
- `supabase-promotions-safe.sql`
- `supabase-reviews-safe.sql`
- `supabase-smart-search-safe.sql`
- `supabase-analytics-dashboard-safe.sql`
- `supabase-storage-safe.sql`
- `supabase-seo-safe.sql`

## 3. QA Test Approach

QA should test the system in four layers:

1. Page-level functional testing: verify each page works independently.
2. Journey testing: verify complete business flows across multiple pages.
3. Admin-to-storefront testing: verify admin changes are visible and correct on the storefront.
4. Data/API testing: verify API validation, Supabase policies, RPC behavior, and persistence.

Recommended browsers:

- Chrome latest
- Edge latest
- Firefox latest
- Safari where available
- Mobile viewport testing for 360px, 390px, 768px, 1024px, and desktop widths

Recommended test account types:

- Guest user
- Registered customer
- Admin user
- Manager user
- Staff user
- Inactive admin user
- User without admin row

## 4. Common Storefront Functions To Test On All Pages

These checks apply to most customer-facing pages:

- Header logo navigation opens home page.
- Desktop and mobile navigation menus work.
- Header category links route to correct category pages.
- Header search submits to product listing or category page.
- Smart search opens suggestions, trending searches, loading state, empty state, and keyboard navigation.
- Account icon reflects signed-in/signed-out user state.
- Wishlist icon/count updates correctly.
- Mini cart count and cart data persist after refresh.
- Footer links open correct pages.
- Newsletter/contact footer forms do not break page behavior.
- Cookie banner accept state works.
- Images load with fallback behavior when the image URL is missing or broken.
- Responsive layout does not overlap or hide controls.
- Console should not show critical JavaScript errors.

## 5. Customer Storefront Page-Wise Scope

### 5.1 Home Page - `index.html`

Purpose: Primary storefront landing page and product discovery entry point.

Main functions:

- Dynamic product sections for new arrivals, trending, featured, and deals.
- Homepage category and banner content.
- Dynamic hero/banner support from Supabase.
- Product cards with image, price, badges, stock messaging, wishlist, and add-to-cart actions.
- Header smart search and category navigation.

Testing focus:

- Page loads without broken sections.
- Product sections populate from live catalog data when APIs are available.
- Empty/error product states are readable when APIs fail.
- Product cards navigate to `shop-single.html` using product ID or slug.
- Add-to-cart updates mini cart and cart page.
- Wishlist toggle works for guest and signed-in users.
- Product badges such as Hot, Most selling, New, Featured, Low Stock, and Out of Stock display correctly.
- Homepage banners are clickable and responsive.

### 5.2 Product Listing Page - `shop-left-sidebar.html`

Purpose: Full catalog listing and product search/filter page.

Main functions:

- Dynamic product loading with pagination.
- Search query support through URL parameter `search`.
- Category and collection filtering.
- Price range filtering.
- Sort dropdown support.
- Sidebar search.
- Product cards with wishlist, add-to-cart, badges, ratings, and stock status.

Testing focus:

- Product list loads correct page size for desktop and mobile.
- Search returns matching products and tracks search events.
- Minimum search length behavior is respected.
- Empty search results show a proper empty state.
- Category links filter or route correctly.
- Price filter updates visible products.
- Pagination next/previous page behavior works.
- Sorting changes listing order.
- Hidden products are not shown to customers.
- Out-of-stock products cannot be purchased unless backorder is allowed.

### 5.3 Dynamic Category Page - `category.html`

Purpose: Single reusable category page using `slug` query parameter.

Main functions:

- Loads category metadata by slug.
- Applies dynamic title, breadcrumb, SEO, description, and products.
- Supports category-specific product listing, filters, search, sort, and pagination.

Testing focus:

- URLs such as `category.html?slug=electronics` load the correct category.
- Missing/invalid slug shows a useful empty state.
- Category metadata and product count match source data.
- Product filters only affect products in that category.
- SEO fields from admin category page appear in page metadata where applicable.

### 5.4 Static Category Pages

Files:

- `category-electronics.html`
- `category-mobile-accessories.html`
- `category-health-supplements.html`
- `category-hygiene-personal-care.html`
- `category-baby-products.html`
- `category-household-items.html`

Purpose: Legacy/static category entry pages mapped to the dynamic category logic.

Main functions:

- Category-specific page shell.
- Listing sort, sidebar search, category filter, and price filter.
- Static category links are normalized to dynamic category URLs.

Testing focus:

- Each static page opens without layout break.
- Category products match the expected category.
- Static category links redirect/normalize correctly.
- Sidebar filters and sort work consistently across all static category pages.

### 5.5 Product Detail Page - `shop-single.html`

Purpose: Product details, buying controls, product reviews, and related products.

Main functions:

- Loads product by `id`, `_id`, `productId`, or `slug`.
- Displays image gallery and primary image.
- Shows name, price, compare-at price/SKU, description, category, tags, stock message, delivery estimate, warranty, return policy, brand, specs, FAQs, promotions, and badges.
- Add-to-cart with quantity controls.
- Wishlist toggle.
- Social share links.
- Product reviews section with approved reviews.
- Verified buyer review submission.
- Related products and recently viewed products.
- SEO metadata application.

Testing focus:

- Product loads correctly by ID and slug.
- Missing product shows "Product not found" or unavailable state.
- Gallery thumbnails, primary image, and gallery ordering are correct.
- Quantity controls prevent invalid quantity.
- Add-to-cart respects stock and backorder rules.
- Wishlist toggle state persists.
- Product specs, FAQs, warranty, return policy, brand, related products, and delivery days reflect admin changes.
- Approved reviews display; pending/rejected reviews do not display.
- Only signed-in verified buyers with delivered orders can submit reviews.
- Review image upload accepts JPG, PNG, WebP, max 3 files, max 3 MB each.
- Duplicate review for same delivered order is blocked.

### 5.6 Cart Page - `cart.html`

Purpose: Customer cart review and coupon application.

Main functions:

- Reads cart from browser storage.
- Displays cart items, price, quantity, subtotal, delivery, discount, and total.
- Supports item removal.
- Supports quantity increase/decrease and direct quantity input.
- Validates cart stock.
- Applies coupon code and automatic discounts.
- Shows disabled checkout state when inventory validation fails.

Testing focus:

- Empty cart state appears when cart has no items.
- Cart persists after page refresh.
- Quantity changes update subtotal and total.
- Quantity below 1 is blocked/normalized.
- Removing one item does not remove other items.
- Discount code success, invalid code, expired code, usage limit, minimum order, product/category scope, free shipping, buy-x-get-y, and automatic discount scenarios work.
- Checkout button is disabled or blocked when stock validation fails.

### 5.7 Checkout Page - `checkout.html`

Purpose: Billing details and order placement.

Main functions:

- Loads cart review table.
- Prefills billing fields from stored customer details.
- Supports coupon application.
- Calculates subtotal, discount, delivery charge, and total.
- Creates order through dashboard/backend API.
- Clears cart and discount code after successful order.
- Redirects to order/account flow after success.

Testing focus:

- Required customer fields are validated: first name, last name, email, phone, address line 1, city, state, country, and PIN/zip code.
- Stored customer values prefill correctly.
- Coupon total matches cart page.
- Payment method is submitted as cash on delivery.
- Successful order generates order ID and deducts/reserves stock as expected.
- Cart is cleared after order.
- Failed API response shows user-friendly error and cart remains intact.

### 5.8 Order Success Page - `order-success.html`

Purpose: Confirmation page after order placement.

Testing focus:

- Confirmation content is visible.
- Links to order tracking, orders, or storefront work.
- Page handles missing order context gracefully.

### 5.9 Account Login and Signup - `account.html`

Purpose: Customer authentication and account entry point.

Main functions:

- Login tab.
- Signup tab.
- Required field validation.
- Email format validation.
- Password length validation.
- Confirm password validation.
- Show/hide password controls.
- Supabase email/password login.
- Supabase email/password signup.
- Google OAuth login.
- Signed-in account panel.
- Sign out.
- Redirect parameter handling.

Testing focus:

- Empty required fields show proper errors.
- Invalid email shows proper error.
- Wrong login credentials show normalized message.
- Email-not-confirmed message is handled.
- Signup with existing email shows correct error.
- Signup stores pending customer state when email verification is required.
- Google login starts OAuth flow.
- Redirects do not allow unsafe external URLs.
- Signed-in user sees account links and sign-out action.
- Header auth state updates after login/logout.

### 5.10 Forgot Password - `forgot-password.html`

Purpose: Request reset password email.

Main functions:

- Email validation.
- Supabase `resetPasswordForEmail`.
- Redirect target to `reset-password.html`.
- Success/error message display.

Testing focus:

- Empty email and invalid email validation.
- Valid email triggers reset request.
- Supabase/network error message is visible.
- Back-to-login link works.

### 5.11 Reset Password - `reset-password.html`

Purpose: Update account password after reset link.

Main functions:

- New password and confirm password fields.
- Required validation.
- Password match validation.
- Supabase `updateUser` password update.
- Redirect/account flow after success.

Testing focus:

- Empty password fields show errors.
- Mismatched passwords are blocked.
- Weak password is rejected by Supabase.
- Valid reset session updates password.
- Expired/invalid reset session shows meaningful error.

### 5.12 Account Dashboard - `account-dashboard.html`

Purpose: Signed-in customer summary page.

Main functions:

- Requires signed-in customer.
- Shows total orders, wishlist items, unread notifications, saved addresses, product reviews, and return requests.
- Shows latest order and tracking link.
- Loads customer profile and common account data from Supabase.

Testing focus:

- Unsigned users redirect to login.
- Counts match actual Supabase rows.
- Latest order link opens tracking page.
- Account navigation works on desktop and mobile.

### 5.13 Profile Page - `profile.html`

Purpose: Customer profile management.

Main functions:

- View and update full name and phone.
- Upload avatar to Supabase storage.
- Persist updated customer profile.
- Delete customer account through RPC.

Testing focus:

- Profile fields load from Supabase/customer storage.
- Save profile updates Supabase and local customer state.
- Avatar upload accepts valid image files.
- Avatar upload failure does not block text profile update.
- Delete account requires typing `DELETE` and final confirmation.
- Delete account signs out and removes customer-related records where configured.

### 5.14 Addresses Page - `addresses.html`

Purpose: Customer saved delivery addresses.

Main functions:

- List saved addresses.
- Add address.
- Edit address.
- Delete address.
- Set default address.
- Ensure one default address behavior through Supabase trigger.

Testing focus:

- Required address fields are enforced.
- First saved address becomes default.
- Setting a new default clears previous default.
- Editing address keeps correct row ID.
- Deleting default address handles remaining addresses correctly.
- Address list order shows default first.

### 5.15 My Orders Page - `my-orders.html`

Purpose: Customer order history and order cancellation.

Main functions:

- Requires signed-in customer.
- Loads orders from Supabase by auth user or email.
- Falls back to Express API by email if needed.
- Shows summary metrics: total, pending, delivered, cancelled, latest, and spend.
- Shows order cards with tracking link, status, payment, fulfillment, invoice, delivery address, total, and items.
- Allows cancellation for pending/confirmed/processing orders.

Testing focus:

- Unsigned users are redirected to login.
- Orders are filtered to signed-in customer only.
- Status labels match order data.
- Cancel button appears only for cancellable statuses.
- Cancellation prompt records reason.
- Cancelled order refreshes list and stock restore behavior is correct.
- Fallback API works if Supabase columns are unavailable.

### 5.16 Track Order Page - `track-order.html`

Purpose: Public/signed-in order tracking by tracking ID or order number.

Main functions:

- Tracking ID input.
- Loads order by `tracking_id` or `order_number`.
- Uses Supabase first, dashboard API fallback.
- Shows tracking status, order number, ETA, payment status, courier, customer, timeline, items, and total.
- Supports URL query parameter `tracking_id`.
- Checks whether signed-in customer owns the tracking ID where possible.

Testing focus:

- Empty tracking ID shows validation message.
- Valid tracking ID loads order.
- Invalid tracking ID shows no-order-found message.
- URL parameter auto-search works.
- Signed-in customer cannot view unrelated order when ownership data is available.
- Timeline reflects current lifecycle data.

### 5.17 Wishlist Page - `wishlist.html`

Purpose: Customer saved products.

Main functions:

- Shows wishlist items from Supabase or local fallback.
- Supports guest/session wishlist and signed-in wishlist.
- Migrates/syncs wishlist state where configured.
- Allows item removal.
- Links to product detail.
- Shows empty state.

Testing focus:

- Guest wishlist persists across refresh.
- Signed-in wishlist loads from Supabase.
- Wishlist toggle state is consistent on listing, detail, and wishlist pages.
- Removed item disappears from all pages after refresh.
- Empty wishlist state is correct.

### 5.18 My Reviews Page - `my-reviews.html`

Purpose: Customer review management from account area.

Main functions:

- Lists customer reviews.
- Shows review approval status.
- Allows customer to submit review for purchased products.
- Allows customer to delete own review.

Testing focus:

- Purchased product list is built from customer order items.
- New review inserts pending status.
- Review requires product, rating, title, and comment.
- Deleted review is removed from account and does not display on storefront.
- Approved/rejected status is visible to customer.

### 5.19 Returns Page - `returns.html`

Purpose: Customer return requests.

Main functions:

- Lists return requests.
- Allows return request for delivered orders.
- Inserts customer notification after return request.

Testing focus:

- Only delivered orders appear as return-eligible.
- Return reason is required.
- Submitted return appears in return list.
- Notification is created for the customer.
- Admin notes/status, if present, are displayed.

### 5.20 Customer Notifications Page - `customer-notifications.html`

Purpose: Customer account alerts and order/return notifications.

Main functions:

- Lists notifications.
- Shows read/unread status.
- Mark single notification as read.
- Mark all notifications as read.

Testing focus:

- Unread count matches dashboard.
- Single mark-read updates only selected notification.
- Mark-all-read updates all notifications for signed-in user.
- Empty notification state is correct.

### 5.21 Contact Page - `contact.html`

Purpose: Customer support contact page.

Main functions:

- Contact/support content.
- Contact form using mailto/text submission.
- Support phone/email links.

Testing focus:

- Contact form fields are usable.
- Mailto action opens configured email client where supported.
- Phone/email links are correct.
- Footer support links route here correctly.

### 5.22 About Page - `about.html`

Purpose: Brand/store information page.

Testing focus:

- Page content renders correctly.
- Navigation, footer, search, and account links work.
- No broken images or layout issues.

### 5.23 404 Page - `404.html`

Purpose: Not-found/error page.

Testing focus:

- Page renders with helpful message.
- Navigation back to storefront works.
- Header/footer remain functional.

## 6. Admin Panel Page-Wise Scope

### 6.1 Admin Login - `/auth/login`

Purpose: Admin authentication through Supabase.

Main functions:

- Email and password input.
- Supabase sign-in.
- Admin-user lookup.
- Redirect to requested route or `/products`.
- Error state for invalid credentials, inactive admin, and missing admin permissions.

Testing focus:

- Valid active admin can log in.
- Invalid email/password shows proper message.
- Supabase environment missing shows controlled failure.
- Authenticated non-admin is redirected or signed out.
- Inactive admin cannot access dashboard.
- Redirect query parameter works safely.

### 6.2 Admin Guard and Navigation

Component: `components/AdminGuard.tsx`

Purpose: Protect admin pages and apply role-based permissions.

Admin nav links:

- Analytics
- Products
- Categories
- Orders
- Inventory
- Promotions
- Reviews
- Wishlist
- Search

Roles and permission expectations:

- `admin`: all permissions.
- `manager`: catalog, orders, and order viewing.
- `staff`: order viewing and order management.

Testing focus:

- Unauthenticated users are redirected to admin login.
- User without active `admin_users` row is blocked.
- User with insufficient permission sees unauthorized state.
- Logout clears session and returns user to login.
- Navigation remains visible only after admin validation.

### 6.3 Products - `/products`

Purpose: Admin catalog/product management.

Main functions:

- Load products from Express API and merge Supabase inventory/product fields.
- Display product image, name, SKU, price, stock, reserved stock, available stock, inventory status, search keywords, product details, SEO, badges, visibility, and actions.
- Save search keywords.
- Edit product detail fields: brand, warranty, return policy, delivery min/max days, gallery order, specifications, FAQs, and related products.
- Edit SEO fields: slug, meta title, meta description, canonical URL, OpenGraph image URL, and preview snippet.
- Toggle storefront badges: Hot, Most selling, New, Featured.
- Toggle visibility.
- Duplicate product.
- Delete product.
- Upload main product image.
- Add gallery images.
- Remove gallery images.
- Set gallery image as primary.
- Reorder gallery images through drag/drop and up/down buttons.
- Adjust stock with positive or negative quantity.
- View product on storefront.

Testing focus:

- Product table loads when both API and Supabase are available.
- Product table still handles partial API/Supabase failure gracefully.
- SKU and product ID matching merge the correct inventory data.
- Search keyword changes are saved and improve storefront search.
- Image upload accepts JPG, PNG, WebP and rejects invalid file type or size over 3 MB.
- Main image updates storefront product image.
- Gallery upload, remove, primary, and reorder are reflected on `shop-single.html`.
- SEO warning appears for too-long title/description.
- Slug updates product storefront URL.
- Store preview URL opens correct product.
- Badge toggles appear correctly on listing and detail pages.
- Visibility toggle hides product from storefront.
- Duplicate creates a separate product record with expected fields.
- Delete removes product and storefront no longer shows it.
- Stock adjustment changes available stock and inventory status.
- Delivery, warranty, return policy, brand, specs, FAQs, and related products appear on product detail page.

### 6.4 Categories - `/categories`

Purpose: Admin category SEO and storefront category metadata.

Main functions:

- Load categories from Supabase.
- Search categories.
- Edit slug, meta title, meta description, canonical URL, and OpenGraph image URL.
- Show SEO title/description warnings.
- Show category URL preview.

Testing focus:

- Category list loads sorted by sort order/name.
- Search filters by name, slug, description, and SEO fields.
- Slug update changes storefront category URL.
- Meta title and description warnings are shown for long values.
- Changes reflect on `category.html?slug=...`.

### 6.5 Orders - `/orders`

Purpose: Admin order listing and basic status management.

Main functions:

- Load orders with pagination.
- Show order ID, customer, total, status, item count, and created date.
- Update order status.
- Supported statuses: pending, shipped, delivered, cancelled, refunded, returned.
- Restore inventory through Supabase hook when order is cancelled/refunded/returned where configured.

Testing focus:

- Orders load page size 25.
- Previous/next pagination works and disables at limits.
- Status dropdown persists selected status.
- Invalid status is rejected by backend/API.
- Cancelled order before shipping restores stock once.
- Refunded/returned order restores stock only when expected.
- Status changes are reflected on My Orders and Track Order pages.

### 6.6 Inventory - `/inventory`

Purpose: Admin stock control and inventory audit logs.

Main functions:

- Load inventory products from Supabase.
- Search by product, SKU, or category.
- Filter all, low stock, and out of stock.
- Display stock, reserved stock, available stock, inventory status, and updated time.
- Edit low-stock threshold.
- Apply manual stock adjustment.
- Toggle track inventory.
- Toggle allow backorder.
- Select a product to view inventory logs.
- Refresh inventory.

Testing focus:

- Search and filters combine correctly.
- Low stock and out of stock statuses match available stock and threshold.
- Positive stock adjustment increases stock.
- Negative stock adjustment decreases stock without invalid state.
- Inventory log records adjustment quantity, before/after stock, note, created by, and date.
- Track inventory off sets status to not tracked.
- Backorder toggle allows purchase when stock is unavailable where storefront logic permits.
- Reserved stock and available stock update after cart reservation/order flow.

### 6.7 Promotions - `/promotions`

Purpose: Discount, coupon, and promotion management.

Main functions:

- Create promotion.
- Edit existing promotion.
- Reset form.
- Delete promotion.
- Activate/deactivate promotion.
- Filter promotions by all, active, expired, scheduled, coupon, automatic, category, and first order.
- View redemption history.
- Select products for product-scoped promotion.
- Promotion types: coupon code, automatic discount, category offer, combo offer, first order offer, free shipping, buy x get y.
- Discount types: percentage, fixed amount, free shipping, buy x get y.
- Apply scope: all, category, product, collection, tag.
- Configure minimum order, maximum discount cap, total usage limit, per-customer limit, starts at, expires at, buy quantity, get quantity, active, first order only, and combine with other discounts.

Testing focus:

- Required title and discount value validation works.
- Coupon code is uppercased and disabled when promotion type is not coupon.
- End date before start date is rejected.
- Negative discount values and invalid limits are rejected.
- Free shipping disables discount value as expected.
- Product selector appends product IDs without duplicates.
- Category slug normalization works.
- Active/scheduled/expired filters classify records correctly.
- Activate/deactivate changes storefront promotion availability.
- Delete removes promotion and redemption history relationship behaves as expected.
- Storefront cart and checkout calculate each promotion type correctly.
- Usage limit, per-customer limit, first-order-only, scope, and date window are enforced.

### 6.8 Reviews - `/reviews`

Purpose: Admin moderation for product reviews.

Main functions:

- Load reviews and product review stats.
- Search product, customer, email, or comment.
- Filter pending, approved, rejected, verified, and all.
- Filter by rating 1 to 5.
- Show product, customer, rating stars, comment, review images, status, product stats, and admin note.
- Save admin note.
- Approve review.
- Reject review.
- Delete review.

Testing focus:

- Pending reviews are default view.
- Approved reviews appear on storefront product detail.
- Rejected reviews do not appear on storefront.
- Verified filter shows only verified purchase reviews.
- Rating filter works independently and with status filter.
- Admin note persists.
- Review image links open in new tab and thumbnail renders.
- Deleting review removes it from admin and customer/product views.
- Product average/count updates after approval/rejection/deletion.

### 6.9 Wishlist Insights - `/wishlist`

Purpose: Admin analytics for customer wishlist behavior.

Main functions:

- Show total wishlist saves.
- Show unique customers/sessions.
- Show most wishlisted products.
- Show recent wishlist activity with product, customer/session, category, price, stock, and date.

Testing focus:

- Wishlist saves from guest sessions and signed-in users are counted.
- Most wishlisted ranking is sorted by save count.
- Product data joins correctly with wishlist rows.
- Removed wishlist items are no longer included after refresh.
- Missing product row does not break analytics page.

### 6.10 Search Analytics - `/search-analytics`

Purpose: Admin analysis of storefront search behavior.

Main functions:

- Load search events.
- Show most searched queries.
- Show zero-result searches.
- Show clicked products from search.
- Show related analytics events/conversion hints where analytics table is available.
- Show frequently searched products based on product title/name/SKU/category/search keywords.
- Refresh data.

Testing focus:

- Search terms entered on storefront create search events.
- Zero-result searches are captured with result count 0.
- Product suggestion clicks record clicked product ID.
- Analytics-events fallback message appears when table is unavailable.
- Frequently searched products respond to updated product `search_keywords`.

### 6.11 Analytics - `/analytics` and `/[locale]/ecommerce/backend/analytics`

Purpose: Business dashboard for revenue, orders, customers, wishlist, and funnel reporting.

Main functions:

- Date range modes: 7 days, 30 days, custom.
- Metrics: total revenue, total orders, average order value, conversion rate, abandoned carts, wishlist adds.
- Revenue by day line chart.
- Orders by day chart.
- Top products by revenue.
- Top products by quantity.
- Top viewed products.
- Top wishlisted products.
- Conversion funnel.
- Customer retention.
- Abandoned cart products.
- Sales by category.
- Sales by payment method.
- Sales by order status.
- Wishlist-to-purchase conversion.

Testing focus:

- 7-day, 30-day, and custom date ranges load expected data.
- Cancelled/refunded/returned orders are excluded from valid revenue where expected.
- AOV equals revenue divided by valid order count.
- Conversion rate uses tracked sessions/events correctly.
- Charts do not break with empty data.
- Top product names resolve from product rows or fallback names.
- Payment/status/category splits match source orders.
- Wishlist conversion reacts to matching wishlist and purchased product IDs.

### 6.12 Unauthorized Page - `/auth/unauthorized`

Purpose: Admin access denial page.

Testing focus:

- User sees clear unauthorized message.
- Navigation or sign-out path is available as designed.
- Direct access to protected routes by unauthorized user does not leak data.

## 7. Backend API Scope

Base path: `/api`

### 7.1 Health

Endpoint:

- `GET /api/health`

Expected result:

- Returns `{ "status": "ok" }`.

### 7.2 Products

Endpoints:

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `PUT /api/products/:id/visibility`

Supported list query parameters:

- `page`
- `limit`, max 50
- `category`
- `search`
- `includeHidden=true`

Validation and behavior to test:

- Required create fields: name, price, SKU, stock, category, description, image or image_url.
- Price must be 0 or greater.
- Stock must be 0 or greater.
- Invalid product ID returns 400.
- Missing product returns 404.
- Hidden products are excluded unless `includeHidden=true`.
- Search matches name and SKU.
- Inventory status derives from stock, reserved stock, threshold, track inventory, and backorder.
- Visibility endpoint requires boolean `visible`.

### 7.3 Orders

Endpoints:

- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id`

Supported list query parameters:

- `page`
- `limit`, max 50
- `status`
- `email`

Validation and behavior to test:

- Required customer fields: firstName, lastName, email, phone, addressLine1, city, state, country, zipCode.
- At least one order item is required.
- Product must exist and be visible.
- Quantity must be at least 1.
- Insufficient stock blocks order unless backorder is allowed.
- Order ID is generated with `RAD-`.
- Stock is deducted after order creation.
- Discount amount cannot exceed subtotal.
- Status update supports pending, shipped, delivered, cancelled, refunded, returned.
- Invalid status returns 400.
- Cancelled before shipped restores stock once.
- Refunded/returned restores stock when restock flag is true.

### 7.4 Collections

Endpoints:

- `GET /api/collections`
- `GET /api/collections/:id`
- `POST /api/collections`
- `PUT /api/collections/:id`
- `DELETE /api/collections/:id`

Supported list query parameters:

- `page`
- `limit`, max 50
- `active=true`
- `status`

Validation and behavior to test:

- Create requires title and slug.
- Active filter returns status `active`.
- Invalid collection ID returns 400.
- Missing collection returns 404.
- Delete returns success message.

### 7.5 Discounts

Endpoints:

- `GET /api/discounts`
- `GET /api/discounts/:id`
- `POST /api/discounts`
- `PUT /api/discounts/:id`
- `DELETE /api/discounts/:id`

Supported list query parameters:

- `page`
- `limit`, max 50
- `active=true`
- `status`
- `method`
- `code`

Validation and behavior to test:

- Create requires title and discountCategory.
- Code is normalized to uppercase.
- Numeric fields are normalized: value, maxDiscount, minOrderAmount, minQuantity, buyQuantity, getQuantity.
- Invalid discount ID returns 400.
- Missing discount returns 404.
- Delete returns success message.

## 8. Supabase Functions And Data Flows To Validate

Critical tables and feature areas:

- `products`: catalog, SEO, inventory, badges, search keywords, product details.
- `categories`: category data and SEO.
- `orders` and `order_items`: checkout, order history, tracking, analytics.
- `customers`: auth profile sync.
- `customer_addresses`: saved addresses and default address.
- `wishlist`: wishlist state and admin insights.
- `reviews`: verified reviews and moderation.
- `return_requests`: customer returns.
- `customer_notifications`: notifications.
- `discounts` and `discount_redemptions`: promotions and coupon usage.
- `analytics_events`: storefront analytics and business dashboard.
- `search_events`: search analytics.
- `inventory_logs` and `stock_reservations`: inventory adjustment and cart reservation.

Important RPC/function behavior:

- `validate_cart_stock`
- `reserve_cart_stock`
- `release_stock_reservations`
- `release_expired_stock_reservations`
- `complete_order_inventory`
- `restore_order_inventory`
- `adjust_product_stock`
- `validate_discount`
- `finalize_discount_redemption`
- `search_products`
- `get_trending_searches`
- `review_order_is_delivered`
- `review_is_verified_purchase`
- `send_customer_notification`
- `delete_my_customer_account`

Testing focus:

- Row-level security allows only expected public/customer/admin actions.
- Admin-only functions are blocked for normal customers.
- Customer-owned records are not visible to other customers.
- Public storefront reads only intended data.
- Storage buckets accept only allowed image types and admin/customer permissions.
- Realtime or refreshed data updates UI after stock, order, wishlist, or review changes.

## 9. End-To-End Test Scenarios

### 9.1 Guest Shopping Flow

1. Open home page.
2. Search for a product.
3. Open product detail.
4. Add product to cart.
5. Update quantity in cart.
6. Apply valid coupon.
7. Checkout as guest with valid billing details.
8. Verify order creation, stock deduction, cart clear, and order availability by email/tracking ID.

### 9.2 Registered Customer Flow

1. Sign up with valid details.
2. Sign in.
3. Add products to wishlist.
4. Add product to cart.
5. Checkout.
6. Open account dashboard.
7. Verify order appears in My Orders.
8. Track order.
9. After admin marks delivered, submit review.
10. Verify review appears as pending.
11. Admin approves review.
12. Verify review appears on product detail.

### 9.3 Admin Catalog-To-Storefront Flow

1. Admin logs in.
2. Upload product image and gallery.
3. Update product SEO, specs, FAQs, warranty, delivery, return policy, brand, badges, and related products.
4. Adjust stock and low-stock threshold.
5. Open storefront product detail.
6. Verify all updates appear correctly.
7. Hide product.
8. Verify product disappears from listing/search/category pages.

### 9.4 Promotion Flow

1. Admin creates coupon promotion with minimum order and date window.
2. Customer applies code below minimum order.
3. Customer increases cart total above minimum order.
4. Discount applies.
5. Customer completes order.
6. Verify redemption record and usage count.
7. Verify usage limit blocks further use when limit is reached.

### 9.5 Inventory Flow

1. Admin sets product stock to low quantity.
2. Customer adds product to cart.
3. Customer attempts quantity above available stock.
4. Verify cart/checkout blocks purchase.
5. Admin enables backorder.
6. Verify storefront purchase behavior changes according to backorder rules.
7. Admin reviews inventory logs.

### 9.6 Review Moderation Flow

1. Customer with delivered order submits review with optional images.
2. Admin sees review in pending list.
3. Admin saves note and rejects review.
4. Verify review does not appear on storefront.
5. Admin approves another review.
6. Verify review count and average rating update on storefront.

## 10. Regression Checklist

Run this checklist before release:

- Homepage product sections render.
- Product listing search, filters, sort, and pagination work.
- Product detail loads by ID and slug.
- Cart quantity, remove, coupon, and checkout link work.
- Checkout creates order and clears cart.
- Account login/signup/logout works.
- My Orders and Track Order show created order.
- Wishlist add/remove works for guest and signed-in user.
- Review submission and moderation work.
- Admin login and role guard work.
- Admin products page can upload image, adjust stock, toggle visibility, and update SEO.
- Admin inventory page shows logs after adjustment.
- Admin promotions affect cart and checkout totals.
- Admin analytics loads without chart/table failure.
- Backend APIs return expected status codes for success and validation failure.
- Mobile menu, search, cart, account, and forms remain usable at mobile widths.

## 11. Test Data Recommendations

Create the following records before QA execution:

- At least 12 active products across all categories.
- One hidden product.
- One out-of-stock product.
- One low-stock product.
- One product with backorder allowed.
- One product with full gallery, specs, FAQs, warranty, return policy, brand, SEO, and related products.
- At least 6 categories.
- At least 3 promotions: coupon code, automatic discount, free shipping or buy-x-get-y.
- At least 3 customer accounts.
- At least 1 delivered order, 1 pending order, 1 cancelled order, 1 refunded/returned order.
- At least 3 reviews: pending, approved, rejected.
- Wishlist rows for both guest session and signed-in customer.
- Analytics/search events generated from storefront usage.

## 12. Suggested Test Case Format

Use the following format in the QA test management system:

| Field | Description |
| --- | --- |
| Test Case ID | Unique ID, for example `RAD-STF-CART-001` |
| Module | Storefront, Account, Admin, API, Supabase |
| Page/Route | File or route being tested |
| Scenario | Short scenario name |
| Preconditions | Required user/data setup |
| Steps | Numbered execution steps |
| Expected Result | Exact expected output/state |
| Actual Result | Filled by QA |
| Status | Pass, Fail, Blocked, Not Run |
| Severity | Critical, High, Medium, Low |
| Evidence | Screenshot, screen recording, API response, console log |

## 13. Priority Areas

Critical:

- Checkout/order creation.
- Inventory deduction/restoration.
- Product visibility and stock purchase rules.
- Admin login and permissions.
- Promotion discount calculations.
- Customer account data isolation.

High:

- Product image/gallery upload.
- Product SEO/detail content.
- Wishlist sync.
- Order tracking.
- Review moderation.
- Address management.

Medium:

- Analytics dashboards.
- Search analytics.
- Homepage banners.
- Recently viewed/related products.
- Newsletter/contact forms.

## 14. Known Technical Notes For QA

- Storefront API base is resolved from `window.RADIOS_API_BASE`, local storage key `radios-api-base`, localhost API URLs, and same-origin `/api`.
- Cart is stored using browser storage key `radios-cart`.
- Customer data is stored using `radios-customer`, `radios-customer-email`, and `radios-customer-id`.
- Applied discount code is stored using `radios-applied-discount-code`.
- Wishlist has Supabase and local fallback behavior.
- Search suggestions require minimum 2 characters.
- Product listing page size differs by viewport: desktop 12 and mobile 8.
- Image uploads allow JPG, PNG, and WebP only, with 3 MB file size limit.
- Admin product updates may write to both Express API records and Supabase product rows depending on available product ID/slug.
- Some storefront features gracefully fall back if optional Supabase columns are missing.

## 15. Exit Criteria

Testing can be considered complete when:

- All critical and high-priority test cases pass.
- No open blocker defects remain.
- Failed medium/low issues are documented with business approval.
- Admin-to-storefront data propagation is verified for products, categories, inventory, promotions, reviews, and wishlist.
- Checkout, order history, tracking, and inventory restoration pass end-to-end.
- Responsive testing is completed for major storefront and admin pages.
- Browser console is clear of critical runtime errors during core journeys.

