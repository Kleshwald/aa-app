import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client.service';
import { type ApiResponse } from '@core/models';

import { type ProcessStatus } from './process.service';
import {
  type SupportChatThread,
  type SupportQueueItem,
  type SupportRequestDetail,
} from './support.model';

/**
 * Рабочее место поддержки. Одна граница на весь кокпит — как `ChatService` у агента:
 * когда очередь начнёт собираться из ДВУХ настоящих систем (1С по OData/HTTP-сервисам
 * + API чат-вендора, docs/SUPPORT.md §4), меняется только этот класс, а не экран.
 */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly api = inject(ApiClient);

  /** Общая очередь: заявки (1С) + диалоги (чат) одним списком указателей. */
  queue(): Observable<ApiResponse<SupportQueueItem[]>> {
    return this.api.get<SupportQueueItem[]>('/support/queue');
  }

  request(id: string): Observable<ApiResponse<SupportRequestDetail | null>> {
    return this.api.get<SupportRequestDetail | null>(`/support/requests/${id}`);
  }

  /** Взять на себя / передать коллеге. `null` — снять ответственного. */
  assign(id: string, assignee: string | null): Observable<ApiResponse<SupportRequestDetail>> {
    return this.api.post<SupportRequestDetail>(`/support/requests/${id}/assign`, { assignee });
  }

  /** Ответ агенту в переписке по заявке — появляется у него в кабинете. */
  reply(id: string, text: string): Observable<ApiResponse<SupportRequestDetail>> {
    return this.api.post<SupportRequestDetail>(`/support/requests/${id}/reply`, { text });
  }

  /** Внутренняя заметка для своих. Агенту не видна. */
  note(id: string, text: string, author: string): Observable<ApiResponse<SupportRequestDetail>> {
    return this.api.post<SupportRequestDetail>(`/support/requests/${id}/note`, { text, author });
  }

  /**
   * Движение по статусной модели. `docItems` — список запрашиваемых документов
   * (статус «Ожидаем документы» без списка бесполезен: агент не знает, что нести).
   * `atInsurer` помечает, что работа ушла во внешний контур — агенту это не видно,
   * он получит только итог.
   */
  setStatus(
    id: string,
    status: ProcessStatus,
    options: { comment?: string; docItems?: string[]; atInsurer?: boolean } = {},
  ): Observable<ApiResponse<SupportRequestDetail>> {
    return this.api.post<SupportRequestDetail>(`/support/requests/${id}/status`, {
      status,
      ...options,
    });
  }

  thread(id: string): Observable<ApiResponse<SupportChatThread | null>> {
    return this.api.get<SupportChatThread | null>(`/support/threads/${id}`);
  }

  replyToThread(
    id: string,
    text: string,
    author: string,
  ): Observable<ApiResponse<SupportChatThread>> {
    return this.api.post<SupportChatThread>(`/support/threads/${id}/reply`, { text, author });
  }

  /** Передать во 2-ю линию по теме (не «наверх», а профильному специалисту). */
  escalate(id: string, topic: string): Observable<ApiResponse<SupportChatThread>> {
    return this.api.post<SupportChatThread>(`/support/threads/${id}/escalate`, { topic });
  }

  assignThread(id: string, assignee: string | null): Observable<ApiResponse<SupportChatThread>> {
    return this.api.post<SupportChatThread>(`/support/threads/${id}/assign`, { assignee });
  }
}
