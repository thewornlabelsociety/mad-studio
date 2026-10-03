import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const viteSupabaseUrl =
  process.env.VITE_SUPABASE_URL?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
  '';
const fudiSupabaseUrl = process.env.FUDI_SUPABASE_URL?.trim() ?? '';

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

export default defineConfig({
  base: basePath,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(viteSupabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
        '',
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY?.trim() ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
        '',
    ),
    'import.meta.env.VITE_SITE_URL': JSON.stringify(
      process.env.VITE_SITE_URL?.trim() ??
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
        '',
    ),
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
});
