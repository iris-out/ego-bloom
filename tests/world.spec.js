import { test, expect } from '@playwright/test';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { buildWorld } from '../shared/worldLayout.js';
import { RIDE_GROUPS } from '../src/world/rideSpecs.js';
import { variantCountOf } from '../src/world/models/tierBuildings.js';
import { CREATOR_TIERS } from '../src/design/tiers.js';
const tiers=['Champion','Master','Diamond','Platinum','Gold','Silver','Bronze'];
const galleryModelCount=CREATOR_TIERS.reduce((total,tier)=>total+variantCountOf(tier.key),0);
const initialGalleryResultCount=Math.min(galleryModelCount,40);
const buildings=buildWorld(Array.from({length:1000},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,nickname:i===0?'달빛 작가':`제작자 ${i}`,handle:`creator${i}`,elo_score:(1000-i)*100000,tier_name:tiers[i%7]})));
async function mock(page,rows=buildings){await page.route('**/api/get-world-data',route=>route.fulfill({json:{buildings:rows}}));}
/** 탐색 패널은 이제 상단 탭 안에 있다. 이미 열려 있으면 다시 누르면 닫히므로 확인한다. */
async function openDiscover(page){
  if(await page.getByRole('textbox',{name:'제작자 검색'}).count()===0) await page.getByRole('tab',{name:'탐색'}).click();
  await expect(page.getByRole('textbox',{name:'제작자 검색'})).toBeVisible();
}
/** 좌하단 드라이브 시작에서 탈것을 골라 카운트다운을 거쳐 조종까지 들어간다. */
async function ride(page,group,name){
  await page.getByRole('button',{name:'드라이브 시작, 단축키 스페이스바'}).click();
  const sheet=page.getByRole('dialog',{name:'탈것 선택'});
  await sheet.getByRole('tab',{name:new RegExp(group)}).click();
  await sheet.getByRole('button',{name:new RegExp(name)}).click();
  await sheet.getByRole('button',{name:'출발'}).click();
  await expect(page.locator('.wui-hud-centre')).toBeVisible({timeout:9000});
}

test('1000 creator city supports search, selection, profile, map and settings',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/NaN|PCFSoftShadowMap|THREE.Clock/.test(m.text()))errors.push(m.text());});
  await page.setViewportSize({width:1440,height:960});await mock(page);
  await page.addInitScript(()=>{window.worldLongTasks=[];new PerformanceObserver(list=>window.worldLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
  await page.goto('/world');
  await expect(page.getByRole('heading',{name:'크리에이터 시티'})).toBeVisible();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await expect(page.getByRole('button',{name:'드라이브 시작, 단축키 스페이스바'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'제작자 검색'})).toHaveCount(0);
  await page.getByRole('tab',{name:'탐색'}).click();
  await page.getByRole('textbox',{name:'제작자 검색'}).fill('@creator999');
  await expect(page.locator('.world-result')).toHaveCount(1);
  await page.locator('.world-result').click();
  await expect(page.getByRole('region',{name:'선택한 제작자'})).toContainText('제작자 999');
  await expect(page.getByRole('link',{name:'프로필 보기'})).toHaveAttribute('href',`/profile?creator=${buildings.find(b=>b.handle==='creator999').id}`);
  // 제작자를 고르면 탐색 탭이 닫힌다. 도시 중심 버튼은 탭 안에 있다.
  await openDiscover(page);
  await page.getByRole('button',{name:'도시 중심으로 이동'}).click();
  await page.getByRole('tab',{name:'설정'}).click();
  await page.getByLabel('그래픽 품질').selectOption('low');
  await page.getByLabel('시간대').selectOption('night');
  await page.getByLabel('날씨').selectOption('snow');
  await page.getByRole('button',{name:'설정 닫기'}).click();
  await page.getByRole('tab',{name:'지도'}).click();
  await expect(page.getByRole('region',{name:'도시 전체 지도'})).toBeVisible();
  expect(await page.locator('.world-map circle').evaluateAll(nodes=>nodes.every(n=>Number.isFinite(Number(n.getAttribute('cx')))&&Number.isFinite(Number(n.getAttribute('cy')))))).toBe(true);
  await page.getByRole('button',{name:'선택 닫기'}).click();
  await page.getByRole('tab',{name:'탐색'}).click();
  await page.getByRole('button',{name:'검색어 지우기'}).click();
  await page.screenshot({path:'/tmp/ego-world-desktop-night.png'});
  const metrics=await page.evaluate(()=>({paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),longTasks:window.worldLongTasks,ready:document.querySelector('.world-stage').dataset}));
  console.log('WORLD_METRICS',JSON.stringify(metrics));
  expect(errors).toEqual([]);
});

