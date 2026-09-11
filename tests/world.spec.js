import { test, expect } from '@playwright/test';
import { buildWorld } from '../shared/worldLayout.js';
const tiers=['Champion','Master','Diamond','Platinum','Gold','Silver','Bronze'];
const buildings=buildWorld(Array.from({length:1000},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,nickname:i===0?'달빛 작가':`제작자 ${i}`,handle:`creator${i}`,elo_score:(1000-i)*100000,tier_name:tiers[i%7]})));
async function mock(page,rows=buildings){await page.route('**/api/get-world-data',route=>route.fulfill({json:{buildings:rows}}));}

test('1000 creator city supports search, selection, profile, map and settings',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/NaN|PCFSoftShadowMap|THREE.Clock/.test(m.text()))errors.push(m.text());});
  await page.setViewportSize({width:1440,height:960});await mock(page);
  await page.addInitScript(()=>{window.worldLongTasks=[];new PerformanceObserver(list=>window.worldLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
  await page.goto('/world');
  await expect(page.getByRole('heading',{name:'크리에이터 시티'})).toBeVisible();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('button',{name:'제작자 목록 펼치기'})).toBeVisible();
  await expect(page.locator('.world-explorer-body')).toBeHidden();
  await page.getByRole('textbox',{name:'제작자 검색'}).fill('@creator999');
  await expect(page.locator('.world-result')).toHaveCount(1);
  await page.locator('.world-result').click();
  await expect(page.getByRole('region',{name:'선택한 제작자'})).toContainText('제작자 999');
  await expect(page.getByRole('link',{name:'프로필 보기'})).toHaveAttribute('href',`/profile?creator=${buildings.find(b=>b.handle==='creator999').id}`);
  await page.getByRole('button',{name:'도시 중심으로 이동'}).click();
  await page.getByRole('button',{name:'월드 설정',exact:true}).click();
  await page.getByLabel('그래픽 품질').selectOption('low');
  await page.getByLabel('시간대').selectOption('night');
  await page.getByLabel('날씨').selectOption('snow');
  await page.getByRole('button',{name:'설정 닫기'}).click();
  await expect(page.getByRole('region',{name:'도시 전체 지도'})).toBeVisible();
  expect(await page.locator('.world-map circle').evaluateAll(nodes=>nodes.every(n=>Number.isFinite(Number(n.getAttribute('cx')))&&Number.isFinite(Number(n.getAttribute('cy')))))).toBe(true);
  await page.getByRole('button',{name:'선택 닫기'}).click();
  await page.getByRole('button',{name:'검색어 지우기'}).click();
  await page.screenshot({path:'/tmp/ego-world-desktop-night.png'});
  const metrics=await page.evaluate(()=>({paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),longTasks:window.worldLongTasks,ready:document.querySelector('.world-stage').dataset}));
  console.log('WORLD_METRICS',JSON.stringify(metrics));
  expect(errors).toEqual([]);
});

test('mobile search, tier selection and touch controls stay within viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page);await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true');
  await page.getByRole('textbox',{name:'제작자 검색'}).fill('달빛');
  await page.locator('.world-result').click();
  await expect(page.getByRole('link',{name:'프로필 보기'})).toBeVisible();
  const inside=await page.evaluate(()=>[...document.querySelectorAll('.world-header,.world-explorer,.world-selection,.world-map,.world-touch-controls')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  expect(inside).toBe(true);
  await page.screenshot({path:'/tmp/ego-world-mobile.png'});
});

test('API error retries successfully and empty city offers model gallery',async({page})=>{
  let failed=true;await page.route('**/api/get-world-data',route=>route.fulfill(failed?{status:503,json:{error:'unavailable'}}:{json:{buildings:[]}}));
  await page.goto('/world');
  await expect(page.getByRole('heading',{name:'도시에 연결하지 못했습니다'})).toBeVisible();
  failed=false;await page.getByRole('button',{name:'다시 시도',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'첫 번째 제작자를 기다리는 도시'})).toBeVisible();
  await page.getByRole('button',{name:'건물 컬렉션 둘러보기'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.world-result')).toHaveCount(7);
  await page.screenshot({path:'/tmp/ego-world-gallery.png'});
});
