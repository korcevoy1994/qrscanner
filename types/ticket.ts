export interface QRCodeData {
  ticket_number: string;
  order_id: string;
  seat_zone: string;
  seat_row: string;
  seat_number: string;
  holder_name: string;
  event_id: string;
  timestamp: number;
}

export interface TicketMetadata {
  ticket_type: string;
  seat_zone: string;
  seat_row: string;
  seat_number: string;
  price: number;
  holder_name: string;
  holder_email: string;
  holder_phone: string;
  order_number: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  seat_id: string;
  ticket_number: string;
  qr_code: QRCodeData;
  status: 'valid' | 'used' | 'cancelled';
  used_at: string | null;
  metadata: TicketMetadata | null;
  created_at: string;
  updated_at: string;
  event_id: string;
}

export interface OrderInfo {
  total_tickets: number;
  used_tickets: number;
  remaining_tickets: number;
  customer_name: string;
}

export interface TicketValidationResponse {
  success: boolean;
  message: string;
  ticket?: Ticket;
  order_info?: OrderInfo;
}
