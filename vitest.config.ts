import { defineConfig } from 'vitest/config';

// Tests du back-office Sign (API Vercel, migrations SQL). L'UI Vite n'est pas couverte ici.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
});
