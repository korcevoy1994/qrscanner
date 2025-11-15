-- Создание таблицы tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  seat_id UUID NOT NULL,
  ticket_number TEXT NOT NULL UNIQUE,
  qr_code JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled')),
  used_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_id UUID NOT NULL
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE tickets IS 'Таблица билетов для мероприятий';
COMMENT ON COLUMN tickets.id IS 'Уникальный идентификатор билета';
COMMENT ON COLUMN tickets.order_id IS 'ID заказа, к которому относится билет';
COMMENT ON COLUMN tickets.seat_id IS 'ID места';
COMMENT ON COLUMN tickets.ticket_number IS 'Уникальный номер билета';
COMMENT ON COLUMN tickets.qr_code IS 'JSON данные для QR кода';
COMMENT ON COLUMN tickets.status IS 'Статус билета: valid, used, cancelled';
COMMENT ON COLUMN tickets.used_at IS 'Время использования билета';
COMMENT ON COLUMN tickets.metadata IS 'Дополнительная информация о билете';
COMMENT ON COLUMN tickets.event_id IS 'ID мероприятия';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - раскомментируйте при необходимости
-- ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Пример политики: разрешить чтение всем
-- CREATE POLICY "Allow public read access" ON tickets
--   FOR SELECT
--   USING (true);

-- Пример политики: разрешить обновление только для authenticated пользователей
-- CREATE POLICY "Allow authenticated users to update" ON tickets
--   FOR UPDATE
--   USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');
