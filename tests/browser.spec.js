import { test, expect } from '@playwright/test';

const KEY = 'fearless-soldier.save.v2';
async function fixture(page, kind) {
  await page.goto('/');
  await page.evaluate(async ({ key, kind }) => {
    const { Game } = await import('/src/game.js');
    const g = new Game(345);
    if (kind === 'death') {
      g.player.hp = 10; g.carve(51, 50);
      g.enemies = [{ id: 0, type: 'zombie', x: 51, y: 50, hp: 45, active: true, cooldown: 0, windup: null }];
    }
    if (kind === 'boss') {
      g.player.x = g.boss.x - 1; g.player.y = g.boss.y; g.player.facing = 'right'; g.boss.hp = 15; g.boss.active = true;
      g.stats.time = 83; g.stats.kills = 7; g.reveal();
    }
    if (kind === 'arena') {
      g.player.x = g.boss.x - 1; g.player.y = g.boss.y; g.player.facing = 'right'; g.boss.hp = 572; g.boss.active = true; g.reveal();
      g.carve(g.boss.x - 4, g.boss.y); g.carve(g.boss.x - 5, g.boss.y);
    }
    if (kind === 'supplies') {
      g.enemies = []; g.player.hp = 50; g.rectangle(50, 49, 6, 3);
      g.items = [{ x: 51, y: 50, type: 'food' }, { x: 52, y: 50, type: 'weapon', level: 2 }, { x: 53, y: 50, type: 'weapon', level: 1 }];
    }
    if (kind === 'combat') {
      g.player.hp = 52; g.player.weapon = 2;
      g.enemies = [{ id: 0, type: 'orc', x: 53, y: 50, hp: 100, active: false, cooldown: 0, windup: null }];
      g.rectangle(51, 49, 5, 3);
      g.items = [{ x: 52, y: 51, type: 'food' }, { x: 54, y: 49, type: 'weapon', level: 1 }];
    }
    if (kind === 'roam') {
      g.tiles.fill(1);g.rectangle(49,49,3,3);g.rectangle(53,49,2,3);g.items=[];
      g.enemies=[{id:0,x:53,y:50,type:'zombie',hp:45,active:false,cooldown:0,windup:null,wanderCooldown:.1}];
    }
    if (['growth','experience','growthdeath'].includes(kind)) {
      g.items=[];g.player.facing='right';g.player.hp=80;g.player.xp=kind==='growth'?40:0;
      g.enemies=[{id:0,x:51,y:50,type:'zombie',hp:15,active:false,cooldown:99,windup:null}];
      if(kind==='growthdeath'){g.gainExperience(60);g.chooseUpgrade('health');g.player.hp=10;g.enemies[0].hp=45;g.enemies[0].active=true;g.enemies[0].cooldown=0;}
    }
    if(kind==='multigrowth'){g.enemies=[];g.items=[];g.gainExperience(220);}
    localStorage.setItem(key, g.serialize());
  }, { key: KEY, kind });
  await page.reload();
  await page.getByRole('button', { name: '继续探索' }).click();
}

test('actual keyboard exploration, chopping, and automatic save survive reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '无畏士兵', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/title.png', fullPage: true });
  await page.getByRole('button', { name: '开始拓荒' }).click();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  await expect(page.locator('#coordinates')).toContainText('X 051');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#coordinates')).toContainText('X 051');
  await page.keyboard.press('Space');
  await expect(page.locator('#tree-count')).toHaveText('1');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  await expect(page.locator('#coordinates')).toContainText('X 052');
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.player.x).toBe(52); expect(stored.stats.trees).toBe(1); expect(stored.tiles).toHaveLength(10000);
  await page.reload(); await page.getByRole('button', { name: '继续探索' }).click();
  await expect(page.locator('#coordinates')).toContainText('X 052');
  await expect(page.locator('#tree-count')).toHaveText('1');
  await page.screenshot({ path: 'artifacts/exploration.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('pause freezes timer and key repeat does not repeatedly attack', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '开始拓荒' }).click();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(170);
  await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.down('Space'); await page.keyboard.up('Space');
  await expect(page.locator('#tree-count')).toHaveText('1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  const timer = await page.locator('#mission-time').textContent();
  await page.waitForTimeout(1100); await expect(page.locator('#mission-time')).toHaveText(timer);
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#coordinates')).toContainText('X 051');
  await page.getByRole('button', { name: '继续探索' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
});

test('death clears persistent progress and starts a new seed without equipment', async ({ page }) => {
  await fixture(page, 'death');
  await expect(page.locator('#overlay-title')).toHaveText('倒在了征途', { timeout: 5000 });
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
  await page.screenshot({ path: 'artifacts/death.png', fullPage: true });
  await page.getByRole('button', { name: '再次出发' }).click();
  await expect(page.locator('#health-value')).toContainText('100');
  await expect(page.locator('#weapon-name')).toHaveText('野战小刀');
  await expect(page.locator('#coordinates')).toContainText('X 050');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).seed, KEY)).not.toBe(345);
});

