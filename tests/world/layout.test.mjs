import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, getWorldBounds, vacantSlots } from '../../shared/worldLayout.js';
import { cityExtentForCount } from '../../shared/urbanPlan.js';
import { LOT_SIZES } from '../../shared/lots.js';

/** 티어 문턱값 때문에 챔피언은 드물다. 실제 분포에 맞춘 표본을 쓴다. */
const MIX=[['Champion',31],['Master',79],['Diamond',118],['Platinum',98],['Gold',109],['Silver',39],['Bronze',98]];
const SCORES={Champion:3.9e8,Master:6e7,Diamond:2.5e7,Platinum:9e5,Gold:9e4,Silver:2e4,Bronze:3e3};
const creators=(count)=>{
  const total=MIX.reduce((sum,[,n])=>sum+n,0),rows=[];
  for(const [tier,share] of MIX)for(let i=0;i<Math.round(count*share/total)&&rows.length<count;i++)
    rows.push({id:`creator-${tier}-${i}`,nickname:`제작자 ${tier} ${i}`,handle:`${tier}${i}`,tier_name:tier,elo_score:SCORES[tier]+i});
  for(let i=rows.length;i<count;i++)rows.push({id:`creator-fill-${i}`,tier_name:'Bronze',elo_score:2000+i});
  return rows;
};
const thousand=creators(1000);

test('1000 creators occupy deterministic city lots',()=>{
  const city=buildWorld(thousand);
  assert.equal(city.length,1000);assert.deepEqual(city,buildWorld([...thousand].reverse()));
  assert.ok(city.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.z)&&Number.isFinite(b.height)&&b.height>0&&b.height<=260));
  assert.equal(new Set(city.map(b=>`${b.x.toFixed(3)},${b.z.toFixed(3)}`)).size,1000);
  assert.ok(city.every(b=>LOT_SIZES.includes(b.lot)));
});

test('tiers mix across named districts while the tallest skyline stays concentrated',()=>{
  const buildings=buildWorld(thousand),districts=new Map();
  for(const b of buildings)(districts.get(b.district)||districts.set(b.district,new Set()).get(b.district)).add(b.tier_name);
  assert.ok(districts.size>=6);assert.ok([...districts.values()].filter(tiers=>tiers.size>=4).length>=4);
  const mean=rows=>rows.reduce((s,b)=>s+b.height,0)/rows.length;
  assert.ok(mean(buildings.filter(b=>b.district==='central'))>mean(buildings.filter(b=>b.district!=='central')));
});

test('live-sized city stays inside its own extent and buildings form multi-lot blocks',()=>{
  const city=buildWorld(creators(572)),extent=city[0].cityExtent;
  // 공식은 성장 루프의 시작값이다. 이 표본은 7개 티어를 균등 순환시켜 챔피언이 82명인데
  // extent 1856 에서 챔피언 필지(132) 는 도시 전체에 53개뿐이다. 표본 자체가 전원 배치가
  // 불가능해 도시가 상한 가까이 커진다. 현실 분포의 상한은 아래 테스트가 따로 지킨다.
  assert.ok(extent<=cityExtentForCount(572)*2.4,`extent ${extent}`);
  assert.ok(city.every(b=>Math.abs(b.x)+b.lot/2<extent&&Math.abs(b.z)+b.lot/2<extent));
  const blocks=new Map();for(const b of city)(blocks.get(b.blockId)||blocks.set(b.blockId,[]).get(b.blockId)).push(b);
  assert.ok([...blocks.values()].filter(group=>group.length>=3).length>=50);
  // 사각 격자라 지구 회전은 거의 없다. 큰 회전은 필지 겹침 판정을 깨뜨린다.
  assert.ok(city.every(b=>Math.abs(b.blockRotation)<=.06));
});

test('height multipliers retain strong tier and ELO differences',()=>{
  const rows=['Bronze','Silver','Gold','Platinum','Diamond','Master','Champion'].flatMap((tier,i)=>[
    {id:`${tier}-low`,tier_name:tier,elo_score:10000+i},{id:`${tier}-high`,tier_name:tier,elo_score:900000+i},
  ]),byId=Object.fromEntries(buildWorld(rows).map(b=>[b.id,b]));
  for(const tier of ['Bronze','Silver','Gold','Platinum','Diamond','Master','Champion'])assert.ok(byId[`${tier}-high`].baseHeight>byId[`${tier}-low`].baseHeight);
  assert.ok(byId['Champion-high'].height>byId['Master-high'].height);
});