test('mobile search, tier selection and touch controls stay within viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page);await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await openDiscover(page);
  await page.getByRole('textbox',{name:'제작자 검색'}).fill('달빛');
  await page.locator('.world-result').click();
  await expect(page.getByRole('link',{name:'프로필 보기'})).toBeVisible();
  const inside=await page.evaluate(()=>[...document.querySelectorAll('.wui-tabs,.wui-panel,.world-selection,.world-map,.world-touch-controls,.wui-launcher-slot')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
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
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await expect(page.locator('.world-result')).toHaveCount(initialGalleryResultCount);
  await page.screenshot({path:'/tmp/ego-world-gallery.png'});
});

test('nearby rooftop name selects creator without corrupting camera and WebGL can fail safely',async({page})=>{
  const rows=[{id:'roof-creator',nickname:'옥상의 작가',handle:'roof',tier_name:'Gold',elo_score:10000,x:32,z:32,height:35,rank:1}];
  await mock(page,rows);await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await openDiscover(page);
  await page.getByRole('textbox',{name:'제작자 검색'}).fill('옥상');await page.locator('.world-result').click();
  const sign=page.getByRole('button',{name:'옥상의 작가 선택'});
  await expect(sign).toBeVisible({timeout:15000});await sign.click();
  await expect(page.getByRole('region',{name:'선택한 제작자'})).toContainText('옥상의 작가');
  await page.screenshot({path:'/tmp/ego-world-rooftop.png'});
  await page.locator('.world-canvas canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.getByText('3D 그래픽 컨텍스트 복구 중…')).toBeVisible();
  await expect(page.getByRole('link',{name:'프로필 보기'})).toBeVisible();
});

test('jet cockpit starts parked, camera drag does not steer plane, throttle and reset work',async({page})=>{
  await page.setViewportSize({width:1440,height:960});await mock(page,buildings.slice(0,7));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'항공기','라이트 제트');
  const hud=page.locator('.wui-hud-centre');
  await expect(hud).toBeVisible();
  await expect(page.getByRole('slider',{name:/비행기 스로틀/})).toHaveAttribute('aria-valuenow','0');
  const canvas=page.locator('.world-canvas canvas');const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.3,{steps:6});await page.mouse.up();
  // 카메라를 끌어도 기수 방위는 000 이어야 한다. 드래그가 조향으로 새면 안 된다.
  await expect(hud).toContainText('000');
  await page.screenshot({path:'/tmp/ego-world-jet.png'});
  await page.getByRole('slider',{name:/비행기 스로틀/}).press('Home');
  await expect(page.getByRole('slider',{name:/비행기 스로틀/})).toHaveAttribute('aria-valuenow','100');
  await page.getByRole('button',{name:'출발 지점으로 돌아가기'}).click();
  await expect(page.getByRole('slider',{name:/비행기 스로틀/})).toHaveAttribute('aria-valuenow','0');
  // C 로 1인칭 콕핏에 들어가고 다시 나온다.
  await page.keyboard.press('KeyC');
  await expect(page.getByRole('button',{name:/3인칭/})).toBeVisible();
  await page.screenshot({path:'/tmp/ego-world-jet-cockpit.png'});
  await page.keyboard.press('KeyC');
  await expect(page.getByRole('button',{name:/1인칭/})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/ego-world-jet-mobile.png'});
  const bounds=await hud.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(hud).toHaveCount(0);
});

test('every selectable ground vehicle mounts a valid Three model',async({page})=>{
  // 세 차량의 출발 카운트다운과 1인칭 렌더링까지 순차 확인한다.
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1280,height:900});await mock(page,buildings.slice(0,20));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  for(const name of ['전차','자주포','장갑차','대공포']){
    await ride(page,'차량',name);
    // 전투 차량은 마우스로 가리킨 곳을 조준한다. 십자선이 떠 있어야 한다.
    await expect(page.locator('.wui-reticle-svg')).toBeVisible();
    await page.keyboard.press('KeyC');
    await expect(page.getByRole('button',{name:/3인칭/})).toBeVisible();
    await expect(page.locator('.wui-reticle-svg')).toBeVisible();
    await expect(page.getByRole('button',{name:/발사/})).toBeVisible();
    // 대공포만 배율 조준경이 있다. V 를 누르면 1배에서 2배로 올라간다.
    if(name==='대공포'){
      await expect(page.locator('.wui-reticle-zoom')).toContainText('1X');
      await page.keyboard.press('KeyV');
      await expect(page.locator('.wui-reticle-zoom')).toContainText('2X');
    }
    // 1인칭에서 마우스로 끌면 포탑이 돌아 시점이 따라간다. 포탑이 곧 시점이다.
    // 방향(오른쪽으로 끌면 오른쪽) 은 turret-aim 단위 테스트가 포구 벡터로 확인한다.
    const canvas=page.locator('.world-canvas canvas');
    const box=await canvas.boundingBox();
    // 계기 보고가 0.15초 주기라 전환 직후에는 아직 값이 없을 수 있다. 떠 있을 때까지 기다린다.
    await expect(page.locator('.wui-reticle-range')).toBeVisible({timeout:15000});
    const before=await page.locator('.wui-reticle-range').textContent();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down({button:'right'});
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2-160,{steps:10});
    await page.mouse.up({button:'right'});
    await expect(page.locator('.wui-reticle-range')).not.toHaveText(before,{timeout:4000});
    await page.keyboard.press('Escape');
    await expect(page.locator('.wui-hud-centre')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('interceptor toggles the boost stage with Q and keeps the rudder on Z',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:960});await mock(page,buildings.slice(0,7));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'항공기','요격기');
  const hud=page.locator('.wui-hud-centre');
  // 요격기만 연료 칸이 있다. 기본 단계에서는 단계 이름을 붙이지 않는다.
  await expect(hud).toContainText('FUEL %');
  await expect(hud).not.toContainText('OD READY');
  await page.keyboard.press('KeyQ');
  await expect(hud).toContainText('OD READY');
  // 누르고 있어도 한 번만 바뀐다. 두 번째 keydown 부터는 autoRepeat 이라 무시해야 한다.
  await page.keyboard.down('KeyQ');await page.keyboard.down('KeyQ');await page.keyboard.down('KeyQ');
  await page.keyboard.up('KeyQ');
  await expect(hud).not.toContainText('OD READY');
  await page.keyboard.press('KeyQ');
  await expect(hud).toContainText('OD READY');
  // Q 가 단계 전환이라 왼쪽 러더는 Z 다. 스로틀을 올리고 Z 를 누르면 기수 방위가 000 에서 움직인다.
  await page.getByRole('slider',{name:/비행기 스로틀/}).press('Home');
  await page.keyboard.down('KeyZ');
  await expect(hud).not.toContainText('000HDG',{timeout:8000});
  await page.keyboard.up('KeyZ');
  expect(errors).toEqual([]);
});