test('boss kill presents exact final results and stops playing', async ({ page }) => {
  await fixture(page, 'boss'); await page.keyboard.press('Space');
  await expect(page.locator('#overlay-title')).toHaveText('荒野已平定');
  await expect(page.locator('#result-stats')).toContainText('01:23');
  await expect(page.locator('#kill-count')).toHaveText('8');
  await page.screenshot({ path: 'artifacts/victory.png', fullPage: true });
  const coords = await page.locator('#coordinates').textContent();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#coordinates')).toHaveText(coords);
  await page.reload(); await expect(page.locator('#overlay-title')).toHaveText('荒野已平定');
  await expect(page.locator('#kill-count')).toHaveText('8');
});

test('actual steps consume food, equip stronger weapons and reject downgrades', async ({ page }) => {
  await fixture(page, 'supplies'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(180);
  await expect(page.locator('#health-value')).toContainText('85');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(180);
  await expect(page.locator('#weapon-name')).toHaveText('破军大剑');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(180);
  await expect(page.locator('#weapon-name')).toHaveText('破军大剑');
});

test('boss warning is visible, can be paused mid-attack and retreat resets health', async ({ page }) => {
  await fixture(page, 'arena'); await page.waitForTimeout(1350);
  await expect(page.locator('#boss-hud')).toBeVisible();
  await page.screenshot({ path: 'artifacts/boss-warning.png', fullPage: true });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved.boss.windup.cells.length).toBeGreaterThan(0);
  await page.reload(); await page.getByRole('button', { name: '继续探索' }).click();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(480); await page.keyboard.up('ArrowLeft');
  await expect(page.locator('#boss-hud')).toBeHidden();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).boss.hp, KEY)).toBe(620);
});

test('new run asks for overwrite and back keeps current progress', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '开始拓荒' }).click();
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '重新开局' }).click();
  await expect(page.locator('#overlay-title')).toHaveText('重新出发？');
  await page.getByRole('button', { name: '返回当前进度' }).click();
  await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  await page.getByRole('button', { name: '重新开局' }).click();
  await page.getByRole('button', { name: '确认新开局' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
});

test('weapon and combat visuals render at desktop sizes without runtime errors', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page, 'combat');
  await expect(page.locator('#weapon-name')).toHaveText('破军大剑');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/combat.png', fullPage: true });
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.screenshot({ path: 'artifacts/desktop-small.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#world').evaluate(element => element.getBoundingClientRect().bottom === innerHeight)).toBe(true);
  expect(errors).toEqual([]);
});

test('corrupted storage still allows a fresh playable run', async ({ page }) => {
  await page.goto('/'); await page.evaluate(key => localStorage.setItem(key, '{broken'), KEY); await page.reload();
  await page.getByRole('button', { name: '开始拓荒' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, KEY)).toBe(2);
});

test('unavailable browser storage reports failure while allowing play', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await page.goto('/'); await page.getByRole('button', { name: '开始拓荒' }).click();
  await expect(page.locator('#save-state')).toContainText('无法保存');
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#coordinates')).toContainText('X 051');
});

test('hidden document pauses and becoming visible never auto-resumes', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '开始拓荒' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#overlay')).toBeVisible();
});

