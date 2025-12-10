import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { scannerSupabase } from '@/lib/scanner-supabase';
import type { Ticket, TicketValidationResponse } from '@/types/ticket';

interface ExtendedTicketValidationResponse extends TicketValidationResponse {
  order_info?: {
    total_tickets: number;
    used_tickets: number;
    remaining_tickets: number;
    customer_name: string;
  };
  validated_count?: number;
}

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
    const { order_id: orderId } = body;

    if (!orderId) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: 'ID заказа не указан' },
        { status: 400 }
      );
    }

    // Параллельно запрашиваем заказ и билеты
    const [orderResult, ticketsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, customer_first_name, customer_last_name, total_tickets')
        .eq('id', orderId)
        .single(),
      supabase
        .from('tickets')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
    ]);

    const { data: order, error: orderError } = orderResult;
    const { data: tickets, error: ticketsError } = ticketsResult;

    if (orderError || !order) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: 'Заказ не найден' },
        { status: 404 }
      );
    }

    if (order.status !== 'paid') {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: `Заказ не оплачен (статус: ${order.status})` },
        { status: 400 }
      );
    }

    if (ticketsError || !tickets || tickets.length === 0) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: 'Билеты не найдены' },
        { status: 404 }
      );
    }

    const validTickets = tickets.filter(t => t.status === 'valid');
    const totalTickets = tickets.length;
    const customerName = `${order.customer_first_name} ${order.customer_last_name}`;

    if (validTickets.length === 0) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        {
          success: false,
          message: 'Все билеты уже использованы',
          order_info: {
            total_tickets: totalTickets,
            used_tickets: totalTickets,
            remaining_tickets: 0,
            customer_name: customerName
          }
        },
        { status: 400 }
      );
    }

    // Активируем все оставшиеся билеты одним запросом
    const validTicketIds = validTickets.map(t => t.id);
    const now = new Date().toISOString();

    const { data: updatedTickets, error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        used_at: now,
        updated_at: now,
      })
      .in('id', validTicketIds)
      .select();

    if (updateError || !updatedTickets) {
      return NextResponse.json<ExtendedTicketValidationResponse>(
        { success: false, message: 'Ошибка при активации билетов' },
        { status: 500 }
      );
    }

    // Логируем все активированные билеты асинхронно
    for (const ticket of updatedTickets) {
      logScan(scannerId, ticket.ticket_number || orderId, 'success');
    }

    const validatedCount = updatedTickets.length;

    return NextResponse.json<ExtendedTicketValidationResponse>({
      success: true,
      message: `Активировано ${validatedCount} билетов! Все билеты использованы (${totalTickets}/${totalTickets})`,
      validated_count: validatedCount,
      order_info: {
        total_tickets: totalTickets,
        used_tickets: totalTickets,
        remaining_tickets: 0,
        customer_name: customerName
      }
    });

  } catch (error) {
    console.error('Validate all error:', error);
    return NextResponse.json<ExtendedTicketValidationResponse>(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
