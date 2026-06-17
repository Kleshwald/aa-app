import { Injectable } from '@angular/core';

import { FEEDBACK_SUPABASE } from './feedback.config';

export interface FeedbackPost {
  id: string;
  created_at: string;
  author: string;
  category: string;
  message: string;
  image_url: string | null;
}

export interface NewFeedback {
  author: string;
  category: string;
  message: string;
  image?: File | null;
}

/**
 * Доска обратной связи поверх Supabase (PostgREST + Storage). Используем нативный
 * fetch, а не HttpClient: запросы идут на внешний домен и должны миновать
 * mock/auth/error-интерсепторы приложения. anon-ключ публичный, доступ ограничен
 * RLS-политиками (см. docs/FEEDBACK.md).
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly base = FEEDBACK_SUPABASE.url.replace(/\/+$/, '');

  private get headers(): Record<string, string> {
    return {
      apikey: FEEDBACK_SUPABASE.anonKey,
      Authorization: `Bearer ${FEEDBACK_SUPABASE.anonKey}`,
    };
  }

  async list(): Promise<FeedbackPost[]> {
    const url = `${this.base}/rest/v1/${FEEDBACK_SUPABASE.table}?select=*&order=created_at.desc`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Supabase list ${res.status}`);
    return (await res.json()) as FeedbackPost[];
  }

  async create(input: NewFeedback): Promise<FeedbackPost> {
    const imageUrl = input.image ? await this.uploadImage(input.image) : null;

    const url = `${this.base}/rest/v1/${FEEDBACK_SUPABASE.table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        author: input.author.trim(),
        category: input.category,
        message: input.message.trim(),
        image_url: imageUrl,
      }),
    });
    if (!res.ok) throw new Error(`Supabase insert ${res.status}`);
    const rows = (await res.json()) as FeedbackPost[];
    return rows[0];
  }

  private async uploadImage(file: File): Promise<string> {
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext || 'png'}`;
    const url = `${this.base}/storage/v1/object/${FEEDBACK_SUPABASE.bucket}/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) throw new Error(`Supabase upload ${res.status}`);
    return `${this.base}/storage/v1/object/public/${FEEDBACK_SUPABASE.bucket}/${path}`;
  }
}
