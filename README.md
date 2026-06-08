# Agent Academy — Прототип

Кликабельный прототип нового фронтенда B2B-платформы Agent Academy. Заменяет устаревший веб-клиент 1С:Предприятие 8.3 на современный Angular SPA. Цель — показать собственникам, тестировать на агентах, передать команде разработки.

**Это не MVP.** Реального бэкенда нет — все данные через HttpInterceptor + Faker.js. Архитектура и API-слой — финальные (как будут в продакшне), при переходе на реальную 1С отключается mock-interceptor одной переменной.

---

## С чего начать

### 1. Окружение (один раз)

- **Node.js LTS 20+** — https://nodejs.org
- **Angular CLI** — `npm install -g @angular/cli@20`
- **Git** — для коммитов
- **Edge или Chrome** — для проверки в браузере (Yandex Browser иногда блокирует DevTools)

### 2. Установка зависимостей

```bash
cd D:\aa-app
npm install
```

### 3. Запуск dev-сервера

```bash
npx ng serve --port 4200
```

Открыть http://localhost:4200/login

**Любые логин/пароль принимаются** — это прототип, авторизация мок.

### 4. Production-сборка

```bash
npx ng build
# результат в dist/agent-academy/browser
```

---

## Структура документации

| Файл | Для кого | Что внутри |
|------|----------|-----------|
| **[CLAUDE.md](./CLAUDE.md)** | AI (Claude Code, Cursor) | Entry-point для возобновления работы в новой сессии — стек, структура, принципы |
| **[STATUS.md](./STATUS.md)** | Команда | Что готово / в работе / в бэклоге, известные проблемы |
| **[PROJECT_BRIEF.md](./PROJECT_BRIEF.md)** | Все | Цели проекта, scope, 5 ключевых сценариев V1, бюджет |
| **[USER_PROFILE.md](./USER_PROFILE.md)** ⭐ | Все | Профиль аудитории на основе реальных данных 914 агентов. Критично для всех UX-решений |
| **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** | Дизайн | Принципы дизайна. **Фактические токены — в `src/styles/tokens.scss`** |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Разработка | Техническая архитектура V1 (Angular → 1С напрямую), API-слой |
| **[api-contract.yaml](./api-contract.yaml)** | Backend + Frontend | OpenAPI контракт. Источник правды для типов |
| **[.cursorrules](./.cursorrules)** | Cursor IDE | Правила для AI в Cursor (Claude использует CLAUDE.md) |

---

## Структура кода

```
src/app/
├── core/                     singleton сервисы + инфраструктура
│   ├── api/                  ApiClient + 3 interceptor (auth, error, mock)
│   ├── services/             домен (AuthService, ClientService, ...)
│   ├── models/               типы (api.generated.ts из OpenAPI)
│   ├── guards/               authGuard, guestGuard
│   └── mock/                 fixtures · handlers · helpers
├── shared/                   переиспользуемые компоненты
├── features/                 страницы по доменам (clients/, osago/, ...)
├── layouts/                  MainLayout (header+sidebar), AuthLayout
├── pages/                    login, not-found
├── app.config.ts             провайдеры
├── app.routes.ts             lazy routes
└── app.ts                    root + <tui-root>

src/styles/
├── tokens.scss               ⭐ источник правды для цветов, шрифтов, размеров
├── typography.scss           типографика
└── overrides.scss            кастомизация Taiga UI
```

---

## Ключевые технические решения

- **Angular 20.3 standalone** (no NgModules) + TypeScript strict + signals
- **Taiga UI 5** для компонентов + **Tailwind 3** для layout (через CSS-vars из tokens.scss)
- **System fonts** (Segoe UI / Inter fallback) — 0 KB на типографику
- **HttpInterceptor + Faker.js seeded** для моков (переключается одной переменной)
- **OpenAPI → TypeScript** через `openapi-typescript` (только типы, без сервисов)
- **PWA через @angular/pwa**, минимальный offline (только статика)
- **ESLint 9 flat + Prettier + Husky + Conventional Commits**

---

## Аудитория (важно для дизайна!)

- **Женщины 35-60** (68%), регионы РФ (97%, не Москва/Питер)
- Сибирь, Дальний Восток, Урал — Минусинск, Усть-Илимск, Тайшет
- **Старые компьютеры**, Windows 7/10, нестабильный 3G/4G
- **Стиль** — профессиональный российский B2B (Госуслуги, Сбербанк Онлайн, Тинькофф Бизнес)
- **НЕ** — Apple, Linear, Vercel, Notion (слишком «для разработчиков»)

См. [USER_PROFILE.md](./USER_PROFILE.md) для деталей.

---

## Что делать с готовым прототипом

1. Показ собственникам — для согласования бюджета на полноценную разработку
2. Показ команде разработки (1С + Angular) — для оценки трудозатрат
3. Тестирование на 5-10 агентах — для обратной связи до больших инвестиций
4. Использование как «скелет» — реальная разработка строится поверх прототипа

---

## Лицензия / контакты

Внутренний проект Agent Academy. Контакты команды — заполнить.

**Версия документа:** 2.0
**Обновлено:** 2026-06-07
