import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { scannerSupabase } from '@/lib/scanner-supabase';
import type { Ticket, TicketValidationResponse } from '@/types/ticket';

// Получить ID текущего сканера из cookies
async function getCurrentScannerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('scanner_token');

  if (!tokenCookie) return null;

  try {
    const decoded = JSON.parse(Buffer.from(tokenCookie.value, 'base64').toString());
    return decoded.userId || null;
  } catch {
    return null;
  }
}

// Логировать сканирование
async function logScan(
  scannerId: string | null,
  ticketNumber: string,
  result: 'success' | 'error' | 'already_used' | 'not_found'
) {
  if (!scannerId) return;

  try {
    await scannerSupabase.from('scan_logs').insert({
      scanner_user_id: scannerId,
      ticket_number: ticketNumber,
      scan_result: result,
    });
  } catch (error) {
    console.error('Failed to log scan:', error);
  }
}

export async function POST(request: NextRequest) {
  const scannerId = await getCurrentScannerId();

  try {
    const body = await request.json();
    const { ticket_number } = body;

    if (!ticket_number) {
      return NextResponse.json<TicketValidationResponse>(
        { success: false, message: 'Номер билета не указан' },
        { status: 400 }
      );
    }

    // Поиск билета в базе данных
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticket_number)
      .single();

    if (fetchError || !ticket) {
      await logScan(scannerId, ticket_number, 'not_found');
      return NextResponse.json<TicketValidationResponse>(
        { success: false, message: 'Билет не найден' },
        { status: 404 }
      );
    }

    // Проверка статуса билета
    if (ticket.status === 'used') {
      await logScan(scannerId, ticket_number, 'already_used');
      return NextResponse.json<TicketValidationResponse>(
        {
          success: false,
          message: `Билет уже использован ${new Date(ticket.used_at!).toLocaleString('ru-RU')}`,
          ticket: ticket as Ticket,
        },
        { status: 400 }
      );
    }

    if (ticket.status === 'cancelled') {
      await logScan(scannerId, ticket_number, 'error');
      return NextResponse.json<TicketValidationResponse>(
        {
          success: false,
          message: 'Билет отменен',
          ticket: ticket as Ticket,
        },
        { status: 400 }
      );
    }

    if (ticket.status !== 'valid') {
      await logScan(scannerId, ticket_number, 'error');
      return NextResponse.json<TicketValidationResponse>(
        {
          success: false,
          message: `Недействительный статус билета: ${ticket.status}`,
          ticket: ticket as Ticket,
        },
        { status: 400 }
      );
    }

    // Обновление статуса билета на 'used'
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError || !updatedTicket) {
      await logScan(scannerId, ticket_number, 'error');
      return NextResponse.json<TicketValidationResponse>(
        { success: false, message: 'Ошибка при обновлении билета' },
        { status: 500 }
      );
    }

    await logScan(scannerId, ticket_number, 'success');
    return NextResponse.json<TicketValidationResponse>({
      success: true,
      message: 'Билет успешно активирован',
      ticket: updatedTicket as Ticket,
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json<TicketValidationResponse>(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
