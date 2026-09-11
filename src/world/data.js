export async function fetchWorld({signal, fetcher=fetch, timeout=15000}={}) {
  const controller = new AbortController();
  const abort=()=>controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetcher('/api/get-world-data',{signal:controller.signal});
    if (!response.ok) throw new Error('도시 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    const payload=await response.json();
    if (!Array.isArray(payload.buildings) || payload.buildings.length>1000 || payload.buildings.some(b=>
      !b || typeof b.id!=='string' || !Number.isFinite(b.x) || !Number.isFinite(b.z) || !Number.isFinite(b.height) || b.height<=0
    )) throw new Error('도시 데이터 형식이 올바르지 않습니다. 다시 시도해주세요.');
    return payload.buildings;
  } catch(error) {
    if (signal?.aborted) throw error;
    if (error.name==='AbortError') throw new Error('연결 시간이 초과되었습니다. 다시 시도해주세요.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
  }
}

export function filterBuildings(buildings, query, tier) {
  const term=query.trim().replace(/^@/,'').toLocaleLowerCase();
  return buildings.filter(b=>(tier==='all' || (b.tier_name||'').toLowerCase()===tier) &&
    (!term || `${b.nickname||''} ${b.handle||''}`.toLocaleLowerCase().includes(term)));
}

export function mapPoint(point,bounds) {
  const x=Number.isFinite(point?.x)?point.x:0, z=Number.isFinite(point?.z)?point.z:0;
  return {x:(x-bounds.minX)/(bounds.maxX-bounds.minX)*100,y:(z-bounds.minZ)/(bounds.maxZ-bounds.minZ)*100};
}
