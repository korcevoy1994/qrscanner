import { NextRequest, NextResponse } from 'next/server';
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

// GET - получить список пользователей
export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: auth.error }, { status: 403 });
  }

  const { data, error } = await scannerSupabase
    .from('scanner_users')
    .select('id, username, name, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: 'Ошибка получения данных' }, { status: 500 });
  }

  return NextResponse.json({ success: true, users: data });
}

// POST - создать нового пользователя
export async function POST(request: NextRequest) {
  const auth = await checkAdminAuth();
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: auth.error }, { status: 403 });
  }

  try {
    const { username, password, name, role = 'scanner' } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { success: false, message: 'Заполните все обязательные поля' },
        { status: 400 }
      );
    }

    // Проверяем уникальность username
    const { data: existing } = await scannerSupabase
      .from('scanner_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Пользователь с таким логином уже существует' },
        { status: 400 }
      );
    }

    // Создаём пользователя через функцию
    const { data, error } = await scannerSupabase
      .rpc('create_scanner_user', {
        p_username: username,
        p_password: password,
        p_name: name,
        p_role: role,
      });

    if (error) {
      console.error('Create user error:', error);
      return NextResponse.json(
        { success: false, message: 'Ошибка создания пользователя' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Пользователь успешно создан',
      userId: data,
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
