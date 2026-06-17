import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';

// Клиентский гейт к технической панели /hub. Это НЕ настоящая защита (пароль
// в бандле), а лёгкий барьер, чтобы панель не открывалась случайной ссылкой.
// Логин — любой телефон (форма не сверяет), пароль — точное совпадение.
export const HUB_PASSWORD = '6767';
export const HUB_UNLOCK_KEY = 'aa_hub_unlocked';

export const hubGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const router = inject(Router);
  if (sessionStorage.getItem(HUB_UNLOCK_KEY) === '1') return true;
  return router.createUrlTree(['/hub-unlock'], { queryParams: { returnUrl: state.url } });
};
