'use client';

import { useState } from 'react';
import QRScanner from '@/components/QRScanner';
import QRFileUpload from '@/components/QRFileUpload';
import ManualInput from '@/components/ManualInput';
import type { TicketValidationResponse } from '@/types/ticket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ScanMethod = 'camera' | 'file' | 'manual';

export default function Home() {
  const [scanMethod, setScanMethod] = useState<ScanMethod>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TicketValidationResponse | null>(null);

  const handleScan = async (ticketNumber: string) => {
    setIsValidating(true);
    setIsScanning(false);

    try {
      const response = await fetch('/api/validate-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_number: ticketNumber }),
      });

      const data: TicketValidationResponse = await response.json();
      setValidationResult(data);

      // Автоматически очистить результат через 8 секунд
      setTimeout(() => {
        setValidationResult(null);
      }, 8000);
    } catch (error) {
      console.error('Ошибка валидации:', error);
      setValidationResult({
        success: false,
        message: 'Ошибка соединения с сервером',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const toggleScanning = () => {
    setIsScanning(!isScanning);
    setValidationResult(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-blue-500/50">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Сканер Билетов
          </h1>
          <p className="text-slate-400 text-lg">Выберите способ проверки билета</p>
        </div>

        {/* Main Card */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Проверка билета</CardTitle>
            <CardDescription>Используйте камеру, файл или введите номер вручную</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="camera" className="w-full" onValueChange={(value) => {
              setScanMethod(value as ScanMethod);
              setIsScanning(false);
              setValidationResult(null);
            }}>
              <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
                <TabsTrigger value="camera" className="data-[state=active]:bg-blue-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Камера
                </TabsTrigger>
                <TabsTrigger value="file" className="data-[state=active]:bg-blue-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Файл
                </TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-blue-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Ввод
                </TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="space-y-4 mt-6">
                <Button
                  onClick={toggleScanning}
                  disabled={isValidating}
                  className={`w-full h-14 text-lg font-semibold ${
                    isScanning
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="6" y="6" width="8" height="8" />
                      </svg>
                      Остановить сканирование
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      Начать сканирование
                    </>
                  )}
                </Button>

                {isScanning && (
                  <div className="rounded-lg overflow-hidden border-2 border-blue-500/50 shadow-lg shadow-blue-500/20">
                    <QRScanner onScan={handleScan} isScanning={isScanning} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="file" className="mt-6">
                <QRFileUpload onScan={handleScan} />
              </TabsContent>

              <TabsContent value="manual" className="mt-6">
                <ManualInput onSubmit={handleScan} isProcessing={isValidating} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Loading */}
        {isValidating && (
          <Card className="border-blue-500/50 bg-slate-900/50 backdrop-blur shadow-xl shadow-blue-500/20">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-lg font-medium text-slate-300">Проверка билета...</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {validationResult && !isValidating && (
          <Card
            className={`backdrop-blur shadow-xl ${
              validationResult.success
                ? 'border-green-500/50 bg-green-950/30 shadow-green-500/20'
                : 'border-red-500/50 bg-red-950/30 shadow-red-500/20'
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full ${
                    validationResult.success ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {validationResult.success ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <CardTitle className={validationResult.success ? 'text-green-400' : 'text-red-400'}>
                    {validationResult.success ? 'Билет действителен!' : 'Ошибка проверки'}
                  </CardTitle>
                  <CardDescription className="text-slate-300 mt-1">
                    {validationResult.message}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {validationResult.ticket && (
              <CardContent className="space-y-4">
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-slate-200">Информация о билете</h3>
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                      <span className="text-sm font-medium text-slate-400">Номер билета</span>
                      <Badge variant="secondary" className="font-mono">
                        {validationResult.ticket.ticket_number}
                      </Badge>
                    </div>

                    {validationResult.ticket.metadata && (
                      <>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                          <span className="text-sm font-medium text-slate-400">Владелец</span>
                          <span className="text-sm font-semibold text-slate-200">
                            {validationResult.ticket.metadata.holder_name}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                          <span className="text-sm font-medium text-slate-400">Место</span>
                          <span className="text-sm font-semibold text-slate-200">
                            Зона {validationResult.ticket.metadata.seat_zone}, Ряд{' '}
                            {validationResult.ticket.metadata.seat_row}, Место{' '}
                            {validationResult.ticket.metadata.seat_number}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                          <span className="text-sm font-medium text-slate-400">Email</span>
                          <span className="text-sm font-semibold text-slate-200">
                            {validationResult.ticket.metadata.holder_email}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                          <span className="text-sm font-medium text-slate-400">Телефон</span>
                          <span className="text-sm font-semibold text-slate-200">
                            {validationResult.ticket.metadata.holder_phone}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

