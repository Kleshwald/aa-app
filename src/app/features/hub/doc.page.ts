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
          'КВ агента в рублях НЕ показываем на экранах котировок — у проекта своя система мотивации.',
          'Категория присваивается по прогнозу сборов на месяц; КВ растёт с прогнозом.',
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
          'У Claude есть приватная файловая память на машине пользователя (проектные решения, фидбэк).',
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
          'Брендбук дополнить компонентами и их состояниями.',
          'PATTERNS.md — как сделать новую страницу / сервис / handler.',
        ],
      },
      {
        heading: 'Технический долг',
        items: [
          'Persist полиса: сейчас F5 теряет свежий договор (in-memory).',
          'Список «Мои клиенты» под новые продукты «Здоровья».',
          'Реальные КВ% и пороги категорий в «Мои финансы» и профиле.',
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
