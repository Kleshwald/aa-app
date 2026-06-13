# Project status

Snapshot на 2026-06-13. Обновляется после каждой существенной итерации.

## Что готово (можно показывать)

| Что | Файлы | Коммит |
|-----|-------|--------|
| Bootstrap проекта (Angular 20 + Taiga 5 + Tailwind + PWA + ESLint/Husky) | `angular.json`, `package.json`, `eslint.config.mjs`, `tailwind.config.js`, `src/styles/*` | `d8b5772` |
| Mock-слой: HttpInterceptor + Faker fixtures (seeded), handlers для auth/agent/dashboard/policies | `src/app/core/mock/**` | `d8b5772` |
| API-слой: ApiClient, auth/error/mock interceptors, генерация типов из OpenAPI | `src/app/core/api/**`, `src/app/core/models/api.generated.ts` | `d8b5772` |
| Login страница (phone-first, глаз пароля, забыли пароль, брендовая палитра) | `src/app/pages/login.page.{ts,html,scss}` | `eac638a` |
| MainLayout: navy header (`--header-bg #1d4e8c`) + аватар-инициалы Имя+Фамилия + ФИО/район с пином + меню с иконками + 8-пунктовый sidebar (бейдж непрочитанных на «Сообщения») + тонированная канва `--brand-50` | `src/app/layouts/main-layout.component.{ts,html,scss}`, `src/styles/tokens.scss` | `2874a00` |
| Страница «Мои клиенты»: 10 колонок как в 1С, поиск, 4 фильтра, sticky header, статус-бейджи, skeleton/empty/error, клик по строке → detail, центр-заголовок navy + строка «Итого» | `src/app/features/clients/clients.page.{ts,html,scss}`, `src/app/core/services/client.service.ts` | `8550938`, `b7258ac`, `b20ee08` |
| **Сообщения = чат поддержки агента** (НАШ UI, не виджет): полноэкранный чат, одна тема/две роли (Поддержка+Куратор) с подписями и аватарами, композер с вложениями, быстрые подсказки, мок `ChatService` (localStorage) | `src/app/features/messages/messages.page.{ts,html,scss}`, `src/app/core/services/chat.service.ts` | `9c9fdca` |
| **Detail-страница договора** `/clients/:id`: данные полиса, допполисы (cross-sell), счётчики операций, выбор документов, блок сервисов | `src/app/features/clients/client-detail.page.{ts,html,scss}`, `src/app/core/services/client-detail.service.ts`, `policies.handler.ts` | `b7258ac` |
| **Расчёт ОСАГО**: форма (страхователь/ТС/водители) → анимация опроса СК → котировки 2-5 компаний с допсервисами в модалке → оплата → успех | `src/app/features/osago/osago.page.{ts,html,scss}` | `4c3bee2` |
| **Пролонгация**: вкладки «Мои пролонгации» (статистика + поиск/фильтр) и «Поиск в РСА» (ФИО/госномер/ВУ) | `src/app/features/prolongation/prolongation.page.{ts,html,scss}`, `prolongation.service.ts`, `prolongations.handler.ts`, `prolongations.fixture.ts` | `9474c03` |
| **Обучение**: наша компактная разводящая (6 продуктов с описаниями) → детальные Tilda-страницы открываются в iframe внутри кабинета; навигация «К обучению» + «В новой вкладке» | `src/app/features/learning/learning.page.ts` | `36137c0` |
| Блок «Наши группы» внизу sidebar — Telegram + ВКонтакте | `src/app/layouts/main-layout.component.{html,scss}` | `6774407`, `b2ec7e9` |
| 3 заглушки для остальных sidebar пунктов | `src/app/features/{health,mortgage,finance}/*.page.ts` | `46a6b73` |

## В работе сейчас

**Система сообщений / поддержка — см. [docs/MESSAGING.md](./docs/MESSAGING.md)** (полный хендофф).
- ✅ Агентский чат (наш UI, мок) — готов.
- ⏳ **Активное решение: выбор РФ-бэкенда** (152-ФЗ). Демо шортлиста: **Webim** + **edna/Carrot quest**. Chatwoot Cloud отклонён для прода. Кастомный адаптер строим ТОЛЬКО после выбора (мок держит UX независимым).
- Дальше по сообщениям: дашборд куратора → звонки (Voximplant/ВАТС) → канал МАКС.

## Бэклог приоритезированно

| # | Что | Сложность | Зависимости |
|---|-----|-----------|-------------|
| 1 | **Профиль агента** — личные данные, статистика, реквизиты для выплат | Низкая (15-20 мин) | — |
| 2 | **Restore /forgot-password страница-заглушка** | Низкая (10 мин) | login ссылается |
| 3 | **`/system` styleguide** | Средняя (30 мин) | паттернов уже накопилось на 5 страниц |
| 4 | **PATTERNS.md** — cookbook «как сделать новую страницу/сервис/handler» | Низкая (15 мин) | после styleguide |
| 5 | **Главная (Дашборд)** — метрики, последние полисы, срочные действия, блок «Финансы и результаты» | Высокая (30-45 мин) | пользователь явно сказал делать в конце |