test('motorcycle mounts and supports driving in third and first person',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1280,height:900});await mock(page,buildings.slice(0,7));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'차량','오토바이');
  await page.keyboard.down('KeyW');
  await page.screenshot({path:'/tmp/ego-world-motorcycle-driving.png'});
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyC');
  await expect(page.getByRole('button',{name:/3인칭/})).toBeVisible();
  await page.screenshot({path:'/tmp/ego-world-motorcycle-cockpit.png'});
  expect(errors).toEqual([]);
});

test('formula has heading-up navigation, faster zoom and detailed first-person cockpit',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:960});await mock(page,buildings.slice(0,40));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'차량','포뮬러');
  const navigation=page.getByRole('region',{name:'주행 내비게이션'});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('img')).toHaveAttribute('aria-label',/반경 75미터/);
  await expect(page.getByRole('button',{name:/브레이크, 단축키 SPACE/})).toBeVisible();
  await page.keyboard.down('KeyW');
  await expect.poll(async()=>Number((await navigation.getByRole('img').getAttribute('aria-label')).match(/반경 (\d+)미터/)?.[1]||0),{timeout:6000}).toBeGreaterThan(75);
  await page.keyboard.down('Space');await page.waitForTimeout(250);await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.screenshot({path:'/tmp/ego-world-formula-exterior.png'});
  await page.keyboard.press('KeyC');
  await expect(page.getByRole('button',{name:/3인칭/})).toBeVisible();
  await page.screenshot({path:'/tmp/ego-world-formula-cockpit.png'});
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('convertible first-person dashboard keeps its recessed cluster clear',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:960});await mock(page,buildings.slice(0,40));await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'차량','오픈카');
  await page.keyboard.press('KeyC');
  await expect(page.getByRole('button',{name:/3인칭/})).toBeVisible();
  await page.screenshot({path:'/tmp/ego-world-convertible-cockpit.png'});
  expect(errors).toEqual([]);
});

