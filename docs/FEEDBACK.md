# Доска обратной связи (/feedback)

Публичная страница `/feedback` — простой «форум» для сбора идей, вопросов и замечаний по прототипу. Записи видят все, можно прикрепить скриншот. Ссылку даём тестировщикам напрямую — вход (гейт) не нужен.

Хранилище — бесплатный **Supabase** (PostgREST + Storage). Запросы идут через нативный `fetch`, минуя mock/auth-интерсепторы приложения. `anon`-ключ публичный по дизайну Supabase — доступ ограничивают RLS-политики, поэтому ключ безопасно держать в бандле.

## Подключение (один раз, ~5 минут)

### 1. Создать проект Supabase
[supabase.com](https://supabase.com) → New project (бесплатный тариф). Запомните пароль БД (для входа в проект; в приложении он не нужен).

### 2. Создать таблицу и политики
Project → **SQL Editor** → New query → вставить и выполнить:

```sql
-- Таблица записей
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     text not null,
  category   text not null default 'idea',
  message    text not null,
  image_url  text
);

-- Публичная доска: любой может читать и добавлять записи
alter table public.feedback enable row level security;

create policy "feedback public read"
  on public.feedback for select using (true);

create policy "feedback public insert"
  on public.feedback for insert with check (true);
```

### 3. Создать бакет для скриншотов
Project → **Storage** → New bucket → имя `feedback-screenshots` → включить **Public bucket** → создать.

Затем SQL Editor (разрешаем анонимную загрузку; публичное чтение даёт сам public-бакет):

```sql
create policy "feedback screenshots upload"
  on storage.objects for insert to anon
  with check (bucket_id = 'feedback-screenshots');
```

### 4. Вставить ключи в код
Project → **Settings → API**, скопировать **Project URL** и **anon public** ключ. Вставить в
[`src/app/features/feedback/feedback.config.ts`](../src/app/features/feedback/feedback.config.ts):

```ts
export const FEEDBACK_SUPABASE = {
  url: 'https://ВАШ-ПРОЕКТ.supabase.co',
  anonKey: 'ВАШ-ANON-КЛЮЧ',
  table: 'feedback',
  bucket: 'feedback-screenshots',
} as const;
```

Пересобрать/задеплоить. Пока `url`/`anonKey` пустые — страница показывает эту инструкцию вместо ленты.

## Что хранится

| Поле | Что |
|------|-----|
| `author` | имя автора (запоминается в браузере, чтобы не вводить повторно) |
| `category` | `idea` · `question` · `problem` · `other` |
| `message` | текст записи |
| `image_url` | публичная ссылка на скриншот в Storage (или пусто) |

## Заметки

- **Спам/модерация:** доска полностью открыта (anon insert). Для небольшой группы тестировщиков это ок. Если понадобится — удалять записи можно из Supabase Table Editor; позже можно добавить простой токен/капчу.
- **Лимит скриншота** — 8 МБ (проверка на клиенте), формат — изображение.
- **Приватность (152-ФЗ):** не просим персональные данные, только имя/ник. Не собираем ничего лишнего.
