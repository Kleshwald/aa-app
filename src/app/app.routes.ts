import { type Routes } from '@angular/router';

import { authGuard, guestGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
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
        path: 'dashboard',
        loadComponent: () =>
          import('@features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'Главная — Agent Academy',
      },
      {
        path: 'osago',
        loadComponent: () => import('@features/osago/osago.page').then((m) => m.OsagoPage),
        title: 'Расчёт ОСАГО — Agent Academy',
      },
      {
        path: 'policies',
        loadComponent: () => import('@features/policies/policies.page').then((m) => m.PoliciesPage),
        title: 'Мои полисы — Agent Academy',
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
