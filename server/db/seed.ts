import bcrypt from 'bcryptjs';
import { db, runTransaction } from './database';

const MASALA_DOSA_IMG = "/images/food/masala_dosa.jpg";
const PAV_BHAJI_IMG = "/images/food/pav_bhaji.jpg";
const VADA_PAV_IMG = "/images/food/vada_pav.jpg";
const PANEER_BUTTER_IMG = "/images/food/paneer_butter_masala.jpg";

/**
 * Safe, idempotent per-record upsert seed logic.
 * Preserves existing user edits, orders, passwords, and custom vendor menu items.
 */
export function seedDatabase() {
  runTransaction(() => {
    // 1. Campus: Dwarkadas J. Sanghvi College of Engineering
    const existingCampus = db.prepare('SELECT id FROM campuses WHERE campus_code = ?').get('DJSCE') as any;
    let campusId = existingCampus?.id;
    if (!existingCampus) {
      const insCampus = db.prepare(`
        INSERT INTO campuses (name, campus_code, location, status)
        VALUES ('Dwarkadas J. Sanghvi College of Engineering', 'DJSCE', 'Vile Parle (West), Mumbai', 'ACTIVE')
      `).run();
      campusId = Number(insCampus.lastInsertRowid);
    }

    // 2. Users (Preserve existing users and passwords)
    const saltRounds = 10;
    const seedUsers = [
      { id: 1, name: 'BYTE Administrator', email: 'admin@example.com', phone: '+91 98200 00001', pass: 'ByteAdmin123!', cat: 'NON_TEACHING_STAFF', role: 'ADMIN' },
      { id: 2, name: 'Dabba Lab Vendor', email: 'vendor@example.com', phone: '+91 98200 00002', pass: 'ByteVendor123!', cat: 'NON_TEACHING_STAFF', role: 'VENDOR' },
      { id: 3, name: 'Tiffin Express Vendor', email: 'vendor.tiffin@example.com', phone: '+91 98200 00003', pass: 'ByteVendor123!', cat: 'NON_TEACHING_STAFF', role: 'VENDOR' },
      { id: 4, name: 'Chai & Crumb Vendor', email: 'vendor.chai@example.com', phone: '+91 98200 00004', pass: 'ByteVendor123!', cat: 'NON_TEACHING_STAFF', role: 'VENDOR' },
      { id: 5, name: 'KEERTHI', email: 'student@example.com', phone: '+91 98200 12345', pass: 'ByteStudent123!', cat: 'STUDENT', role: 'USER' },
      { id: 6, name: 'Prof. K. Sharma', email: 'prof.sharma@example.com', phone: '+91 98200 54321', pass: 'ByteFaculty123!', cat: 'FACULTY', role: 'USER' },
    ];

    const findUser = db.prepare('SELECT id FROM users WHERE email = ?');
    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, campus_id, user_category, operational_role, account_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    for (const u of seedUsers) {
      const exists = findUser.get(u.email);
      if (!exists) {
        const hash = bcrypt.hashSync(u.pass, saltRounds);
        insertUser.run(u.name, u.email, u.phone, hash, campusId, u.cat, u.role);
      }
    }

    // 3. Outlets
    const seedOutlets = [
      { id: 1, name: 'Central Canteen', slug: 'central-canteen', desc: 'Everyday comfort meals, fresh tiffin, and live chaat.', loc: 'Ground Floor · Main Building', open: '08:00', close: '19:30', status: 'ACTIVE', crowd: 'MODERATE', wait: 12, ownerId: 2 },
      { id: 2, name: 'South Indian Corner', slug: 'south-indian-corner', desc: 'Crisp dosas, idlis, vadas & filter coffee.', loc: 'Food Court · North Wing', open: '07:30', close: '18:00', status: 'ACTIVE', crowd: 'LOW', wait: 7, ownerId: 3 },
      { id: 3, name: 'Beverage & Snack Station', slug: 'beverage-station', desc: 'Cutting chai, cold coffee, sandwiches, and bakery treats.', loc: 'Library Quadrangle', open: '08:00', close: '20:30', status: 'ACTIVE', crowd: 'HIGH', wait: 15, ownerId: 4 },
    ];

    const findOutlet = db.prepare('SELECT id FROM outlets WHERE slug = ?');
    const insertOutlet = db.prepare(`
      INSERT INTO outlets (campus_id, outlet_name, slug, description, location, opening_time, closing_time, outlet_status, crowd_level, avg_wait_min, vendor_owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const o of seedOutlets) {
      const exists = findOutlet.get(o.slug);
      if (!exists) {
        insertOutlet.run(campusId, o.name, o.slug, o.desc, o.loc, o.open, o.close, o.status, o.crowd, o.wait, o.ownerId);
      }
    }

    // 4. Outlet Staff
    const seedStaff = [
      { outlet_id: 1, user_id: 2, role: 'MANAGER' },
      { outlet_id: 2, user_id: 3, role: 'MANAGER' },
      { outlet_id: 3, user_id: 4, role: 'MANAGER' },
    ];

    const findStaff = db.prepare('SELECT id FROM outlet_staff WHERE outlet_id = ? AND user_id = ?');
    const insertStaff = db.prepare(`
      INSERT INTO outlet_staff (outlet_id, user_id, staff_role, status)
      VALUES (?, ?, ?, 'ACTIVE')
    `);

    for (const s of seedStaff) {
      if (!findStaff.get(s.outlet_id, s.user_id)) {
        insertStaff.run(s.outlet_id, s.user_id, s.role);
      }
    }

    // 5. Menu Categories
    const seedCats = [
      { outlet_id: 1, name: 'Popular', desc: 'Campus crowd favorites', order: 1 },
      { outlet_id: 1, name: 'Mains & Meals', desc: 'Filling and nutritious hot plates', order: 2 },
      { outlet_id: 1, name: 'Quick Snacks', desc: 'Fast grab-and-go bites', order: 3 },
      { outlet_id: 2, name: 'Breakfast & Tiffin', desc: 'Freshly steamed and griddled South Indian fare', order: 1 },
      { outlet_id: 2, name: 'Combos', desc: 'Pairings with filter coffee', order: 2 },
      { outlet_id: 3, name: 'Hot & Cold Brews', desc: 'Teas, coffees and refreshers', order: 1 },
      { outlet_id: 3, name: 'Bites & Bakery', desc: 'Puffs, buns and cookies', order: 2 },
    ];

    const findCat = db.prepare('SELECT id FROM menu_categories WHERE outlet_id = ? AND category_name = ?');
    const insertCat = db.prepare(`
      INSERT INTO menu_categories (outlet_id, category_name, description, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const c of seedCats) {
      if (!findCat.get(c.outlet_id, c.name)) {
        insertCat.run(c.outlet_id, c.name, c.desc, c.order);
      }
    }

    // 6. Menu Items
    const seedFoods = [
      {
        outlet_id: 1, category_name: 'Popular', name: 'Mumbai Pav Bhaji',
        desc: 'Slow-simmered spiced bhaji with melting butter slab, served with buttered toasted pav & fresh chopped onions.',
        price: 80.0, img: PAV_BHAJI_IMG, food_type: 'VEG', tags: ['JAIN', 'POPULAR'], allergens: ['DAIRY', 'GLUTEN'],
        prep: 8, stock: 45, order: 1, popular: 1,
      },
      {
        outlet_id: 1, category_name: 'Popular', name: 'Authentic Mumbai Vada Pav',
        desc: 'The classic DJSCE campus fuel: Spiced golden batata vada in pav, layered with red garlic chutney & fried chilli.',
        price: 25.0, img: VADA_PAV_IMG, food_type: 'VEG', tags: ['POPULAR'], allergens: ['GLUTEN'],
        prep: 4, stock: 60, order: 2, popular: 1,
      },
      {
        outlet_id: 1, category_name: 'Mains & Meals', name: 'Paneer Butter Masala',
        desc: 'Silky tomato-cashew makhani gravy with tender cottage cheese, fresh cream swirl & warm butter tandoori naan.',
        price: 120.0, img: PANEER_BUTTER_IMG, food_type: 'VEG', tags: ['NORTH_INDIAN'], allergens: ['DAIRY', 'NUTS', 'GLUTEN'],
        prep: 12, stock: 30, order: 3, popular: 1,
      },
      {
        outlet_id: 1, category_name: 'Mains & Meals', name: 'Campus Special Veg Thali',
        desc: 'Complete student meal: 2 Phulkas, Paneer Subzi, Dal Tadka, Steamed Jeera Rice, Curd & Gulab Jamun.',
        price: 90.0, img: PANEER_BUTTER_IMG, food_type: 'VEG', tags: ['JAIN', 'THALI'], allergens: ['DAIRY', 'GLUTEN'],
        prep: 12, stock: 40, order: 4, popular: 0,
      },
      {
        outlet_id: 1, category_name: 'Quick Snacks', name: 'Grilled Paneer Wrap',
        desc: 'Spiced paneer tikka slices with crunchy bell peppers, mint yogurt dressing and pickled onions rolled in flatbread.',
        price: 80.0, img: VADA_PAV_IMG, food_type: 'VEG', tags: ['QUICK_BITES'], allergens: ['DAIRY', 'GLUTEN'],
        prep: 7, stock: 25, order: 5, popular: 0,
      },
      {
        outlet_id: 2, category_name: 'Breakfast & Tiffin', name: 'Mysore Masala Dosa',
        desc: 'Crisp roasted fermented rice crepe smeared with spicy red chutney, stuffed with spiced potato bhaji, served with coconut chutney & sambar.',
        price: 70.0, img: MASALA_DOSA_IMG, food_type: 'VEG', tags: ['SOUTH_INDIAN', 'JAIN'], allergens: ['MUSTARD'],
        prep: 10, stock: 50, order: 1, popular: 1,
      },
      {
        outlet_id: 2, category_name: 'Breakfast & Tiffin', name: 'Steamed Idli Sambar (2 Pcs)',
        desc: 'Pillow-soft steamed rice & lentil cakes dipped in hot aromatic drumstick sambar with tempered coconut chutney.',
        price: 45.0, img: MASALA_DOSA_IMG, food_type: 'VEG', tags: ['SOUTH_INDIAN', 'JAIN', 'LOW_CALORIE'], allergens: [],
        prep: 5, stock: 40, order: 2, popular: 0,
      },
      {
        outlet_id: 2, category_name: 'Combos', name: 'South Indian Tiffin Combo',
        desc: '1 Mini Masala Dosa + 1 Steamed Idli + 1 Medu Vada with hot filter coffee.',
        price: 110.0, img: MASALA_DOSA_IMG, food_type: 'VEG', tags: ['COMBO'], allergens: ['DAIRY'],
        prep: 12, stock: 20, order: 3, popular: 1,
      },
      {
        outlet_id: 3, category_name: 'Hot & Cold Brews', name: 'Special Cutting Chai',
        desc: 'Double cardamom, crushed ginger, boiled strong Assam CTC tea with thick boiled milk.',
        price: 15.0, img: MASALA_DOSA_IMG, food_type: 'VEG', tags: ['BEVERAGE'], allergens: ['DAIRY'],
        prep: 3, stock: 120, order: 1, popular: 1,
      },
      {
        outlet_id: 3, category_name: 'Hot & Cold Brews', name: 'Chilled Cold Coffee with Ice Cream',
        desc: 'Thick espresso blitz with milk and ice, topped with a scoop of vanilla ice cream & cocoa dusting.',
        price: 60.0, img: PAV_BHAJI_IMG, food_type: 'VEG', tags: ['BEVERAGE', 'DESSERT'], allergens: ['DAIRY'],
        prep: 5, stock: 35, order: 2, popular: 1,
      },
      {
        outlet_id: 1, category_name: 'Mains & Meals', name: 'Chicken Dum Biryani',
        desc: 'Fragrant basmati rice layered with marinated chicken, saffron, fried onions, and served with cucumber raita.',
        price: 120.0, img: MASALA_DOSA_IMG, food_type: 'NON_VEG', tags: ['NON_VEG', 'BIRYANI'], allergens: ['DAIRY'],
        prep: 15, stock: 0, order: 6, popular: 1,
      },
      {
        outlet_id: 1, category_name: 'Mains & Meals', name: 'Amritsari Chole Bhature',
        desc: 'Two huge puffed golden bhaturas served with spicy dark Punjabi chole, pickle and onion rings.',
        price: 90.0, img: PAV_BHAJI_IMG, food_type: 'VEG', tags: ['NORTH_INDIAN'], allergens: ['GLUTEN'],
        prep: 12, stock: 30, order: 7, popular: 1,
      },
    ];

    const findFood = db.prepare('SELECT id FROM menu_items WHERE outlet_id = ? AND item_name = ?');
    const insertFood = db.prepare(`
      INSERT INTO menu_items (
        outlet_id, category_id, item_name, description, price, image_url,
        food_type, dietary_tags, allergens, preparation_time, availability_status,
        stock_quantity, display_order, rating, is_popular
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of seedFoods) {
      if (!findFood.get(f.outlet_id, f.name)) {
        const cat = db.prepare('SELECT id FROM menu_categories WHERE outlet_id = ? AND category_name = ?').get(f.outlet_id, f.category_name) as any;
        const catId = cat?.id || 1;
        const status = f.stock > 0 ? 'AVAILABLE' : 'SOLD_OUT';
        insertFood.run(
          f.outlet_id, catId, f.name, f.desc, f.price, f.img,
          f.food_type, JSON.stringify(f.tags), JSON.stringify(f.allergens),
          f.prep, status, f.stock, f.order, 4.8, f.popular
        );
      }
    }

    // 7. Outlet Tables
    const seedTables = [
      { id: 1, outlet_id: 1, num: 'T-01', cap: 4, loc: 'Main Hall · Window Side', status: 'available' },
      { id: 2, outlet_id: 1, num: 'T-02', cap: 4, loc: 'Main Hall · Central', status: 'occupied' },
      { id: 3, outlet_id: 1, num: 'T-03', cap: 2, loc: 'Main Hall · Quick Nook', status: 'available' },
      { id: 4, outlet_id: 1, num: 'T-04', cap: 6, loc: 'Booth A · Faculty Corner', status: 'available' },
      { id: 5, outlet_id: 1, num: 'T-05', cap: 4, loc: 'Courtyard Veranda', status: 'available' },
      { id: 6, outlet_id: 1, num: 'T-06', cap: 4, loc: 'Courtyard Veranda', status: 'occupied' },
      { id: 7, outlet_id: 1, num: 'T-07', cap: 2, loc: 'High Top · Express Bar', status: 'available' },
      { id: 8, outlet_id: 1, num: 'T-08', cap: 6, loc: 'Booth B · Study Group', status: 'available' },
      { id: 9, outlet_id: 1, num: 'T-09', cap: 4, loc: 'South Terrace', status: 'occupied' },
      { id: 10, outlet_id: 1, num: 'T-10', cap: 4, loc: 'South Terrace', status: 'available' },
      { id: 11, outlet_id: 1, num: 'T-11', cap: 2, loc: 'Library Exit Zone', status: 'available' },
      { id: 12, outlet_id: 1, num: 'T-12', cap: 6, loc: 'Booth C · Lounge Area', status: 'available' },
    ];

    const findTable = db.prepare('SELECT id FROM outlet_tables WHERE outlet_id = ? AND table_number = ?');
    const insertTable = db.prepare(`
      INSERT INTO outlet_tables (outlet_id, table_number, capacity, location, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const t of seedTables) {
      if (!findTable.get(t.outlet_id, t.num)) {
        insertTable.run(t.outlet_id, t.num, t.cap, t.loc, t.status);
      }
    }

    // 8. Initial notifications for student user
    const noteCount = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = 5').get() as any;
    if (noteCount.c === 0) {
      const insNote = db.prepare(`
        INSERT INTO notifications (user_id, title, body, type, read, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', ?))
      `);
      insNote.run(5, 'Welcome to BYTE', 'Your campus meal companion is ready. Browse canteens, order dishes, and reserve dining tables.', 'announcement', 0, '-20 minutes');
      insNote.run(5, 'Lunch Rush Advisory', 'Central Canteen rush expected between 12:45 PM and 1:30 PM. Order ahead to skip counter lines.', 'rush', 0, '-10 minutes');
    }
  });

  console.log('[BYTE DB] Safe per-record upsert seeding verified successfully.');
}
