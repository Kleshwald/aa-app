import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

interface DocSection {
  heading: string;
  items: string[];
}
interface DocContent {
  title: string;
  intro: string;
  source: string;
  sections: DocSection[];
}

const DOC_CONTENT: Record<string, DocContent> = {
  design: {
    title: 'Принципы дизайна',
    intro: 'Каждое UX-решение проходит через профиль реальной аудитории.',
    source: 'DESIGN_SYSTEM.md · USER_PROFILE.md · src/styles/tokens.scss',
    sections: [
      {
        heading: 'Аудитория',
        items: [
          'Агент — женщина около 48 лет из малого города (напр. Минусинск).',
          'Старый ноутбук, нестабильный 3G.',
          'Десктоп-first, минимальное разрешение 1366×768.',
        ],
      },
      {
        heading: 'Ориентиры',
        items: [
          'Профессиональный российский B2B: Госуслуги, Сбербанк, Тинькофф Бизнес.',
          'НЕ Linear / Vercel / Apple.',
          'Палитра из логотипа: navy #0C3363 (CTA) + голубой #3992E4 (декор).',
        ],
      },
      {
        heading: 'Размеры и контраст',
        items: [
          'Body 18px, кнопки 48px — под возрастную аудиторию.',
          'Контраст ≥ 4.5:1.',
          'Шрифт системный (Segoe UI / Inter fallback, 0 KB).',
        ],
      },
      {
        heading: 'Правила',
        items: [
          'Не прятать важные функции в выпадающих меню.',
          'Светлая тема по умолчанию — тёмную не вводим без обсуждения.',
          'Навигация и CTA крупные и явные.',
          'Числа — табличные (tabular-nums); статусы — семантические цвета.',
        ],
      },
      {
        heading: 'Экран котировок (залочено)',
        items: [
          'Карточки СК — табличное выравнивание (одинаковые колонки).',
          '«Итого» — главное число; цена продукта вторична.',
          '«?» у цены раскрывает расчёт по коэффициентам.',
          'Сортировка: Сегмент сверху, Перестраховочный пул снизу; «Лучшая цена» + зелёный.',
          'Здоровье выбирает без radio — кнопкой на карточке; «Скидка из комиссии».',
        ],
      },
    ],
  },
  product: {
    title: 'Продуктовые принципы',
    intro: 'Почему мы принимаем такие решения.',
    source: 'PROJECT_BRIEF.md · приватная память Claude',
    sections: [
      {
        heading: 'Подход',
        items: [
          'Кликабельный прототип, не MVP: бэкенда нет, данные — моки (HttpInterceptor + Faker).',
          'Code-first итерации прямо в браузере, без Figma-этапов.',
          'Одна страница за итерацию, атомарные коммиты.',
        ],
      },
      {
        heading: 'Мотивация и КВ',
        items: [
          'Категории: «Основная» (база, новым агентам 6 мес) и «Индивидуальная» (условия по соглашению).',
          'Категория присваивается по прогнозу сборов на месяц (сборы ÷ прошедшие дни × дней в месяце); КВ растёт с прогнозом.',
          'Порог продаж ОСАГО — 50 000 ₽/мес (ниже 3 месяца подряд → приостановка).',
          'КВ агента в рублях НЕ показываем на экранах котировок — у проекта своя система мотивации.',
          'Алгоритм вывода страховых «под капотом»: кто ответил / в каком порядке / по какой цене — не раскрываем.',
        ],
      },
      {
        heading: 'Потоки',
        items: [
          'После оплаты агент попадает на страницу договора /clients/:id, а не в список.',
          'Экран ожидания расчёта — позитивный, B2B-тон, без «подбираем/подобрали».',
        ],
      },
    ],
  },
  architecture: {
    title: 'Архитектура',
    intro: 'Технические принципы V1.',
    source: 'ARCHITECTURE.md · api-contract.yaml',
    sections: [
      {
        heading: 'Поток данных',
        items: [
          'Component → Service → ApiClient → HttpClient → Backend.',
          'Компоненты не делают HTTP-вызовы напрямую.',
          'Моки через mock-interceptor + Faker (in-memory, на сессию).',
        ],
      },
      {
        heading: 'Angular',
        items: [
          'Angular 20 standalone, без NgModules.',
          'OnPush на всех компонентах.',
          'inject() вместо constructor injection.',
          'Signals для UI-состояния, toSignal для async, RxJS — для HTTP и реактивных форм.',
          'Lazy-loaded routes.',
        ],
      },
      {
        heading: 'Качество',
        items: [
          'TypeScript strict, никаких any.',
          'ESLint 9 flat + Prettier + Husky + Conventional Commits.',
          'Типы из OpenAPI: npm run generate:api → api.generated.ts.',
        ],
      },
      {
        heading: 'Моки и данные',
        items: [
          'mock-interceptor + Faker (seeded): /agents/me, /policies, /prolongations, /finance/*.',
          'Данные in-memory на сессию; POST /policies создаёт договор (F5 теряет свежий полис).',
          'Данные мотивации — в FinanceResults (/finance/results).',
        ],
      },
      {
        heading: 'Общие компоненты',
        items: [
          'insurer-logo — лого СК (+ монограмма-fallback).',
          'addon-icon — иконки доп.продуктов.',
          'calc-loader — общий экран ожидания расчёта (ОСАГО + Здоровье).',
          'motivation-strip — полоса мотивации на котировках.',
        ],
      },
    ],
  },
  ai: {
    title: 'Инструкции для Клода и Курсора',
    intro: 'Как ИИ-ассистенты работают с проектом.',
    source: 'CLAUDE.md · .cursorrules · STATUS.md',
    sections: [
      {
        heading: 'Контекст',
        items: [
          'CLAUDE.md грузится автоматически в начале сессии (для команды и других машин).',
          '.cursorrules — правила для Cursor.',
          'Приватная память Claude: quote-конвенции, issue→договор, мессенджинг, дизайн-флоу, обслуживание панели.',
        ],
      },
      {
        heading: 'Запуск',
        items: [
          'dev: npx --no-install ng serve --host 0.0.0.0 --port 4200.',
          'Открывать в Edge/Chrome (Yandex Browser блокирует F12).',
          'build: ng build · lint: ng lint.',
        ],
      },
      {
        heading: 'Правила работы',
        items: [
          'Атомарные коммиты, Conventional Commits, без --no-verify.',
          'Не предлагать middle-слой / NestJS / GraphQL — отложено явно.',
          'Не вводить тёмную тему или тёмный header без обсуждения.',
          'При сохранении/хендоффе — обновлять панель /hub (документы) и сообщать об этом.',
        ],
      },
    ],
  },
  backlog: {
    title: 'Бэклог',
    intro: 'Что делаем дальше.',
    source: 'STATUS.md',
    sections: [
      {
        heading: 'Ближайшее',
        items: [
          'Регистрация агента (вход с регистрацией).',
          'Роли: кабинеты куратора и поддержки.',
          'Восстановление пароля (/forgot-password).',
          'Главная (Дашборд) — метрики и срочные действия.',
        ],
      },
      {
        heading: 'Документация',
        items: [
          'Панель /hub — дополнять документы при каждом сохранении проекта.',
          'Брендбук дополнить компонентами и их состояниями.',
          'PATTERNS.md — как сделать новую страницу / сервис / handler.',
        ],
      },
      {
        heading: 'Технический долг',
        items: [
          'Persist полиса: сейчас F5 теряет свежий договор (in-memory).',
          'Список «Мои клиенты» под новые продукты «Здоровья».',
          'Реальные КВ% и пороги категорий; структура «Индивидуальной» категории.',
        ],
      },
    ],
  },
  screens: {
    title: 'Карта экранов',
    intro: 'Что собрано в прототипе и где это лежит (маршруты).',
    source: 'src/app/app.routes.ts',
    sections: [
      {
        heading: 'Кабинет агента — готово',
        items: [
          'Вход — /login (по номеру телефона).',
          'Мои клиенты — /clients (10 колонок как в 1С, поиск, фильтры).',
          'Договор — /clients/:id (информация, документы, процессы).',
          'ОСАГО — /osago (форма → расчёт → котировки → оплата → договор).',
          'Здоровье — /health (3 продукта → расчёт → котировки → оформление → договор).',
          'Пролонгация — /prolongation (мои пролонгации + поиск в НСИС).',
          'Ипотека — /mortgage (встроенный виджет polis.online).',
          'Мои финансы — /finance (Мои результаты / К выплате / История выплат).',
          'Обучение — /learning (Tilda в iframe).',
          'Сообщения — /messages (чат поддержки, мок).',
          'Профиль — /profile (личные данные, реквизиты, документы).',
        ],
      },
      {
        heading: 'Заглушки / в работе',
        items: [
          'Главная (Дашборд) — /dashboard (делаем в конце).',
          'Регистрация — /register (отдельный этап).',
          'Роли: куратор и поддержка — кабинеты ещё не сделаны.',
        ],
      },
      {
        heading: 'Служебное',
        items: ['Панель проекта — /hub (входы + документация, эта страница).'],
      },
    ],
  },
  domain: {
    title: 'Доменные факты',
    intro: 'Что неочевидно из API и кода.',
    source: 'CLAUDE.md · приватная память Claude',
    sections: [
      {
        heading: 'Названия и вход',
        items: [
          'Список полисов называется «Мои клиенты» (не «Полисы») — как в текущей 1С.',
          'Логин — номер телефона (не email, не ИКП).',
          'ИКП — идентификатор агента для отчётности.',
        ],
      },
      {
        heading: 'Структура',
        items: [
          'Sidebar — 8 пунктов: Мои клиенты · Пролонгация · ОСАГО · Здоровье · Ипотека · Мои финансы · Обучение · Сообщения.',
          'Таблица клиентов = 10 колонок как в 1С: ИКП · Дата · Куратор · Страхователь · Объект · № полиса · Продукт · Цена · Статус · СК.',
          '«Здоровье» = 3 продукта: несчастный случай · спортсмены · укус клеща.',
        ],
      },
      {
        heading: 'Деньги и потоки',
        items: [
          'Категории мотивации: «Основная» и «Индивидуальная»; КВ — по прогнозу сборов.',
          'КВ в рублях на котировках не показываем; в «Здоровье» скидка клиенту — «Скидка из комиссии».',
          'После оплаты — страница договора /clients/:id, не список.',
        ],
      },
    ],
  },
  decisions: {
    title: 'Залоченные решения',
    intro: 'Решения, которые не переоткрываем без явной причины.',
    source: 'приватная память Claude · STATUS.md',
    sections: [
      {
        heading: 'Дизайн и UX',
        items: [
          'Брендовый navy header (не тёмный без обсуждения); светлая тема по умолчанию.',
          'Не прятать важные функции в выпадающих меню; крупные размеры под аудиторию.',
        ],
      },
      {
        heading: 'Котировки и мотивация',
        items: [
          'Табличное выравнивание карточек; «Итого»-герой; «?»-поповер расчёта.',
          'Сортировка Сегмент сверху / Пул снизу; «Лучшая цена».',
          'Без КВ в рублях; общий calc-loader (B2B-тон, без «подбираем»).',
          'Здоровье выбирает без radio — кнопкой на карточке; «Скидка из комиссии».',
        ],
      },
      {
        heading: 'Архитектура',
        items: [
          'Standalone + OnPush + inject() + signals; без NgModules и any.',
          'Без middle-слоя / NestJS / GraphQL — отложено явно.',
          'После оплаты → /clients/:id (мок POST /policies, in-memory).',
        ],
      },
    ],
  },
};

@Component({
  selector: 'app-hub-doc-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doc.page.html',
  styleUrl: './doc.page.scss',
})
export class DocPage {
  private readonly route = inject(ActivatedRoute);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly doc = computed<DocContent | null>(() => DOC_CONTENT[this.id()] ?? null);
}
