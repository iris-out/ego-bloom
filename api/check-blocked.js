import { createClient } from '@supabase/supabase-js';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!supabase) return res.status(500).end(JSON.stringify({ error: 'DB not configured' }));

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return res.status(400).end(JSON.stringify({ error: 'Invalid id' }));

  const { data } = await supabase
    .from('account_current')
    .select('is_blocked')
    .eq('id', id)
    .single();

  res.end(JSON.stringify({ blocked: data?.is_blocked === true }));
}
