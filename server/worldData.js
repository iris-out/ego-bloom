import { buildWorld } from '../shared/worldLayout.js';
import { getCreatorTierName } from '../shared/creatorTiers.js';

export function resolveWorldTier(row) {
  const tierName = getCreatorTierName(Number(row?.elo_score) || 0);
  const grandmaster = tierName === 'GRANDMASTER';
  return {
    tierName,
    layoutTierName: grandmaster ? 'MASTER' : tierName,
    heightScale: grandmaster ? 1.2 : 1,
  };
}

export async function loadWorldData(supabase, blacklist='') {
  if (!supabase) throw new Error('World database is not configured');
  const ids=blacklist.split(',').map(s=>s.trim()).filter(s=>/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s));
  let query=supabase.from('account_current')
    .select('id,nickname,handle,elo_score,tier_name,profile_image_url,updated_at')
    .eq('is_blocked',false)
    .order('elo_score',{ascending:false})
    .order('id',{ascending:true});
  if (ids.length) query=query.not('id','in',`(${ids.join(',')})`);
  const {data,error}=await query.limit(1000);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Invalid world database response');
  const layoutRows=data.map((row)=>{
    const resolved=resolveWorldTier(row);
    return {...row,tier_name:resolved.layoutTierName,_resolvedTier:resolved};
  });
  const buildings=buildWorld(layoutRows).map(({_resolvedTier,...building})=>({
    ...building,
    tier_name:_resolvedTier.tierName,
    height:Math.min(260,building.height*_resolvedTier.heightScale),
  }));
  return {buildings};
}