test('full viewport gameplay has circular top-left radar and bottom-right status with no scrolling', async ({ page }) => {
  await page.goto('/');await page.getByRole('button',{name:'开始拓荒'}).click();
  for(const viewport of [{width:1360,height:768},{width:1024,height:800},{width:800,height:600}]) {
    await page.setViewportSize(viewport);
    const layout=await page.evaluate(() => {
      const bounds=selector => {const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      return {world:bounds('#world'),radar:bounds('.radar-frame'),status:bounds('.status-hud'),round:getComputedStyle(document.querySelector('.radar-frame')).borderRadius,scroll:document.documentElement.scrollHeight,footers:document.querySelectorAll('footer,.sidebar,.field-footer').length};
    });
    expect(layout.world).toMatchObject({x:0,y:0,width:viewport.width,height:viewport.height});
    expect(layout.radar.x).toBeLessThan(30);expect(layout.radar.y).toBeLessThan(30);expect(layout.round).toBe('50%');
    expect(Math.abs(layout.radar.width-layout.radar.height)).toBeLessThan(1);
    expect(viewport.width-layout.status.right).toBeLessThan(30);expect(viewport.height-layout.status.bottom).toBeLessThan(30);
    expect(layout.scroll).toBe(viewport.height);expect(layout.footers).toBe(0);
  }
});

test('real movement keeps rendered soldier centered and camera advances in sub-tile increments', async ({ page }) => {
  await fixture(page,'supplies');
  await page.evaluate(async () => {
    const {Renderer}=await import('/src/render.js');const world=Renderer.prototype.world;
    window.motionFrames=[];
    Renderer.prototype.world=function(...args) {world.apply(this,args);window.motionFrames.push(structuredClone(this.lastFrame));};
  });
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(750);await page.keyboard.up('ArrowRight');
  const frames=await page.evaluate(() => window.motionFrames);
  expect(frames.length).toBeGreaterThan(10);
  for(let i=1;i<frames.length;i++) {
    expect(frames[i].player).toEqual(frames[0].player);
    expect(Math.abs(frames[i].camera.x-frames[i-1].camera.x)).toBeLessThan(.7);
    expect(frames[i].camera.y).toBe(frames[0].camera.y);
  }
  expect(frames.at(-1).camera.x-frames[0].camera.x).toBeGreaterThan(2);
});

test('actual slash renders distinct weapon poses and impact recoil in consecutive frames', async ({ page }) => {
  await fixture(page,'combat');
  await page.evaluate(async () => {
    const {Renderer}=await import('/src/render.js');const world=Renderer.prototype.world;
    window.combatFrames=[];
    Renderer.prototype.world=function(game,...args){world.call(this,game,...args);window.combatFrames.push({slash:game.slash?{life:game.slash.life,duration:game.slash.duration,facing:game.slash.facing}:null,recoil:game.enemies.some(e=>e.reaction?.remaining>0),sparks:game.effects.some(e=>e.kind==='spark'),strike:game.enemies.some(e=>e.strike?.remaining>0)});};
  });
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(180);await page.keyboard.press('Space');
  await page.waitForTimeout(60);await page.screenshot({path:'artifacts/melee-impact.png'});
  await page.waitForTimeout(260);
  const frames=await page.evaluate(() => window.combatFrames),swing=frames.filter(f=>f.slash);
  expect(swing.length).toBeGreaterThan(2);expect(swing[0].slash.life).toBeGreaterThan(swing.at(-1).slash.life);
  expect(swing.some(f=>f.recoil&&f.sparks)).toBe(true);
  await page.waitForFunction(() => window.combatFrames.some(frame => frame.strike));
  await page.screenshot({path:'artifacts/monster-strike.png'});
});

test('legacy map save stays untouched and new run uses version 2 with 10000 tiles', async ({ page }) => {
  await page.goto('/');
  const old=JSON.stringify({version:1,size:200,backup:'previous forest'});
  await page.evaluate(raw=>localStorage.setItem('fearless-soldier.save.v1',raw),old);
  await page.reload();await expect(page.locator('#version-note')).toContainText('100×100');
  await page.getByRole('button',{name:'开始拓荒'}).click();
  const saves=await page.evaluate(key=>({old:localStorage.getItem('fearless-soldier.save.v1'),current:JSON.parse(localStorage.getItem(key))}),KEY);
  expect(saves.old).toBe(old);expect(saves.current.version).toBe(2);expect(saves.current.size).toBe(100);expect(saves.current.tiles).toHaveLength(10000);
});

test('visible monster patrols behind wood without aggro and keeps animation across reload',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await fixture(page,'roam');
  await page.evaluate(async()=>{
    const {Renderer,visualPosition}=await import('/src/render.js');const world=Renderer.prototype.world;
    window.patrolFrames=[];
    Renderer.prototype.world=function(game,...args){world.call(this,game,...args);const e=game.enemies[0];window.patrolFrames.push({visual:visualPosition(e),x:e.x,y:e.y,active:e.active,facing:e.facing,moving:!!e.move,floor:game.floor(e.x,e.y)});};
  });
  await page.waitForTimeout(350);
  const frames=await page.evaluate(()=>window.patrolFrames);
  expect(frames.some(f=>f.moving)).toBe(true);
  expect(new Set(frames.map(f=>`${f.visual.x.toFixed(3)},${f.visual.y.toFixed(3)}`)).size).toBeGreaterThan(2);
  for(const frame of frames){expect(frame.active).toBe(false);expect(frame.floor).toBe(true);expect(frame.x).toBeGreaterThanOrEqual(53);expect(frame.x).toBeLessThanOrEqual(54);}
  await expect(page.locator('#health-value')).toContainText('100');
  await page.screenshot({path:'artifacts/monster-patrol.png'});
  await page.keyboard.press('Escape');
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).enemies[0],KEY);
  await page.reload();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).enemies[0],KEY)).toEqual(before);
  await page.getByRole('button',{name:'继续探索'}).click();await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).enemies[0],KEY);
  expect(after.active).toBe(false);expect(after.hp).toBe(45);
  expect(after.move?.elapsed ?? 1).toBeGreaterThan(before.move?.elapsed ?? 0);
  expect(errors).toEqual([]);
});

