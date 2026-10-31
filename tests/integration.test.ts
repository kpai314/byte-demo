process.env.NODE_ENV = 'test';

import axios from 'axios';
import { app } from '../server';
import { db } from '../server/db/database';
import { seedDatabase } from '../server/db/seed';
import { getKolkataDate, getKolkataTime } from '../server/utils/kolkataTime';
import type { Server } from 'http';

const TEST_PORT = 3005;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runAllTests() {
  console.log('========================================================');
  console.log('  BYTE CAMPUS FOOD OS — COMPREHENSIVE INTEGRATION SUITE ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  // Start HTTP Server
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
  });

  try {
    // ----------------------------------------------------
    // SUITE 1: HEALTH & AUTHENTICATION
    // ----------------------------------------------------
    console.log('\n--- 1. Health & Authentication Tests ---');

    const healthRes = await axios.get(`${BASE_URL}/api/health`);
    assert(healthRes.data.success === true && healthRes.data.data.status === 'ok', 'Health Check API returns success envelope');

    // Student Login
    const studentLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'student@example.com',
      password: 'ByteStudent123!',
    });
    const studentCookie = studentLogin.headers['set-cookie']?.[0] || '';
    assert(studentLogin.data.success === true && studentLogin.data.data.email === 'student@example.com', 'Student authentication succeeds');

    // Admin Login
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'ByteAdmin123!',
    });
    const adminCookie = adminLogin.headers['set-cookie']?.[0] || '';
    assert(adminLogin.data.success === true && adminLogin.data.data.role === 'admin', 'Admin authentication succeeds');

    // Vendor Login
    const vendorLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'vendor@example.com',
      password: 'ByteVendor123!',
    });
    const vendorCookie = vendorLogin.headers['set-cookie']?.[0] || '';
    assert(vendorLogin.data.success === true && vendorLogin.data.data.role === 'vendor', 'Vendor authentication succeeds');

    // ----------------------------------------------------
    // SUITE 2: TABLE RESERVATION SYSTEM (Section 2)
    // ----------------------------------------------------
    console.log('\n--- 2. Table Reservation Engine Tests ---');

    const targetDate = '2026-11-15'; // Future date for test stability
    // Clean up any reservations for targetDate from previous test runs to ensure idempotency
    db.prepare('DELETE FROM reservations WHERE reservation_date = ?').run(targetDate);
    db.prepare("DELETE FROM menu_items WHERE item_name LIKE 'Automated Test%'").run();

    // 2.1 Table list does not duplicate rows
    const tablesListRes = await axios.get(`${BASE_URL}/api/tables?reservation_date=${targetDate}&time=12:00`);
    const tablesList = tablesListRes.data.data;
    const tableIds = tablesList.map((t: any) => t.id);
    const uniqueTableIds = new Set(tableIds);
    assert(tableIds.length === uniqueTableIds.size, `GET /tables returns unique rows without duplicates (${tableIds.length} tables)`);

    // 2.2 Table capacity exceeding check
    try {
      await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 5, // Table 3 capacity is 2
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(false, 'Party size exceeding capacity must fail');
    } catch (err: any) {
      assert(err.response?.status === 400 && err.response?.data?.error?.code === 'CAPACITY_EXCEEDED', 'Party size exceeding capacity rejected with HTTP 400 CAPACITY_EXCEEDED');
    }

    // 2.3 Invalid date format check
    try {
      await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: 'not-a-date',
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(false, 'Invalid date format must fail');
    } catch (err: any) {
      assert(err.response?.status === 400, 'Invalid date format rejected with HTTP 400');
    }

    // 2.4 Past reservation check
    try {
      await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: '2020-01-01',
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(false, 'Past reservation must fail');
    } catch (err: any) {
      assert(err.response?.status === 400, 'Past reservation rejected with HTTP 400');
    }

    // 2.5 Valid reservation succeeds
    let booking1Id = 0;
    try {
      const res = await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      booking1Id = res.data.data.id;
      assert(res.status === 201 && res.data.data.start_time === '12:00' && res.data.data.end_time === '12:20', 'Valid reservation (12:00-12:20) created with HTTP 201');
    } catch (err: any) {
      assert(false, `Valid reservation failed: ${err.message}`);
    }

    // 2.6 Overlapping reservation fails with HTTP 409
    try {
      await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:10', // Overlaps 12:00-12:20
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(false, 'Overlapping reservation must be rejected');
    } catch (err: any) {
      assert(err.response?.status === 409, 'Overlapping reservation (12:10-12:30) rejected with HTTP 409 CONFLICT');
    }

    // 2.7 Adjacent time slot succeeds (12:20-12:40 on same table)
    try {
      const resAdjacent = await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:20', // Exactly adjacent
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(resAdjacent.status === 201 && resAdjacent.data.data.start_time === '12:20', 'Adjacent time slot (12:20-12:40) succeeds without conflict');
    } catch (err: any) {
      assert(false, `Adjacent time slot failed: ${err.message}`);
    }

    // 2.8 Different table reserved independently at same time
    try {
      const resTable5 = await axios.post(
        `${BASE_URL}/api/tables/5/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 4,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(resTable5.status === 201, 'Different table (Table 5) reserved independently for same time slot');
    } catch (err: any) {
      assert(false, `Independent table reservation failed: ${err.message}`);
    }

    // 2.9 Cancel reservation releases availability
    try {
      const cancelRes = await axios.post(
        `${BASE_URL}/api/tables/3/cancel`,
        {},
        { headers: { Cookie: studentCookie } }
      );
      assert(cancelRes.data.success === true, 'Reservation cancellation releases table');

      // Now booking 12:00-12:20 on Table 3 should succeed again!
      const rebookRes = await axios.post(
        `${BASE_URL}/api/tables/3/reserve`,
        {
          reservation_date: targetDate,
          start_time: '12:00',
          duration_minutes: 20,
          party_size: 2,
        },
        { headers: { Cookie: studentCookie } }
      );
      assert(rebookRes.status === 201, 'Re-booking cancelled time slot succeeds immediately');
    } catch (err: any) {
      assert(false, `Cancellation / rebook failed: ${err.message} - ${JSON.stringify(err.response?.data)}`);
    }

    // 2.10 GET /reservations/mine retrieves student reservations
    const myRes = await axios.get(`${BASE_URL}/api/reservations/mine`, { headers: { Cookie: studentCookie } });
    assert(Array.isArray(myRes.data.data) && myRes.data.data.length > 0, 'GET /reservations/mine returns active and historical bookings');

    // ----------------------------------------------------
    // SUITE 3: MENU & DIETARY DATA FLOW (Sections 3 & 4)
    // ----------------------------------------------------
    console.log('\n--- 3. Menu & Dietary Data Flow Tests ---');

    // 3.1 Retrieve all foods
    const foodsRes = await axios.get(`${BASE_URL}/api/foods`);
    assert(foodsRes.data.success === true && Array.isArray(foodsRes.data.data) && foodsRes.data.data.length >= 10, 'GET /foods returns full food directory');

    // 3.2 Filter by outlet
    const outlet1Foods = await axios.get(`${BASE_URL}/api/foods?outlet_id=1`);
    assert(outlet1Foods.data.data.every((f: any) => f.outlet_id === 1), 'GET /foods?outlet_id=1 returns only Central Canteen dishes');

    // 3.3 Search food
    const searchRes = await axios.get(`${BASE_URL}/api/foods?search=Pav`);
    assert(searchRes.data.data.some((f: any) => f.name.includes('Pav')), 'GET /foods?search=Pav finds matching dishes');

    // 3.4 Dietary filters: VEG, NON_VEG, JAIN
    const vegRes = await axios.get(`${BASE_URL}/api/foods?diet=VEG`);
    assert(vegRes.data.data.every((f: any) => f.food_type === 'VEG'), 'GET /foods?diet=VEG returns only vegetarian items');

    const nonVegRes = await axios.get(`${BASE_URL}/api/foods?diet=NON_VEG`);
    assert(nonVegRes.data.data.every((f: any) => f.food_type === 'NON_VEG'), 'GET /foods?diet=NON_VEG returns non-veg dishes');

    const jainRes = await axios.get(`${BASE_URL}/api/foods?diet=JAIN`);
    assert(jainRes.data.data.length > 0 && jainRes.data.data.every((f: any) => f.is_jain === true), 'GET /foods?diet=JAIN correctly parses JSON dietary_tags and filters Jain items');

    // 3.5 Create Menu Item (Vendor CRUD)
    let newDishId = 0;
    const createDishRes = await axios.post(
      `${BASE_URL}/api/foods`,
      {
        outlet_id: 1,
        category_id: 1,
        name: 'Automated Test Dhokla',
        description: 'Fresh nylon dhokla with mustard tempering',
        price: 40,
        food_type: 'VEG',
        dietary_tags: ['JAIN', 'POPULAR'],
        prep_minutes: 5,
        stock_quantity: 25,
      },
      { headers: { Cookie: vendorCookie } }
    );
    newDishId = createDishRes.data.data.id;
    assert(createDishRes.status === 201 && createDishRes.data.data.name === 'Automated Test Dhokla', 'Vendor creates new menu item (POST /foods)');

    // 3.6 Update Menu Item Price & Description
    const updateDishRes = await axios.patch(
      `${BASE_URL}/api/foods/${newDishId}`,
      { price: 45, description: 'Updated soft nylon dhokla' },
      { headers: { Cookie: vendorCookie } }
    );
    assert(updateDishRes.data.data.price === 45, 'Vendor updates menu item price (PATCH /foods/:id)');

    // 3.7 Update Availability
    const toggleAvailRes = await axios.patch(
      `${BASE_URL}/api/foods/${newDishId}/availability`,
      { is_available: false },
      { headers: { Cookie: vendorCookie } }
    );
    assert(toggleAvailRes.data.data.availability_status === 'SOLD_OUT', 'Vendor updates item availability (PATCH /foods/:id/availability)');

    // 3.8 Deactivate item
    const deleteDishRes = await axios.delete(
      `${BASE_URL}/api/foods/${newDishId}`,
      { headers: { Cookie: vendorCookie } }
    );
    assert(deleteDishRes.data.data.status === 'HIDDEN', 'Vendor deactivates menu item (DELETE /foods/:id)');

    // ----------------------------------------------------
    // SUITE 4: CATEGORY REORDERING (Section 8)
    // ----------------------------------------------------
    console.log('\n--- 4. Category Reorder Route Order Tests ---');

    const reorderRes = await axios.patch(
      `${BASE_URL}/api/categories/reorder`,
      {
        orders: [
          { id: 1, display_order: 10 },
          { id: 2, display_order: 20 },
        ],
      },
      { headers: { Cookie: adminCookie } }
    );
    assert(reorderRes.status === 200 && Array.isArray(reorderRes.data.data), 'PATCH /categories/reorder is reached before /:id parameter route');

    // ----------------------------------------------------
    // SUITE 5: NOTIFICATIONS API (Section 7)
    // ----------------------------------------------------
    console.log('\n--- 5. Notifications Endpoint Tests ---');

    // Unauthenticated rejection
    try {
      await axios.get(`${BASE_URL}/api/notifications`);
      assert(false, 'Unauthenticated notifications request should be rejected');
    } catch (err: any) {
      assert(err.response?.status === 401, 'Unauthenticated GET /notifications rejected with 401');
    }

    // Authenticated list
    const notesRes = await axios.get(`${BASE_URL}/api/notifications`, { headers: { Cookie: studentCookie } });
    assert(notesRes.data.success === true && Array.isArray(notesRes.data.data), 'GET /notifications returns array of dispatches');

    // Mark all as read
    const markAllRes = await axios.patch(`${BASE_URL}/api/notifications/read-all`, {}, { headers: { Cookie: studentCookie } });
    assert(markAllRes.data.success === true, 'PATCH /notifications/read-all marks dispatches read');

    // Unread count is now 0
    const unreadCountRes = await axios.get(`${BASE_URL}/api/notifications/unread-count`, { headers: { Cookie: studentCookie } });
    assert(unreadCountRes.data.data.count === 0, 'GET /notifications/unread-count returns 0 after marking all read');

    // ----------------------------------------------------
    // SUITE 6: ORDERS, STATUS HISTORY & PICKUP TOKENS (Sections 9 & 10)
    // ----------------------------------------------------
    console.log('\n--- 6. Orders, Status History & Pickup Token Tests ---');

    // Single-outlet cart validation
    const cartVal = await axios.post(`${BASE_URL}/api/cart/validate`, {
      outlet_id: 1,
      items: [{ food_item_id: 1, quantity: 2 }, { food_item_id: 2, quantity: 1 }],
    });
    assert(cartVal.data.data.subtotal === 185, 'Cart validation calculates correct prices from database');

    // Place Order
    const idemp = `suite-order-${Date.now()}`;
    const checkoutRes = await axios.post(
      `${BASE_URL}/api/checkout`,
      {
        outlet_id: 1,
        items: [{ food_item_id: 1, quantity: 1 }],
        idempotency_key: idemp,
        payment_method: 'upi',
      },
      { headers: { Cookie: studentCookie } }
    );

    const orderData = checkoutRes.data.data;
    const testOrderId = orderData.id;
    const testToken = orderData.pickup_token;
    assert(checkoutRes.status === 201 && orderData.status === 'PLACED', 'Order checkout created order transactionally');

    // Idempotency replay
    const replayRes = await axios.post(
      `${BASE_URL}/api/checkout`,
      {
        outlet_id: 1,
        items: [{ food_item_id: 1, quantity: 1 }],
        idempotency_key: idemp,
      },
      { headers: { Cookie: studentCookie } }
    );
    assert(replayRes.data.data.id === testOrderId, 'Idempotency replay returns existing order without creating duplicate');

    // Status transition: PLACED -> ACCEPTED
    const acceptRes = await axios.patch(
      `${BASE_URL}/api/orders/${testOrderId}/status`,
      { status: 'ACCEPTED' },
      { headers: { Cookie: vendorCookie } }
    );
    assert(acceptRes.data.data.status === 'ACCEPTED', 'Vendor transitions order from PLACED to ACCEPTED');

    // Invalid transition check: ACCEPTED -> COMPLETED directly should fail
    try {
      await axios.patch(
        `${BASE_URL}/api/orders/${testOrderId}/status`,
        { status: 'COMPLETED' },
        { headers: { Cookie: vendorCookie } }
      );
      assert(false, 'Direct transition from ACCEPTED to COMPLETED must be rejected');
    } catch (err: any) {
      assert(err.response?.status === 400 && err.response?.data?.error?.code === 'INVALID_STATUS_TRANSITION', 'Invalid transition ACCEPTED -> COMPLETED rejected with HTTP 400');
    }

    // Transition ACCEPTED -> PREPARING -> READY
    await axios.patch(`${BASE_URL}/api/orders/${testOrderId}/status`, { status: 'PREPARING' }, { headers: { Cookie: vendorCookie } });
    await axios.patch(`${BASE_URL}/api/orders/${testOrderId}/status`, { status: 'READY' }, { headers: { Cookie: vendorCookie } });

    // Check Order Details & History audit
    const orderDetailsRes = await axios.get(`${BASE_URL}/api/orders/${testOrderId}`, { headers: { Cookie: studentCookie } });
    const historyList = orderDetailsRes.data.data.history;
    assert(Array.isArray(historyList) && historyList.length >= 3, `Order status history audit records valid transitions (${historyList.length} steps recorded)`);

    // Verify Pickup Token at counter
    const verifyRes = await axios.post(
      `${BASE_URL}/api/orders/${testOrderId}/verify-pickup`,
      { pickup_token: testToken },
      { headers: { Cookie: vendorCookie } }
    );
    assert(verifyRes.data.data.status === 'COMPLETED', 'Pickup token verified and order marked COMPLETED');

    // Prevent Pickup Token reuse
    try {
      await axios.post(
        `${BASE_URL}/api/orders/${testOrderId}/verify-pickup`,
        { pickup_token: testToken },
        { headers: { Cookie: vendorCookie } }
      );
      assert(false, 'Token reuse must be blocked');
    } catch (err: any) {
      assert(err.response?.status === 409, 'Re-verifying redeemed pickup token blocked with HTTP 409 ALREADY_COMPLETED');
    }

    // ----------------------------------------------------
    // SUITE 7: DATABASE PERSISTENCE & SEEDING (Section 5)
    // ----------------------------------------------------
    console.log('\n--- 7. Database Persistence & Idempotent Seeding Tests ---');

    // Re-run seed on existing populated DB
    seedDatabase();
    const countCheck = db.prepare('SELECT COUNT(*) as c FROM outlets').get() as any;
    assert(countCheck.c === 3, 'Idempotent seed does not duplicate outlets on existing database');

    const userCountCheck = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
    assert(userCountCheck.c === 6, 'Idempotent seed preserves existing user accounts without duplicates');
  } finally {
    // Teardown HTTP server
    server.close();
  }

  console.log('\n========================================================');
  console.log(`  INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
