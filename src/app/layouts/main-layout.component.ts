import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AttentionService } from '@core/services/attention.service';
import { AuthService } from '@core/services/auth.service';
import { ChatService } from '@core/services/chat.service';
import { UxVariantService } from '@core/services/ux-variant.service';

interface NavItem {
  label: string;
  route: string;
  icon:
    | 'clients'
    | 'prolongation'
    | 'osago'
    | 'health'
    | 'mortgage'
    | 'finance'
    | 'learning'
    | 'messages';
}

const NAV: readonly NavItem[] = [
  { label: 'Мои клиенты', route: '/clients', icon: 'clients' },
  { label: 'Пролонгация', route: '/prolongation', icon: 'prolongation' },
  { label: 'ОСАГО', route: '/osago', icon: 'osago' },
  { label: 'Здоровье', route: '/health', icon: 'health' },
  { label: 'Ипотека', route: '/mortgage', icon: 'mortgage' },
  { label: 'Мои финансы', route: '/finance', icon: 'finance' },
  { label: 'Обучение', route: '/learning', icon: 'learning' },
  { label: 'Сообщения', route: '/messages', icon: 'messages' },
] as const;

const MESSAGES_ROUTE = '/messages';

@Component({
  selector: 'app-main-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly nav = NAV;
  protected readonly agent = this.auth.currentAgent;
  protected readonly agentName = computed(() => this.agent()?.fullName ?? 'Агент');
  // Территория + район — тихой второй строкой под именем (не якорь, а контекст).
  protected readonly agentLocation = computed(() => {
    const a = this.agent();
    return [a?.district, a?.region].filter(Boolean).join(', ');
  });

  private readonly chat = inject(ChatService);
  private readonly attention = inject(AttentionService);
  private readonly ux = inject(UxVariantService);

  protected readonly messagesRoute = MESSAGES_ROUTE;
  // Счётчик «Сообщения» = непрочитанный чат (+ заявки, где ваш ход — ТОЛЬКО когда
  // процессы живут в Сообщениях: v1 «Процессы в Сообщениях», v3 «Переписка в
  // Сообщениях»). В v2 «Уведомления вверху» процессов в Сообщениях нет — их считает
  // ТОЛЬКО сигнал в шапке, иначе бейдж обещал бы то, чего в Сообщениях не открыть.
  protected readonly messagesUnread = computed(
    () =>
      this.chat.unread() +
      (this.ux.messagesCountsProcesses() ? this.attention.awaitingPolicyCount() : 0),
  );

  // Сквозной сигнал «Ждут ваших действий» — единственный амбиентный детектор,
  // виден на всех экранах. Куда ведёт клик — зависит от UX-варианта (см. UxVariantService):
  // v1 → Сообщения/Процессы, v2 → «Мои клиенты» с чипом, v3 → беседа заявки в Сообщениях.
  protected readonly attentionCount = this.attention.awaitingPolicyCount;
  protected readonly attentionLink = this.ux.signalLink;

  // Метка активного UX-варианта — только когда он выбран ЯВНО (через ссылку с /hub).
  // Обычный вход агента метки не видит; тестировщик-сравниватель — видит, куда попал.
  protected readonly uxChosen = this.ux.chosen;
  protected readonly uxMeta = this.ux.meta;

  // «Не знаю» ≠ «ноль». При отказе бэкенда молчать нельзя: тишина читается как
  // «вас никто не ждёт» — это худший обман для аудитории, чей главный страх —
  // «пропущу и опозорюсь». Показываем честное «не удалось проверить».
  protected readonly attentionFailed = this.attention.failed;
  protected readonly attentionRetrying = this.attention.retrying;
  // 'loading' | 'ok' | 'error' — чтобы «Всё сделано» показывать ТОЛЬКО когда точно
  // знаем, что ноль (state==='ok'), а не пока грузимся (тогда 0 — это «не знаю»).
  protected readonly attentionState = this.attention.state;
  protected readonly clientsRoute = '/clients';

  /** Отказ — не тупик: спрашиваем ещё раз сами, не гоняя агента на F5. */
  retryAttention(): void {
    this.attention.retry();
  }

  protected readonly userMenuOpen = signal(false);

  constructor() {
    // Обновляем профиль в шапке из /agents/me — чтобы имя/локация были свежими,
    // а не из снимка, сохранённого при прошлом входе.
    this.auth.refreshAgent();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  logout(): void {
    this.closeUserMenu();
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = event.target as Node;
    const menu = this.host.nativeElement.querySelector('.app-header__user');
    if (menu && !menu.contains(target)) this.closeUserMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
  }
}
