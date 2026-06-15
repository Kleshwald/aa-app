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
  {
    path: 'register',
    loadComponent: () => import('@pages/register.page').then((m) => m.RegisterPage),
    title: 'Регистрация — Agent Academy',
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
        path: 'dashboard',
        loadComponent: () =>
          import('@features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'Главная — Agent Academy',
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
