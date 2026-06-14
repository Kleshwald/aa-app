import { DOCUMENT, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { InsurerLogoComponent } from '@shared/insurer-logo/insurer-logo.component';

export interface PolicyDetail {
  label: string;
  value: string;
}

export interface PolicyDoc {
  name: string;
  hint?: string;
}

/**
 * Экран «Полис оформлен» — общий для ОСАГО и «Здоровья».
 * Показывает статус договора, реквизиты и список документов (заглушка-скачивание).
 * Презентационный: данные и действия приходят сверху через input/output.
 */
@Component({
  selector: 'app-policy-issued',
  imports: [DecimalPipe, InsurerLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policy-issued.component.html',
  styleUrl: './policy-issued.component.scss',
})
export class PolicyIssuedComponent {
  private readonly doc = inject(DOCUMENT);

  readonly productTitle = input.required<string>();
  readonly carrierId = input<string>('');
  readonly carrierName = input.required<string>();
  readonly policyNumber = input.required<string>();
  readonly total = input.required<number>();
  readonly details = input<PolicyDetail[]>([]);
  readonly documents = input<PolicyDoc[]>([]);

  readonly toClients = output<void>();
  readonly newPolicy = output<void>();

  // Прототип: реального файла нет — отдаём текстовую заглушку, чтобы «скачивание» работало.
  downloadDoc(item: PolicyDoc): void {
    const text = [
      item.name,
      '',
      `Полис № ${this.policyNumber()}`,
      `${this.productTitle()} · ${this.carrierName()}`,
      '',
      'Документ сформирован в прототипе Agent Academy.',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = `${item.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
