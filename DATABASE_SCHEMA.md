# BYTE — Relational Database Schema Specification (Part C & D)
## Campus Food Operating System · Dwarkadas J. Sanghvi College of Engineering (DJSCE)

### Overview
BYTE implements an ANSI SQL relational database schema supporting both PostgreSQL production deployments and local SQLite container storage (using WAL mode and enforced foreign keys).

---

### Entity Relationship Diagram & Tables

#### 1. `campuses`
Represents participating academic campuses (extensible for multi-campus deployments).
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique campus identifier |
| `name` | TEXT | NOT NULL | Official institution name |
| `campus_code` | TEXT | UNIQUE, NOT NULL | Code identifier (e.g. `DJSCE`) |
| `location` | TEXT | NOT NULL | Campus physical address |
| `status` | TEXT | DEFAULT 'ACTIVE' | `ACTIVE` or `INACTIVE` |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration timestamp |

#### 2. `users`
Decouples academic identity (`user_category`) from operational authorization (`operational_role`).
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique user identifier |
| `full_name` | TEXT | NOT NULL | User's full name (e.g. `KEERTHI`) |
| `email` | TEXT | UNIQUE, NOT NULL | Campus verified email address |
| `phone` | TEXT | NULLABLE | Contact telephone |
| `password_hash` | TEXT | NOT NULL | Bcrypt/Argon2 one-way salted hash |
| `campus_id` | INTEGER | FOREIGN KEY (`campuses.id`) | Institutional link |
| `user_category` | TEXT | CHECK: `STUDENT`, `FACULTY`, `NON_TEACHING_STAFF` | Academic classification |
| `operational_role`| TEXT | CHECK: `USER`, `ADMIN`, `VENDOR`, `OUTLET_STAFF` | Platform permissions |
| `account_status` | TEXT | CHECK: `ACTIVE`, `SUSPENDED`, `PENDING` | Access control status |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration timestamp |
| `updated_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Last profile modification |

#### 3. `outlets`
Independent campus kitchen outlets operating on campus premises.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique outlet identifier |
| `campus_id` | INTEGER | FOREIGN KEY (`campuses.id`) | Institutional link |
| `outlet_name` | TEXT | NOT NULL | Display name (e.g. `Central Canteen`) |
| `slug` | TEXT | UNIQUE, NOT NULL | URL-friendly slug |
| `description` | TEXT | NULLABLE | Kitchen specialty description |
| `location` | TEXT | NOT NULL | Campus floor / wing location |
| `opening_time` | TEXT | DEFAULT '08:00' | Operating start time (HH:MM) |
| `closing_time` | TEXT | DEFAULT '20:00' | Operating finish time (HH:MM) |
| `outlet_status` | TEXT | CHECK: `ACTIVE`, `CLOSED`, `MAINTENANCE` | Current operational state |
| `crowd_level` | TEXT | CHECK: `LOW`, `MODERATE`, `HIGH` | Real-time queue indicator |
| `avg_wait_min` | INTEGER | DEFAULT 10 | Estimated dispatch delay |
| `vendor_owner_id`| INTEGER | FOREIGN KEY (`users.id`) | Primary vendor account |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification |

#### 4. `outlet_staff`
Membership mapping between staff users and authorized outlets.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Outlet reference |
| `user_id` | INTEGER | FOREIGN KEY (`users.id`) | Staff member reference |
| `staff_role` | TEXT | CHECK: `MANAGER`, `CHEF`, `CASHIER`, `STAFF` | Operational assignment |
| `status` | TEXT | DEFAULT 'ACTIVE' | Active or Inactive |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Assignment timestamp |

#### 5. `menu_categories`
Groupings for menu items within an outlet.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique category identifier |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Outlet owner |
| `category_name`| TEXT | NOT NULL | Display title (e.g. `Breakfast & Tiffin`) |
| `description` | TEXT | NULLABLE | Category description |
| `display_order`| INTEGER | DEFAULT 0 | Sorting priority on UI |
| `is_active` | INTEGER/BOOLEAN | DEFAULT 1 | 1 for active, 0 for hidden |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

#### 6. `menu_items`
Dishes and beverages served at campus outlets.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique item identifier |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Kitchen source |
| `category_id` | INTEGER | FOREIGN KEY (`menu_categories.id`) | Category placement |
| `item_name` | TEXT | NOT NULL | Dish title |
| `description` | TEXT | NULLABLE | Recipe description |
| `price` | REAL/FLOAT | CHECK: `price >= 0` | Current selling price (INR) |
| `image_url` | TEXT | NOT NULL | Photography asset path |
| `food_type` | TEXT | CHECK: `VEG`, `NON_VEG`, `EGG` | Primary dietary classification |
| `dietary_tags` | TEXT (JSON) | DEFAULT '[]' | Tags: `JAIN`, `VEGAN`, `POPULAR` |
| `allergens` | TEXT (JSON) | DEFAULT '[]' | Allergens: `DAIRY`, `GLUTEN`, `NUTS` |
| `preparation_time`| INTEGER | CHECK: `>= 0`, DEFAULT 10 | Cook time in minutes |
| `availability_status`| TEXT | CHECK: `AVAILABLE`, `SOLD_OUT`, `HIDDEN` | Inventory visibility |
| `stock_quantity` | INTEGER | CHECK: `>= 0`, DEFAULT 100 | Portions currently on hand |
| `display_order` | INTEGER | DEFAULT 0 | Ordering priority |
| `rating` | REAL/FLOAT | DEFAULT 4.8 | Student rating score |
| `is_popular` | INTEGER/BOOLEAN | DEFAULT 0 | Highlights signature carousel |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification |

#### 7. `orders`
Transactional customer order records.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Order primary key |
| `order_number` | TEXT | UNIQUE, NOT NULL | Human-readable token (e.g. `B1234`) |
| `idempotency_key` | TEXT | UNIQUE, NULLABLE | Protects against duplicate charges |
| `user_id` | INTEGER | FOREIGN KEY (`users.id`) | Purchasing student/staff |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Single canteen rule enforced |
| `subtotal` | REAL/FLOAT | CHECK: `>= 0` | Server-calculated item sum |
| `taxes` | REAL/FLOAT | CHECK: `>= 0`, DEFAULT 0 | Regulatory campus taxes |
| `discounts` | REAL/FLOAT | CHECK: `>= 0`, DEFAULT 0 | BYTE Points voucher discounts |
| `total_amount` | REAL/FLOAT | CHECK: `>= 0` | Final transaction amount |
| `payment_status` | TEXT | CHECK: `PENDING`, `PAID`, `FAILED`, `CASH_AT_COUNTER`, `REFUNDED` | Payment resolution |
| `order_status` | TEXT | CHECK: `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` | Order lifecycle |
| `pickup_token` | TEXT | NOT NULL | Verification token (e.g. `TK-4821-EXP`) |
| `pickup_counter`| TEXT | DEFAULT 'COUNTER 01' | Dedicated collection window |
| `pickup_type` | TEXT | CHECK: `immediate`, `scheduled` | Timing mode |
| `scheduled_time`| TEXT | NULLABLE | Recess slot or break timestamp |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Order placement time |
| `updated_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Last status transition |