test('city-only map bounds contain every building',()=>{
  const city=buildWorld(creators(572)),bounds=getWorldBounds(city);
  assert.ok(bounds.minZ>-city[0].cityExtent*1.4);
  for(const b of city)assert.ok(b.x>bounds.minX&&b.x<bounds.maxX&&b.z>bounds.minZ&&b.z<bounds.maxZ);
});

test('vacant slots stay disjoint from the creator lots that share the plan',()=>{
  const rows=creators(572),city=buildWorld(rows),vacant=vacantSlots(rows);
  assert.ok(vacant.length>0);
  const used=new Set(city.map(b=>`${b.x.toFixed(3)},${b.z.toFixed(3)}`));
  for(const slot of vacant)assert.ok(!used.has(`${slot.x.toFixed(3)},${slot.z.toFixed(3)}`));
  assert.equal(vacant[0].cityExtent,city[0].cityExtent);
});

test('invalid scores and duplicate ids cannot corrupt layout',()=>{
  const buildings=buildWorld([{id:'a',elo_score:NaN},{id:'a',elo_score:2},{id:'b',elo_score:-20}]);
  assert.equal(buildings.length,2);assert.ok(buildings.every(b=>Number.isFinite(b.height)));
});

test('map bounds remain finite for hand-authored gallery buildings without lot metadata',()=>{
  const bounds=getWorldBounds([{id:'gallery',x:32,z:-64,height:20}]);
  assert.ok(Object.values(bounds).every(Number.isFinite));
});

test('현실 분포에서는 도시가 과하게 커지지 않고 조닝이 지켜진다',()=>{
  // 실제 티어 분포는 상위가 극소수다. 챔피언 최저 ELO 가 78,165,000 이라 상위 1000명
  // 안에 몇 명 없다. 조닝의 땅값은 이 분포로 재야 한다.
  const mix=[['Champion',3],['Grandmaster',9],['Master',28],['Diamond',60],
    ['Platinum',140],['Gold',210],['Silver',280],['Bronze',270]];
  const rows=[];let index=0;
  for(const [tier,count] of mix)for(let i=0;i<count;i++,index++)rows.push({
    id:`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,
    nickname:`제작자 ${index}`,handle:`c${index}`,elo_score:(1000-index)*100000,tier_name:tier});

  const city=buildWorld(rows),extent=city[0].cityExtent;
  assert.equal(city.length,1000);
  // 조닝 전에는 1.64 배였다. 산 세 곳, 해변 두 줄, 리조트 네 곳, 관청가 광장을
  // 건축 금지로 빼면서 늘었다. 2.1 을 넘으면 그건 새 낭비라 봐야 한다.
  assert.ok(extent<=cityExtentForCount(1000)*2.1,`extent ${extent}`);

  // 좌표가 겹치면 배치가 예비 경로로 떨어진 것이다.
  const seen=new Set();
  for(const b of city){const at=`${b.x},${b.z}`;assert.equal(seen.has(at),false,`${at} 중복`);seen.add(at);}

  // 관청가는 ZETA 시청과 중앙 공원 자리다. 어떤 티어도 여기 서지 않는다.
  assert.ok(city.every(b=>b.band!=='civic'),'관청가에 건물이 섰다');

  // 챔피언과 그랜드마스터는 도심 핵 안이다.
  for(const b of city)if(b.tier_name==='Champion'||b.tier_name==='Grandmaster')
    assert.equal(b.node,'central',`${b.tier_name} 가 ${b.node} 에 섰다`);

  // 브론즈와 실버는 도심 첨탑 대역에 들어가지 않는다.
  for(const b of city)if(b.tier_name==='Bronze'||b.tier_name==='Silver')
    assert.notEqual(b.band,'champ',`${b.tier_name} 가 첨탑 대역에 섰다`);
});
