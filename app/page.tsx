'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, History, CheckCircle2, XCircle, Clock, Ticket, User, MapPin, Loader2, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import QRScanner from '@/components/QRScanner';
import QRFileUpload from '@/components/QRFileUpload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TicketValidationResponse } from '@/types/ticket';

interface ScanHistoryItem {
  id: string;
  ticketNumber: string;
  timestamp: Date;
  result: TicketValidationResponse;
}

export default function Home() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('camera');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TicketValidationResponse | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  const handleScan = useCallback(async (ticketNumber: string) => {
    // Prevent duplicate scans while validating
    if (isValidating) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/validate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_number: ticketNumber }),
      });

      const data: TicketValidationResponse = await response.json();
      setValidationResult(data);

      // Add to history
      setScanHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ticketNumber,
          timestamp: new Date(),
          result: data,
        },
        ...prev.slice(0, 49), // Keep last 50 items
      ]);

      // Auto-clear result after 5 seconds
      setTimeout(() => {
        setValidationResult(null);
      }, 5000);
    } catch (error) {
      console.error('Validation error:', error);
      const errorResult: TicketValidationResponse = {
        success: false,
        message: 'Ошибка соединения с сервером',
      };
      setValidationResult(errorResult);

      setScanHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ticketNumber,
          timestamp: new Date(),
          result: errorResult,
        },
        ...prev.slice(0, 49),
      ]);
    } finally {
      setIsValidating(false);
    }
  }, [isValidating]);

  const clearHistory = useCallback(() => {
    setScanHistory([]);
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">QR Сканнер</h1>
              <p className="text-xs text-muted-foreground">Проверка билетов</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
                <span className="text-sm font-medium hidden sm:block">{user.name}</span>
              </div>
            )}
            {user?.role === 'admin' && scanHistory.length > 0 && (
              <Badge variant="secondary" className="gap-1.5">
                <History className="w-3 h-3" />
                {scanHistory.length}
              </Badge>
            )}
            {user?.role === 'admin' && (
              <Button variant="ghost" size="icon" onClick={() => router.push('/admin')} title="Админ-панель">
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout} title="Выйти">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container px-4 py-6 max-w-2xl mx-auto">
        {user?.role === 'admin' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="camera" className="gap-2">
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Камера</span>
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Файл</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">История</span>
                {scanHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs sm:hidden">
                    {scanHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Camera Tab */}
            <TabsContent value="camera" className="mt-0 space-y-4">
              <QRScanner onScan={handleScan} isActive={activeTab === 'camera'} />

              <p className="text-sm text-muted-foreground text-center">
                Наведите камеру на QR код билета для проверки
              </p>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-0 space-y-4">
              <QRFileUpload onScan={handleScan} />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              {scanHistory.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <History className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground text-center">
                      История сканирований пуста
                    </p>
                    <p className="text-sm text-muted-foreground/70 text-center mt-1">
                      Отсканируйте QR код, чтобы начать
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Последние {scanHistory.length} сканирований
                    </p>
                    <Button variant="ghost" size="sm" onClick={clearHistory}>
                      Очистить
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {scanHistory.map((item) => (
                      <Card key={item.id} className={cn(
                        'transition-all',
                        item.result.success ? 'border-green-500/30' : 'border-destructive/30'
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                              item.result.success ? 'bg-green-500/10' : 'bg-destructive/10'
                            )}>
                              {item.result.success ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-destructive" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-medium truncate">
                                  {item.ticketNumber}
                                </span>
                                <Badge variant={item.result.success ? 'default' : 'destructive'} className="shrink-0">
                                  {item.result.success ? 'Валидный' : 'Ошибка'}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground truncate">
                                {item.result.message}
                              </p>

                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {item.timestamp.toLocaleTimeString('ru-RU')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          /* Scanner-only view - just camera */
          <div className="space-y-4">
            <QRScanner onScan={handleScan} isActive={true} />

            <p className="text-sm text-muted-foreground text-center">
              Наведите камеру на QR код билета для проверки
            </p>
          </div>
        )}
      </div>

      {/* Validation overlay */}
      {isValidating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
          <p className="text-xl font-semibold">Проверка билета...</p>
        </div>
      )}

      {/* Result overlay */}
      {validationResult && !isValidating && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300',
            validationResult.success ? 'bg-green-500' : 'bg-destructive'
          )}
          onClick={() => setValidationResult(null)}
        >
          <div className="max-w-md w-full flex flex-col items-center text-white">
            {/* Icon */}
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 animate-in zoom-in duration-300">
              {validationResult.success ? (
                <CheckCircle2 className="w-14 h-14 text-green-500" />
              ) : (
                <XCircle className="w-14 h-14 text-destructive" />
              )}
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold mb-2 text-center">
              {validationResult.success ? 'Билет действителен!' : 'Ошибка проверки'}
            </h2>

            {/* Message */}
            <p className="text-lg text-white/90 text-center mb-6">
              {validationResult.message}
            </p>

            {/* Ticket details */}
            {(validationResult.ticket || validationResult.order_info) && (
              <Card className="w-full bg-white/20 border-white/30 backdrop-blur-sm">
                <CardContent className="p-4 space-y-3">
                  {/* Order info - показываем использование билетов */}
                  {validationResult.order_info && (
                    <>
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-white/70" />
                        <div>
                          <p className="text-xs text-white/70">Покупатель</p>
                          <p className="font-semibold">
                            {validationResult.order_info.customer_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-white/70" />
                        <div>
                          <p className="text-xs text-white/70">Билеты</p>
                          <p className="font-semibold">
                            Использовано: {validationResult.order_info.used_tickets} из {validationResult.order_info.total_tickets}
                          </p>
                          {/* Progress bar */}
                          <div className="w-full bg-white/20 rounded-full h-2 mt-1">
                            <div
                              className="bg-white rounded-full h-2 transition-all duration-300"
                              style={{
                                width: `${(validationResult.order_info.used_tickets / validationResult.order_info.total_tickets) * 100}%`
                              }}
                            />
                          </div>
                          {validationResult.order_info.remaining_tickets > 0 && (
                            <p className="text-xs text-white/70 mt-1">
                              Осталось: {validationResult.order_info.remaining_tickets}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {validationResult.ticket && (
                    <>
                      <div className="flex items-center gap-3">
                        <Ticket className="w-5 h-5 text-white/70" />
                        <div>
                          <p className="text-xs text-white/70">Номер билета</p>
                          <p className="font-mono font-semibold text-sm">
                            {validationResult.ticket.ticket_number}
                          </p>
                        </div>
                      </div>

                      {validationResult.ticket.metadata && (
                        <>
                          {/* Если нет order_info, показываем holder_name из metadata */}
                          {!validationResult.order_info && (
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-white/70" />
                              <div>
                                <p className="text-xs text-white/70">Владелец</p>
                                <p className="font-semibold">
                                  {validationResult.ticket.metadata.holder_name}
                                </p>
                              </div>
                            </div>
                          )}

                          {validationResult.ticket.metadata.seat_zone && (
                            <div className="flex items-center gap-3">
                              <MapPin className="w-5 h-5 text-white/70" />
                              <div>
                                <p className="text-xs text-white/70">Место</p>
                                <p className="font-semibold">
                                  Зона {validationResult.ticket.metadata.seat_zone}, Ряд{' '}
                                  {validationResult.ticket.metadata.seat_row}, Место{' '}
                                  {validationResult.ticket.metadata.seat_number}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-sm text-white/60 mt-6">
              Нажмите в любом месте, чтобы закрыть
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
