import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Anclado a `src/` — mismo patrón que avoqado-web-dashboard. Sin esto
    // rige el default de vitest (`**/*.test.*`), que barre el árbol ENTERO:
    // cualquier worktree anidado aporta su suite y la de su node_modules.
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Excluye explícitamente los specs de Playwright (e2e) — vitest
    // sólo corre unit/integration.
    //
    // Los patrones van con globs (`**/x/**`), NO con el nombre pelón: un
    // `'node_modules'` literal sólo tapa el del root y deja pasar los
    // anidados. Y los worktrees de git son copias del propio repo con sus
    // propias dependencias — sin excluirlos, vitest corre la suite de otra
    // sesión MÁS la de zod/msw que viven en su node_modules.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      '**/.idea/**',
      '**/.git/**',
      '**/.worktrees/**',
      '**/.claude/worktrees/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.mock.ts',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
})
