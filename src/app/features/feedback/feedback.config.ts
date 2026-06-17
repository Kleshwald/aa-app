// Конфиг Supabase для доски обратной связи (/feedback).
//
// anon-ключ в Supabase ПУБЛИЧНЫЙ по дизайну (доступ ограничивают RLS-политики),
// поэтому его безопасно держать в бандле. Заполнить после создания проекта —
// пошагово в docs/FEEDBACK.md (там же SQL для таблицы, бакета и политик).
//
// Пока url/anonKey пустые — страница /feedback покажет инструкцию по подключению
// вместо попытки загрузить записи.

export const FEEDBACK_SUPABASE = {
  url: 'https://zyyvgpdxrmybxrdbutrg.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eXZncGR4cm15YnhyZGJ1dHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTI4MjgsImV4cCI6MjA5NzI2ODgyOH0.cqBPmeeZtJE-cDdklAbdBy2WXEtOWdz-0O78keizjVw',
  table: 'feedback',
  bucket: 'feedback-screenshots',
} as const;

export function feedbackConfigured(): boolean {
  return FEEDBACK_SUPABASE.url.trim().length > 0 && FEEDBACK_SUPABASE.anonKey.trim().length > 0;
}
