# Uncle's Car Leasing — Formal Full‑Stack Site

Tabs: **Main Menu**, **Leasing**, **About Us**, **Contact**.  
No vehicle photos included by default; UI shows reserved placeholders so you can add images later.

## Run on Port 4000
1) Create the database:
```sql
CREATE DATABASE IF NOT EXISTS car_leasing_db;
```
(Adjust `server.js` credentials if needed.)

2) Install & start:
```bash
npm install
npm start
```
Open `http://localhost:4000`

## Data
Tables are created automatically on first run:
- `vehicles(id, name, type, fuel, price_per_day_rent, price_buy, image_url)`
- `contacts(id, name, email, message, created_at)`
- `orders(id, customer_name, email, phone, order_type, start_date, end_date, total, created_at)`
- `order_items(id, order_id, vehicle_id, quantity, price_each)`

Seed vehicles inserted with **NULL** `image_url` so placeholders render.

## API
- `GET /api/vehicles` — list vehicles
- `POST /api/contact` — `{"name","email","message"}`
- `POST /api/order` —
```json
{
  "customer_name": "John Doe",
  "email": "john@example.com",
  "phone": "123",
  "order_type": "rent", // or "buy"
  "start_date": "2025-08-23",
  "end_date": "2025-08-26",
  "items": [{ "vehicle_id": 1, "quantity": 1 }]
}
```
- `GET /api/last-order` — session peek

## Add your own images
- Update `vehicles.image_url` with your file paths or URLs, and replace the placeholder boxes automatically.
