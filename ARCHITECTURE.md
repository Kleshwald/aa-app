# Agent Academy — Архитектура To-Be (V1)

## Что это за документ

Описание целевой технической архитектуры Agent Academy на этапе **V1** (первая версия нового фронтенда).

Этот документ для:
- Команды разработки (1С и Angular)
- Архитекторов и техлидов
- Собственников (общая часть)

## Главное решение

**В V1 строим простой стек:**

```
Браузер пользователя (Angular SPA + PWA)
            ↓
        HTTPS / JSON
            ↓
1С:Предприятие 8.3 (HTTP-сервисы + бизнес-логика)
```

**В V1 НЕ строим:**
- Middle-слой (Node.js)
- Микросервисы
- Insurance Gateway (отдельные сервисы для интеграций со СК)
- Очереди (RabbitMQ, Kafka)
- Server-Side Rendering
- Расширенную аналитику

**Это сознательное решение** на основе принципа YAGNI ("You Aren't Gonna Need It"): не строим то, что не нужно сегодня.

При появлении реальной потребности (нагрузка, кэширование, аналитика) — добавляем по мере необходимости.

## Общая схема

```
┌─────────────────────────────────────────────────────────┐
│           Браузер пользователя (агента)                  │
│                                                           │
│   ┌────────────────────────────────────────────────┐    │
│   │         Angular 18 SPA + PWA                    │    │
│   │                                                  │    │
│   │   Components                                     │    │
│   │       ↓                                          │    │
│   │   Services (PolicyService, AuthService, ...)    │    │
│   │       ↓                                          │    │
│   │   ApiClient (единая обёртка для HTTP)           │    │
│   │       ↓                                          │    │
│   │   HttpClient + Interceptors                     │    │
│   │   - JWT auth                                    │    │
│   │   - Error handling                              │    │
│   │   - (Mock interceptor — только в dev)           │    │
│   └────────────────┬───────────────────────────────┘    │
└────────────────────┼─────────────────────────────────────┘
                     │
                     │ HTTPS (TLS 1.2+)
                     │ JSON
                     │ JWT Bearer Token
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         1С:Предприятие 8.3 (сервер)                      │
│                                                           │
│   HTTP-сервисы (REST API)                                │
│   - /api/v1/auth/...                                     │
│   - /api/v1/agents/...                                   │
│   - /api/v1/policies/...                                 │
│   - /api/v1/calculations/...                             │
│   - /api/v1/commissions/...                              │
│                                                           │
│   Бизнес-логика (как сейчас):                            │
│   - Расчёт комиссий                                      │
│   - Интеграции с 7 СК (РЕСО, Альфа, Ингос, ...)         │
│   - Управление пользователями (агенты, кураторы)         │
│   - Документы и регистры                                 │
│   - Синхронизация с 1С Бухгалтерия (ИП/ЮЛ/СЗ)           │
│   - Синхронизация с 1С ЗУП (ФЛ)                          │
│   - Синхронизация с банком (Т-банк)                      │
│                                                           │
│   Хранилище: MS SQL Server                               │
└─────────────────────────────────────────────────────────┘
```

## Что делает каждая часть

### Angular SPA (фронтенд)

**Отвечает за:**
- Отображение UI пользователю
- Маршрутизация между страницами
- Клиентская валидация форм
- Управление состоянием (через Signals)
- Локальный кэш в Service Worker (для PWA)
- HTTP-запросы к 1С через ApiClient
- Обработка ошибок API и показ пользователю
- Показ loading/error/empty states

**НЕ отвечает за:**
- Бизнес-логику (комиссии, расчёты, правила)
- Хранение данных (только UI-state и кэш)
- Авторизацию (только сохранение JWT и его отправку)
- Интеграции с внешними системами

### 1С:Предприятие (бэкенд)

**Отвечает за:**
- Хранение всех данных (полисы, агенты, комиссии)
- Бизнес-логику (расчёты, правила, проверки)
- Серверную валидацию
- Интеграции со страховыми компаниями (как сейчас)
- Документооборот и регистры
- Авторизацию (выдача JWT-токенов)
- HTTP-сервисы для фронта (REST API по контракту OpenAPI)
- Регуляторную отчётность (ЦБ, налоговая)
- Синхронизацию с бухгалтерскими системами

**НЕ отвечает за:**
- Рендеринг UI (только данные через API)
- Обслуживание толстого клиента и веб-клиента 1С для агентов (фронт другой)

## API-коммуникация

### Протокол

- **HTTPS только** (никакого HTTP в production)
- **TLS 1.2+** (минимум)
- **JSON** в запросе и ответе
- **UTF-8** кодировка

