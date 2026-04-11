import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('account_current')
      .select('id, nickname, handle, elo_score, tier_name')
      .order('elo_score', { ascending: false })
      .limit(1000);

    if (error) throw error;

    // --- 그리드 기반 도시 배치 알고리즘 ---
    const GRID_SIZE = 56; // 빌딩 간의 간격 (미터 단위, 지형 셰이더와 통일)
    const ROAD_INTERVAL = 3; // 몇 칸마다 도로가 생기는지 (예: 3칸마다 도로)
    
    // 빌딩이 들어갈 수 있는 슬롯(구획) 좌표를 미리 계산하는 제네레이터 스타일 로직
    const slots = [];
    let layer = 0;
    const MAX_LAYERS = 20; // 1000명을 충분히 수용할 만큼

    // 나선형으로 그리드 슬롯을 찾음 — 중심(0,0)부터 바깥으로 순서 보장
    // 1위가 항상 도심 중앙에, 랭킹 순서대로 외곽으로 확장
    const visitedSet = new Set();
    const queue = [[0, 0]];
    visitedSet.add('0,0');

    while (slots.length < data.length && queue.length > 0) {
      const [x, z] = queue.shift();
      const isRoadX = x % ROAD_INTERVAL === 0;
      const isRoadZ = z % ROAD_INTERVAL === 0;
      
      // 중앙을 가로지르는 강(River) 구역은 건물 배치에서 제외 (world z=120~200 → grid z=2~5)
      const isRiver = z >= 2 && z <= 4;

      if (!isRoadX && !isRoadZ && !isRiver) {
        slots.push({ gx: x, gz: z });
      }

      // 4방향 이웃을 거리 순으로 탐색 (BFS → 랭킹 순서 = 중심 거리 순서)
      for (const [dx, dz] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = x + dx, nz = z + dz;
        const key = `${nx},${nz}`;
        if (!visitedSet.has(key)) {
          visitedSet.add(key);
          queue.push([nx, nz]);
        }
      }
    }

    // 랭킹 순서와 무관하게 무작위 배치
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    const worldData = data.map((creator, index) => {
      const slot = slots[index] || { gx: index, gz: index };
      
      // 약간의 랜덤 오프셋을 더해 완벽한 격자 느낌을 탈피 (-1.5 ~ +1.5)
      const jitterX = (Math.random() - 0.5) * 4.0;
      const jitterZ = (Math.random() - 0.5) * 4.0;
      
      const x = slot.gx * GRID_SIZE + jitterX;
      const z = slot.gz * GRID_SIZE + jitterZ;

      return {
        ...creator,
        x,
        z,
        // ELO 기반 높이 — 전체 범위를 6~120으로 정규화
        // log10 스케일로 ELO 1~최대값을 골고루 분산
        height: Math.max(13, (Math.log10(Math.max(1, creator.elo_score)) - 2) * 12)
      };
    });

    return res.status(200).json({ buildings: worldData });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
