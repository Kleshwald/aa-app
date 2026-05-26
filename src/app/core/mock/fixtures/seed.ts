import { faker } from '@faker-js/faker/locale/ru';

import { environment } from '@env/environment';

// Seeded once at module load so every fixture file produces stable data.
// Bumping environment.mockSeed regenerates the entire mock world.
faker.seed(environment.mockSeed);

export { faker };
