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

// PATCH - обновить пользователя
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: auth.error }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, is_active, password } = body;

    // Если меняем пароль
    if (password) {
      const { error: passwordError } = await scannerSupabase
        .rpc('update_scanner_password', {
          p_user_id: id,
          p_new_password: password,
        });

      if (passwordError) {
        console.error('Update password error:', passwordError);
        return NextResponse.json(
          { success: false, message: 'Ошибка обновления пароля' },
          { status: 500 }
        );
      }
    }

    // Обновляем остальные поля
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { error } = await scannerSupabase
      .from('scanner_users')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Update user error:', error);
      return NextResponse.json(
        { success: false, message: 'Ошибка обновления пользователя' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Пользователь успешно обновлён',
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

// DELETE - удалить пользователя
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: auth.error }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { error } = await scannerSupabase
      .from('scanner_users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete user error:', error);
      return NextResponse.json(
        { success: false, message: 'Ошибка удаления пользователя' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Пользователь успешно удалён',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, message: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
