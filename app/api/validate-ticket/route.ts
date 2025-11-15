import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Ticket, TicketValidationResponse } from '@/types/ticket';

export async function POST(request: NextRequest) {
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
      return NextResponse.json<TicketValidationResponse>(
        { success: false, message: 'Билет не найден' },
        { status: 404 }
      );
    }

    // Проверка статуса билета
    if (ticket.status === 'used') {
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
      return NextResponse.json<TicketValidationResponse>(
        { success: false, message: 'Ошибка при обновлении билета' },
        { status: 500 }
      );
    }

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
