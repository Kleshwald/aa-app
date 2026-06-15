import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HubCard {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  badgeKind?: 'ok' | 'soon';
}

/**
 * Техническая «панель проекта» — не часть продукта для агента. Собирает входы
 * (в т.ч. по ролям) и документацию прототипа. Доступна по прямой ссылке /hub,
 * вне агентской оболочки и без гардов.
 */
@Component({
  selector: 'app-hub-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub.page.html',
  styleUrl: './hub.page.scss',
})
export class HubPage {
  protected readonly systemLogins: HubCard[] = [
    { title: 'Обычный вход', desc: 'Стандартная форма входа по телефону', href: '/login' },
    {
      title: 'Вход с регистрацией',
      desc: 'Самостоятельная регистрация агента',
      href: '/register',
      badge: 'отдельно',
      badgeKind: 'soon',
    },
  ];

  protected readonly roleLogins: HubCard[] = [
    {
      title: 'Агент',
      desc: 'Кабинет агента — основной продукт прототипа',
      href: '/login',
      badge: 'доступно',
      badgeKind: 'ok',
    },
    {
      title: 'Куратор',
      desc: 'Команда агентов, заявки, контроль продаж',
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
  ];
}
