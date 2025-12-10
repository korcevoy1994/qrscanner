import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { scannerSupabase } from '@/lib/scanner-supabase';
import type { Ticket, TicketValidationResponse } from '@/types/ticket';

// Интерфейс для расширенного ответа с информацией о заказе
interface ExtendedTicketValidationResponse extends TicketValidationResponse {
  order_info?: {
    total_tickets: number;
    used_tickets: number;
    remaining_tickets: number;
    customer_name: string;
  };
}

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

// Парсинг QR данных - поддержка всех форматов
interface ParsedQRData {
  orderId: string | null;
  ticketNumber: string | null;
  isJson: boolean;
}

function parseQRData(qrData: string): ParsedQRData {
  try {
    const parsed = JSON.parse(qrData);

    // Формат Email QR: { ticket_id, ticket_number, ... }
    // Формат Database QR: { order_id, ticket_number, ... }
    const orderId = parsed.ticket_id || parsed.order_id || null;
    const ticketNumber = parsed.ticket_number || parsed.ticketNumber || null;

    return {
      orderId,
      ticketNumber,
      isJson: true
    };
  } catch {
    // Legacy формат - просто строка ticket_number
    return {
      orderId: null,
      ticketNumber: qrData,
      isJson: false
    };
  }
}

export async function POST(request: NextRequest) {
  const scannerId = await getCurrentScannerId();

  try {
    const body = await request.json();
    const { ticket_number: rawQrData } = body;

    if (!rawQrData) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: 'QR код не указан' },
        { status: 400 }
      );
    }

    // Парсим QR данные
    const { orderId, ticketNumber, isJson } = parseQRData(rawQrData);
    const logTicketNumber = ticketNumber || orderId || 'unknown';

    // Если есть order_id (из JSON QR) - используем новую логику
    if (orderId) {
      return await validateByOrderId(orderId, logTicketNumber, scannerId);
    }

    // Если нет order_id но есть ticket_number - используем legacy логику
    if (ticketNumber) {
      return await validateByTicketNumber(ticketNumber, scannerId);
    }

    await logScan(scannerId, logTicketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Неверный формат QR кода' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// Новая логика - валидация по order_id
async function validateByOrderId(
  orderId: string,
  logTicketNumber: string,
  scannerId: string | null
): Promise<NextResponse<ExtendedTicketValidationResponse>> {

  // 1. Ищем заказ
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, customer_first_name, customer_last_name, total_tickets')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    await logScan(scannerId, logTicketNumber, 'not_found');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Заказ не найден' },
      { status: 404 }
    );
  }

  // 2. Проверяем статус оплаты
  if (order.status !== 'paid') {
    await logScan(scannerId, logTicketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      {
        success: false,
        message: `Заказ не оплачен (статус: ${order.status})`
      },
      { status: 400 }
    );
  }

  // 3. Получаем все билеты заказа
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (ticketsError || !tickets || tickets.length === 0) {
    await logScan(scannerId, logTicketNumber, 'not_found');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Билеты не найдены для данного заказа' },
      { status: 404 }
    );
  }

  // 4. Подсчитываем статусы билетов
  const validTickets = tickets.filter(t => t.status === 'valid');
  const usedTickets = tickets.filter(t => t.status === 'used');
  const totalTickets = tickets.length;

  const customerName = `${order.customer_first_name} ${order.customer_last_name}`;

  // 5. Проверяем есть ли неиспользованные билеты
  if (validTickets.length === 0) {
    const lastUsed = usedTickets[usedTickets.length - 1];
    const lastUsedAt = lastUsed?.used_at
      ? new Date(lastUsed.used_at).toLocaleString('ru-RU')
      : 'неизвестно';

    await logScan(scannerId, logTicketNumber, 'already_used');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      {
        success: false,
        message: `Все билеты уже использованы (${usedTickets.length}/${totalTickets}). Последнее использование: ${lastUsedAt}`,
        ticket: lastUsed as Ticket,
        order_info: {
          total_tickets: totalTickets,
          used_tickets: usedTickets.length,
          remaining_tickets: 0,
          customer_name: customerName
        }
      },
      { status: 400 }
    );
  }

  // 6. Берём первый неиспользованный билет и отмечаем как использованный
  const ticketToUse = validTickets[0];

  const { data: updatedTicket, error: updateError } = await supabase
    .from('tickets')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketToUse.id)
    .select()
    .single();

  if (updateError || !updatedTicket) {
    await logScan(scannerId, logTicketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Ошибка при активации билета' },
      { status: 500 }
    );
  }

  // 7. Формируем успешный ответ
  const newUsedCount = usedTickets.length + 1;
  const newRemainingCount = validTickets.length - 1;

  await logScan(scannerId, updatedTicket.ticket_number || logTicketNumber, 'success');

  // Парсим metadata если это строка
  let metadata = updatedTicket.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = null;
    }
  }

  return NextResponse.json<ExtendedTicketValidationResponse>({
    success: true,
    message: newRemainingCount > 0
      ? `Билет активирован! Использовано: ${newUsedCount}/${totalTickets}`
      : `Билет активирован! Все билеты использованы (${newUsedCount}/${totalTickets})`,
    ticket: {
      ...updatedTicket,
      metadata
    } as Ticket,
    order_info: {
      total_tickets: totalTickets,
      used_tickets: newUsedCount,
      remaining_tickets: newRemainingCount,
      customer_name: customerName
    }
  });
}

// Legacy логика - валидация по ticket_number
async function validateByTicketNumber(
  ticketNumber: string,
  scannerId: string | null
): Promise<NextResponse<ExtendedTicketValidationResponse>> {

  // Поиск билета в базе данных
  const { data: ticket, error: fetchError } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single();

  if (fetchError || !ticket) {
    await logScan(scannerId, ticketNumber, 'not_found');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Билет не найден' },
      { status: 404 }
    );
  }

  // Проверка статуса билета
  if (ticket.status === 'used') {
    await logScan(scannerId, ticketNumber, 'already_used');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      {
        success: false,
        message: `Билет уже использован ${new Date(ticket.used_at!).toLocaleString('ru-RU')}`,
        ticket: ticket as Ticket,
      },
      { status: 400 }
    );
  }

  if (ticket.status === 'cancelled') {
    await logScan(scannerId, ticketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      {
        success: false,
        message: 'Билет отменен',
        ticket: ticket as Ticket,
      },
      { status: 400 }
    );
  }

  if (ticket.status !== 'valid') {
    await logScan(scannerId, ticketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
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
    await logScan(scannerId, ticketNumber, 'error');
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Ошибка при обновлении билета' },
      { status: 500 }
    );
  }

  await logScan(scannerId, ticketNumber, 'success');

  // Парсим metadata если это строка
  let metadata = updatedTicket.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = null;
    }
  }

  return NextResponse.json<ExtendedTicketValidationResponse>({
    success: true,
    message: 'Билет успешно активирован',
    ticket: {
      ...updatedTicket,
      metadata
    } as Ticket,
  });
}