#### 8. `order_items`
Immutable historical snapshot of lines purchased at time of checkout.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Line record ID |
| `order_id` | INTEGER | FOREIGN KEY (`orders.id`) ON DELETE CASCADE | Order link |
| `menu_item_id` | INTEGER | FOREIGN KEY (`menu_items.id`) | Original item link |
| `item_name_snapshot` | TEXT | NOT NULL | Item name at purchase time |
| `unit_price_snapshot`| REAL/FLOAT | CHECK: `>= 0` | Price frozen at purchase time |
| `quantity` | INTEGER | CHECK: `> 0` | Quantity ordered |
| `selected_options` | TEXT (JSON) | DEFAULT '{}' | Customizations |
| `item_total` | REAL/FLOAT | CHECK: `>= 0` | Snapshot price × quantity |

#### 9. `payments`
Sandbox UPI and physical cash-at-counter settlement records.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Payment record ID |
| `order_id` | INTEGER | FOREIGN KEY (`orders.id`) ON DELETE CASCADE | Associated order |
| `payment_provider` | TEXT | DEFAULT 'SANDBOX_UPI' | Provider identifier |
| `payment_reference`| TEXT | UNIQUE, NOT NULL | Transaction reference token |
| `amount` | REAL/FLOAT | CHECK: `>= 0` | Amount paid (INR) |
| `payment_method` | TEXT | CHECK: `upi`, `cash`, `card`, `campus_id` | Payment mode |
| `payment_status` | TEXT | CHECK: `SUCCESS`, `PENDING`, `FAILED` | Provider settlement status |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

