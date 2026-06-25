import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { TeamService } from '@core/services/team.service';

/**
 * Панель «Команда» — сотрудники и субагенты агента.
 * Встраивается вкладкой в Профиль (/profile), не отдельный роут.
 */
@Component({
  selector: 'app-team-panel',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-panel.component.html',
  styleUrl: './team-panel.component.scss',
})
export class TeamPanelComponent {
  private readonly teamService = inject(TeamService);

  protected readonly team = toSignal(this.teamService.team().pipe(map((r) => r.data)), {
    initialValue: null,
  });

  protected readonly hasEmployees = computed(() => {
    const t = this.team();
    return !!t && !t.worksWithoutEmployees && t.employees.length > 0;
  });

  protected readonly hasSubagents = computed(() => {
    const t = this.team();
    return !!t && !t.worksWithoutSubagents && t.subagents.length > 0;
  });

  initials(fullName: string): string {
    const parts = fullName.split(' ').filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  phoneFormatted(raw: string): string {
    const d = raw.replace(/\D/g, '');
    if (d.length !== 11) return raw;
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }

  notImplemented(): void {
    alert('Появится позже (заглушка прототипа)');
  }
}
