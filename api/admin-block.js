import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

const HANDLE_RE = /^[a-zA-Z0-9가-힣._-]{1,50}$/;

async function resolveHandleFromZeta(cleanHandle) {
  if (!HANDLE_RE.test(cleanHandle)) return null;
  try {
    const res = await fetch(`https://zeta-ai.io/@${encodeURIComponent(cleanHandle)}`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EgoBloom-Admin/1.0)' },
    });
    let finalHost = '';
    try { finalHost = new URL(res.url).hostname; } catch {}
    if (!finalHost.endsWith('zeta-ai.io')) return null;
    let match = res.url.match(/creators\/([a-f0-9-]{36})/i);
    if (!match) {
      const html = await res.text();
      match = html.match(/creators\/([a-f0-9-]{36})/i);
    }
    return match?.[1] ?? null;
  } catch { return null; }
}

async function verifyAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .single();
  return adminRow ? user : null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: '관리자 권한이 없습니다.' });

  // GET: 차단된 사용자 목록
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('account_current')
      .select('id, handle, nickname, elo_score, is_blocked, blocked_reason, blocked_at')
      .eq('is_blocked', true)
      .order('blocked_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ blocked: data ?? [] });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // POST: 사용자 차단 (id 또는 handle로)
  if (req.method === 'POST') {
    const { id, handle, reason } = payload;
    if (!id && !handle) return res.status(400).json({ error: 'id 또는 handle이 필요합니다.' });

    const now = new Date().toISOString();
    const blockFields = {
      is_blocked: true,
      blocked_reason: reason?.trim() || null,
      blocked_at: now,
    };

    // ── 핸들로 차단 ──
    if (!id) {
      const clean = (handle || '').replace(/^@/, '').trim();

      // 1. DB에서 먼저 조회
      const { data: found } = await supabase
        .from('account_current')
        .select('id')
        .eq('handle', clean)
        .single();

      if (found) {
        // 이미 등록된 사용자 → 바로 업데이트
        const { error } = await supabase
          .from('account_current')
          .update(blockFields)
          .eq('id', found.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, id: found.id });
      }

      // 2. DB에 없으면 Zeta API로 UUID 조회
      const resolvedId = await resolveHandleFromZeta(clean);
      if (!resolvedId) return res.status(404).json({ error: '해당 크리에이터를 찾을 수 없습니다.' });

      // 3. 최소 행 upsert (update-creator가 나중에 채워줌, is_blocked는 유지됨)
      const { error } = await supabase
        .from('account_current')
        .upsert({
          id: resolvedId,
          handle: clean,
          nickname: clean,
          follower_count: 0,
          plot_interaction_count: 0,
          voice_play_count: 0,
          elo_score: 0,
          tier_name: 'BRONZE',
          updated_at: now,
          ...blockFields,
        }, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, id: resolvedId, preRegistered: true });
    }

    // ── UUID로 차단 ──
    const { data: updated, error } = await supabase
      .from('account_current')
      .update(blockFields)
      .eq('id', id)
      .select('id');
    if (error) return res.status(500).json({ error: error.message });
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'DB에 등록되지 않은 사용자입니다. @핸들로 다시 시도해주세요.' });
    }
    return res.status(200).json({ success: true, id });
  }

  // DELETE: 차단 해제
  if (req.method === 'DELETE') {
    const { id } = payload;
    if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

    const { error } = await supabase
      .from('account_current')
      .update({ is_blocked: false, blocked_reason: null, blocked_at: null })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
