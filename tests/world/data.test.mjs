import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWorld, filterBuildings, mapPoint } from '../../src/world/data.js';

test('failed HTTP responses never become an empty successful city', async () => {
  await assert.rejects(fetchWorld({fetcher:async()=>new Response('{"error":"internal"}', {status:500})}), /불러오지/);
});
test('invalid successful payload is reported and legitimate empty array is accepted', async () => {
  await assert.rejects(fetchWorld({fetcher:async()=>Response.json({error:'bad'})}), /형식/);
  await assert.rejects(fetchWorld({fetcher:async()=>Response.json({buildings:[{id:'a', x:null,z:0,height:20}]})}), /형식/);
  assert.deepEqual(await fetchWorld({fetcher:async()=>Response.json({buildings:[]})}), []);
});
test('search matches Korean names and handles with optional at sign and tier', () => {
  const rows=[{nickname:'달빛 작가',handle:'Moon',tier_name:'Gold'}, {nickname:'해님',handle:'sun',tier_name:'Bronze'}];
  assert.equal(filterBuildings(rows,'달빛','all').length,1);
  assert.equal(filterBuildings(rows,'@MOON','gold').length,1);
  assert.equal(filterBuildings(rows,'@MOON','silver').length,0);
});
test('map projection reaches all four corners and inverts for navigation', () => {
  const bounds={minX:-100,maxX:100,minZ:-200,maxZ:200};
  assert.deepEqual(mapPoint({x:-100,z:-200},bounds),{x:0,y:0});
  assert.deepEqual(mapPoint({x:100,z:200},bounds),{x:100,y:100});
});

test('invalid camera positions cannot produce NaN map attributes', () => {
  const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
  assert.deepEqual(mapPoint({x:NaN,z:undefined},bounds),{x:50,y:50});
});
