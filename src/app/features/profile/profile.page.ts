import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { ProfileService, type AgentProfile } from '@core/services/profile.service';

const LEGAL_TYPE_LABELS: Record<AgentProfile['legalType'], string> = {
  individual: 'Физическое лицо',
  ip: 'Индивидуальный предприниматель',
  sz: 'Самозанятый',
  ul: 'Юридическое лицо',
};

@Component({
  selector: 'app-profile-page',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly profileService = inject(ProfileService);

  protected readonly profile = toSignal(this.profileService.me().pipe(map((r) => r.data)), {
    initialValue: null,
  });

  protected readonly initials = computed(() => {
    const parts = (this.profile()?.fullName ?? '').split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  protected readonly location = computed(() => {
    const p = this.profile();
    return p ? [p.region, p.district].filter(Boolean).join(', ') : '';
  });

  protected readonly legalTypeLabel = computed(() => {
    const p = this.profile();
    return p ? LEGAL_TYPE_LABELS[p.legalType] : '';
  });

  protected readonly statusLabel = computed(() => {
    switch (this.profile()?.status) {
      case 'active':
        return 'Активен';
      case 'blocked':
        return 'Заблокирован';
      default:
        return 'Неактивен';
    }
  });

  protected readonly phoneFormatted = computed(() => {
    const raw = this.profile()?.phone ?? '';
    const d = raw.replace(/\D/g, '');
    if (d.length !== 11) return raw;
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  });

  // Реквизиты — демо-данные прототипа (в моках банковских реквизитов нет).
  protected readonly payout = {
    inn: '246512345678',
    bank: 'ПАО Сбербанк',
    account: '•••• •••• •••• 4567',
    bik: '044525225',
  };

  notImplemented(): void {
    alert('Редактирование появится позже (заглушка прототипа)');
  }
}
