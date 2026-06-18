import { TuiDay, type TuiValueTransformer } from '@taiga-ui/cdk';

/**
 * ISO-строка ('yyyy-mm-dd') ↔ TuiDay для контролов дат на Taiga.
 * Контролы остаются строками (как в остальной логике), UI — на Taiga-календаре.
 */
export class IsoDayTransformer implements TuiValueTransformer<TuiDay | null, string> {
  fromControlValue(value: string): TuiDay | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new TuiDay(y, m - 1, d);
  }
  toControlValue(day: TuiDay | null): string {
    if (!day) return '';
    const mm = String(day.month + 1).padStart(2, '0');
    const dd = String(day.day).padStart(2, '0');
    return `${day.year}-${mm}-${dd}`;
  }
}
