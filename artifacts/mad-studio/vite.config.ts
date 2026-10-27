import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

/** Monorepo root — `.env` / Replit Secrets map to `NEXT_PUBLIC_*` here. */
const repoRoot = path.resolve(import.meta.dirname, '../..');

function envTrim(key: string, loaded: Record<string, string>): string {
  return (
    process.env[key]?.trim() ||
    loaded[key]?.trim() ||
    ''
  );
}

export default defineConfig(async ({ mode }) => {
  const loaded = loadEnv(mode, repoRoot, '');

// Replit supplies PORT for the dev server, but static production builds do
// not receive it. Keep the artifact's configured preview port as the default.
const rawPort = process.env.PORT ?? loaded.PORT ?? '24726';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? loaded.BASE_PATH ?? '/';

const viteSupabaseUrl =
  envTrim('VITE_SUPABASE_URL', loaded) ||
  envTrim('NEXT_PUBLIC_SUPABASE_URL', loaded);
const fudiSupabaseUrl = envTrim('FUDI_SUPABASE_URL', loaded);

function normalizeSupabaseProjectUrl(value: string): string {
  return value.trim().replace(/\/$/, '').toLowerCase();
}

if (viteSupabaseUrl && fudiSupabaseUrl) {
  if (normalizeSupabaseProjectUrl(viteSupabaseUrl) === normalizeSupabaseProjectUrl(fudiSupabaseUrl)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be the MAD Studio project, not FUDI_SUPABASE_URL. Point FÜDI vars at the external read-only project only.',
    );
  }
}

  const viteSupabasePublishableKey =
    envTrim('VITE_SUPABASE_PUBLISHABLE_KEY', loaded) ||
    envTrim('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', loaded) ||
    envTrim('NEXT_PUBLIC_SUPABASE_ANON_KEY', loaded);
  const viteSupabaseAnonKey =
    envTrim('VITE_SUPABASE_ANON_KEY', loaded) ||
    envTrim('NEXT_PUBLIC_SUPABASE_ANON_KEY', loaded);
  const viteSiteUrl =
    envTrim('VITE_SITE_URL', loaded) || envTrim('NEXT_PUBLIC_SITE_URL', loaded);

  if (!viteSupabaseUrl && mode !== 'test') {
    console.warn(
      '[mad-studio] VITE_SUPABASE_URL is empty — set NEXT_PUBLIC_SUPABASE_URL in repo root .env or Replit Secrets, then restart Vite.',
    );
  }

  return {
  base: basePath,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(viteSupabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      viteSupabasePublishableKey,
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      viteSupabaseAnonKey,
    ),
    'import.meta.env.VITE_SITE_URL': JSON.stringify(viteSiteUrl),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/player', '@remotion/media'],
  },
  optimizeDeps: {
    include: ['remotion', '@remotion/player', '@remotion/media'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Replit routes /api to the api-server artifact; locally, proxy there.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] ?? '';
            if (
              contentType.includes('text/event-stream') ||
              proxyRes.headers['x-vercel-ai-ui-message-stream']
            ) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
      '/r': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  };
});