test('driving beside a tall creator building keeps its creator card in view',async({page})=>{
  const nearby={id:'near-road-creator',nickname:'도로 옆 제작자',handle:'roadside',tier_name:'Diamond',elo_score:25000,x:160,z:30,height:120,rank:1};
  const beside={id:'beside-road-creator',nickname:'옆 건물 제작자',handle:'beside',tier_name:'Gold',elo_score:12000,x:195,z:60,height:80,rank:2,cityExtent:200};
  await page.setViewportSize({width:1440,height:960});await mock(page,[nearby,beside]);await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await ride(page,'차량','세단');
  const card=page.getByRole('button',{name:'도로 옆 제작자 선택'});
  await expect(card).toBeVisible({timeout:15000});
  await expect.poll(async()=>{
    const bounds=await card.boundingBox().catch(()=>null);
    return !!bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1440&&bounds.y+bounds.height<=960;
  },{timeout:15000}).toBe(true);
  const bounds=await card.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(140);
  expect(bounds.width).toBeLessThanOrEqual(180);
  expect(bounds.height).toBeLessThanOrEqual(100);
  await expect(page.getByRole('button',{name:'옆 건물 제작자 선택'})).toBeVisible();
});

test('home navbar exposes an Open World tab',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await mock(page,[]);
  await page.goto('/');await page.getByRole('tab',{name:'오픈월드',exact:true}).click();
  await expect(page).toHaveURL(/\/world$/);
});

