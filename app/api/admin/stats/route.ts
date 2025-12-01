import { NextResponse } from 'next/server';
import { scannerSupabase } from '@/lib/scanner-supabase';
import { cookies } from 'next/headers';

// Проверка админских прав
async function checkAdminAuth(): Promise<{ isAdmin: boolean; error?: string }> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('scanner_user');

  if (!userCookie) {
    return { isAdmin: false, error: 'Не авторизован' };
  }

  try {
    const user = JSON.parse(userCookie.value);
    if (user.role !== 'admin') {
      return { isAdmin: false, error: 'Недостаточно прав' };
    }
    return { isAdmin: true };
  } catch {
    return { isAdmin: false, error: 'Ошибка авторизации' };
  }
}

export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: auth.error }, { status: 403 });
  }

  try {
    // Получаем все логи сканирований с информацией о пользователях
    const { data: logs, error: logsError } = await scannerSupabase
      .from('scan_logs')
      .select(`
        id,
        ticket_number,
        scan_result,
        scanned_at,
        scanner_user_id,
        scanner_users (
          id,
          username,
          name
        )
      `)
      .order('scanned_at', { ascending: false });

    if (logsError) {
      console.error('Logs fetch error:', logsError);
      return NextResponse.json(
        { success: false, message: 'Ошибка получения логов' },
        { status: 500 }
      );
    }

    // Получаем всех пользователей для статистики
    const { data: users, error: usersError } = await scannerSupabase
      .from('scanner_users')
      .select('id, username, name, role, is_active');

    if (usersError) {
      console.error('Users fetch error:', usersError);
      return NextResponse.json(
        { success: false, message: 'Ошибка получения пользователей' },
        { status: 500 }
      );
    }

    // Считаем статистику по каждому сканеру
    const scannerStats = users
      .filter((u) => u.role === 'scanner')
      .map((user) => {
        const userLogs = logs?.filter((log) => log.scanner_user_id === user.id) || [];
        const successCount = userLogs.filter((log) => log.scan_result === 'success').length;
        const errorCount = userLogs.filter((log) => log.scan_result === 'error').length;
        const alreadyUsedCount = userLogs.filter((log) => log.scan_result === 'already_used').length;
        const notFoundCount = userLogs.filter((log) => log.scan_result === 'not_found').length;

        return {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            is_active: user.is_active,
          },
          stats: {
            total: userLogs.length,
            success: successCount,
            error: errorCount,
            already_used: alreadyUsedCount,
            not_found: notFoundCount,
          },
          lastScan: userLogs[0]?.scanned_at || null,
        };
      });

    // Общая статистика
    const totalStats = {
      total: logs?.length || 0,
      success: logs?.filter((log) => log.scan_result === 'success').length || 0,
      error: logs?.filter((log) => log.scan_result === 'error').length || 0,
      already_used: logs?.filter((log) => log.scan_result === 'already_used').length || 0,
      not_found: logs?.filter((log) => log.scan_result === 'not_found').length || 0,
    };

    // Последние 50 сканирований для детального просмотра
    const recentScans = (logs || []).slice(0, 50).map((log) => ({
      id: log.id,
      ticket_number: log.ticket_number,
      scan_result: log.scan_result,
      scanned_at: log.scanned_at,
      scanner: log.scanner_users,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalStats,
        scannerStats,
        recentScans,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