### Авторизация

- **JWT (JSON Web Token)** в Authorization header
- Формат: `Authorization: Bearer <token>`
- **Срок жизни access token:** 15-30 минут
- **Refresh token:** для продления сессии (длительный)
- Endpoint `/auth/login` возвращает оба токена

### Формат ответа

Все endpoints возвращают единый формат:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142
  }
}
```

При ошибке:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Заполните все обязательные поля",
    "details": { "fields": ["vin", "ownerBirthDate"] }
  }
}
```

### Версионирование API

URL: `/api/v1/...`, `/api/v2/...`

При breaking changes — новая версия. Старая поддерживается ещё минимум 6 месяцев.

## Frontend стек

| Технология | Версия | Назначение |
|------------|--------|------------|
| Angular | 18 (LTS) | Фреймворк |
| TypeScript | 5.4+ | Язык (strict mode) |
| Taiga UI | 5.x | UI-библиотека |
| Tailwind CSS | 3.4+ | Стилизация layout |
| RxJS | 7.x | Асинхронные потоки |
| Angular CDK | 18 | Headless-логика |
| Lucide Angular | latest | Дополнительные иконки |
| Faker.js | 8.x | Mock-данные |
| @angular/pwa | 18 | PWA support |

## Структура frontend-проекта

```
src/
├── app/
│   ├── core/                    # Singleton-сервисы и инфраструктура
│   │   ├── api/                 # API-слой
│   │   │   ├── api-client.service.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   ├── error.interceptor.ts
│   │   │   │   └── mock.interceptor.ts (dev only)
│   │   │   └── tokens.ts
│   │   ├── services/            # Бизнес-сервисы
│   │   │   ├── auth.service.ts
│   │   │   ├── agent.service.ts
│   │   │   ├── policy.service.ts
│   │   │   ├── calculation.service.ts
│   │   │   └── ...
│   │   ├── models/              # TypeScript-типы
│   │   │   ├── agent.model.ts
│   │   │   ├── policy.model.ts
│   │   │   ├── api-response.model.ts
│   │   │   └── ...
│   │   ├── guards/              # Route guards
│   │   │   └── auth.guard.ts
│   │   └── mock/                # Mock-данные (dev only)
│   │       ├── mock-generator.ts
│   │       └── handlers/
│   ├── shared/                  # Переиспользуемые компоненты
│   │   ├── components/
│   │   ├── directives/
│   │   └── pipes/
│   ├── features/                # Бизнес-функциональность по доменам
│   │   ├── dashboard/
│   │   ├── osago/
│   │   ├── policies/
│   │   ├── clients/
│   │   ├── commissions/
│   │   ├── support/
│   │   └── profile/
│   ├── layouts/
│   │   ├── main-layout.component.ts
│   │   └── auth-layout.component.ts
│   └── pages/
│       ├── login.page.ts
│       └── not-found.page.ts
├── assets/
│   ├── fonts/
│   ├── images/
│   └── icons/
├── environments/
│   ├── environment.ts           # dev (моки)
│   ├── environment.staging.ts
│   └── environment.prod.ts
└── styles/
    ├── tokens.scss              # CSS-переменные
    ├── typography.scss
    └── overrides.scss           # Кастомизация Taiga
```

## API-слой (детально)

### Принцип: разделение ответственности

Цепочка:

```
Component → Service → ApiClient → HttpClient → Backend (1С)
```

**Компонент** знает только про свой Service.
**Service** знает про ApiClient и работает с типизированными данными.
**ApiClient** — единая точка для HTTP, добавляет общие вещи (auth, error handling).
**HttpClient** — встроенный Angular, делает реальные HTTP-запросы.

### ApiClient

```typescript
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  get<T>(endpoint: string, params?: HttpParams): Observable<ApiResponse<T>> {
    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, { params })
      .pipe(
        catchError(this.handleError),
        retry({ count: 2, delay: 1000 })
      );
  }
  
  post<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, body)
      .pipe(catchError(this.handleError));
  }
  
  // put, delete...
}
```

### Mock-стратегия

В режиме разработки `environment.useMocks = true` — подключается **MockInterceptor**:

```typescript
@Injectable()
export class MockInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    if (!environment.useMocks) return next.handle(req);
    
    // Находим mock handler для этого endpoint
    const handler = findMockHandler(req.url, req.method);
    if (!handler) return next.handle(req);
    
    // Возвращаем mock-ответ с задержкой
    return handler(req).pipe(delay(200 + Math.random() * 600));
  }
}
```

