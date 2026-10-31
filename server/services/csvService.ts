import bcrypt from 'bcryptjs';
import { db, runTransaction } from '../db/database';

export interface CsvPreviewResult {
  valid: boolean;
  entity_type: 'menu_items' | 'categories' | 'outlets' | 'users';
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  headers: string[];
  sample_rows: any[];
  errors: Array<{ row: number; reason: string }>;
}

export interface CsvImportResult {
  success: boolean;
  imported_count: number;
  errors_count: number;
  message: string;
  errors?: Array<{ row: number; reason: string }>;
}

// Simple RFC 4180 CSV line parser
function parseCsv(content: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.length > 0 && currentRow.some(c => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

// Strip formula injection risk (=, +, -, @)
function sanitizeCsvValue(val: string): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (['=', '+', '-', '@'].includes(trimmed.charAt(0))) {
    return "'" + trimmed;
  }
  return trimmed;
}

const REQUIRED_HEADERS: Record<string, string[]> = {
  menu_items: ['outlet_id', 'category_id', 'item_name', 'price', 'food_type'],
  categories: ['outlet_id', 'category_name'],
  outlets: ['outlet_name', 'location'],
  users: ['full_name', 'email', 'user_category', 'operational_role'],
};

export class CsvService {
  /**
   * Preview and validate CSV before executing transaction
   */
  static preview(entityType: string, csvContent: string): CsvPreviewResult {
    const rawRows = parseCsv(csvContent);
    if (rawRows.length < 2) {
      return {
        valid: false,
        entity_type: entityType as any,
        total_rows: 0,
        valid_rows_count: 0,
        invalid_rows_count: 0,
        headers: [],
        sample_rows: [],
        errors: [{ row: 1, reason: 'CSV must contain a header row and at least one data row.' }],
      };
    }

    const headers = rawRows[0].map(h => sanitizeCsvValue(h).toLowerCase());
    const expectedHeaders = REQUIRED_HEADERS[entityType];

    if (!expectedHeaders) {
      return {
        valid: false,
        entity_type: entityType as any,
        total_rows: 0,
        valid_rows_count: 0,
        invalid_rows_count: 0,
        headers,
        sample_rows: [],
        errors: [{ row: 1, reason: `Unknown entity type "${entityType}".` }],
      };
    }

    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return {
        valid: false,
        entity_type: entityType as any,
        total_rows: rawRows.length - 1,
        valid_rows_count: 0,
        invalid_rows_count: rawRows.length - 1,
        headers,
        sample_rows: [],
        errors: [{ row: 1, reason: `Missing required headers: ${missingHeaders.join(', ')}` }],
      };
    }

    const errors: Array<{ row: number; reason: string }> = [];
    const sampleRows: any[] = [];
    let validCount = 0;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = sanitizeCsvValue(row[idx] || '');
      });

      let rowValid = true;

      // Validate based on entity
      if (entityType === 'menu_items') {
        const outletId = parseInt(rowObj.outlet_id, 10);
        const categoryId = parseInt(rowObj.category_id, 10);
        const price = parseFloat(rowObj.price);
        const foodType = (rowObj.food_type || '').toUpperCase();

        if (isNaN(outletId) || outletId <= 0) {
          errors.push({ row: i + 1, reason: 'Invalid outlet_id.' });
          rowValid = false;
        }
        if (isNaN(categoryId) || categoryId <= 0) {
          errors.push({ row: i + 1, reason: 'Invalid category_id.' });
          rowValid = false;
        }
        if (isNaN(price) || price < 0) {
          errors.push({ row: i + 1, reason: 'Price must be a non-negative number.' });
          rowValid = false;
        }
        if (!['VEG', 'NON_VEG', 'EGG'].includes(foodType)) {
          errors.push({ row: i + 1, reason: 'food_type must be VEG, NON_VEG, or EGG.' });
          rowValid = false;
        }
      } else if (entityType === 'users') {
        const email = rowObj.email;
        if (!email || !email.includes('@')) {
          errors.push({ row: i + 1, reason: 'Invalid email address.' });
          rowValid = false;
        }
      }

      if (rowValid) {
        validCount++;
      }
      if (sampleRows.length < 5) {
        sampleRows.push(rowObj);
      }
    }

    return {
      valid: errors.length === 0,
      entity_type: entityType as any,
      total_rows: rawRows.length - 1,
      valid_rows_count: validCount,
      invalid_rows_count: errors.length,
      headers,
      sample_rows: sampleRows,
      errors,
    };
  }

  /**
   * Execute transactional import
   */
  static executeImport(entityType: string, csvContent: string): CsvImportResult {
    const preview = this.preview(entityType, csvContent);
    if (!preview.valid) {
      return {
        success: false,
        imported_count: 0,
        errors_count: preview.errors.length,
        message: 'CSV validation failed. Correct the errors before importing.',
        errors: preview.errors,
      };
    }

    const rawRows = parseCsv(csvContent);
    const headers = rawRows[0].map(h => sanitizeCsvValue(h).toLowerCase());

    return runTransaction(() => {
      let imported = 0;

      if (entityType === 'menu_items') {
        const insertStmt = db.prepare(`
          INSERT INTO menu_items (
            outlet_id, category_id, item_name, description, price,
            image_url, food_type, preparation_time, stock_quantity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = sanitizeCsvValue(row[idx] || '');
          });

          insertStmt.run(
            parseInt(rowObj.outlet_id, 10),
            parseInt(rowObj.category_id, 10),
            rowObj.item_name,
            rowObj.description || 'Campus Special',
            parseFloat(rowObj.price),
            rowObj.image_url || '/src/assets/images/pav_bhaji_fisheye_1793394718269.jpg',
            rowObj.food_type.toUpperCase(),
            parseInt(rowObj.preparation_time || '10', 10),
            parseInt(rowObj.stock_quantity || '50', 10)
          );
          imported++;
        }
      } else if (entityType === 'categories') {
        const insertStmt = db.prepare(`
          INSERT INTO menu_categories (outlet_id, category_name, description, display_order, is_active)
          VALUES (?, ?, ?, ?, 1)
        `);

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = sanitizeCsvValue(row[idx] || '');
          });

          insertStmt.run(
            parseInt(rowObj.outlet_id, 10),
            rowObj.category_name,
            rowObj.description || '',
            parseInt(rowObj.display_order || '0', 10)
          );
          imported++;
        }
      } else if (entityType === 'users') {
        const defaultHash = bcrypt.hashSync('ByteUser2026!', 10);
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO users (
            full_name, email, phone, password_hash, campus_id,
            user_category, operational_role, account_status
          ) VALUES (?, ?, ?, ?, 1, ?, ?, 'ACTIVE')
        `);

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = sanitizeCsvValue(row[idx] || '');
          });

          insertStmt.run(
            rowObj.full_name,
            rowObj.email,
            rowObj.phone || null,
            defaultHash,
            rowObj.user_category || 'STUDENT',
            rowObj.operational_role || 'USER'
          );
          imported++;
        }
      }

      return {
        success: true,
        imported_count: imported,
        errors_count: 0,
        message: `Successfully imported ${imported} records.`,
      };
    });
  }
}
