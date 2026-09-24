import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldRoom } from '../../src/world/multiplayer.js';
import { createHealth } from '../../src/world/health.js';
import { consumeCombatHits, scoreRows, visibleScoreRows, validScore } from '../../src/world/worldScores.js';
import { actorLabelVisible } from '../../src/world/actorLabels.js';

const pose = life => ({ x: 0, y: 20, z: 0, heading: 0, pitch: 0, roll: 0, phase: 'airborne', kind: 'flight', key: 'fighter', life });
/** In-memory presence/broadcast hub: messages use the same channel handlers as production. */
function hub() {
  const entries = new Map(), packets = [];
  const sync = () => { for (const entry of entries.values()) entry.handlers['presence:sync']?.(); };
  const deliver = (sender, event, payload) => { for (const [id, entry] of entries) if (id !== sender) entry.handlers[`broadcast:${event}`]?.({ payload }); };
  async function join(id) {
    const handlers = {}, snapshots = []; let subscribe;
    const channel = {
      on(type, filter, fn) { handlers[`${type}:${filter.event}`] = fn; return this; },
      subscribe(fn) { subscribe = fn; return this; },
      presenceState: () => Object.fromEntries([...entries].map(([key, value]) => [key, [value.meta]])),
      async track(meta) { entries.get(id).meta = meta; sync(); return 'ok'; },
      async send(packet) { packets.push({ sender: id, ...packet }); deliver(id, packet.event, packet.payload); return 'ok'; },
    };
    entries.set(id, { handlers, meta: {} });
    const room = createWorldRoom({ channel: () => channel, async removeChannel() { entries.delete(id); sync(); } }, { id, onChange: state => snapshots.push(state), now: () => 10 });
    await subscribe('SUBSCRIBED'); sync();
    return { room, snapshots, last: () => snapshots.at(-1), raw: (event, payload) => deliver(id, event, payload) };
  }
  return { join, packets, deliver };
}

test('victim-confirmed fatality credits shooter once, survives swaps, and late join sees totals', async () => {
  const network = hub(), a = await network.join('a'), b = await network.join('b');
  b.room.setPose(pose(10)); b.room.tick();
  b.room.confirmFatal({ killer: 'a', life: 10 });
  assert.equal(a.last().scores.a.players, 1);
  b.raw('fatal', { id: 'b', killer: 'a', life: 10 });
  b.raw('fatal', { id: 'b', killer: 'a', life: 9 });
  b.raw('fatal', { id: 'b', killer: 'a', life: 11 });
  assert.equal(a.last().scores.a.players, 1);
  a.room.confirmAI('ground:3'); a.room.confirmAI('ground:3');
  a.room.setIdentity({ kind: 'car', ride: 'tank' }); a.room.setPose(null); a.room.tick();
  assert.deepEqual(a.last().scores.a, { seq: 2, players: 1, ai: 1 });
  const c = await network.join('c');
  assert.deepEqual(c.last().scores.a, { seq: 2, players: 1, ai: 1 });
  b.room.setPose(pose(11)); b.room.tick(); b.room.confirmFatal({ killer: 'a', life: 11 });
  assert.equal(c.last().scores.a.players, 2);
  a.room.close();
  assert.equal(c.last().scores.a, undefined);
  const anew = await network.join('a-new-session');
  assert.equal(anew.last().scores['a-new-session'].seq, 0);
  c.raw('fatal', { id: 'a', killer: 'a-new-session', life: 11 });
  assert.equal(anew.last().scores['a-new-session'].seq, 0);
});

test('malformed, stale and departed source messages cannot alter a score', async () => {
  const network = hub(), a = await network.join('a'), b = await network.join('b');
  b.raw('score', { id: 'b', score: { seq: 3, players: 1, ai: 2 } });
  for (const score of [{ seq: 2, players: 1, ai: 1 }, { seq: 4, players: 0, ai: 4 }, { seq: 99, players: NaN, ai: 0 }, { seq: -1, players: -1, ai: 0 }, { seq: 4, players: 2, ai: 1 }]) b.raw('score', { id: 'b', score });
  assert.deepEqual(a.last().scores.b, { seq: 3, players: 1, ai: 2 });
  b.room.close();
  network.deliver('b', 'score', { id: 'b', score: { seq: 9, players: 4, ai: 5 } });
  assert.equal(a.last().scores.b, undefined);
  assert.equal(validScore({ seq: Infinity, players: 0, ai: Infinity }), null);
});

test('fatal shooter follows accepted hit order and old life damage is discarded', () => {
  const health = { ...createHealth('car', 'tank'), hp: 50 };
  const queue = { amount: 170, hits: [{ life: 1, owner: 'old', amount: 100 }, { life: 2, owner: 'first', amount: 20 }, { life: 2, owner: 'fatal', amount: 40 }, { life: 2, owner: 'late', amount: 10 }] };
  const deaths = [];
  assert.equal(consumeCombatHits(health, queue, 2, 1, event => deaths.push(event)).wrecked, true);
  assert.deepEqual(deaths, [{ killer: 'fatal', life: 2 }]);
  assert.equal(queue.amount, 0); assert.deepEqual(queue.hits, []);
});

test('ranking uses total then deterministic ID and always includes own row', () => {
  const roster = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Player ${i}` }));
  const rows = scoreRows(roster, { 2: { seq: 3, players: 1, ai: 2 }, 1: { seq: 3, players: 3, ai: 0 } }, '7');
  assert.deepEqual(rows.slice(0, 2).map(row => row.id), ['1', '2']);
  assert.equal(visibleScoreRows(rows).at(-1).id, '7');
});

test('actor label visibility rejects far, offscreen, behind camera and malformed positions', () => {
  assert.equal(actorLabelVisible({ x: 0, y: 0, z: .5 }, 100), true);
  for (const [point, distance] of [[{ x: 2, y: 0, z: 0 }, 10], [{ x: 0, y: 0, z: 2 }, 10], [{ x: 0, y: 0, z: .5 }, 600], [{ x: NaN, y: 0, z: 0 }, 10]]) assert.equal(actorLabelVisible(point, distance), false);
});

test('fatality before the next pose tick publishes the new life before confirmation and credits once', async () => {
  const network = hub(), attacker = await network.join('attacker'), victim = await network.join('victim');
  victim.room.setPose(pose(1)); victim.room.tick();
  victim.room.setPose(pose(2));
  victim.room.confirmFatal({ killer: 'attacker', life: 2 });
  assert.equal(attacker.last().scores.attacker.players, 1, 'new life fatality must credit before the scheduled tick');
  const sent = network.packets.filter(packet => packet.sender === 'victim');
  assert.deepEqual(sent.map(packet => [packet.event, packet.payload.pose?.life ?? packet.payload.life]), [['flight', 1], ['flight', 2], ['fatal', 2]]);
  assert.equal(sent[1].payload.seq, sent[0].payload.seq + 1);
  victim.room.tick();
  victim.room.confirmFatal({ killer: 'attacker', life: 2 });
  victim.raw('fatal', { id: 'victim', killer: 'attacker', life: 2 });
  victim.raw('fatal', { id: 'victim', killer: 'attacker', life: 1 });
  assert.equal(attacker.last().scores.attacker.players, 1, 'tick and replay must not duplicate the credit');
});
