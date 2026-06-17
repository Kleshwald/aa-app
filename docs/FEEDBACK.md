# Доска обратной связи (/feedback)

Публичная страница `/feedback` — простой «форум» для сбора идей, вопросов и замечаний по прототипу. Записи видят все, можно прикрепить скриншот. Ссылку даём тестировщикам напрямую — вход (гейт) не нужен.

Хранилище — бесплатный **Supabase** (PostgREST + Storage). Запросы идут через нативный `fetch`, минуя mock/auth-интерсепторы приложения. `anon`-ключ публичный по дизайну Supabase — доступ ограничивают RLS-политики, поэтому ключ безопасно держать в бандле.

## Подключение (один раз, ~5 минут)

### 1. Создать проект Supabase
[supabase.com](https://supabase.com) → New project (бесплатный тариф). Запомните пароль БД (для входа в проект; в приложении он не нужен).

### 2. Создать таблицу и политики
Project → **SQL Editor** → New query → вставить и выполнить:

```sql
-- Таблица записей (посты и ответы — в одной таблице, ответ = parent_id != null)
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author     text not null,
  section    text not null default 'client',   -- client | arch | product
  page       text,                             -- рубрика страницы (только client)
  parent_id  uuid references public.feedback(id) on delete cascade,  -- ответ
  category   text not null default 'idea',     -- idea | question | problem | other
  message    text not null,
  image_url  text,
  likes      int  not null default 0
);

create index feedback_parent_idx on public.feedback(parent_id);

-- Публичная доска: любой может читать и добавлять записи
alter table public.feedback enable row level security;

create policy "feedback public read"
  on public.feedback for select using (true);

create policy "feedback public insert"
  on public.feedback for insert with check (true);

-- Лайки только через функцию (±1), чтобы анонимы не могли менять что угодно
create or replace function public.bump_feedback_likes(row_id uuid, delta int)
returns int language plpgsql security definer set search_path = public as $$
declare new_likes int;
begin
  if delta not in (-1, 1) then raise exception 'delta must be -1 or 1'; end if;
  update public.feedback set likes = greatest(0, likes + delta)
    where id = row_id returning likes into new_likes;
  return new_likes;
end; $$;

grant execute on function public.bump_feedback_likes(uuid, int) to anon;
```

### Если таблица уже создана раньше — миграция
Выполнить один раз в SQL Editor (безопасно, `if not exists`):

```sql
alter table public.feedback add column if not exists section   text not null default 'client';
alter table public.feedback add column if not exists page      text;
alter table public.feedback add column if not exists parent_id uuid references public.feedback(id) on delete cascade;
alter table public.feedback add column if not exists likes     int  not null default 0;
create index if not exists feedback_parent_idx on public.feedback(parent_id);

create or replace function public.bump_feedback_likes(row_id uuid, delta int)
returns int language plpgsql security definer set search_path = public as $$
declare new_likes int;
begin
  if delta not in (-1, 1) then raise exception 'delta must be -1 or 1'; end if;
  update public.feedback set likes = greatest(0, likes + delta)
    where id = row_id returning likes into new_likes;
  return new_likes;
end; $$;

grant execute on function public.bump_feedback_likes(uuid, int) to anon;
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

## Модерация (удаление записей)

Доска открыта на чтение и запись, но **удалять может только модератор** — через защищённую функцию `delete_feedback(row_id, pass)`. Пароль модерации проверяется на сервере и **не хранится в бандле** (поэтому его нельзя подсмотреть в коде сайта). Замените `ВАШ-ПАРОЛЬ-МОДЕРАЦИИ` на свой и **не коммитьте** его — он живёт только в БД:

```sql
create or replace function public.delete_feedback(row_id uuid, pass text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if pass <> 'ВАШ-ПАРОЛЬ-МОДЕРАЦИИ' then return false; end if;
  delete from public.feedback where id = row_id or parent_id = row_id;  -- пост + его ответы
  return true;
end; $$;

grant execute on function public.delete_feedback(uuid, text) to anon;
```

На странице `/feedback` внизу — ссылка **«Модерация»**: вводишь этот пароль один раз (хранится на сессию вкладки), у каждой записи появляется «Удалить». Сменить пароль — `create or replace` той же функции с новым значением.

### Очистить тестовые записи
Полный сброс ленты (выполнить в SQL Editor):

```sql
delete from public.feedback;
```

Тестовые скриншоты — Storage → бакет `feedback-screenshots` → выделить файлы → удалить.

## Что хранится

| Поле | Что |
|------|-----|
| `author` | имя автора (запоминается в браузере, чтобы не вводить повторно) |
| `section` | раздел: `client` (клиентский путь/дизайн) · `arch` (архитектура/тех) · `product` (продукт/роадмэп/бэклог) |
| `page` | рубрика страницы для раздела `client` (osago/health/clients/… или other) |
| `parent_id` | если заполнено — это ответ на пост с таким id (ветка) |
| `category` | тип: `idea` · `question` · `problem` · `other` |
| `message` | текст записи |
| `image_url` | публичная ссылка на скриншот в Storage (или пусто) |
| `likes` | счётчик лайков (меняется только функцией `bump_feedback_likes`) |

## Заметки

- **Спам/модерация:** запись открыта (anon insert), удаление — только через `delete_feedback` с паролем модерации (см. раздел «Модерация»). Для небольшой группы тестировщиков ок; при широкой раздаче можно добавить капчу.
- **Лимит скриншота** — 8 МБ (проверка на клиенте), формат — изображение.
- **Приватность (152-ФЗ):** не просим персональные данные, только имя/ник. Не собираем ничего лишнего.
