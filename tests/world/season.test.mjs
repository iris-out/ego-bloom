import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeason, getAtmosphere, getTimeOfDay } from '../../src/world/season.js';
test('season uses KST date boundaries and September 12 is early autumn',()=>{
 const before=getSeason(new Date('2026-09-11T14:59:59Z')),after=getSeason(new Date('2026-09-11T15:00:00Z'));
 assert.equal(before.dateKey,'2026-09-11');assert.equal(after.dateKey,'2026-09-12');assert.equal(after.label,'초가을');
 assert.notEqual(after.leaf,getSeason(new Date('2026-07-12T00:00:00Z')).leaf);
});
test('all calendar days including leap day provide finite seasonal atmospheres',()=>{
 for(let day=0;day<366;day++){
  const season=getSeason(new Date(Date.UTC(2028,0,1+day)));
  for(const mode of ['day','dawn','sunset','night']){
   const sky=getAtmosphere(mode,season,'clear');
   assert.ok(sky.direction.every(Number.isFinite));assert.match(season.ground,/^#[0-9a-f]{6}$/i);
  }
 }
 const season=getSeason(new Date('2026-09-12T00:00:00Z'));
 assert.ok(getAtmosphere('dawn',season).direction[0]>0);
 assert.ok(getAtmosphere('sunset',season).direction[0]<0);
 assert.notEqual(getAtmosphere('dawn',season).horizon,getAtmosphere('sunset',season).horizon);
});

const atKst = (hour, minute = 0) => new Date(Date.UTC(2026, 8, 13, hour - 9, minute));

test('시간대는 KST 시각을 따른다', () => {
  assert.equal(getTimeOfDay(atKst(0)), 'night');
  assert.equal(getTimeOfDay(atKst(4, 59)), 'night');
  assert.equal(getTimeOfDay(atKst(5)), 'dawn');
  assert.equal(getTimeOfDay(atKst(6, 59)), 'dawn');
  assert.equal(getTimeOfDay(atKst(7)), 'day');
  assert.equal(getTimeOfDay(atKst(16, 59)), 'day');
  assert.equal(getTimeOfDay(atKst(17)), 'sunset');
  assert.equal(getTimeOfDay(atKst(18, 59)), 'sunset');
  assert.equal(getTimeOfDay(atKst(19)), 'night');
  assert.equal(getTimeOfDay(atKst(23, 59)), 'night');
});

test('시간대는 브라우저 시간대와 무관하다', () => {
  // 같은 순간을 서울에서 보면 새벽 2시다. 어느 지역에서 열어도 밤이어야 한다.
  assert.equal(getTimeOfDay(new Date('2026-09-13T17:00:00Z')), 'night');
  assert.equal(getTimeOfDay(new Date('2026-09-13T03:00:00Z')), 'day');
});

test('잘못된 날짜는 낮으로 떨어진다', () => {
  assert.equal(getTimeOfDay(new Date('없는날짜')), 'day');
  assert.equal(getTimeOfDay(null), 'day');
});

test('밤하늘은 진한 파랑이고 낮보다 훨씬 어둡다', () => {
  const season = getSeason(new Date('2026-09-13T00:00:00Z'));
  const night = getAtmosphere('night', season);
  const day = getAtmosphere('day', season);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  for (const key of ['zenith', 'horizon']) {
    const [r, g, b] = rgb(night[key]);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    assert.ok(luma < 26, `밤 ${key} 가 밝다. luma ${luma.toFixed(1)}`);
    assert.ok(b > r && b > g, `밤 ${key} 가 파랑이 아니다. ${night[key]}`);
    // 파랑이 다른 채널보다 뚜렷하게 앞서야 진한 파랑으로 읽힌다.
    assert.ok(b - Math.max(r, g) >= 8, `밤 ${key} 의 파랑이 약하다. ${night[key]}`);
  }

  const nightLuma = rgb(night.horizon).reduce((sum, v) => sum + v, 0);
  const dayLuma = rgb(day.horizon).reduce((sum, v) => sum + v, 0);
  assert.ok(nightLuma < dayLuma * 0.12, `밤 지평선이 낮의 ${(nightLuma / dayLuma * 100).toFixed(0)}% 다`);
});

test('밤에는 계절 색을 지평선에 섞지 않는다', () => {
  const season = getSeason(new Date('2026-09-13T00:00:00Z'));
  const plain = getAtmosphere('night', season);
  const other = getAtmosphere('night', { ...season, horizon: '#ffffff' });
  assert.equal(plain.horizon, other.horizon);
});
