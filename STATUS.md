# Project status

Snapshot на 2026-06-07. Обновляется после каждой существенной итерации.

## Что готово (можно показывать)

| Что | Файлы | Коммит |
|-----|-------|--------|
| Bootstrap проекта (Angular 20 + Taiga 5 + Tailwind + PWA + ESLint/Husky) | `angular.json`, `package.json`, `eslint.config.mjs`, `tailwind.config.js`, `src/styles/*` | `d8b5772` |
| Mock-слой: HttpInterceptor + Faker fixtures (seeded), handlers для auth/agent/dashboard/policies | `src/app/core/mock/**` | `d8b5772` |
| API-слой: ApiClient, auth/error/mock interceptors, генерация типов из OpenAPI | `src/app/core/api/**`, `src/app/core/models/api.generated.ts` | `d8b5772` |
| Login страница (phone-first, глаз пароля, забыли пароль, брендовая палитра) | `src/app/pages/login.page.{ts,html,scss}` | `eac638a` |
| MainLayout: navy header + 8-пунктовый sidebar + user dropdown | `src/app/layouts/main-layout.component.{ts,html,scss}` | (uncommitted) |
| Страница «Мои клиенты»: 10 колонок как в 1С, поиск, 4 фильтра, sticky header, статус-бейджи, skeleton/empty/error | `src/app/features/clients/clients.page.{ts,html,scss}`, `src/app/core/services/client.service.ts` | (uncommitted) |
| 7 заглушек для остальных sidebar пунктов | `src/app/features/{prolongation,health,mortgage,finance,learning,messages}/*.page.ts` | (uncommitted) |

## В работе сейчас

(ничего активного — ждём решения куда дальше)

## Бэклог приоритезированно

| # | Что | Сложность | Зависимости |
|---|-----|-----------|-------------|
| 1 | **Расчёт ОСАГО** — форма (VIN/марка/владелец) + результаты от 7 СК | Высокая (40-60 мин) | — |
| 2 | **Пролонгация** — список полисов с близким окончанием, кнопка пролонгации | Средняя (20-30 мин) | переиспользует таблицу клиентов |
| 3 | **Профиль агента** — личные данные, статистика, реквизиты для выплат | Низкая (15-20 мин) | — |
| 4 | **Главная (Дашборд)** — метрики, последние полисы, срочные действия, блок «Финансы и результаты» | Высокая (30-45 мин) | пользователь явно сказал делать в конце |
| 5 | **Detail-страница полиса** `/clients/:id` | Средняя (20-30 мин) | таблица клиентов уже есть |
| 6 | **Restore /forgot-password страница-заглушка** | Низкая (10 мин) | login ссылается |
| 7 | **`/system` styleguide** | Средняя (30 мин) | после 2-3 страниц, чтобы увидеть паттерны |
| 8 | **PATTERNS.md** — cookbook «как сделать новую страницу/сервис/handler» | Низкая (15 мин) | после styleguide |

## Известные проблемы / технический долг

- **Перезагрузка страницы (F5)** теперь восстанавливает agent profile из localStorage. Если переименовать поля в `AuthenticatedAgent` — старые ключи в localStorage могут оказаться без новых полей у уже залогиненных тестировщиков (нужен relogin).
- **api-contract.yaml** описывает `login` как «ИКП агента или email» — устарело, нужно обновить на «номер телефона» при следующем правке контракта.
- **Стили компонентов разбросаны по `.scss` страниц.** После 2-3 страниц вынести повторяющиеся блоки в `shared/components/` (`app-page-header`, `app-status-badge`, `app-data-table`).
- **`DESIGN_SYSTEM.md` отстаёт от факта** — настоящие токены в `src/styles/tokens.scss`. Синхронизировать после styleguide.
- **PWA service-worker** включён только в production-build. В dev — отключён через `isDevMode()`.
- **`@taiga-ui/styles/taiga-ui-theme.less` не активирует light-палитру через `:root` сам** — пришлось добавить атрибут `tuiTheme="light"` на `<tui-root>` в `app.ts`. Если в будущем добавлять dark mode — это точка переключения.

## Vite dev-server: критичный нюанс окружения

**Проект ДОЛЖЕН лежать в пути без пробелов и кириллицы** (`D:\aa-app\`, не `D:\Архив Claude\Прототип 3.0\`). Иначе Vite генерирует `polyfills.js` с unencoded путями (`/@fs/D:/Архив Claude/...`), браузер не может загрузить zone.js, рендерится белая страница. Junctions и `NODE_PRESERVE_SYMLINKS=1` не помогают (Vite внутри использует `fs.realpath`).

## Браузер для проверки

- ✅ **Microsoft Edge** или Chrome — F12 работает, никаких блокировок
- ⚠️ **Yandex Browser** — F12 иногда блокируется (политика Kaspersky), но визуально страница работает
- ⚠️ **Kaspersky Endpoint Security** на машине инжектит свой `main.js` в HTTP-трафик (включая localhost). Не критично для функциональности, но может ломать lazy chunks при некоторых конфигах защиты

## Команды-шпаргалка

```bash
cd D:\aa-app

npx --no-install ng serve --port 4200       # dev server (run in background)
npx --no-install ng build                    # production build
npx --no-install ng lint                     # ESLint
npm run generate:api                         # пересобрать src/app/core/models/api.generated.ts

git status                                    # husky хуки активны — lint-staged + commitlint на commit
```

## Текущий счёт работы

- **Коммитов:** 2 (bootstrap + login)
- **Файлов в репо:** ~100 (без node_modules)
- **Initial bundle (dev):** ~109 KB raw / 22 KB gzip
- **Initial bundle (prod):** ~2.79 MB raw (не оптимизирован для production метрик ещё)
- **Lazy chunks:** clients-page 42 KB, login-page 16 KB, остальные стабы по ~3 KB
