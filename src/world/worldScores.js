import { hurt } from './health.js';

const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
export function validScore(value) {
  if (!value || !count(value.seq) || !count(value.players) || !count(value.ai) || value.seq !== value.players + value.ai) return null;
  return { seq: value.seq, players: value.players, ai: value.ai };
}
export const emptyScore = () => ({ seq: 0, players: 0, ai: 0 });
export function scoreRows(roster, scores, selfId) {
  const rows = roster.map(person => ({ ...person, ...(validScore(scores?.[person.id]) || emptyScore()) }));
  rows.sort((a, b) => b.seq - a.seq || a.id.localeCompare(b.id));
  return rows.map((row, index) => ({ ...row, rank: index + 1, self: row.id === selfId }));
}
export function visibleScoreRows(rows, limit = 5) {
  const top = rows.slice(0, limit), own = rows.find(row => row.self);
  if (own && !top.includes(own)) top.push(own);
  return top;
}
let generation = 0;
export const nextCombatLife = () => ++generation;
/** Apply accepted hits in simulation order. Only the hit crossing zero owns the fatality. */
export function consumeCombatHits(health, queue, life, now, onFatal) {
  if (!queue) return health;
  let next = health;
  for (const hit of queue.hits || []) {
    if (hit.life !== life || !Number.isFinite(hit.amount) || hit.amount <= 0) continue;
    const before = next;
    next = hurt(next, hit.amount, now);
    if (!before.wrecked && next.wrecked && hit.owner) onFatal?.({ killer: hit.owner, life });
  }
  queue.amount = 0; queue.hits = [];
  return next;
}
