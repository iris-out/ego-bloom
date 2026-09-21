import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateCreatorHandler, calculateEloScore } from '../../api/update-creator.js';
import { createZetaSource } from '../../shared/zetaSource.js';

const ID = '11111111-2222-3333-4444-555555555555';
const OK_ORIGIN = 'https://ego-bloom.vercel.app';

/** upsert 인자를 기록하는 최소 Supabase 대역이다. */
function fakeSupabase({ updatedAt = null } = {}) {
  const calls = { upserts: [] };
  return {
    calls,
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: updatedAt ? { updated_at: updatedAt } : null, error: null }),
        upsert: async (row) => { calls.upserts.push(row); return { error: null }; },
      };
    },
  };
}

function fakeRes() {
  const out = { code: 0, body: null };
  return {
    out,
    status(code) { out.code = code; return this; },
    json(payload) { out.body = payload; return this; },
    end() { return this; },
  };
}

const snapshot = {
  id: ID,
  handle: 'someone',
  nickname: '누군가',
  profileImageUrl: '/zeta-image/abc.png',
  followerCount: 100,
  plotInteractionCount: 50_000,
  voicePlayCount: 10,
  plotCount: 5,
  topCharInteractions: [30_000, 20_000],
  oldestCharCreatedAt: '2025-01-01T00:00:00.000Z',
};

function run(body, { supabase = fakeSupabase(), fetchSnapshot = async () => snapshot, origin = OK_ORIGIN, ...rest } = {}) {
  const handler = createUpdateCreatorHandler({
    supabase,
    fetchSnapshot,
    now: () => Date.parse('2026-09-21T00:00:00.000Z'),
    env: {},
    ...rest,
  });
  const res = fakeRes();
  return handler({ method: 'POST', headers: { origin }, body }, res).then(() => ({ res: res.out, supabase }));
}

test('허용되지 않은 Origin 은 403 이다', async () => {
  const { res } = await run({ id: ID }, { origin: 'https://evil.example' });
  assert.equal(res.code, 403);
});

test('UUID 가 아니면 400 이다', async () => {
  const { res } = await run({ id: 'not-a-uuid' });
  assert.equal(res.code, 400);
});

test('클라이언트가 보낸 지표는 무시하고 서버가 읽은 값을 저장한다', async () => {
  const { res, supabase } = await run({
    id: ID,
    followerCount: 99_999_999,
    plotInteractionCount: 99_999_999,
    eloScore: 99_999_999,
    tierName: 'Champion',
    nickname: '조작된 이름',
  });

  assert.equal(res.code, 200);
  const row = supabase.calls.upserts[0];
  assert.equal(row.follower_count, snapshot.followerCount);
  assert.equal(row.plot_interaction_count, snapshot.plotInteractionCount);
  assert.equal(row.nickname, snapshot.nickname);
  assert.equal(row.elo_score, calculateEloScore(snapshot, Date.parse('2026-09-21T00:00:00.000Z')));
  assert.notEqual(row.tier_name, 'Champion');
});

test('최근에 갱신된 제작자는 상류를 다시 읽지 않는다', async () => {
  let fetched = 0;
  const { res, supabase } = await run({ id: ID }, {
    supabase: fakeSupabase({ updatedAt: '2026-09-20T23:55:00.000Z' }),
    fetchSnapshot: async () => { fetched += 1; return snapshot; },
  });
  assert.equal(res.code, 200);
  assert.equal(fetched, 0);
  assert.equal(supabase.calls.upserts.length, 0);
});

test('갱신 간격이 지났으면 다시 읽는다', async () => {
  const { supabase } = await run({ id: ID }, {
    supabase: fakeSupabase({ updatedAt: '2026-09-20T20:00:00.000Z' }),
  });
  assert.equal(supabase.calls.upserts.length, 1);
});

test('blacklist 는 상류 조회도 하지 않는다', async () => {
  let fetched = 0;
  const { res, supabase } = await run({ id: ID }, {
    env: { RANK_BLACKLIST: ID },
    fetchSnapshot: async () => { fetched += 1; return snapshot; },
  });
  assert.equal(res.code, 200);
  assert.equal(fetched, 0);
  assert.equal(supabase.calls.upserts.length, 0);
});

test('상류에 제작자가 없으면 404 이고 아무것도 쓰지 않는다', async () => {
  const { res, supabase } = await run({ id: ID }, { fetchSnapshot: async () => null });
  assert.equal(res.code, 404);
  assert.equal(supabase.calls.upserts.length, 0);
});

test('허용되지 않은 프로필 이미지 주소는 저장하지 않는다', async () => {
  const { supabase } = await run({ id: ID }, {
    fetchSnapshot: async () => ({ ...snapshot, profileImageUrl: 'https://evil.example/x.png' }),
  });
  assert.equal(supabase.calls.upserts[0].profile_image_url, null);
});

test('zetaSource 는 캐릭터 쪽을 끝까지 읽고 상위 20개와 최초 생성일을 만든다', async () => {
  const page = (n, offset) => ({
    plots: Array.from({ length: n }, (_, i) => ({
      interactionCountWithRegen: 10_000 - offset - i,
      createdAt: `2025-0${(i % 9) + 1}-01T00:00:00.000Z`,
    })),
  });
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('/users/')) return { ok: true, json: async () => ({ username: 'someone', nickname: '누군가', profileImageUrl: '/zeta-image/a.png' }) };
    if (url.includes('/creators/')) return { ok: true, json: async () => ({ followerCount: 7, plotInteractionCount: 800, voicePlaySeconds: 42 }) };
    const offset = Number(new URL(url).searchParams.get('offset'));
    return { ok: true, json: async () => (offset === 0 ? page(200, 0) : page(3, 200)) };
  };

  const snap = await createZetaSource({ fetchImpl }).creatorSnapshot(ID);
  assert.equal(snap.plotCount, 203);
  assert.equal(snap.topCharInteractions.length, 20);
  assert.equal(snap.topCharInteractions[0], 10_000);
  assert.equal(snap.oldestCharCreatedAt, '2025-01-01T00:00:00.000Z');
  // 회수가 없으면 초를 쓴다
  assert.equal(snap.voicePlayCount, 42);
  assert.equal(seen.filter(u => u.includes('/plots?')).length, 2);
});
