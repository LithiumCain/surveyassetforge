import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Both of these fail silently at runtime rather than at build time: a missing
// publishable key compiles main.tsx to an unconditional throw and the bundler drops
// the whole app as unreachable (build still exits 0, ships a blank page), and a
// missing API URL falls back to localhost, so a deployed app looks healthy while
// reporting an empty fleet. Fail the build instead — a broken deploy should be loud.
const requireEnv = (mode: string) => ({
  name: 'require-env',
  apply: 'build' as const,
  config() {
    const env = loadEnv(mode, process.cwd(), '');
    const missing = ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_API_BASE_URL'].filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `Missing required build-time env var(s): ${missing.join(', ')}.\n` +
          'Set them in the deployment environment (Vercel → Settings → Environment Variables)\n' +
          'or in apps/web/.env.local for a local build.',
      );
    }
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), requireEnv(mode)],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          clerk: ['@clerk/clerk-react'],
        },
      },
    },
  },
}));
