export const environment = {
  production: false,
  useMocks: true,
  apiUrl: 'http://localhost:4200/api/v1',
  jwtStorageKey: 'agent_academy_token',
  refreshTokenStorageKey: 'agent_academy_refresh_token',
  mockSeed: 12345,
  mockDelayMs: { min: 200, max: 800 },
  mockErrorRate: 0.05,
};