**Преимущество:** сервисы и компоненты **не знают**, что данные мок. Они работают так же, как с реальным API.

При подключении реальной 1С — `environment.useMocks = false`, и interceptor пропускает запросы.

### Версионирование environments

```typescript
// environment.ts (development)
export const environment = {
  production: false,
  useMocks: true,
  apiUrl: 'http://localhost:4200/api/v1', // не используется при mocks
  jwtStorageKey: 'agent_academy_token',
};

// environment.staging.ts
export const environment = {
  production: false,
  useMocks: false,
  apiUrl: 'https://staging-1c.agentacademy.ru/hs/api/v1',
  jwtStorageKey: 'agent_academy_token',
};

// environment.prod.ts
export const environment = {
  production: true,
  useMocks: false,
  apiUrl: 'https://b2b.agentacademy.ru/hs/api/v1',
  jwtStorageKey: 'agent_academy_token',
};
```

## OpenAPI-контракт

Файл `api-contract.yaml` в корне проекта — **источник правды** для API.

**Использование:**
- Angular-команда генерирует из него TypeScript-типы
- 1С-команда реализует HTTP-сервисы по спецификации
- Mock-handlers соответствуют контракту
- Документация генерируется автоматически (Swagger UI)

**Процесс изменений:**
1. Обсуждение нового endpoint между фронт-командой и 1С-командой
2. Обновление `api-contract.yaml`
3. Параллельная реализация на обеих сторонах
4. Тестирование на staging
5. Деплой в продакшн (синхронно)

## Окружения

### Development (локально у разработчика)

- Angular dev server (`ng serve`)
- Моки включены (HttpInterceptor)
- Hot reload
- Source maps
- HTTPS не обязателен

### Staging (тестовый сервер)

- Angular production build
- Реальная 1С (тестовая копия)
- HTTPS обязателен
- Доступ: только команда (basic auth + IP whitelist)
- Использование для:
  - QA-тестирования
  - Демо команде и собственникам
  - Интеграционных тестов с 1С

### Production (боевой сервер)

