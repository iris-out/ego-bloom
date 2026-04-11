import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'

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

              // [비활성화] account_history 쓰기 중단 — 시즌/성장 랭킹 기능 미사용 중
              // await supabase.from('account_history').upsert({
              //   id: data.id, record_date: recordDate, handle: data.handle, nickname: data.nickname,
              //   follower_count: data.followerCount, plot_interaction_count: data.plotInteractionCount,
              //   voice_play_count: data.voicePlayCount, elo_score: data.eloScore, tier_name: data.tierName
              // }, { onConflict: 'id, record_date' });

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

      server.middlewares.use('/api/get-season-rankings', async (req, res, next) => {
        try {
          if (!supabase) throw new Error('Supabase not configured');
          const url = new URL(req.url, `http://${req.headers.host}`);
          const now = new Date();
          const year = parseInt(url.searchParams.get('year')) || now.getUTCFullYear();
          const month = parseInt(url.searchParams.get('month')) || (now.getUTCMonth() + 1);
          const seasonStart = `${year}-${String(month).padStart(2, '0')}-01`;

          // Get all current scores
          const { data: current, error: currentErr } = await supabase
            .from('account_current')
            .select('id, nickname, handle, elo_score, tier_name, follower_count, plot_interaction_count')
            .gt('elo_score', 0);
          if (currentErr) throw currentErr;

          if (!current || current.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ rankings: [], season: { year, month, start: seasonStart } }));
          }

          const ids = current.map(r => r.id);

          // Get earliest history records at/after season start for each creator
          const CHUNK = 400;
          let allHistory = [];
          for (let i = 0; i < ids.length; i += CHUNK) {
            const chunk = ids.slice(i, i + CHUNK);
            const { data: rows, error: histErr } = await supabase
              .from('account_history')
              .select('id, elo_score, record_date')
              .gte('record_date', seasonStart)
              .in('id', chunk)
              .order('record_date', { ascending: true });
            if (histErr) throw histErr;
            allHistory = allHistory.concat(rows || []);
          }

          const seasonStartElo = {};
          for (const row of allHistory) {
            if (!seasonStartElo[row.id]) {
              seasonStartElo[row.id] = row.elo_score;
            }
          }

          const ranked = current
            .filter(c => seasonStartElo[c.id] != null)
            .map(creator => ({
              ...creator,
              start_elo: seasonStartElo[creator.id],
              elo_change: creator.elo_score - seasonStartElo[creator.id],
            }))
            .sort((a, b) => b.elo_change - a.elo_change)
            .slice(0, 30);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            rankings: ranked,
            season: { year, month, start: seasonStart },
          }));
        } catch (err) {
          console.error('Get Season Rankings Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use('/api/get-growth-ranking', async (req, res) => {
        try {
          if (!supabase) throw new Error('Supabase not configured');

          const now = new Date();
          const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
          const todayKST = kst.toISOString().split('T')[0];
          const threeDaysAgo = new Date(kst);
          threeDaysAgo.setDate(kst.getDate() - 3);
          const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

          // 최근 4일치 history 레코드 가져오기
          const { data: histRows, error: histErr } = await supabase
            .from('account_history')
            .select('id, record_date, elo_score, follower_count, plot_interaction_count, nickname, handle, tier_name')
            .gte('record_date', threeDaysAgoStr)
            .lte('record_date', todayKST)
            .order('record_date', { ascending: true });
          if (histErr) throw histErr;

          // 크리에이터별 전체 레코드 수 확인 (전체 기간 history 수)
          const allIds = [...new Set((histRows || []).map(r => r.id))];
          let totalRecordMap = {};
          if (allIds.length > 0) {
            const CHUNK = 400;
            for (let i = 0; i < allIds.length; i += CHUNK) {
              const chunk = allIds.slice(i, i + CHUNK);
              const { data: countRows } = await supabase
                .from('account_history')
                .select('id', { count: 'exact' })
                .in('id', chunk);
              // group by id manually
              if (countRows) countRows.forEach(r => {
                totalRecordMap[r.id] = (totalRecordMap[r.id] || 0) + 1;
              });
            }
          }

          // 크리에이터별 그룹화
          const byCreator = {};
          for (const row of (histRows || [])) {
            if (!byCreator[row.id]) byCreator[row.id] = [];
            byCreator[row.id].push(row);
          }

          // 성장 점수 계산 (3일 쇼 + 전체 레코드 3일 초과 필요)
          const growthList = [];
          for (const [id, records] of Object.entries(byCreator)) {
            if (records.length < 2) continue;
            if ((totalRecordMap[id] || 0) <= 3) continue; // 3일 이하 제외
            const oldest = records[0];
            const latest = records[records.length - 1];
            const growthScore = (latest.elo_score || 0) - (oldest.elo_score || 0);
            growthList.push({
              id, nickname: latest.nickname, handle: latest.handle,
              elo_score: latest.elo_score || 0,
              elo_oldest: oldest.elo_score || 0,
              growth_score: growthScore,
              follower_count: latest.follower_count || 0,
              follower_count_oldest: oldest.follower_count || 0,
              plot_interaction_count: latest.plot_interaction_count || 0,
              plot_interaction_oldest: oldest.plot_interaction_count || 0,
            });
          }

          growthList.sort((a, b) => b.growth_score - a.growth_score);
          const positiveGrowth = growthList.filter(c => c.growth_score > 0);
          const top10 = positiveGrowth.slice(0, 10);
          const total = positiveGrowth.length;

          const TIER_INFO = [
            { pct: 0.01, tier: 'champion', name: 'CHAMPION', color: '#F97316' },
            { pct: 0.05, tier: 'master',   name: 'MASTER',   color: '#D946EF' },
            { pct: 0.15, tier: 'diamond',  name: 'DIAMOND',  color: '#3B82F6' },
            { pct: 0.30, tier: 'platinum', name: 'PLATINUM', color: '#E2E8F0' },
            { pct: 0.50, tier: 'gold',     name: 'GOLD',     color: '#FBBF24' },
            { pct: 0.70, tier: 'silver',   name: 'SILVER',   color: '#9CA3AF' },
          ];
          const assignTier = (rank, tot) => {
            const pct = rank / tot;
            const t = TIER_INFO.find(t => pct <= t.pct);
            return t || { tier: 'bronze', name: 'BRONZE', color: '#C58356' };
          };

          const rankings = top10.map((c, i) => {
            const t = assignTier(i + 1, total);
            return { ...c, growth_rank: i + 1, growth_tier: t.tier, growth_tier_name: t.name, growth_tier_color: t.color };
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ rankings, dataAvailable: true, windowDays: 3 }));
        } catch (err) {
          console.error('Growth Ranking Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      // Dev 전용: /api/server-status → emergency.zeta-ai.io 프록시
      server.middlewares.use('/api/server-status', async (req, res) => {
        try {
          const [sRes, mRes] = await Promise.all([
            fetch('https://emergency.zeta-ai.io/ko/status'),
            fetch('https://emergency.zeta-ai.io/ko/message'),
          ]);
          const statusText = (await sRes.text()).trim();
          const message = (await mRes.text()).trim();
          let status = 'error';
          if (statusText === 'green') status = 'ok';
          else if (statusText === 'yellow') status = 'warning';
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status, message: status === 'ok' ? null : (message || null) }));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'error', message: null }));
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

          const GRID_SIZE = 24;
          const ROAD_INTERVAL = 4;
          const slots = [];

          const visitedSet = new Set();
          const queue = [[0, 0]];
          visitedSet.add('0,0');

          while (slots.length < data.length && queue.length > 0) {
            const [x, z] = queue.shift();
            const isRoadX = x % ROAD_INTERVAL === 0;
            const isRoadZ = z % ROAD_INTERVAL === 0;
            const isRiver = z >= 12 && z <= 20;
            if (!isRoadX && !isRoadZ && !isRiver) slots.push({ gx: x, gz: z });
            for (const [dx, dz] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
              const nx = x + dx, nz = z + dz;
              const key = `${nx},${nz}`;
              if (!visitedSet.has(key)) { visitedSet.add(key); queue.push([nx, nz]); }
            }
          }

          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }

          const worldData = data.map((creator, index) => {
            const slot = slots[index] || { gx: index, gz: index };
            const jitterX = (Math.random() - 0.5) * 8.0;
            const jitterZ = (Math.random() - 0.5) * 8.0;
            return {
              ...creator,
              x: slot.gx * GRID_SIZE + jitterX,
              z: slot.gz * GRID_SIZE + jitterZ,
              height: Math.max(13, (Math.log10(Math.max(1, creator.elo_score)) - 2) * 12)
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

// Vite plugin: dev 서버 시작 시 fetch_ranking.js 자동 실행 → ranking_latest.json을 Supabase 최신 데이터로 갱신
function devFetchRankingPlugin(env) {
  return {
    name: 'dev-fetch-ranking',
    apply: 'serve',
    configureServer() {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[ego-bloom] ⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 → ranking 자동 갱신 스킵');
        return;
      }
      console.log('[ego-bloom] 🔄 ranking_latest.json 갱신 중 (Supabase)...');
      const child = spawn('node', ['scripts/fetch_ranking.js'], {
        env: { ...process.env, ...env },
        stdio: 'inherit',
      });
      child.on('exit', (code) => {
        if (code === 0) console.log('[ego-bloom] ✅ ranking_latest.json 갱신 완료');
        else console.error(`[ego-bloom] ❌ fetch_ranking.js 실패 (exit ${code})`);
      });
    },
  };
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
      devFetchRankingPlugin(env),
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
              // /api/zeta/* 프록시 경로 매칭 (직접 CDN URL이 아닌 실제 요청 경로)
              urlPattern: ({ url }) => url.pathname.startsWith('/api/zeta/'),
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
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('highcharts')) return 'vendor-highcharts';
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
          },
        },
      },
    },
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
