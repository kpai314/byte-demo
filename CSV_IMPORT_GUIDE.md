# BYTE — CSV Batch Import Guide (Part L)
## Administrator Data Ingestion & Migration System

### Overview
The CSV Import system provides an administrator-only bulk ingestion mechanism for campus data. It operates via a mandatory 2-step process:
1. **Dry-Run Validation & Preview**: Validates headers, data types, negative numbers, and detects syntax errors without modifying the database.
2. **Transactional Commit**: Inserts all records within an atomic database transaction. If any record fails constraint checks, the entire batch rolls back.

---

### Security & Formula Injection Protections
CSV content uploaded to BYTE is sanitized:
- Any field starting with spreadsheet formula triggers (`=`, `+`, `-`, `@`) is prepended with a single quote (`'`) to disable formula execution in spreadsheet software.
- Direct object references and raw SQL queries are disallowed; all fields are bound using parameterized SQL statements.

---

### Supported Entity Formats

#### 1. Menu Items (`menu_items`)
**Required Headers**:
`outlet_id,category_id,item_name,description,price,food_type,preparation_time,stock_quantity`

**Example CSV**:
```csv
outlet_id,category_id,item_name,description,price,food_type,preparation_time,stock_quantity
1,1,"Chole Kulche Combo","Spiced Amritsari chole with 2 fluffy butter kulchas",95,VEG,10,35
2,4,"Rava Masala Dosa","Crispy semolina crepe tempered with cumin and green chillies",75,VEG,12,40
3,6,"Iced Caramel Macchiato","Espresso over cold milk and caramel drizzle",70,VEG,4,50
```

**Field Rules**:
- `outlet_id`: Must be a valid integer corresponding to an existing outlet.
- `category_id`: Must be a valid integer corresponding to an existing category.
- `item_name`: Non-empty string.
- `price`: Positive numeric value (e.g. `95` or `95.50`). Negative prices rejected.
- `food_type`: Must be strictly one of `VEG`, `NON_VEG`, or `EGG`.
- `preparation_time`: Integer minutes (minimum 0).
- `stock_quantity`: Integer portions available (minimum 0).

---

#### 2. Categories (`categories`)
**Required Headers**:
`outlet_id,category_name,description,display_order`

**Example CSV**:
```csv
outlet_id,category_name,description,display_order
1,"Live Griddle Specials","Tawa fried campus items",4
2,"Filter Coffee & Sweets","Traditional South Indian beverages and desserts",3
3,"Fresh Pressed Juices","Seasonal vitamin boosts",3
```

---

#### 3. Users (`users`)
**Required Headers**:
`full_name,email,phone,user_category,operational_role`

**Example CSV**:
```csv
full_name,email,phone,user_category,operational_role
"Aarav Mehta","aarav.mehta@example.com","+91 98200 11111",STUDENT,USER
"Dr. Ananya Roy","ananya.roy@example.com","+91 98200 22222",FACULTY,USER
"Subhash Canteen Staff","subhash.staff@example.com","+91 98200 33333",NON_TEACHING_STAFF,OUTLET_STAFF
```

**Field Rules**:
- `email`: Must be a valid email format. Duplicate emails across campus are rejected.
- `user_category`: Must be `STUDENT`, `FACULTY`, or `NON_TEACHING_STAFF`.
- `operational_role`: Must be `USER`, `VENDOR`, `OUTLET_STAFF`, or `ADMIN`.
- Passwords are automatically initialized with a secure default hashed credential (`ByteUser2026!`).
