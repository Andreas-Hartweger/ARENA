import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  worker: { format: 'es' },
  server: { strictPort: true },
  preview: { strictPort: true },
  plugins: [react()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
