import { createClient } from '@supabase/supabase-js';
import type { Ticket } from '@/types/ticket';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Используем service role key для обхода RLS при валидации билетов
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface Database {
  public: {
    Tables: {
      tickets: {
        Row: Ticket;
        Insert: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}
