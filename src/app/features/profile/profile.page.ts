import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { ProfileService, type AgentProfile } from '@core/services/profile.service';

// Профиль — справочник, не флоу: 3 вкладки по поводам захода агента.
// Названия вкладок = карта поводов (слово «реквизиты» прямо в табе), чтобы
// агент 45+ с холодного входа сразу видел, куда идти (риск «не заметит вкладку»).
type Tab = 'data' | 'docs' | 'terms';

const LEGAL_TYPE_LABELS: Record<AgentProfile['legalType'], string> = {
  individual: 'Физическое лицо',
  ip: 'Индивидуальный предприниматель',
  sz: 'Самозанятый',
  ul: 'Юридическое лицо',
};

type DocStatus = 'ok' | 'pending' | 'missing';
interface AgentDoc {
  name: string;
  status: DocStatus;
  meta?: string;
}
interface SignedDoc {
  name: string;
  signedDate: string;
}
interface CommissionRow {
  product: string;
  kv: string;
}

const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  ok: 'Загружен',
  pending: 'На проверке',
  missing: 'Не загружен',
};

@Component({
  selector: 'app-profile-page',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly profileService = inject(ProfileService);

  protected readonly activeTab = signal<Tab>('data');

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

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

  // ─── Документы (демо-данные прототипа) ───
  protected readonly docStatusLabels = DOC_STATUS_LABELS;

  // Документы от агента — состав зависит от правовой формы.
  protected readonly agentDocs = computed<AgentDoc[]>(() => {
    const legal = this.profile()?.legalType;
    const legalExtra: AgentDoc[] =
      legal === 'ip'
        ? [
            {
              name: 'Свидетельство о регистрации ИП (ОГРНИП)',
              status: 'ok',
              meta: 'загружено 15.01.2024',
            },
          ]
        : legal === 'sz'
          ? [
              {
                name: 'Справка о постановке на учёт (НПД)',
                status: 'ok',
                meta: 'загружено 15.01.2024',
              },
            ]
          : legal === 'ul'
            ? [{ name: 'Учредительные документы', status: 'ok', meta: 'загружено 15.01.2024' }]
            : [];
    return [
      { name: 'Паспорт РФ', status: 'ok', meta: 'загружен 15.01.2024' },
      { name: 'СНИЛС', status: 'ok', meta: 'загружен 15.01.2024' },
      { name: 'ИНН', status: 'ok', meta: 'загружен 15.01.2024' },
      ...legalExtra,
      { name: 'Реквизиты банковского счёта', status: 'ok', meta: 'загружено 15.01.2024' },
      { name: 'Фото для профиля', status: 'missing' },
    ];
  });

  // Документы, подписанные электронной подписью.
  protected readonly signedDocs: SignedDoc[] = [
    { name: 'Агентский договор (оферта о присоединении)', signedDate: '2024-01-15' },
    { name: 'Согласие на обработку персональных данных', signedDate: '2024-01-15' },
    { name: 'Тарифное соглашение (условия КВ)', signedDate: '2024-01-15' },
  ];

  // Условия сотрудничества — базовое КВ по продуктам (демо).
  protected readonly commissions: CommissionRow[] = [
    { product: 'ОСАГО', kv: '20 %' },
    { product: 'Страхование от несчастного случая', kv: '35 %' },
    { product: 'Страхование спортсменов', kv: '30 %' },
    { product: 'Страхование от укуса клеща', kv: '25 %' },
    { product: 'Ипотека', kv: '28 %' },
  ];

  download(name: string): void {
    const blob = new Blob([`«${name}»\nДемо-файл прототипа Agent Academy.`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  upload(): void {
    alert('Загрузка документа появится позже (заглушка прототипа)');
  }

  notImplemented(): void {
    alert('Редактирование появится позже (заглушка прототипа)');
  }
}
