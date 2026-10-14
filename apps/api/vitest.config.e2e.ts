import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Les tests suivent les URL présignées depuis le réseau Docker (ou la CI), pas depuis un
      // navigateur : l'adresse signée doit être celle qu'ils peuvent joindre
      S3_PUBLIC_URL: process.env.S3_ENDPOINT ?? '',
    },
  },
});
