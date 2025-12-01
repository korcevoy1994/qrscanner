import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Выход выполнен успешно',
  });

  // Удаляем cookies
  response.cookies.delete('scanner_token');
  response.cookies.delete('scanner_user');

  return response;
}