test('live multiplayer shows another pilot, counts both sessions and removes departing planes',async({browser})=>{
  test.skip(!process.env.WORLD_REALTIME_TEST,'Opt-in live Supabase verification');
  test.setTimeout(60000);
  const observer=await browser.newPage(),pilot=await browser.newPage();
  const topic=`t${crypto.randomUUID().replaceAll('-','').slice(0,17)}`;
  // Equal byte lengths preserve Supabase's binary Broadcast frame headers.
  const retopic=(message,from,to)=>typeof message==='string'?message.replaceAll(from,to):Buffer.from(message.toString('latin1').replaceAll(from,to),'latin1');
  for(const page of [observer,pilot]) await page.routeWebSocket('**/realtime/v1/websocket**',ws=>{
    const server=ws.connectToServer();
    ws.onMessage(message=>server.send(retopic(message,'ego-bloom-world-v1',topic)));
    server.onMessage(message=>ws.send(retopic(message,topic,'ego-bloom-world-v1')));
  });
  try {
    for(const page of [observer,pilot]){await mock(page,buildings.slice(0,7));await page.goto('/world');}
    await observer.getByRole('tab',{name:'접속자'}).click();
    const online=observer.getByRole('region',{name:'접속자'}).getByRole('status');
    await expect(online).toHaveAttribute('data-connection','connected');
    await expect.poll(async()=>Number((await online.innerText()).match(/\d+/)?.[0]||0)).toBeGreaterThanOrEqual(2);
    await expect(pilot.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
    await ride(pilot,'항공기','라이트 제트');
    await expect(observer.locator('.world-pilot-label[data-peer-id]')).toHaveCount(1);
    await ride(observer,'항공기','라이트 제트');
    await expect(pilot.locator('.world-pilot-label[data-peer-id]')).toHaveCount(1);
    await observer.screenshot({path:'/tmp/ego-world-multiplayer.png'});
    // 차량도 같은 채널을 쓴다. 전차로 바꿔 타면 상대 화면에 차체 게이지가 함께 나온다.
    await pilot.keyboard.press('Escape');
    await ride(pilot,'차량','전차');
    await expect(observer.locator('.world-peer-hull')).toHaveCount(1);
    await expect(pilot.locator('.wui-hull')).toBeVisible();
    await observer.screenshot({path:'/tmp/ego-world-multiplayer-armor.png'});
    await pilot.keyboard.press('Escape');
    await expect(observer.locator('.world-pilot-label[data-peer-id]')).toHaveCount(0);
    const before=Number((await online.innerText()).match(/\d+/)[0]);
    await pilot.close();
    await expect.poll(async()=>Number((await online.innerText()).match(/\d+/)?.[0]||0)).toBe(before-1);
  } finally {await observer.close();if(!pilot.isClosed())await pilot.close();}
});

test('model gallery renders seasonal day, sunrise, sunset and moon shaders without WebGL errors',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Shader Error|VALIDATE_STATUS|shader.*ERROR|WebGLProgram|NaN/i.test(m.text()))errors.push(m.text());});
  await page.clock.setFixedTime(new Date('2026-09-11T15:00:00Z'));
  await mock(page,[]);await page.goto('/world');
  await openDiscover(page);
  await page.getByRole('tab',{name:'건물 컬렉션'}).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:30000});
  await expect(page.locator('.world-result')).toHaveCount(initialGalleryResultCount);
  await page.getByRole('tab',{name:'설정'}).click();
  await expect(page.getByLabel('도시 계절')).toHaveText('KST 2026-09-12 · 초가을');
  for(const mode of ['day','dawn','sunset','night']){
   await page.getByLabel('시간대').selectOption(mode);
   await page.waitForTimeout(700);
   await page.screenshot({path:`/tmp/ego-world-${mode}-season.png`});
  }
  expect(errors).toEqual([]);
});

test('flying past a creator shows a fading profile, tier and score card without stealing controls',async({page})=>{
 const rows=[{id:'flyby',nickname:'가을 작가',handle:'autumn',tier_name:'Gold',elo_score:123456,x:500,z:140,height:80,rank:1,profile_image_url:'https://example.com/avatar.png'}];
 await page.setViewportSize({width:1440,height:960});await mock(page,rows);await page.goto('/world');
 await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
 await ride(page,'항공기','라이트 제트');
 await expect(page.locator('.world-pilot-label[data-self]')).toBeVisible();
 await page.waitForTimeout(500);
 const canvas=page.locator('.world-canvas canvas'),box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.5-262,box.y+box.height*.45,{steps:8});await page.mouse.up();
 await page.waitForTimeout(2500);
 await page.screenshot({path:'/tmp/ego-world-flight-creator-debug.png'});
 const card=page.getByLabel('가을 작가 제작자 카드');
 await expect(card).toBeVisible({timeout:15000});
 await expect(card).toContainText('골드');await expect(card).toContainText('123,456');
 await expect(card.locator('img')).toHaveCount(1);
 const opacity=await card.evaluate(el=>Number(getComputedStyle(el).opacity));expect(opacity).toBeGreaterThan(0);expect(opacity).toBeLessThan(1);
 expect(await card.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
 await page.screenshot({path:'/tmp/ego-world-flight-creator.png'});
});

