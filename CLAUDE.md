# Claude — Start here

Этот файл загружается автоматически Claude Code в начале каждой сессии. Цель — за 2 минуты ввести AI в контекст без лишних вопросов.

## Что за проект

**Agent Academy** — кликабельный прототип нового фронтенда B2B-платформы для российских страховых агентов. Заменяет устаревший UX веб-клиента 1С:Предприятие 8.3. Цель прототипа — показать собственникам, тестировать на 5-10 агентах, передать команде разработки. **Это не MVP**: реального бэкенда нет, все данные — моки через HttpInterceptor + Faker.js.

## Где что лежит

- **Физический путь:** `D:\aa-app\` (переехали 2026-05-26 из `D:\Архив Claude\Прототип 3.0\` — кириллица + пробелы ломали Vite dev-server, см. [`docs/migration-vite-path.md`] если будет создан).
- **Запуск dev:** `cd D:\aa-app && npx --no-install ng serve --port 4200`. Открыть в **Edge или Chrome** (Yandex Browser блокирует F12 → DevTools).
- **Build:** `npx --no-install ng build` (output → `dist/agent-academy/browser`).
- **Lint:** `npx --no-install ng lint`. Хуки husky запускают lint-staged + commitlint автоматически.

## Что читать в первую очередь (по убыванию важности)

1. **[STATUS.md](./STATUS.md)** — что готово, что в работе, что дальше
2. **[USER_PROFILE.md](./USER_PROFILE.md)** ⭐ КРИТИЧНО — реальный профиль агента (женщина 48 из Минусинска, старый ноутбук, нестабильный 3G). Каждое UX-решение проходит через этот документ.
3. **[PROJECT_BRIEF.md](./PROJECT_BRIEF.md)** — цели, scope, 5 ключевых сценариев V1
4. **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — принципы и токены (но факт ушёл вперёд — смотри `src/styles/tokens.scss` для актуальных значений)
5. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — техническая архитектура V1 (Angular напрямую к 1С, mock-interceptor)
6. **[.cursorrules](./.cursorrules)** — правила для AI (Cursor читает автоматически, Claude — добавочный контекст)
7. **[api-contract.yaml](./api-contract.yaml)** — OpenAPI контракт; типы генерируются через `npm run generate:api` → `src/app/core/models/api.generated.ts`

## Стек одной строкой

Angular 20.3 standalone (no NgModules) + TypeScript strict + Taiga UI 5 + Tailwind 3 (CSS-vars из `tokens.scss`) + Faker.js моки + @angular/pwa + ESLint 9 flat + Prettier + Husky + Conventional Commits.

## Архитектурные принципы (короткая выжимка из ARCHITECTURE.md)

- **Component → Service → ApiClient → HttpClient → Backend.** Компоненты НЕ делают HTTP-вызовы напрямую.
- **OnPush change detection** на всех компонентах (enforced ESLint).
- **inject() function**, не constructor injection (enforced).
- **Signals для UI state**, `toSignal` для async, RxJS только для HTTP и Reactive Forms.
- **Standalone components**, lazy-loaded routes.
- **Никаких `any`** (enforced).

## Где живёт код

```
src/app/
├── core/                     ← singleton сервисы, инфраструктура
│   ├── api/
│   │   ├── api-client.service.ts    единая обёртка HTTP
│   │   └── interceptors/            auth · error · mock
│   ├── services/             домен (AuthService, ClientService, ...)
│   ├── models/               TS-типы (api.generated.ts + ApiResponse)
│   ├── guards/               authGuard, guestGuard
│   └── mock/                 fixtures · handlers · helpers
├── shared/                   ✅ insurer-logo · addon-icon · calc-loader (общий экран расчёта)
├── features/                 страницы по доменам
│   ├── clients/              ✅ Мои клиенты + detail-страница договора (/clients/:id)
│   ├── osago/                ✅ Расчёт ОСАГО (форма → лоадер → котировки → оплата → договор)
│   ├── prolongation/         ✅ Пролонгации + поиск в НСИС
│   ├── health/               ✅ 3 продукта (НС / Спорт / Клещ), флоу как ОСАГО
│   ├── learning/             ✅ разводящая + Tilda в iframe
│   ├── messages/             ✅ чат поддержки агента (наш UI, мок)
│   ├── mortgage/, finance/   ⏭ заглушки
│   ├── profile/              ⏭ заглушка
│   └── dashboard/            ⏭ заглушка (делаем в конце)
├── layouts/                  MainLayout (header+sidebar), AuthLayout
├── pages/                    login, not-found
├── app.config.ts             провайдеры (interceptors, Taiga, локаль, PWA)
├── app.routes.ts             lazy routes
└── app.ts                    root <tui-root>
```

## Дизайн в одном абзаце

Профессиональный российский B2B (Госуслуги, Сбербанк, Тинькофф Бизнес), НЕ Linear/Vercel/Apple. Брендовая палитра из логотипа: navy `#0C3363` основной CTA + голубой `#3992E4` для декора. Шрифт — system (Segoe UI / Inter fallback, 0 KB). Размеры под возрастную аудиторию: body 18px, кнопки 48px, контраст ≥ 4.5:1. Десктоп-first (1366×768 минимум). См. `src/styles/tokens.scss` для всех токенов.

