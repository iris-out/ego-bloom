import { test, expect } from '@playwright/test';
const buildings=[{id:'ride-creator',nickname:'테스트 작가',handle:'ride',tier_name:'Gold',elo_score:10000,x:32,z:32,height:35,rank:1}];
async function mock(page,rows){await page.route('**/api/get-world-data',route=>route.fulfill({json:{buildings:rows}}));}
async function enterWorld(page){await page.goto('/world');await page.getByRole('button',{name:/^싱글 플레이/}).click();}
async function ride(page,group,name){
  await page.getByRole('button',{name:'드라이브 시작, 단축키 스페이스바'}).click();
  const sheet=page.getByRole('dialog',{name:'탈것 선택'});
  await sheet.getByRole('tab',{name:new RegExp(group)}).click();
  await sheet.locator('.wui-ride-name').filter({hasText:new RegExp(`^${name}$`)}).click();
  await sheet.getByRole('button',{name:'출발'}).click();
  await expect(page.locator('.wui-hybrid')).toBeVisible({timeout:9000});
  await expect(page.locator('.world-page')).toHaveAttribute('data-phase','driving',{timeout:9000});
}

for (const [group,name,key] of [['차량','드리프트 튜닝카','drift'],['항공기','비행선','airship']]) {
  test(`${key} supports selection, movement, first-person view and reset`,async({page})=>{
    test.setTimeout(90000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(/THREE.WebGLProgram: Shader Error|NaN/.test(message.text()))errors.push(message.text());});
    await page.setViewportSize({width:800,height:600});
    await mock(page,buildings);await enterWorld(page);
    await page.getByRole('tab',{name:'설정'}).click();
    await page.getByLabel('그래픽 품질').selectOption('low');
    await page.getByLabel('시간대').selectOption('day');
    await page.getByRole('button',{name:'설정 닫기'}).click();
    await expect(page.locator('.world-stage')).toHaveAttribute('data-ready','true',{timeout:15000});
    await ride(page,group,name);
    await expect(page.getByLabel(`탑승 중 ${name}`,{exact:true})).toBeVisible();
    if(key==='airship') {
      await expect(page.getByRole('button',{name:/기관총|미사일/})).toHaveCount(0);
      await page.keyboard.down('KeyW');
      await expect.poll(async()=>Number(await page.locator('.wui-flight-panel .wui-readout').nth(1).locator('b').textContent()),{timeout:25000}).toBeGreaterThan(5);
      await page.keyboard.up('KeyW');
    } else {
      await page.keyboard.down('KeyW');
      await expect.poll(async()=>Number(await page.getByRole('meter',{name:'속도',exact:true}).getAttribute('aria-valuenow')),{timeout:30000}).toBeGreaterThan(55);
      await page.keyboard.down('Space');await page.keyboard.down('KeyD');
      await expect.poll(async()=>Number(await page.getByRole('meter',{name:'속도',exact:true}).getAttribute('aria-valuenow')),{timeout:15000}).toBeLessThan(50);
      await page.screenshot({path:'/tmp/ego-drift-effects.png'});
      await page.keyboard.up('Space');await page.keyboard.up('KeyD');await page.keyboard.up('KeyW');
    }
    await page.screenshot({path:`/tmp/ego-${key}-third.png`});
    await page.keyboard.press('KeyC');
    await expect(page.locator('.wui-hybrid')).toHaveAttribute('data-view','first');
    await page.screenshot({path:`/tmp/ego-${key}-first.png`});
    await page.getByRole('button',{name:'출발 지점으로 돌아가기'}).click();
    if(key==='airship')await expect(page.getByRole('slider',{name:/비행기 스로틀/,includeHidden:true})).toHaveAttribute('aria-valuenow','0');
    await expect(page.getByLabel(`탑승 중 ${name}`,{exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    if(key==='airship')await expect(page.getByRole('group',{name:'상승 · 선회 조이스틱'})).toBeVisible();
    else await expect(page.getByRole('button',{name:/드리프트.*SPACE/})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
