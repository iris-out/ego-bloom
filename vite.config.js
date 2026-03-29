import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createClient } from '@supabase/supabase-js'

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
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
          });

          const finalUrl = response.url;
          let match = finalUrl.match(/creators\/([a-f0-9-]{36})/i);

          if (!match) {
            const html = await response.text();
            match = html.match(/creators\/([a-f0-9-]{36})/i);
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

// Vite plugin: Supabase local testing middleware
function supabaseApiPlugin(env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  return {
    name: 'supabase-api-mock',
    configureServer(server) {
      // Body parser for POST requests
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/api/update-creator') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              if (!supabase) throw new Error('Supabase not configured');
              const data = JSON.parse(body);
              
              const now = new Date();
              const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
              const kst = new Date(utc + (9 * 60 * 60 * 1000));
              const recordDate = kst.toISOString().split('T')[0];

              await supabase.from('account_current').upsert({
                id: data.id, handle: data.handle, nickname: data.nickname,
                profile_image_url: data.profileImageUrl, follower_count: data.followerCount,
                plot_interaction_count: data.plotInteractionCount, voice_play_count: data.voicePlayCount,
                elo_score: data.eloScore, tier_name: data.tierName, updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

              await supabase.from('account_history').upsert({
                id: data.id, record_date: recordDate, handle: data.handle, nickname: data.nickname,
                follower_count: data.followerCount, plot_interaction_count: data.plotInteractionCount,
                voice_play_count: data.voicePlayCount, elo_score: data.eloScore, tier_name: data.tierName
              }, { onConflict: 'id, record_date' });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Update Creator Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });

      server.middlewares.use('/api/get-rankings', async (req, res, next) => {
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const { data, error } = await supabase
            .from('account_current')
            .select('*')
            .order('elo_score', { ascending: false })
            .limit(100);

          if (error) throw error;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ rankings: data }));
        } catch (err) {
          console.error('Get Rankings Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use('/api/search-rank', async (req, res, next) => {
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const url = new URL(req.url, `http://${req.headers.host}`);
          const q = url.searchParams.get('q');
          
          if (!q) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: '검색어를 입력해주세요.' }));
          }

          const { data: users, error: searchError } = await supabase
            .from('account_current')
            .select('*')
            .or(`nickname.ilike.%${q}%,handle.ilike.%${q}%`)
            .limit(1);

          if (searchError) throw searchError;

          if (!users || users.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: '유저를 찾을 수 없습니다.' }));
          }

          const targetUser = users[0];

          const { count, error: countError } = await supabase
            .from('account_current')
            .select('*', { count: 'exact', head: true })
            .gt('elo_score', targetUser.elo_score);

          if (countError) throw countError;

          const rank = (count || 0) + 1;

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ user: targetUser, rank }));
        } catch (err) {
          console.error('Search Rank Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use('/api/get-world-data', async (req, res, next) => {
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const { data, error } = await supabase
            .from('account_current')
            .select('id, nickname, handle, elo_score, tier_name')
            .order('elo_score', { ascending: false })
            .limit(1000);

          if (error) throw error;

          const GRID_SIZE = 8;
          const ROAD_INTERVAL = 4;
          const slots = [];
          const MAX_LAYERS = 20;

          for (let l = 0; l <= MAX_LAYERS; l++) {
            for (let x = -l; x <= l; x++) {
              for (let z = -l; z <= l; z++) {
                if (Math.abs(x) !== l && Math.abs(z) !== l) continue;
                if (x % ROAD_INTERVAL !== 0 && z % ROAD_INTERVAL !== 0) {
                  slots.push({ gx: x, gz: z });
                }
                if (slots.length >= data.length) break;
              }
              if (slots.length >= data.length) break;
            }
            if (slots.length >= data.length) break;
          }

          const worldData = data.map((creator, index) => {
            const slot = slots[index] || { gx: index, gz: index };
            return {
              ...creator,
              x: slot.gx * GRID_SIZE,
              z: slot.gz * GRID_SIZE,
              height: Math.max(2, (Math.log10(Math.max(1, creator.elo_score)) - 3) * 8) 
            };
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ buildings: worldData }));
        } catch (err) {
          console.error('Get World Data Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      handleResolverPlugin(),
      supabaseApiPlugin(env),
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
          secure: env.NODE_ENV === 'production',
        },
        '/zeta-image': {
          target: 'https://image.zeta-ai.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/zeta-image/, ''),
          secure: env.NODE_ENV === 'production',
        },
        '/zeta-s3': {
          target: 'https://zeta-image.s3.ap-northeast-2.amazonaws.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/zeta-s3/, ''),
          secure: env.NODE_ENV === 'production',
        }
      }
    }
  }
})
