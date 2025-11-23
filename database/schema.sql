-- 1. Таблица загрузок (Uploads)
-- Хранит информацию о загруженных файлах
CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,                         -- 10-значный ID файла (например, '1234567890')
    filename TEXT NOT NULL,                      -- Имя файла на диске (например, '1234567890.png')
    originalname TEXT NOT NULL,                  -- Оригинальное имя файла (например, 'photo.png')
    size BIGINT NOT NULL,                        -- Размер в байтах
    mimetype TEXT NOT NULL,                      -- Тип файла (например, 'image/png')
    url TEXT NOT NULL,                           -- Полная ссылка (например, 'http://bublickrust/1234567890')
    token TEXT,                                  -- API токен, который использовался для загрузки
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Дата загрузки
);

-- 2. Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_uploads_token ON uploads(token);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_at ON uploads(uploaded_at DESC);

