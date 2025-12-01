import { createClient } from '@supabase/supabase-js';

const scannerSupabaseUrl = process.env.NEXT_PUBLIC_SCANNER_SUPABASE_URL!;
const scannerSupabaseAnonKey = process.env.NEXT_PUBLIC_SCANNER_SUPABASE_ANON_KEY!;

export const scannerSupabase = createClient(scannerSupabaseUrl, scannerSupabaseAnonKey);

// Типы для базы данных сканера
export interface ScannerUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'scanner';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScanLog {
  id: string;
  scanner_user_id: string;
  ticket_number: string;
  scan_result: 'success' | 'error' | 'already_used' | 'not_found';
  scanned_at: string;
  device_info?: string;
}
