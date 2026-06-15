// Демо-сборка (GitHub Pages): прод-оптимизация, но с моками — бэкенда нет.
// mockErrorRate = 0, чтобы публичное демо не падало на случайных ошибках.
export const environment = {
  production: true,
  useMocks: true,
  apiUrl: '/api/v1',
  jwtStorageKey: 'agent_academy_token',
  refreshTokenStorageKey: 'agent_academy_refresh_token',
  mockSeed: 12345,
  mockDelayMs: { min: 100, max: 400 },
  mockErrorRate: 0,
};
