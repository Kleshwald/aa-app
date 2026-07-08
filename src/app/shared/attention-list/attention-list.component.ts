import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { AttentionItem, AttentionSource } from '@core/services/attention.service';

/**
 * «Ждут ваших действий» — единый список дел, ждущих агента (заявки + чат). Стиль трекинга
 * (Госуслуги «Сегодня вас ждут: …»), НЕ мессенджер: каждый пункт подписан источником
 * и уводит кнопкой в СВОЮ систему. Пустое состояние спокойное — «всё под контролем».
 * Тонкий компонент: только рендер переданных пунктов (агрегирует AttentionService).
 */
@Component({
  selector: 'app-attention-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attention-list.component.html',
  styleUrl: './attention-list.component.scss',
})
export class AttentionListComponent {
  /** Пункты «требуют вас». */
  readonly items = input.required<AttentionItem[]>();
  /** Скрывать спокойное пустое состояние (для мест, где пустой блок не нужен). */
  readonly hideWhenEmpty = input(false);
  /** Агент нажал кнопку действия (для закрытия панели/поповера у вызывающего). */
  readonly navigated = output<void>();

  protected sourceLabel(source: AttentionSource): string {
    return source === 'chat' ? 'Сообщение' : 'Заявка';
  }
}
