import axios, { AxiosResponse } from 'axios';

const apiBaseUrl =
  typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : '/api/v1';

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Global Response Interceptor:
 * Transparently unwraps standardized `{ success: true, data: ..., message: ... }` envelopes.
 * Guarantees that whether an endpoint returns `{ success: true, data: [...] }`
 * or a raw payload, callers get the actual entity data.
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      // Standard envelope detected
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    // Standardize error message extraction
    const serverMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      'Network or server request failed';

    error.friendlyMessage = serverMessage;
    return Promise.reject(error);
  }
);

// ==========================================
// DEFENSIVE DATA NORMALIZATION HELPERS (Part G)
// Guarantees: TypeError: .filter / .map is not a function NEVER HAPPENS
// ==========================================

export function safeArray<T>(input: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(input)) return input;
  // If input is wrapped in an envelope object, defensively extract the array
  if (input && typeof input === 'object') {
    if ('data' in input && Array.isArray((input as any).data)) {
      return (input as any).data;
    }
    if ('items' in input && Array.isArray((input as any).items)) {
      return (input as any).items;
    }
    if ('outlets' in input && Array.isArray((input as any).outlets)) {
      return (input as any).outlets;
    }
  }
  return fallback;
}

export function safeString(input: unknown, fallback = ''): string {
  if (typeof input === 'string') return input;
  if (typeof input === 'number') return String(input);
  return fallback;
}

export function safeNumber(input: unknown, fallback = 0): number {
  if (typeof input === 'number' && !isNaN(input)) return input;
  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

// ==========================================
// SHARED TYPES
// ==========================================

export type User = {
  id: number;
  name: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: 'user' | 'vendor' | 'outlet_staff' | 'admin';
  operational_role?: 'USER' | 'ADMIN' | 'VENDOR' | 'OUTLET_STAFF';
  user_type: string;
  user_category?: 'STUDENT' | 'FACULTY' | 'NON_TEACHING_STAFF';
  campus_id?: number | string;
};

export type Outlet = {
  id: number;
  name: string;
  outlet_name?: string;
  slug: string;
  description: string;
  location: string;
  status: string;
  outlet_status?: string;
  crowd_level: 'LOW' | 'MODERATE' | 'HIGH';
  avg_wait_min: number;
  available_tables: number;
  total_tables?: number;
};

export type Food = {
  id: number;
  outlet_id: number;
  category_id: number;
  name: string;
  item_name?: string;
  description: string;
  price: number;
  image_url: string;
  prep_minutes: number;
  preparation_time?: number;
  dietary_type: 'veg' | 'non_veg';
  food_type?: string;
  is_jain: boolean;
  dietary_tags?: string[];
  allergens?: string[];
  is_available: boolean;
  availability_status?: string;
  available_quantity: number | null;
  stock_quantity?: number;
  rating?: number;
  is_popular?: boolean;
  outlet_name?: string;
};

export type Order = {
  id: number;
  order_number: string;
  outlet_id: number;
  outlet_name: string;
  pickup_counter: string;
  status: 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  order_status?: string;
  total: number;
  total_amount?: number;
  payment_status?: string;
  pickup_token?: string;
  created_at: string;
  pickup_type?: 'immediate' | 'scheduled';
  scheduled_time?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price?: number;
    line_total?: number;
  }>;
};

export type Table = {
  id: number;
  outlet_id?: number;
  outlet_name?: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  location: string;
  reserved_by?: string;
  expires_at?: string;
  reservation_slot?: {
    reservation_number: string;
    start_time: string;
    end_time: string;
  };
};

export type Reservation = {
  id: number;
  reservation_number: string;
  user_id: number;
  outlet_id: number;
  outlet_name?: string;
  table_id: number;
  table_number?: string;
  capacity?: number;
  location?: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  party_size: number;
  status: string;
  reservation_status?: string;
  created_at: string;
};

export type NotificationItem = {
  id: number;
  title: string;
  body: string;
  timestamp: string;
  type: 'order' | 'pickup' | 'rush' | 'announcement' | 'reservation';
  read: boolean;
};

export type HardwareStatus = {
  device_id: string;
  device_model: string;
  ip_address: string;
  status: 'online' | 'offline' | 'syncing';
  last_sync: string;
  canteen_terminal: string;
  active_printer: boolean;
  queued_tickets: number;
  uptime_hours: number;
};

export type CanteenStatus = {
  campus: string;
  crowd_level: 'LOW' | 'MODERATE' | 'HIGH';
  average_wait_minutes: number;
  available_tables: number;
  total_tables: number;
  active_outlets_count: number;
  rush_period: string;
  outlets: Array<{
    id: number;
    name: string;
    location: string;
    crowd_level: 'LOW' | 'MODERATE' | 'HIGH';
    avg_wait_min: number;
    status: string;
  }>;
};
