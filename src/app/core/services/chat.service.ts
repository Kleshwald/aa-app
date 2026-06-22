import { Injectable, computed, signal } from '@angular/core';

// 'agent' = the logged-in agent; 'company' = our side (support OR curator).
export type ChatAuthor = 'agent' | 'company';
export type ChatRole = 'support' | 'curator';

export interface ChatSender {
  name: string;
  role: ChatRole;
}

export interface ChatAttachment {
  name: string;
  kind: 'image' | 'file';
}

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  sender?: ChatSender; // who replied on our side (undefined for the agent's own messages)
  text: string;
  attachments: ChatAttachment[];
  createdAt: number;
  status: 'sending' | 'sent';
  read: boolean; // for company messages: seen by the agent
}

const STORAGE_KEY = 'agent_academy_support_chat_v3';

// Single thread, two roles answer (attributed). Полное ФИО с отчеством; куратор —
// демо-куратор агента (совпадает с профилем), не безымянный.
const SUPPORT: ChatSender = { name: 'Котова Анна Сергеевна', role: 'support' };
const CURATOR: ChatSender = { name: 'Парфенова Оксана Анатольевна', role: 'curator' };

const CURATOR_INTRO =
  'Здравствуйте! Я ваш куратор Оксана Анатольевна. По обучению, плану продаж и общим ' +
  'вопросам пишите мне прямо здесь.';
const GREETING =
  'Это поддержка Agent Academy. Опишите вопрос — поможем с котировкой, полисом ' +
  'или оплатой. Можно приложить скриншот.';

// Keyword → canned operator reply. Makes the prototype chat feel alive without a backend.
const CANNED: { match: RegExp; reply: string }[] = [
  {
    match: /котиров|расч[её]т|осаго|каско/i,
    reply:
      'Проверяю расчёт. Подскажите, пожалуйста, № заявки или госномер ТС — посмотрю, почему не проходит котировка.',
  },
  {
    match: /полис|документ|бланк/i,
    reply:
      'Сейчас посмотрю по полису. Уточните, пожалуйста, номер полиса — подгружу в течение нескольких минут.',
  },
  {
    match: /оплат|плат[её]ж|комисс|выплат/i,
    reply:
      'Передал в отдел расчётов. Обычно по оплате отвечаем в течение часа, вернусь с результатом.',
  },
  {
    match: /ошибк|не работает|баг|зависа|сломал/i,
    reply:
      'Спасибо, зафиксировал. Уточните, пожалуйста, на какой странице возникает ошибка и приложите скриншот, если можно.',
  },
];

const DEFAULT_REPLY = 'Спасибо за обращение! Оператор подключится с минуты на минуту.';

/**
 * Mock support-chat service for the prototype. Holds the conversation in memory,
 * persists to localStorage (so it survives reload), and fakes operator replies.
 * The component talks only to this interface — swapping in a real backend
 * (Chatwoot / Webim / edna REST + realtime) later won't touch the chat UI.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private counter = 0;

  readonly messages = signal<ChatMessage[]>([]);
  readonly supportTyping = signal(false);
  readonly support = SUPPORT; // for the "typing…" avatar
  readonly unread = computed(
    () => this.messages().filter((m) => m.author === 'company' && !m.read).length,
  );

  constructor() {
    this.restore();
  }

  send(text: string, attachments: ChatAttachment[] = []): void {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const message: ChatMessage = {
      id: this.nextId(),
      author: 'agent',
      text: trimmed,
      attachments,
      createdAt: Date.now(),
      status: 'sending',
      read: true,
    };
    this.messages.update((list) => [...list, message]);
    this.persist();

    // Flip to "sent", then fake an operator reply.
    setTimeout(() => this.setStatus(message.id, 'sent'), 400);
    this.scheduleSupportReply(trimmed);
  }

  /** Mark all company messages as read (called when the agent opens the chat). */
  markRead(): void {
    if (this.unread() === 0) return;
    this.messages.update((list) =>
      list.map((m) => (m.author === 'company' ? { ...m, read: true } : m)),
    );
    this.persist();
  }

  private scheduleSupportReply(userText: string): void {
    this.supportTyping.set(true);
    setTimeout(() => {
      this.supportTyping.set(false);
      const reply = CANNED.find((c) => c.match.test(userText))?.reply ?? DEFAULT_REPLY;
      this.messages.update((list) => [
        ...list,
        {
          id: this.nextId(),
          author: 'company',
          sender: SUPPORT,
          text: reply,
          attachments: [],
          createdAt: Date.now(),
          status: 'sent',
          read: false,
        },
      ]);
      this.persist();
    }, 1800);
  }

  private setStatus(id: string, status: ChatMessage['status']): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, status } : m)));
    this.persist();
  }

  private nextId(): string {
    this.counter += 1;
    return `m${Date.now()}-${this.counter}`;
  }

  private seed(): void {
    const now = Date.now();
    // One thread, two roles: curator intro + support greeting. Приветствия НЕ считаем
    // непрочитанными (read: true) — бейдж только на реальные ответы, без ложной тревоги.
    this.messages.set([
      {
        id: this.nextId(),
        author: 'company',
        sender: CURATOR,
        text: CURATOR_INTRO,
        attachments: [],
        createdAt: now,
        status: 'sent',
        read: true,
      },
      {
        id: this.nextId(),
        author: 'company',
        sender: SUPPORT,
        text: GREETING,
        attachments: [],
        createdAt: now + 1,
        status: 'sent',
        read: true,
      },
    ]);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages()));
    } catch {
      // storage unavailable — keep working in memory only
    }
  }

  private restore(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      this.seed();
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.messages.set(parsed as ChatMessage[]);
        this.counter = parsed.length;
        return;
      }
    } catch {
      // fall through to seed
    }
    this.seed();
  }
}
