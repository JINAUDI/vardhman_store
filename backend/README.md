# Vardhman Store API

Shared backend for the Vardhman Store storefront and Dashcode admin dashboard.

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Start in dev mode with `npm run dev`

If you are only using the Shiprocket/Supabase checkout bridge and do not have local MongoDB running, set `START_WITHOUT_MONGO=true` in `.env`.

## Endpoints

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `PUT /api/products/:id/visibility`
- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `GET /api/shiprocket/config`
- `POST /api/shiprocket/orders`

## Shiprocket

Shiprocket calls are made only from the backend so API credentials are not exposed in browser JavaScript.

1. In Shiprocket, create an API user from Settings > API. Use that API user's email and password, not the normal storefront customer login.
2. Add `SHIPROCKET_API_EMAIL`, `SHIPROCKET_API_PASSWORD`, and `SHIPROCKET_PICKUP_LOCATION` to `.env`.
3. Set package defaults with `SHIPROCKET_DEFAULT_LENGTH_CM`, `SHIPROCKET_DEFAULT_BREADTH_CM`, `SHIPROCKET_DEFAULT_HEIGHT_CM`, and `SHIPROCKET_DEFAULT_WEIGHT_KG`.
4. Optionally set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so successful Shiprocket syncs are written back to the Supabase `orders` row.

The storefront checkout calls `POST /api/shiprocket/orders` after the local order is created. If Shiprocket is temporarily unavailable, the customer order remains created and the failure is logged for retry.
