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

    let targetId = id;
    if (!targetId) {
      const clean = (handle || '').replace(/^@/, '').trim();
      const { data: found } = await supabase
        .from('account_current')
        .select('id')
        .eq('handle', clean)
        .single();
      if (!found) return res.status(404).json({ error: '해당 크리에이터를 찾을 수 없습니다.' });
      targetId = found.id;
    }

    const { error } = await supabase
      .from('account_current')
      .update({
        is_blocked: true,
        blocked_reason: reason?.trim() || null,
        blocked_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, id: targetId });
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