## Доменные факты (что неочевидно из API)

- **Раздел со списком полисов называется «Мои клиенты»** (не «Полисы») — привычное название из текущей 1С.
- **Логин — это номер телефона.** Не email, не ИКП. ИКП используется как идентификатор агента для отчётности.
- **Sidebar — 8 пунктов:** Мои клиенты · Пролонгация · ОСАГО · Здоровье · Ипотека · Мои финансы · Обучение · Сообщения.
- **Колонки таблицы клиентов — 8** (ревизия 2026-06-18): Дата · Страхователь · Объект страхования · № полиса · Продукт · Цена · Статус · Страховая компания. **ИКП и Куратор убраны из таблицы** — это атрибуты агента (одни на все строки), их место — Профиль. Объект зависит от продукта (ОСАГО — авто+госномер, НС/Антиклещ — «Здоровье», ипотека — «Недвижимость»). Сортировка — по Дате и Цене; статусы пока только «Оформлен»/«Черновик».
- **«Мои клиенты» — главная страница** (открывается после входа; **Дашборд удалён**).
- **Имена людей** (агент/клиент/куратор) — всегда **полное ФИО с отчеством**, не обрезать многоточием. Демо-агент: **Филь Виктория Викторовна**, куратор **Парфенова Оксана Анатольевна**.
- **Шапка кабинета** = логотип + имя/меню; ИКП/Куратор/регион — в Профиле; «Сообщения» — только в сайдбаре (без дубля в шапке); аватар — нейтральный силуэт.
- **«Здоровье» = 3 продукта:** Страхование от несчастного случая · Страхование спортсменов · Страхование от укуса клеща (на первой странице — карточки-селекторы с иконками).
- **После оплаты** (ОСАГО и Здоровье) агент попадает НЕ в список «Мои клиенты», а на страницу договора `/clients/:id` («Информация о договоре») — статус «Оформлен», реквизиты, документы. Договор создаётся через `POST /policies` (мок, in-memory: F5 «теряет» свежий договор).
- **КВ агента в рублях не показываем** на экранах котировок. В «Здоровье» скидка клиенту подписана **«Скидка из комиссии»** (0 / −15%); у части СК цена фиксированная (напр. по Антиклещу — Ренессанс).

## Persistent memory

Помимо этого репо у Claude есть приватная memory на машине пользователя (грузится автоматически):

```
C:\Users\Mi\.claude\projects\d--aa-app\memory\
├── MEMORY.md                            индекс
├── project_messaging_architecture.md   направление по бэкенду чата (152-ФЗ)
├── project_quote_screen_conventions.md залоченные решения по экранам котировок ОСАГО/Здоровье
├── project_issue_to_contract_flow.md   оформление → договор /clients/:id (мок POST /policies)
├── feedback_design_flow.md             как работать (code-first в браузере, ПМ+дизайнер, без Figma)
├── feedback_hub_maintenance.md         при сохранении дорабатывать панель /hub и сообщать
└── project_taiga_form_pattern.md       как делать формы на Taiga UI 5.8 (textfield/date/select)
```

Memory персональна для пользователя и не в репо. Этот `CLAUDE.md` — для команды и других машин.

## Как работаем

- **Code-first в браузере** — никаких Figma-этапов, итерируем прямо в коде (см. `feedback_design_flow.md`).
- **Одна страница за итерацию**, не «всё сразу».
- **Атомарные коммиты** с Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`).
- **Запускать в Edge/Chrome**, не Yandex Browser (там бывают блокировки F12).
- **Перед коммитом** husky запускает lint-staged. Если падает — починить, не использовать `--no-verify`.
- **Техническая панель `/hub`** (входы + документация, `src/app/features/hub/`) — живой центр управления. При каждом сохранении/хендоффе дорабатывать её документы (особенно «Карта экранов», «Бэклог», «Залоченные решения») и сообщать об этом. Держать синхронно со STATUS.md, CLAUDE.md и памятью.

## Что НЕ делать

- Не предлагать middle-слой / NestJS / GraphQL — отложено явно.
- Не использовать NgModules, only standalone.
- Не использовать `any`, не использовать constructor injection.
- Не делать формы на сырых нативных `input/select/date` — использовать Taiga UI (`tui-textfield`/`tuiInput`/`tuiInputDate`/`tuiSelect`); паттерн в `project_taiga_form_pattern.md`.
- Не пытаться быть как Linear/Vercel/Apple в дизайне.
- Не предлагать тёмную тему по умолчанию.
- Не скрывать важные функции в выпадающих меню.
- Не делать тёмный header без обсуждения — пользователь явно подтверждал navy брендовый.
