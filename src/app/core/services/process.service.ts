import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

// ─── Процесс по договору («заявка» в терминах 1С) ───
// Изменение / расторжение / убыток. В этой итерации детально проработан kind='change'.

export type ProcessKind = 'change' | 'cancel' | 'loss';
export type ProcessActor = 'agent' | 'support';

// Статусы — зеркало 1С (Проверка документов / В работе / Ожидаем документы / …).
export type ProcessStatus =
  | 'submitted'
  | 'checking-docs'
  | 'in-work'
  | 'awaiting-docs'
  | 'done'
  | 'rejected';

/** Запрос документов от поддержки (при статусе «Ожидаем документы»). */
export interface ProcessDocRequest {
  title: string;
  items: string[];
}

export interface ProcessStatusEvent {
  at: string; // ISO datetime
  status: ProcessStatus;
  comment?: string;
  author: ProcessActor;
  requestNumber: string;
  docRequest?: ProcessDocRequest;
}

export interface ProcessComment {
  at: string;
  author: ProcessActor;
  authorName: string;
  text: string;
}

export interface ProcessAttachment {
  id: string;
  name: string;
  uploadedAt: string;
  author: ProcessActor;
}

export interface PolicyProcess {
  id: string;
  requestNumber: string; // «000012900»
  policyId: string;
  policyNumber: string;
  kind: ProcessKind;
  reasons: string[]; // коды причин (для change)
  status: ProcessStatus; // = последний статус из statusHistory (для удобства)
  statusHistory: ProcessStatusEvent[];
  comments: ProcessComment[];
  attachments: ProcessAttachment[];
  responsibleName?: string;
  createdAt: string;
}

export interface CreateProcessPayload {
  kind: ProcessKind;
  reasons: string[];
  formSnapshot?: unknown; // снимок формы изменений (для будущей передачи в 1С)
}

/**
 * Заявка, ждущая действия агента («ваш ход») — плоский указатель для единого
 * индикатора «Требуют вас». Не переписка, а ссылка: клиент+полис+что нужно+куда идти.
 * Обогащена именем клиента (джойн с полисом на моке) — в самой заявке его нет.
 */
export interface AwaitingProcess {
  processId: string;
  requestNumber: string;
  policyId: string;
  policyNumber: string;
  clientName: string;
  kind: ProcessKind;
  need: string; // что нужно от агента, человеческой строкой (напр. «Ждут документы: …»)
}

// ─── Каталог причин изменения (из 1С) — единый источник для диалога/ленты/истории ───
export interface ChangeReason {
  code: string;
  label: string;
}

export const CHANGE_REASONS: readonly ChangeReason[] = [
  { code: 'add-driver', label: 'Добавление нового водителя' },
  { code: 'replace-license', label: 'Замена ВУ' },
  { code: 'policy-error', label: 'Ошибка в полисе' },
  { code: 'change-owner', label: 'Смена собственника ТС' },
  { code: 'replace-plate-sts', label: 'Замена ГРЗ и (или) СТС' },
  { code: 'unlimited-drivers', label: 'ЛДУ без ограничений' },
  { code: 'with-trailer', label: 'Используется с прицепом' },
  {
    code: 'policyholder-doc',
    label: 'Изменение документа страхователя (замена паспорта по достижению возраста)',
  },
  { code: 'owner-doc', label: 'Изменение документа собственника' },
  { code: 'remove-driver', label: 'Удаление водителя' },
  { code: 'owner-name', label: 'Смена ФИО собственника' },
  { code: 'policyholder-name', label: 'Смена ФИО страхователя' },
] as const;

const REASON_LABEL = new Map(CHANGE_REASONS.map((r) => [r.code, r.label]));

export function reasonLabel(code: string): string {
  return REASON_LABEL.get(code) ?? code;
}

export const PROCESS_STATUS_LABEL: Record<ProcessStatus, string> = {
  submitted: 'Заявка создана',
  'checking-docs': 'Проверка документов',
  'in-work': 'В работе',
  'awaiting-docs': 'Ожидаем документы',
  done: 'Изменения внесены',
  rejected: 'Отклонено',
};

export const PROCESS_KIND_LABEL: Record<ProcessKind, string> = {
  change: 'Внесение изменений (ВИ)',
  cancel: 'Расторжение договора',
  loss: 'Урегулирование убытка',
};

@Injectable({ providedIn: 'root' })
export class ProcessService {
  private readonly api = inject(ApiClient);

  /** Список заявок по договору (свежие сверху). */
  listForPolicy(policyId: string): Observable<ApiResponse<PolicyProcess[]>> {
    return this.api.get<PolicyProcess[]>(`/policies/${policyId}/processes`);
  }

  /**
   * Заявки, ждущие действия агента (статус «Ожидаем документы»), по ВСЕМ полисам —
   * питает единый индикатор «Требуют вас». Игнорирует фильтр периода списка клиентов.
   */
  listAwaiting(): Observable<ApiResponse<AwaitingProcess[]>> {
    return this.api.get<AwaitingProcess[]>('/processes/awaiting');
  }

  /** Создать заявку (внесение изменений). Возвращает id и номер заявки. */
  create(
    policyId: string,
    payload: CreateProcessPayload,
  ): Observable<ApiResponse<{ id: string; requestNumber: string } | null>> {
    return this.api.post<{ id: string; requestNumber: string } | null>(
      `/policies/${policyId}/processes`,
      payload,
    );
  }

  /** Добавить комментарий агента к заявке (поддержка ответит отложенно). */
  addComment(processId: string, text: string): Observable<ApiResponse<PolicyProcess | null>> {
    return this.api.post<PolicyProcess | null>(`/processes/${processId}/comments`, { text });
  }

  /** Приложить документ к заявке (заглушка загрузки). */
  uploadDoc(processId: string, name: string): Observable<ApiResponse<PolicyProcess | null>> {
    return this.api.post<PolicyProcess | null>(`/processes/${processId}/documents`, { name });
  }
}
