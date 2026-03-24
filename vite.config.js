import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Vite plugin: @handle → UUID resolver middleware
function handleResolverPlugin() {
  return {
    name: 'handle-resolver',
    configureServer(server) {
      server.middlewares.use('/api/resolve-handle', async (req, res, next) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const handle = url.searchParams.get('handle');

          if (!handle) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Handle required' }));
            return;
          }

          const cleanHandle = handle.replace(/^@/, '');
          const targetUrl = `https://zeta-ai.io/@${cleanHandle}`;
          console.log(`[handle-resolver] Resolving: ${handle} -> ${targetUrl}`);

          const response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              // Warning: User-Agent spoofing may violate Zeta-AI ToS or cause blocks.
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
          });

          // Try to match from redirect URL first
          const finalUrl = response.url;
          console.log(`[handle-resolver] Resolved to: ${finalUrl}`);

          let match = finalUrl.match(/creators\/([a-f0-9-]{36})/i);

          // If no match in URL, try parsing the HTML content
          if (!match) {
            const html = await response.text();
            match = html.match(/creators\/([a-f0-9-]{36})/i);
            if (match) {
              console.log(`[handle-resolver] Found creator ID in HTML content`);
            }
          }

          if (match && match[1]) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ id: match[1] }));
          } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'User not found or invalid redirect format' }));
          }
        } catch (e) {
          console.error('[handle-resolver] Error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    handleResolverPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'EgoBloom',
        short_name: 'EgoBloom',
        description: '제타 AI 제작자 통계 대시보드',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.zeta-ai\.io\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'zeta-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/zeta': {
        target: 'https://api.zeta-ai.io/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zeta/, ''),
        secure: process.env.NODE_ENV === 'production',
      },
      '/zeta-image': {
        target: 'https://image.zeta-ai.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zeta-image/, ''),
        secure: process.env.NODE_ENV === 'production',
      },
      '/zeta-s3': {
        target: 'https://zeta-image.s3.ap-northeast-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zeta-s3/, ''),
        secure: process.env.NODE_ENV === 'production',
      }
    }
  }
})
