import { createClient } from '@supabase/supabase-js';
import { loadWorldData } from '../server/worldData.js';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY) : null;

export default async function handler(req,res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='GET') return res.status(405).json({error:'Method Not Allowed'});
  try {
    return res.status(200).json(await loadWorldData(supabase,process.env.RANK_BLACKLIST));
  } catch {
    return res.status(503).json({error:'World data is temporarily unavailable'});
  }
}
