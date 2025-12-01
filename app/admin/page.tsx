'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  X,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Radio,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { scannerSupabase } from '@/lib/scanner-supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ScannerUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'scanner';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'scanner';
}

interface ScannerStat {
  user: {
    id: string;
    username: string;
    name: string;
    is_active: boolean;
  };
  stats: {
    total: number;
    success: number;
    error: number;
    already_used: number;
    not_found: number;
  };
  lastScan: string | null;
}

interface RecentScan {
  id: string;
  ticket_number: string;
  scan_result: 'success' | 'error' | 'already_used' | 'not_found';
  scanned_at: string;
  scanner: {
    id: string;
    username: string;
    name: string;
  } | null;
}

interface StatsData {
  totalStats: {
    total: number;
    success: number;
    error: number;
    already_used: number;
    not_found: number;
  };
  scannerStats: ScannerStat[];
  recentScans: RecentScan[];
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');

  // Users state
  const [users, setUsers] = useState<ScannerUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof scannerSupabase.channel> | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<ScannerUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    name: '',
    role: 'scanner',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
      } else {
        setUsersError(data.message);
      }
    } catch {
      setUsersError('Ошибка загрузки пользователей');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setStatsError(data.message);
      }
    } catch {
      setStatsError('Ошибка загрузки статистики');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'admin') {
        router.push('/');
        return;
      }
      fetchUsers();
      fetchStats();
    }
  }, [authLoading, user, router, fetchUsers, fetchStats]);

  // Realtime subscription
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // Создаём канал для прослушивания изменений в scan_logs
    const channel = scannerSupabase
      .channel('scan_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_logs',
        },
        () => {
          // При новом сканировании обновляем статистику
          fetchStats();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        scannerSupabase.removeChannel(channelRef.current);
      }
    };
  }, [user, fetchStats]);

  const openAddForm = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', name: '', role: 'scanner' });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (userToEdit: ScannerUser) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      password: '',
      name: userToEdit.name,
      role: userToEdit.role,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      if (editingUser) {
        const updateData: Record<string, unknown> = {
          name: formData.name,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }

        const response = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        const data = await response.json();
        if (!data.success) {
          setFormError(data.message);
          return;
        }
      } else {
        if (!formData.password) {
          setFormError('Пароль обязателен для нового пользователя');
          return;
        }

        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await response.json();
        if (!data.success) {
          setFormError(data.message);
          return;
        }
      }

      closeForm();
      fetchUsers();
    } catch {
      setFormError('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserActive = async (userToToggle: ScannerUser) => {
    try {
      const response = await fetch(`/api/admin/users/${userToToggle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !userToToggle.is_active }),
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
      }
    } catch {
      setUsersError('Ошибка обновления статуса');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
      } else {
        setUsersError(data.message);
      }
    } catch {
      setUsersError('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScanResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return <Badge className="bg-green-500">Успешно</Badge>;
      case 'already_used':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Уже использован</Badge>;
      case 'not_found':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Не найден</Badge>;
      default:
        return <Badge variant="destructive">Ошибка</Badge>;
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Админ-панель</h1>
                <p className="text-xs text-muted-foreground">Управление сканерами</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container px-4 py-6 max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Пользователи
            </TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${isRealtimeConnected ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  {isRealtimeConnected ? 'Live' : 'Отключено'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoadingStats}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>

            {isLoadingStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : statsError ? (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{statsError}</p>
              </div>
            ) : stats ? (
              <>
                {/* Total Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.totalStats.total}</p>
                          <p className="text-xs text-muted-foreground">Всего</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.totalStats.success}</p>
                          <p className="text-xs text-muted-foreground">Успешных</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.totalStats.already_used}</p>
                          <p className="text-xs text-muted-foreground">Повторных</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stats.totalStats.not_found + stats.totalStats.error}</p>
                          <p className="text-xs text-muted-foreground">Ошибок</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Scanner Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Статистика по сканерам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.scannerStats.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Нет данных</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.scannerStats.map((scanner) => (
                          <div
                            key={scanner.user.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                <Shield className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{scanner.user.name}</p>
                                <p className="text-xs text-muted-foreground">@{scanner.user.username}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className="font-bold">{scanner.stats.total}</p>
                                <p className="text-xs text-muted-foreground">Всего</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-green-500">{scanner.stats.success}</p>
                                <p className="text-xs text-muted-foreground">Успешно</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-orange-500">{scanner.stats.already_used}</p>
                                <p className="text-xs text-muted-foreground">Повторно</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="font-bold text-destructive">{scanner.stats.not_found + scanner.stats.error}</p>
                                <p className="text-xs text-muted-foreground">Ошибки</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Scans */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Последние сканирования</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.recentScans.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Нет сканирований</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.recentScans.slice(0, 20).map((scan) => (
                          <div
                            key={scan.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[120px] sm:max-w-none">
                                {scan.ticket_number}
                              </code>
                              {getScanResultBadge(scan.scan_result)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                              <span className="hidden sm:inline">{scan.scanner?.name || 'Неизвестно'}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(scan.scanned_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openAddForm} className="gap-2">
                <Plus className="w-4 h-4" />
                Добавить
              </Button>
            </div>

            {usersError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{usersError}</p>
              </div>
            )}

            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <Card key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              u.role === 'admin' ? 'bg-primary/10' : 'bg-secondary'
                            }`}
                          >
                            {u.role === 'admin' ? (
                              <ShieldCheck className="w-5 h-5 text-primary" />
                            ) : (
                              <Shield className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{u.name}</span>
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                {u.role === 'admin' ? 'Админ' : 'Сканер'}
                              </Badge>
                              {!u.is_active && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Неактивен
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleUserActive(u)}
                            title={u.is_active ? 'Деактивировать' : 'Активировать'}
                          >
                            {u.is_active ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteUser(u.id)}
                            disabled={deletingId === u.id}
                            className="text-destructive hover:text-destructive"
                          >
                            {deletingId === u.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {users.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Нет пользователей</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Логин</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    disabled={!!editingUser || isSaving}
                    required
                    placeholder="scanner11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Имя</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isSaving}
                    required
                    placeholder="Сканер 11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Пароль {editingUser && '(оставьте пустым, чтобы не менять)'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      disabled={isSaving}
                      required={!editingUser}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Роль</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'admin' | 'scanner') =>
                      setFormData({ ...formData, role: value })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scanner">Сканер</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeForm}
                    disabled={isSaving}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : editingUser ? (
                      'Сохранить'
                    ) : (
                      'Создать'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
