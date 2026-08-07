import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HubCard {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  badgeKind?: 'ok' | 'soon' | 'ext';
  /** Внешняя ссылка (открывается в новой вкладке через href, не через router). */
  external?: boolean;
  /** Query-параметры для routerLink (напр. выбор UX-варианта ?ux=v2). */
  query?: Record<string, string>;
}

/**
 * Техническая «панель проекта» — не часть продукта для агента. Собирает входы
 * (в т.ч. по ролям) и документацию прототипа. Доступна по прямой ссылке /hub,
 * вне агентской оболочки и без гардов.
 */
@Component({
  selector: 'app-hub-page',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub.page.html',
  styleUrl: './hub.page.scss',
})
export class HubPage {
  protected readonly systemLogins: HubCard[] = [
    {
      title: 'Обычный вход',
      desc: 'Окно входа в платформу: имя и пароль (демо: любое имя + 6767)',
      href: '/login',
      badge: 'доступно',
      badgeKind: 'ok',
    },
    {
      title: 'Вход с регистрацией',
      desc: 'Самостоятельная регистрация агента',
      href: '/register',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
    {
      title: 'Вход в ЛК поддержки',
      desc: 'Кабинет оператора поддержки (Webim, внешний сервис)',
      href: 'https://webim.ru/chat-for-site/',
      badge: 'внешний',
      badgeKind: 'ext',
      external: true,
    },
  ];

  /**
   * Три версии обработки процессов (заявок) для сравнения владельцем. Один рантайм-флаг
   * ?ux=v1|v2|v3 (залипает в localStorage) — не три сборки. Открывать по одной: выбрал →
   * пощупал → вернулся (метка внизу слева ведёт назад сюда) → следующий. Точка входа —
   * «Мои клиенты»: там видны и сигнал в шапке, и таблица; Сообщения — в один клик.
   */
  protected readonly uxVariants: HubCard[] = [
    {
      title: 'Вариант 1 · Процессы в Сообщениях',
      desc: 'Текущая версия. Сигнал «Ждут ваших действий» в шапке ведёт в Сообщения → вкладка «Процессы» (список-указатель, клик открывает заявку на странице договора).',
      href: '/clients',
      query: { ux: 'v1' },
      badge: 'текущая',
      badgeKind: 'ok',
    },
    {
      title: 'Вариант 2 · Уведомления вверху',
      desc: 'Предыдущая версия. Сигнал в шапке ведёт в «Мои клиенты» с фильтром «ждут вас». Сообщения — только чат поддержки; заявки живут в договоре и в таблице.',
      href: '/clients',
      query: { ux: 'v2' },
      badge: 'сравнение',
      badgeKind: 'soon',
    },
    {
      title: 'Вариант 3 · Переписка в Сообщениях',
      desc: 'Уведомления вверху + переписка заявок синхронизирована в Сообщения: единый список бесед, отдельный чат на клиента. (Формат-кандидат; переписка по убытку — в контуре 152-ФЗ.)',
      href: '/clients',
      query: { ux: 'v3' },
      badge: 'сравнение',
      badgeKind: 'soon',
    },
  ];

  /**
   * Разведка форка: тот же кабинет на управляемых формах 1С:Предприятие 8.5.
   * Кликабельный прототип (внешний Artifact) + материалы для инженера, как верстать
   * реальную версию. Решение о платформе НЕ принято — см. «Почему 1С или Angular».
   */
  protected readonly platform1c: HubCard[] = [
    {
      title: 'Кликабельный прототип 1С 8.5',
      desc: 'Тот же функционал (клиенты · ОСАГО · договор · здоровье · пролонгация · сообщения) в языке интерфейса 1С 8.5: рама-«коробка» платформы (логотип 1С, вкладки форм, системные команды), наш дизайн — внутри форм. HTML-рендер, не запущенная форма. Открытая ссылка, вход не нужен.',
      href: '1c85.html',
      badge: 'вживую',
      badgeKind: 'ok',
      external: true,
    },
    {
      title: 'Брендбук для инженера — 1С 8.5',
      desc: 'Как верстать реальную версию: шрифты, размеры, палитра (hex), кнопки, поля, статусы; что платформа отдаёт и что нет.',
      href: '/hub/doc/design-1c',
    },
    {
      title: 'MCP для Cursor — пилот 8.5',
      desc: 'Как дать ИИ контекст конфигурации (метаданные · справка 8.5 · синтакс-чек), чтобы поднять качество AI-генерации кода 1С. Контур, .cursorrules, безопасность, метрика.',
      href: '/hub/doc/mcp-1c',
    },
    {
      title: 'Почему 1С или Angular',
      desc: 'Разбор развилки платформы: где проходит инженерная граница, две решающие цифры (лицензии, найм), следующий ход.',
      href: '/hub/doc/platform-1c',
    },
    {
      title: 'Система взаимодействия 1С',
      desc: 'Чат, куратор, переписка по процессу и CRM на платформе — как встроить и где ограничения (152-ФЗ, лицензии).',
      href: '/hub/doc/interaction-1c',
    },
  ];

  /** Версии и платформы — намечены на будущее, пока в разработке. */
  protected readonly platforms: HubCard[] = [
    {
      title: 'Мобильная версия',
      desc: 'Адаптив и нативное приложение для смартфона',
      href: '/hub/doc/mobile',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
    {
      title: 'Версия для планшета',
      desc: 'Раскладка интерфейса под планшет',
      href: '/hub/doc/tablet',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
    {
      title: 'Вариант на React',
      desc: 'Альтернативная реализация фронтенда на React',
      href: '/hub/doc/react',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
  ];

  protected readonly roleLogins: HubCard[] = [
    {
      title: 'Агент',
      desc: 'Кабинет агента — основной продукт (вход: любое имя + 6767)',
      href: '/login',
      badge: 'доступно',
      badgeKind: 'ok',
    },
    {
      title: 'Агент по ссылке',
      desc: 'Регистрация нового агента по приглашению: анкета → SMS-оферта → «вы в системе», сразу можно считать',
      href: '/register',
      badge: 'доступно',
      badgeKind: 'ok',
    },
    {
      title: 'Куратор',
      desc: 'Дерево «Мои агенты», добавление агента, override — в разработке (итерация 3)',
      href: '/login',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
    {
      title: 'Поддержка',
      desc: 'Рабочее место поддержки: чаты и тикеты',
      href: '/login',
      badge: 'в разработке',
      badgeKind: 'soon',
    },
  ];

  protected readonly docs: HubCard[] = [
    {
      title: 'Принципы дизайна',
      desc: 'На что опираемся, правила интерфейса',
      href: '/hub/doc/design',
    },
    { title: 'Брендбук', desc: 'Цвета, шрифты, элементы — вживую', href: '/hub/brandbook' },
    {
      title: 'Продуктовые принципы',
      desc: 'Почему мы принимаем такие решения',
      href: '/hub/doc/product',
    },
    {
      title: 'Архитектура',
      desc: 'Технические принципы и структура кода',
      href: '/hub/doc/architecture',
    },
    {
      title: 'Инструкции для Клода и Курсора',
      desc: 'CLAUDE.md, .cursorrules, память',
      href: '/hub/doc/ai',
    },
    { title: 'Карта моков / API', desc: 'Эндпоинты и фикстуры', href: '/hub/doc/api' },
    { title: 'Релиз / деплой', desc: 'GitHub Pages, доступ, обновление', href: '/hub/doc/release' },
    { title: 'Карта экранов', desc: 'Что собрано и где — маршруты', href: '/hub/doc/screens' },
    { title: 'Доменные факты', desc: 'Что неочевидно из API и кода', href: '/hub/doc/domain' },
    {
      title: 'Залоченные решения',
      desc: 'Что не переоткрываем без причины',
      href: '/hub/doc/decisions',
    },
    { title: 'Чеклист демо', desc: 'Сценарий показа по шагам', href: '/hub/doc/demo' },
    { title: 'Глоссарий', desc: 'ИКП, КВ, НСИС, сегмент, пул…', href: '/hub/doc/glossary' },
    { title: 'Профиль аудитории', desc: 'Для кого делаем продукт', href: '/hub/doc/audience' },
    { title: 'Бэклог', desc: 'Что делаем дальше, технический долг', href: '/hub/doc/backlog' },
    {
      title: 'Обратная связь — настройка',
      desc: 'Как подключить доску /feedback (Supabase)',
      href: '/hub/doc/feedback',
    },
  ];
}