**Сделано из прошлого бэклога:** Расчёт ОСАГО (`4c3bee2`), Пролонгация (`9474c03`), Detail-страница договора (`b7258ac`).

## Известные проблемы / технический долг

- **Перезагрузка страницы (F5)** теперь восстанавливает agent profile из localStorage. Если переименовать поля в `AuthenticatedAgent` — старые ключи в localStorage могут оказаться без новых полей у уже залогиненных тестировщиков (нужен relogin).
- **api-contract.yaml** описывает `login` как «ИКП агента или email» — устарело, нужно обновить на «номер телефона» при следующем правке контракта.
- **Стили компонентов разбросаны по `.scss` страниц.** Уже 5 страниц — пора вынести повторяющиеся блоки в `shared/components/` (`app-page-header`, `app-status-badge`, `app-data-table`). `osago.page.scss` раздулся до 15.6 kB, из-за чего пришлось поднять `anyComponentStyle` error-бюджет в `angular.json` с 12 до 20 kB (warning оставлен на 4 kB как напоминание).
- **Два разных паттерна поиска.** Таблица клиентов — серверный поиск через `toObservable` + `debounceTime` + `switchMap` (правильный). Пролонгация — клиентская фильтрация через `searchTick`-сигнал, который computed `myFiltered` читает, чтобы пересчитаться при вводе в `FormControl`. При выносе в `shared/` свести к одному подходу.
- **ОСАГО: успех ведёт на `/clients`, а не на detail нового полиса** — мок не создаёт реальную запись. `setTimeout` в `issue()` это заглушка; счётчик `LOADING_TOTAL_MS = 40_000` тоже демонстрационный.
- **`DESIGN_SYSTEM.md`**: палитра синхронизирована с `tokens.scss` (брендовый navy+голубой, `--header-bg`, 3 роли цвета). Компонентные паттерны (шапка с аватаром, чат) добить при `/system` styleguide. Источник истины по токенам — `src/styles/tokens.scss`.
- **PWA service-worker** включён только в production-build. В dev — отключён через `isDevMode()`.
- **`@taiga-ui/styles/taiga-ui-theme.less` не активирует light-палитру через `:root` сам** — пришлось добавить атрибут `tuiTheme="light"` на `<tui-root>` в `app.ts`. Если в будущем добавлять dark mode — это точка переключения.

## Vite dev-server: критичный нюанс окружения

**Проект ДОЛЖЕН лежать в пути без пробелов и кириллицы** (`D:\aa-app\`, не `D:\Архив Claude\Прототип 3.0\`). Иначе Vite генерирует `polyfills.js` с unencoded путями (`/@fs/D:/Архив Claude/...`), браузер не может загрузить zone.js, рендерится белая страница. Junctions и `NODE_PRESERVE_SYMLINKS=1` не помогают (Vite внутри использует `fs.realpath`).

**`ng serve` без `--host` биндится только на IPv6 (`::1`)** на этой машине, а Windows резолвит `localhost` в IPv4 (`127.0.0.1`) первым → «сайт не открывается». Запускать **`ng serve --host 0.0.0.0 --port 4200`** (слушает IPv4) или открывать `http://127.0.0.1:4200/` напрямую.

## Браузер для проверки

- ✅ **Microsoft Edge** или Chrome — F12 работает, никаких блокировок
- ⚠️ **Yandex Browser** — F12 иногда блокируется (политика Kaspersky), но визуально страница работает
- ⚠️ **Kaspersky Endpoint Security** на машине инжектит свой `main.js` в HTTP-трафик (включая localhost). Не критично для функциональности, но может ломать lazy chunks при некоторых конфигах защиты

## Команды-шпаргалка

```bash
cd D:\aa-app

npx --no-install ng serve --host 0.0.0.0 --port 4200   # dev server (см. нюанс IPv6 ниже)
npx --no-install ng build                    # production build
npx --no-install ng lint                     # ESLint
npm run generate:api                         # пересобрать src/app/core/models/api.generated.ts

git status                                    # husky хуки активны — lint-staged + commitlint на commit
```

## Текущий счёт работы

- **Готовых страниц:** 7 (login, Мои клиенты, Detail договора, ОСАГО, Пролонгация, Сообщения/чат, Обучение) + 3 заглушки
- **⚠️ Обучение (iframe Tilda):** если `agentacademy.ru` отдаёт `X-Frame-Options`/`frame-ancestors`, iframe не отрисуется. Проверить в браузере; если блок — включить разрешение в Tilda или сменить подход. Есть запасная ссылка.
- **Lazy chunks (prod, gzip):** prolongation 5.2 KB, client-detail 4.3 KB, clients 4.1 KB, osago ~7 KB, login 2.7 KB
- **Initial bundle (prod):** ~1.19 MB raw (не оптимизирован для production метрик ещё; budget warning ожидаем)
- **Сборка/линт:** `ng build` ✅ (warnings по CSS-бюджету), `ng lint` ✅ чисто
