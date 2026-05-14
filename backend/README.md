# Radios API

Shared backend for the Radios storefront and Dashcode admin dashboard.

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Start in dev mode with `npm run dev`

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
