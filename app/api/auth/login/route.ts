import { NextRequest, NextResponse } from 'next/server';
import { scannerSupabase } from '@/lib/scanner-supabase';
import type { LoginResponse } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json<LoginResponse>(
        { success: false, message: 'Логин и пароль обязательны' },
        { status: 400 }
      );
    }

    // Проверяем пользователя в базе данных
    const { data: user, error } = await scannerSupabase
      .rpc('verify_user_password', {
        p_username: username,
        p_password: password,
      });

    if (error || !user || user.length === 0) {
      // Попробуем альтернативный способ - получить пользователя и проверить пароль
      const { data: userData, error: userError } = await scannerSupabase
        .from('scanner_users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (userError || !userData) {
        return NextResponse.json<LoginResponse>(
          { success: false, message: 'Неверный логин или пароль' },
          { status: 401 }
        );
      }

      // Проверяем пароль через SQL функцию
      const { data: isValid, error: verifyError } = await scannerSupabase
        .rpc('check_password', {
          input_password: password,
          stored_hash: userData.password_hash,
        });

      if (verifyError || !isValid) {
        return NextResponse.json<LoginResponse>(
          { success: false, message: 'Неверный логин или пароль' },
          { status: 401 }
        );
      }

      // Пароль верный
      const userResponse = {
        username: userData.username,
        name: userData.name,
        role: userData.role as 'admin' | 'scanner',
        created_at: userData.created_at,
        updated_at: userData.updated_at,
      };

      const token = generateToken(userData.id, username);

      const response = NextResponse.json<LoginResponse>({
        success: true,
        message: 'Авторизация успешна',
        user: userResponse,
        token,
      });

      setAuthCookies(response, token, userResponse);
      return response;
    }

    // Если RPC функция сработала
    const userData = user[0];
    const userResponse = {
      username: userData.username,
      name: userData.name,
      role: userData.role as 'admin' | 'scanner',
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    const token = generateToken(userData.id, username);

    const response = NextResponse.json<LoginResponse>({
      success: true,
      message: 'Авторизация успешна',
      user: userResponse,
      token,
    });

    setAuthCookies(response, token, userResponse);
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<LoginResponse>(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

function generateToken(userId: string, username: string): string {
  const timestamp = Date.now();
  const payload = JSON.stringify({ userId, username, timestamp });
  return Buffer.from(payload).toString('base64');
}

function setAuthCookies(
  response: NextResponse,
  token: string,
  user: { username: string; name: string; role: 'admin' | 'scanner'; created_at: string; updated_at: string }
) {
  response.cookies.set('scanner_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 часа
    path: '/',
  });

  response.cookies.set('scanner_user', JSON.stringify(user), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}
