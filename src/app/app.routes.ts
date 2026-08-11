import { type Routes } from '@angular/router';

import { authGuard, guestGuard } from '@core/guards/auth.guard';
import { hubGuard } from '@core/guards/hub.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clients' },

  // Техническая панель проекта — вне агентской оболочки, за паролем (hubGuard).
  {
    path: 'hub-unlock',
    loadComponent: () => import('@pages/hub-unlock.page').then((m) => m.HubUnlockPage),
    title: 'Панель проекта — доступ',
  },
  {
    path: 'hub',
    loadComponent: () => import('@features/hub/hub.page').then((m) => m.HubPage),
    canActivate: [hubGuard],
    title: 'Панель проекта — Agent Academy',
  },
  {
    path: 'hub/brandbook',
    loadComponent: () => import('@features/hub/brandbook.page').then((m) => m.BrandbookPage),
    canActivate: [hubGuard],
    title: 'Брендбук — Agent Academy',
  },
  {
    path: 'hub/doc/:id',
    loadComponent: () => import('@features/hub/doc.page').then((m) => m.DocPage),
    canActivate: [hubGuard],
    title: 'Документация — Agent Academy',
  },
  // Рабочее место поддержки — отдельная роль, вне агентской оболочки.
  // За тем же гейтом, что и панель проекта: показываем владельцу и команде, агенту не нужно.
  {
    path: 'support',
    loadComponent: () => import('@features/support/support.page').then((m) => m.SupportPage),
    canActivate: [hubGuard],
    title: 'Поддержка — рабочее место',
  },
  {
    path: 'register',
    loadComponent: () => import('@pages/register.page').then((m) => m.RegisterPage),
    title: 'Регистрация — Agent Academy',
  },
  // Публичная доска обратной связи — без гарда, ссылку даём тестировщикам напрямую.
  {
    path: 'feedback',
    loadComponent: () => import('@features/feedback/feedback.page').then((m) => m.FeedbackPage),
    title: 'Обратная связь — Agent Academy',
  },

  {
    path: '',
    loadComponent: () =>
      import('@layouts/auth-layout.component').then((m) => m.AuthLayoutComponent),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('@pages/login.page').then((m) => m.LoginPage),
        title: 'Вход — Agent Academy',
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('@layouts/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'clients',
        loadComponent: () => import('@features/clients/clients.page').then((m) => m.ClientsPage),
        title: 'Мои клиенты — Agent Academy',
      },
      {
        path: 'clients/:id',
        loadComponent: () =>
          import('@features/clients/client-detail.page').then((m) => m.ClientDetailPage),
        title: 'Информация о договоре — Agent Academy',
      },
      {
        // Сделка «Согласование» — дело, у которого ещё НЕТ договора (полис только будет),
        // поэтому она не может жить под /clients/:id. Дом сделки — строка в «Мои клиенты».
        //
        // Входа «с нуля» у сделки нет и не будет: запрос тарифа рождается ВНУТРИ продукта
        // (ОСАГО ЮЛ, Автопомощник и далее), а не отдельной кнопкой «напишите в поддержку».
        // Сюда агент попадает по строке в «Мои клиенты» или из сигнала «Ждут ваших действий».
        path: 'deals/:id',
        loadComponent: () => import('@features/deals/deal.page').then((m) => m.DealPage),
        title: 'Согласование — Agent Academy',
      },
      {
        // Внесение изменений в договор — переиспользует форму ОСАГО в режиме 'change'.
        path: 'clients/:id/change',
        loadComponent: () => import('@features/osago/osago.page').then((m) => m.OsagoPage),
        data: { mode: 'change' },
        title: 'Внесение изменений — Agent Academy',
      },
      {
        // Заявка на расторжение — своя короткая форма (НЕ форма ОСАГО: другой предмет,
        // деньги и дата прекращения, а не поля полиса).
        path: 'clients/:id/cancel',
        loadComponent: () => import('@features/clients/cancel.page').then((m) => m.CancelPage),
        title: 'Расторжение договора — Agent Academy',
      },
      {
        path: 'prolongation',
        loadComponent: () =>
          import('@features/prolongation/prolongation.page').then((m) => m.ProlongationPage),
        title: 'Пролонгация — Agent Academy',
      },
      {
        path: 'osago',
        loadComponent: () => import('@features/osago/osago.page').then((m) => m.OsagoPage),
        title: 'ОСАГО — Agent Academy',
      },
      {
        path: 'health',
        loadComponent: () => import('@features/health/health.page').then((m) => m.HealthPage),
        title: 'Здоровье — Agent Academy',
      },
      {
        path: 'mortgage',
        loadComponent: () => import('@features/mortgage/mortgage.page').then((m) => m.MortgagePage),
        title: 'Ипотека — Agent Academy',
      },
      {
        path: 'finance',
        loadComponent: () => import('@features/finance/finance.page').then((m) => m.FinancePage),
        title: 'Мои финансы — Agent Academy',
      },
      {
        path: 'learning',
        loadComponent: () => import('@features/learning/learning.page').then((m) => m.LearningPage),
        title: 'Обучение — Agent Academy',
      },
      {
        path: 'messages',
        loadComponent: () => import('@features/messages/messages.page').then((m) => m.MessagesPage),
        title: 'Сообщения — Agent Academy',
      },
      {
        path: 'profile',
        loadComponent: () => import('@features/profile/profile.page').then((m) => m.ProfilePage),
        title: 'Профиль — Agent Academy',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('@pages/not-found.page').then((m) => m.NotFoundPage),
    title: 'Страница не найдена',
  },
];