test('actual kill updates experience HUD without leveling before the threshold',async({page})=>{
  await fixture(page,'experience');await page.keyboard.press('Space');
  await expect(page.locator('#xp-value')).toHaveText('20 / 60');await expect(page.locator('#level-badge')).toHaveText('LV.1');
  await expect(page.locator('#kill-count')).toHaveText('1');await expect(page.locator('#overlay')).toBeHidden();
});

test('level-up freezes gameplay and health choice updates cap, bar and persisted progress',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await fixture(page,'growth');await page.keyboard.press('Space');
  await expect(page.locator('#overlay-title')).toHaveText('升级至 LV.2');
  await expect(page.locator('#upgrade-options')).toBeVisible();await expect(page.locator('#xp-value')).toHaveText('0 / 90');
  const time=await page.locator('#mission-time').textContent(),coords=await page.locator('#coordinates').textContent();
  await page.keyboard.press('ArrowRight');await page.waitForTimeout(300);
  await expect(page.locator('#mission-time')).toHaveText(time);await expect(page.locator('#coordinates')).toHaveText(coords);
  await page.screenshot({path:'artifacts/level-up.png'});
  await page.locator('#health-upgrade').click();await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#health-value')).toHaveText('100 / 120');await expect(page.locator('#level-badge')).toHaveText('LV.2');
  expect(await page.locator('#health-fill').evaluate(el=>parseFloat(el.style.width))).toBeCloseTo(83.333,2);
  const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).player,KEY);
  expect(p).toMatchObject({level:2,xp:0,maxHp:120,hp:100,healthUpgrades:1,pendingUpgrades:0});
  await page.screenshot({path:'artifacts/growth-health.png'});
  await page.reload();await page.getByRole('button',{name:'继续探索'}).click();
  await expect(page.locator('#health-value')).toHaveText('100 / 120');await expect(page.locator('#level-badge')).toHaveText('LV.2');expect(errors).toEqual([]);
});

test('speed choice increases displayed attack rate and saves the actual faster cooldown',async({page})=>{
  await fixture(page,'growth');await page.keyboard.press('Space');
  await expect(page.locator('#speed-preview')).toContainText('4.17 → 4.67');
  await page.locator('#speed-upgrade').click();await expect(page.locator('#attack-rate')).toHaveText('攻速 4.67 次/秒');
  const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  expect(data.player.speedUpgrades).toBe(1);expect(data.player.maxHp).toBe(100);expect(data.attackCooldown).toBeLessThan(.24);
  await page.reload();await page.getByRole('button',{name:'继续探索'}).click();await expect(page.locator('#attack-rate')).toHaveText('攻速 4.67 次/秒');
});

test('unspent multi-level choices survive pause and reload and support keyboard selection',async({page})=>{
  await fixture(page,'multigrowth');await expect(page.locator('#overlay-title')).toHaveText('升级至 LV.3');await expect(page.locator('#overlay-copy')).toContainText('2 次');
  await page.keyboard.press('Escape');await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  await page.reload();await page.getByRole('button',{name:'继续探索'}).click();await expect(page.locator('#upgrade-options')).toBeVisible();
  await page.keyboard.press('1');await expect(page.locator('#overlay-copy')).toContainText('1 次');
  await page.keyboard.press('2');await expect(page.locator('#overlay')).toBeHidden();await expect(page.locator('#xp-value')).toHaveText('70 / 120');
  const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).player,KEY);expect(p).toMatchObject({level:3,maxHp:120,healthUpgrades:1,speedUpgrades:1,pendingUpgrades:0});
});

test('death removes run growth and restart begins with base health, level and speed',async({page})=>{
  await fixture(page,'growthdeath');await expect(page.locator('#level-badge')).toHaveText('LV.2');
  await expect(page.locator('#overlay-title')).toHaveText('倒在了征途');
  expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
  await page.getByRole('button',{name:'再次出发'}).click();await expect(page.locator('#level-badge')).toHaveText('LV.1');
  await expect(page.locator('#xp-value')).toHaveText('0 / 60');await expect(page.locator('#health-value')).toHaveText('100 / 100');await expect(page.locator('#attack-rate')).toHaveText('攻速 4.17 次/秒');
});
