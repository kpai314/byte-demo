# BYTE — REST API Documentation (Part F & F1)
## Campus Food Operating System · Dwarkadas J. Sanghvi College of Engineering

### Base URL
- Primary: `/api/v1`
- Mirror: `/api` (for backward-compatibility)

All endpoints strictly follow the **Part F1 Response Contract**:
```json
{
  "success": true,
  "data": [...],
  "message": null
}
```
Errors return:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

---

### Authentication (`/auth`)

#### `POST /api/v1/auth/login`
Signs in a campus student, faculty member, vendor, or administrator.
- **Request Body**:
  ```json
  {
    "email": "student@example.com",
    "password": "ByteStudent123!"
  }
  ```
- **Response** (`200 OK`): Sets `byte_session` HTTP-only cookie.
  ```json
  {
    "success": true,
    "data": {
      "id": 5,
      "name": "KEERTHI",
      "email": "student@example.com",
      "role": "user",
      "operational_role": "USER",
      "user_type": "student",
      "campus_id": 1
    },
    "message": "Sign-in successful."
  }
  ```

#### `GET /api/v1/auth/me`
Retrieves authenticated session user.
- **Headers**: Cookie `byte_session=<id>` or `Authorization: Bearer <id>`
- **Response** (`200 OK`): User profile object.

#### `POST /api/v1/auth/logout`
Clears session cookie.
- **Response** (`200 OK`): `{ "success": true, "data": { "ok": true } }`

---

### Canteen Outlets (`/outlets`)

#### `GET /api/v1/outlets`
Returns all active campus food outlets.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Central Canteen",
        "slug": "central-canteen",
        "location": "Ground Floor · Main Building",
        "crowd_level": "MODERATE",
        "avg_wait_min": 12,
        "available_tables": 6,
        "total_tables": 12,
        "status": "active"
      }
    ]
  }
  ```

#### `GET /api/v1/outlets/:outletId/menu`
Returns hierarchical menu categories and food dishes for the outlet.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Popular",
        "items": [
          {
            "id": 1,
            "name": "Mumbai Pav Bhaji",
            "price": 80,
            "prep_minutes": 8,
            "dietary_type": "veg",
            "is_jain": true,
            "is_available": true
          }
        ]
      }
    ]
  }
  ```

---

### Food Items Directory (`/foods` or `/menu-items`)

#### `GET /api/v1/foods`
Search and filter food items campus-wide.
- **Query Params**:
  - `search` (string): Search term in name, description, or canteen
  - `outlet_id` (integer): Filter by outlet
  - `diet` (string): `VEG`, `NON_VEG`, or `ALL`
- **Response** (`200 OK`): Array of food item objects.

#### `POST /api/v1/menu-items` (Vendor/Admin)
Creates a new menu item.
- **Request Body**:
  ```json
  {
    "outlet_id": 1,
    "category_id": 1,
    "name": "Chole Bhature",
    "price": 90,
    "food_type": "VEG",
    "prep_minutes": 10,
    "stock_quantity": 40
  }
  ```

#### `PATCH /api/v1/menu-items/:id/availability` (Vendor/Admin)
Toggles item availability (`AVAILABLE` or `SOLD_OUT`).
- **Request Body**: `{ "is_available": true }`

---

### Cart & Orders (`/cart`, `/orders`, `/checkout`)

#### `POST /api/v1/cart/validate`
Validates tray items against single-outlet rule, live DB prices, and stock.
- **Request Body**:
  ```json
  {
    "outlet_id": 1,
    "items": [
      { "food_item_id": 1, "quantity": 2 }
    ]
  }
  ```
- **Response** (`200 OK`): Server-calculated subtotal, tax, and valid line items.

#### `POST /api/v1/checkout`
Executes transactional order placement, generates pickup token, and decrements stock.
- **Request Body**:
  ```json
  {
    "outlet_id": 1,
    "items": [{ "food_item_id": 1, "quantity": 1 }],
    "idempotency_key": "unique-client-token-94812",
    "pickup_type": "immediate",
    "payment_method": "upi"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "data": {
      "id": 1005,
      "order_number": "B8492",
      "outlet_name": "Central Canteen",
      "pickup_counter": "COUNTER 01",
      "status": "PLACED",
      "total": 80,
      "pickup_token": "TK-3914-EXP"
    }
  }
  ```

#### `GET /api/v1/orders/mine`
Retrieves past and active orders for the authenticated student.

#### `PATCH /api/v1/orders/:id/status` (Vendor/Admin)
Transitions order state (`PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `COMPLETED`).

#### `POST /api/v1/orders/:id/verify-pickup` (Staff/Vendor)
Validates `pickup_token` presented by student and transitions order to `COMPLETED`.

---

### Table Reservations (`/tables` or `/reservations`)

#### `GET /api/v1/tables`
Returns live dining floor plan with status (`available`, `reserved`, `occupied`).

#### `POST /api/v1/tables/:id/reserve`
Places an atomic 15–20 minute express hold on a table.
- **Request Body**:
  ```json
  {
    "duration_minutes": 15,
    "party_size": 4
  }
  ```
- **Response** (`201 Created`): Confirmed seating pass with expiry timestamp.
- **Error** (`409 Conflict`): Returned if table is already reserved.

#### `POST /api/v1/tables/:id/cancel`
Releases reserved table back to `available`.

---

### Platform Administration & CSV Imports (`/admin`)

#### `GET /api/v1/admin/analytics` (Admin)
Returns campus-wide metrics: Total orders, Revenue in INR, Active users, Outlets count.

#### `GET /api/v1/admin/users` (Admin)
Returns complete registered user directory.

#### `PATCH /api/v1/admin/users/:id` (Admin)
Updates user operational role (`USER`, `VENDOR`, `OUTLET_STAFF`, `ADMIN`).

#### `POST /api/v1/admin/csv/preview` (Admin)
Dry-run parses and validates CSV headers, duplicate detection, and types.
- **Request Body**:
  ```json
  {
    "entity_type": "menu_items",
    "csv_content": "outlet_id,category_id,item_name,price,food_type\n1,1,\"Poha\",35,VEG"
  }
  ```

#### `POST /api/v1/admin/csv/import` (Admin)
Executes transactional database insertion of validated CSV records.