#### 10. `outlet_tables`
Physical seating inventory across dining halls and verandas.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Table record ID |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) ON DELETE CASCADE | Canteen dining area |
| `table_number` | TEXT | NOT NULL | Physical table code (e.g. `T-01`) |
| `capacity` | INTEGER | CHECK: `> 0` | Seating capacity (2, 4, 6 seats) |
| `location` | TEXT | NOT NULL | Zone description (e.g. `Window Side`) |
| `status` | TEXT | CHECK: `available`, `occupied`, `reserved`, `maintenance` | Real-time status |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration time |

#### 11. `reservations`
Express 15–20 minute seating holds with strict transactional overlap protection.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Reservation primary key |
| `reservation_number`| TEXT | UNIQUE, NOT NULL | Pass code (e.g. `RES-48210`) |
| `user_id` | INTEGER | FOREIGN KEY (`users.id`) | Student holding table |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Dining hall |
| `table_id` | INTEGER | FOREIGN KEY (`outlet_tables.id`) | Table held |
| `reservation_date` | TEXT | NOT NULL | Date format `YYYY-MM-DD` |
| `start_time` | TEXT | NOT NULL | Start time `HH:MM` |
| `end_time` | TEXT | NOT NULL | Expiry hold time `HH:MM` |
| `party_size` | INTEGER | CHECK: `> 0` | Number of diners |
| `reservation_status`| TEXT | CHECK: `CONFIRMED`, `SEATED`, `CANCELLED`, `EXPIRED` | Pass status |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Booking timestamp |
| `updated_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Status update timestamp |

#### 12. `reviews`
Verified feedback from completed meals.
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Review ID |
| `user_id` | INTEGER | FOREIGN KEY (`users.id`) | Reviewer |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Canteen reviewed |
| `order_id` | INTEGER | UNIQUE, FOREIGN KEY (`orders.id`) | Verified completed order |
| `rating` | INTEGER | CHECK: `rating BETWEEN 1 AND 5` | Star rating |
| `review_text` | TEXT | NULLABLE | Feedback commentary |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Submission timestamp |

#### 13. `media_assets`
Metadata registry for digital assets (images, videos, menus).
| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Asset ID |
| `outlet_id` | INTEGER | FOREIGN KEY (`outlets.id`) | Associated outlet |
| `media_type` | TEXT | CHECK: `IMAGE`, `VIDEO`, `DOCUMENT` | MIME category |
| `media_url` | TEXT | NOT NULL | Asset URL/path |
| `thumbnail_url`| TEXT | NULLABLE | Preview image |
| `alt_text` | TEXT | NULLABLE | Accessibility description |
| `title` | TEXT | NULLABLE | Headline |
| `duration_seconds`| INTEGER | DEFAULT 0 | Video length |
| `created_at` | TEXT/DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration timestamp |

---

### Integrity Rules & Constraints Enforced
1. **Single Outlet Rule**: Orders and Carts are constrained to exactly one outlet (`orders.outlet_id`).
2. **Historical Price Freezing**: Updating `menu_items.price` does not alter past orders; `order_items` stores frozen `unit_price_snapshot`.
3. **No Negative Values**: `price >= 0`, `stock_quantity >= 0`, `quantity > 0`, `subtotal >= 0`.
4. **Concurrency Protection**: Reservations check existing confirmed bookings for that date/time inside `runTransaction()` (`BEGIN IMMEDIATE`), rejecting double bookings with 409 Conflict.
5. **Review Eligibility**: Reviews require a unique `order_id` in `COMPLETED` state belonging to the reviewing student.