test('400px 폭에서 탭바와 탈것 선택 시트가 화면을 넘지 않는다',async({page})=>{
  await page.setViewportSize({width:400,height:780});await mock(page);await page.goto('/world');
  const tabs=page.getByRole('tablist',{name:'월드 도구'});
  await expect(tabs).toBeVisible();
  const tabsBox=await tabs.boundingBox();
  expect(tabsBox.x).toBeGreaterThanOrEqual(0);
  expect(tabsBox.x+tabsBox.width).toBeLessThanOrEqual(400);

  await page.getByRole('button',{name:'드라이브 시작, 단축키 스페이스바'}).click();
  const sheet=page.getByRole('dialog',{name:'탈것 선택'});
  await expect(sheet).toBeVisible();
  const sheetBox=await sheet.boundingBox();
  expect(sheetBox.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox.x+sheetBox.width).toBeLessThanOrEqual(400);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('탈것 선택에서 출발하면 카운트다운을 거쳐 조종으로 들어간다',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1280,height:860});await mock(page);await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await page.getByRole('button',{name:'드라이브 시작, 단축키 스페이스바'}).click();

  const sheet=page.getByRole('dialog',{name:'탈것 선택'});
  // 탭의 숫자는 등록부에서 나온다. 손으로 적어 두면 탈것을 더할 때마다 이 테스트가 먼저 깨진다.
  for(const group of RIDE_GROUPS){
    await expect(sheet.getByRole('tab',{name:`${group.ko} ${group.rides.length}`})).toBeVisible();
  }

  await sheet.getByRole('tab',{name:/^차량 /}).click();
  await sheet.getByRole('button',{name:/세단/}).click();
  await sheet.getByRole('button',{name:'출발'}).click();

  // 0.5초씩 3, 2, 1 을 거쳐 1.5초에 조작이 열린다.
  await expect(page.locator('.wui-count')).toBeVisible();
  await expect(page.locator('.wui-hud-centre')).toBeVisible({timeout:6000});
  await expect(page.locator('.wui-count')).toHaveCount(0);
  await expect(page.getByRole('tablist',{name:'월드 도구'})).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('tablist',{name:'월드 도구'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('TEMP zeta sign night glow visual check',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:960});await mock(page);
  await page.goto('/world');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
  await page.getByRole('tab',{name:'설정'}).click();
  await page.getByLabel('시간대').selectOption('night');
  await page.getByRole('button',{name:'설정 닫기'}).click();
  await page.getByRole('tab',{name:'지도'}).click();
  const map=page.getByRole('img',{name:/전체 제작자 위치/});
  const box=await map.boundingBox();
  await map.click({position:{x:box.width*0.5522,y:box.height*0.4829}});
  await page.getByRole('tab',{name:'지도'}).click();
  await page.waitForTimeout(1500);
  for(let i=0;i<20;i++){await page.mouse.wheel(0,-250);await page.waitForTimeout(150);}
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/ego-world-cityhall-night.png'});
  await page.getByRole('tab',{name:'설정'}).click();
  await page.getByLabel('시간대').selectOption('day');
  await page.getByRole('button',{name:'설정 닫기'}).click();
  await page.waitForTimeout(800);
  await page.screenshot({path:'/tmp/ego-world-cityhall-day.png'});
});
