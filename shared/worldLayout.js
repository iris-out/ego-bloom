export const WORLD = Object.freeze({ spacing: 32, roadEvery: 4, riverZ: 64, riverWidth: 24 });

export function buildWorld(records) {
  const unique = new Map();
  for (const row of records) {
    if (typeof row.id !== 'string' || !row.id) continue;
    const score = Math.max(0, Number(row.elo_score) || 0);
    if (!unique.has(row.id) || score > unique.get(row.id).elo_score) {
      unique.set(row.id, { ...row, elo_score: Number.isFinite(score) ? score : 0 });
    }
  }
  const rows = [...unique.values()].sort((a,b) => b.elo_score-a.elo_score || a.id.localeCompare(b.id)).slice(0,1000);
  const slots = [];
  for (let gx=-28; gx<=28; gx++) for (let gz=-28; gz<=28; gz++) {
    const x=gx*WORLD.spacing, z=gz*WORLD.spacing;
    if (gx % WORLD.roadEvery === 0 || gz % WORLD.roadEvery === 0) continue;
    if (Math.abs(z-WORLD.riverZ) < 28) continue;
    if (Math.abs(x)>=32 && Math.abs(x)<=96 && z>=-96 && z<=-32) continue;
    slots.push({x,z});
  }
  slots.sort((a,b) => (a.x*a.x+a.z*a.z)-(b.x*b.x+b.z*b.z) || a.z-b.z || a.x-b.x);
  const group = row => ['master','champion'].includes((row.tier_name||'').toLowerCase()) ? 0
    : ['platinum','diamond'].includes((row.tier_name||'').toLowerCase()) ? 1 : 2;
  const hash = id => {
    let value=2166136261;
    for (const char of id) value=Math.imul(value^char.charCodeAt(0),16777619);
    value^=value>>>16; value=Math.imul(value,0x7feb352d); value^=value>>>15;
    return value>>>0;
  };
  // Mix silhouettes within each requested neighborhood, deterministically by identity.
  const placement=[...rows].sort((a,b)=>group(a)-group(b) || hash(a.id)-hash(b.id) || a.id.localeCompare(b.id));
  const addresses=new Map(placement.map((row,i)=>[row.id,slots[i]]));
  return rows.map((row,i) => ({
    ...row, ...addresses.get(row.id), rank:i+1,
    height: Math.max(12, Math.min(70, 12 + (Math.log10(Math.max(1,row.elo_score))-3)*9)),
  }));
}

export function getWorldBounds(buildings) {
  let radius=160;
  for (const b of buildings) radius=Math.max(radius,Math.abs(b.x)+48,Math.abs(b.z)+48);
  return {minX:-radius,maxX:radius,minZ:-radius,maxZ:radius};
}
