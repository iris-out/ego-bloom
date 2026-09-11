import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, getWorldBounds, WORLD } from '../../shared/worldLayout.js';

const creators = Array.from({ length: 1000 }, (_, i) => ({
  id: `creator-${i}`, nickname: `제작자 ${i}`, handle: `user${i}`,
  elo_score: (1000 - i) * 100000, tier_name: ['Champion', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'][i % 7],
}));

test('1000 creators occupy unique plots outside roads and river with bounded heights', () => {
  const buildings = buildWorld(creators);
  assert.equal(buildings.length, 1000);
  assert.equal(new Set(buildings.map(b => `${b.x},${b.z}`)).size, 1000);
  for (const b of buildings) {
    assert.notEqual((b.x / WORLD.spacing) % WORLD.roadEvery, 0);
    assert.notEqual((b.z / WORLD.spacing) % WORLD.roadEvery, 0);
    assert.ok(Math.abs(b.z - WORLD.riverZ) >= 28);
    assert.ok(b.height >= 12 && b.height <= 70);
  }
});

test('same records yield identical addresses regardless of input order', () => {
  assert.deepEqual(buildWorld(creators), buildWorld([...creators].reverse()));
});

test('tier neighborhoods remain central but ranks mix inside each neighborhood', () => {
  const buildings=buildWorld(creators);
  const group=t=>['master','champion'].includes(t.toLowerCase())?0:['platinum','diamond'].includes(t.toLowerCase())?1:2;
  const distances=[[],[],[]];
  for (const b of buildings) distances[group(b.tier_name)].push(b.x*b.x+b.z*b.z);
  assert.ok(Math.max(...distances[0])<=Math.min(...distances[1]));
  assert.ok(Math.max(...distances[1])<=Math.min(...distances[2]));
  const central=buildings.filter(b=>group(b.tier_name)===0).sort((a,b)=>a.x*a.x+a.z*a.z-b.x*b.x-b.z*b.z);
  assert.ok(central.slice(0,10).some(b=>b.tier_name==='Master'));
  assert.ok(central.slice(0,10).some(b=>b.tier_name==='Champion'));
  assert.ok(buildings.some((b,i)=>i>0 && b.x*b.x+b.z*b.z < buildings[i-1].x**2+buildings[i-1].z**2));
});

test('civic and park blocks stay free of creator buildings',()=>{
  const buildings=buildWorld(creators);
  assert.ok(buildings.every(b=>!(Math.abs(b.x)<=96 && Math.abs(b.x)>=32 && b.z>=-96 && b.z<=-32)));
});

test('world map bounds include all exterior plots with padding and handle empty cities', () => {
  for (const buildings of [buildWorld(creators), []]) {
    const bounds = getWorldBounds(buildings);
    assert.ok(bounds.maxX > bounds.minX && bounds.maxZ > bounds.minZ);
    for (const b of buildings) {
      assert.ok(b.x > bounds.minX && b.x < bounds.maxX);
      assert.ok(b.z > bounds.minZ && b.z < bounds.maxZ);
    }
  }
});

test('invalid scores and duplicate ids cannot corrupt layout', () => {
  const buildings = buildWorld([{id:'a', elo_score:NaN}, {id:'a', elo_score:2}, {id:'b', elo_score:-20}]);
  assert.equal(buildings.length, 2);
  assert.ok(buildings.every(b => Number.isFinite(b.height)));
});

test('ELO spreads heights within a tier and master/champion apply requested multipliers',()=>{
  const buildings=buildWorld([
    {id:'g1',tier_name:'Gold',elo_score:100000}, {id:'g2',tier_name:'Gold',elo_score:110000},
    {id:'m',tier_name:'Master',elo_score:1000000}, {id:'c',tier_name:'Champion',elo_score:1000000},
  ]);
  const byId=Object.fromEntries(buildings.map(b=>[b.id,b]));
  assert.ok(byId.g2.height/byId.g1.height>1.5);
  assert.equal(byId.m.height,byId.m.baseHeight*1.7);
  assert.equal(byId.c.height,byId.c.baseHeight*2);
});
