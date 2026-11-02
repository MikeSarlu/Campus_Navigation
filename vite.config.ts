/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Descarga automática para usar la app sin conexión (docs/DISENO.md §6.11).
    VitePWA({
      registerType: 'prompt', // la app decide cuándo aplicar una versión nueva (nunca a media navegación)
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'UDLAP Campus',
        short_name: 'UDLAP Campus',
        description: 'Encuentra salones y servicios del campus UDLAP.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo lo que la app necesita sin conexión: código, mapa base, fuentes, worker del mapa y datos.
        globPatterns: ['**/*.{js,css,html,png,json,mvt,pbf,mjs}'],
        // El editor es una herramienta en línea: no se descarga en los teléfonos de los estudiantes.
        globIgnores: ['**/EditorApp-*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(data|tiles|fonts|vendor|icons)\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { host: true, port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