- Angular production build
- Раздача через CDN (Cloudflare/Yandex Cloud)
- Реальная 1С (продакшн)
- HTTPS обязателен (Let's Encrypt или коммерческий сертификат)
- Мониторинг (Sentry, метрики)

## Безопасность

### Авторизация

- JWT с коротким сроком жизни (15-30 мин)
- Refresh token (с длинным сроком жизни)
- При истечении access — автоматическое обновление через refresh
- При истечении refresh — редирект на /login

### CORS

1С отдаёт CORS-заголовки только для разрешённых доменов:
- `https://localhost:4200` (dev)
- `https://staging.agentacademy.ru` (staging)
- `https://b2b.agentacademy.ru` (prod)

### XSS-защита

- Angular встроенный sanitizer (по умолчанию)
- CSP headers (Content Security Policy)
- Никаких `bypassSecurityTrustHtml` без крайней необходимости

### CSRF-защита

- JWT в Authorization header (не в cookies) — встроенная защита от CSRF
- SameSite=Strict для всех необходимых cookies

### Чувствительные данные

- ❌ Не логировать данные клиентов в console
- ❌ Не отправлять полные данные полиса в публичные URL
- ✅ Маскировать номера документов в UI (например, "ХХХ-...-1234")
- ✅ Audit log на стороне 1С для всех операций

### HTTPS только

В production — никакого HTTP. Все ссылки, изображения, скрипты — HTTPS.

## Производительность

### Целевые показатели

| Метрика | Цель |
|---------|------|
| First Contentful Paint | <2.5 сек (на 3G) |
| Time to Interactive | <5 сек (на 3G) |
| Largest Contentful Paint | <2.5 сек |
| Cumulative Layout Shift | <0.1 |
| First Input Delay | <100ms |
| Lighthouse Performance | >70 (mobile slow 3G), >90 (desktop) |

### Оптимизации

#### На стороне фронта

- ✅ **Lazy loading** всех routes (каждая feature — отдельный chunk)
- ✅ **Tree shaking** через Angular CLI production build
- ✅ **Минификация** и **gzip/brotli**
- ✅ **Кэширование** через Service Worker
- ✅ **WebP/AVIF** для изображений с fallback на JPG
- ✅ **Preload** критичных ресурсов
- ✅ **Defer** некритичных скриптов

#### На стороне инфраструктуры

- ✅ **CDN** для статики (Cloudflare/Yandex Cloud)
- ✅ **HTTP/2** или HTTP/3
- ✅ **Gzip/Brotli** на сервере
- ✅ **Cache headers** для статики (`Cache-Control: public, max-age=31536000`)

#### Что НЕ делаем в V1

- ❌ Server-Side Rendering (SSR) — overkill для B2B-приложения
- ❌ Edge computing — overkill для нашего масштаба
- ❌ Сложные стратегии кэширования API — потом, через middle-слой

## PWA (Progressive Web App)

### Что включает

- ✅ **Installable** — пользователь может установить на главный экран
- ✅ **Service Worker** — кэширование статики
- ✅ **Offline fallback** — простая страница "Нет интернета, попробуйте позже"
- ✅ **App icon, splash screen, theme color**

### Что НЕ включает в V1

- ❌ Полный offline-режим (только базовый кэш)
- ❌ Push-уведомления (отложено)
- ❌ Background sync (отложено)
- ❌ Доступ к камере, контактам, файлам

## Деплой

### Frontend

- **Где хостим:** свой VPS, Yandex Cloud, или Vercel (для прототипа)
- **CI/CD:** GitHub Actions или GitLab CI
- **Процесс:**
  1. Push в `main`
  2. Автоматический build (`ng build --configuration=production`)
  3. Деплой на staging
  4. Smoke-тесты
  5. Manual approve
  6. Деплой на production

### Backend (1С)

- Отдельный процесс деплоя (как сейчас)
- HTTP-сервисы публикуются на сервере 1С
- Версионирование API позволяет деплоить независимо от фронта

### Координация релизов

При изменениях API (новые endpoints, изменения формата):
- Сначала деплой 1С (новый endpoint доступен)
- Потом деплой фронта (использует новый endpoint)
- Старый код фронта продолжает работать (если API обратно совместимо)

## Мониторинг и логирование

### Frontend

- **Sentry** — для ошибок JavaScript
- **Web Vitals** — Core Web Vitals (LCP, FID, CLS)
- **Yandex.Metrika** или **Plausible** — для бизнес-метрик

### Backend (1С)

- Существующие механизмы логирования 1С
- HTTP-логи всех API-запросов
- Регулярный аудит ошибок

## Будущая эволюция

### V2 (через 6-12 месяцев)

- Middle-слой (Node.js + Fastify или NestJS)
- Кэширование частых запросов в Redis
- Аналитика на PostgreSQL рядом с 1С
- Расширенное логирование и мониторинг

### V3 (через 12-24 месяца)

- Постепенная миграция логики из 1С в middle-слой
- Insurance Gateway (отдельный сервис для интеграций со СК)
- Чат и CRM в новом стеке
- Расширенная аналитика

### V4 (горизонт 2+ года)

- Возможный полный отказ от 1С для основной логики
- 1С только для бухгалтерии и регуляторной отчётности
- Решение принимать по факту, не сейчас

## Принципы архитектуры

### 1. Простота сейчас, расширение потом
Не строим то, что не нужно сегодня (YAGNI).

### 2. Готовность к эволюции
Код пишется так, чтобы middle-слой и другие компоненты можно было добавить без переписывания.

### 3. API-First подход
OpenAPI-контракт — источник правды. Изменения через контракт.

### 4. TypeScript strict
Типы спасают от багов в финансово-чувствительной системе.

### 5. Mobile-aware, не mobile-first
Десктоп — основной канал. Мобилка — для отдельных сценариев.

### 6. Accessibility
Система должна работать для всех агентов (включая 65+ с проблемами зрения).

### 7. Performance-first
Работаем на старых компьютерах и медленном интернете.

### 8. Безопасность по умолчанию
HTTPS, JWT, CSP, XSS protection — встроены, не добавляются потом.

## Что НЕ архитектурно решено (требует обсуждения с командой)

1. **Где хостить frontend?** Свой VPS / Yandex Cloud / Vercel?
2. **Кто будет настраивать CI/CD?** Внутренняя команда или агентство?
3. **Мониторинг ошибок:** Sentry self-hosted или SaaS?
4. **CDN:** Cloudflare работает в РФ ограниченно, Yandex Cloud — альтернатива
5. **Sentry или альтернатива** для логирования ошибок

Эти вопросы решаются с командой при старте разработки.

## Что ВНЕ скоупа архитектуры V1

- Микросервисы
- Kubernetes
- Service Mesh
- GraphQL
- Event Sourcing
- CQRS
- Real-time через WebSocket (пока не нужно)
- Machine Learning / AI инфраструктура

Это всё может появиться в V3-V4 при реальной необходимости.

---

**Версия документа:** 1.0
**Дата:** Февраль 2026
