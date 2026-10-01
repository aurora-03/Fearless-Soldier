import { test, expect } from '@playwright/test';

const KEY = 'fearless-soldier.save.v1';
async function fixture(page, kind) {
  await page.goto('/');
  await page.evaluate(async ({ key, kind }) => {
    const { Game } = await import('/src/game.js');
    const g = new Game(345);
    if (kind === 'death') {
      g.player.hp = 10; g.carve(101, 100);
      g.enemies = [{ id: 0, type: 'zombie', x: 101, y: 100, hp: 45, active: true, cooldown: 0, windup: null }];
    }
    if (kind === 'boss') {
      g.player.x = g.boss.x - 1; g.player.y = g.boss.y; g.player.facing = 'right'; g.boss.hp = 15; g.boss.active = true;
      g.stats.time = 83; g.stats.kills = 7; g.reveal();
    }
    if (kind === 'arena') {
      g.player.x = g.boss.x - 1; g.player.y = g.boss.y; g.player.facing = 'right'; g.boss.hp = 572; g.boss.active = true; g.reveal();
    }
    if (kind === 'supplies') {
      g.enemies = []; g.player.hp = 50; g.rectangle(100, 99, 6, 3);
      g.items = [{ x: 101, y: 100, type: 'food' }, { x: 102, y: 100, type: 'weapon', level: 2 }, { x: 103, y: 100, type: 'weapon', level: 1 }];
    }
    if (kind === 'combat') {
      g.player.hp = 52; g.player.weapon = 2;
      g.enemies = [{ id: 0, type: 'orc', x: 103, y: 100, hp: 100, active: false, cooldown: 0, windup: null }];
      g.rectangle(101, 99, 5, 3);
      g.items = [{ x: 102, y: 101, type: 'food' }, { x: 104, y: 99, type: 'weapon', level: 1 }];
    }
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
  await expect(page.locator('#coordinates')).toContainText('X 101');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#coordinates')).toContainText('X 101');
  await page.keyboard.press('Space');
  await expect(page.locator('#tree-count')).toHaveText('1');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  await expect(page.locator('#coordinates')).toContainText('X 102');
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-title')).toHaveText('稍作休整');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(stored.player.x).toBe(102); expect(stored.stats.trees).toBe(1); expect(stored.tiles).toHaveLength(40000);
  await page.reload(); await page.getByRole('button', { name: '继续探索' }).click();
  await expect(page.locator('#coordinates')).toContainText('X 102');
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
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#coordinates')).toContainText('X 101');
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
  await expect(page.locator('#coordinates')).toContainText('X 100');
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
  expect(await page.locator('.field-footer').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  expect(errors).toEqual([]);
});

test('corrupted storage still allows a fresh playable run', async ({ page }) => {
  await page.goto('/'); await page.evaluate(key => localStorage.setItem(key, '{broken'), KEY); await page.reload();
  await page.getByRole('button', { name: '开始拓荒' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, KEY)).toBe(1);
});

test('unavailable browser storage reports failure while allowing play', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
  await page.goto('/'); await page.getByRole('button', { name: '开始拓荒' }).click();
  await expect(page.locator('#save-state')).toContainText('无法保存');
  await page.keyboard.press('ArrowRight'); await expect(page.locator('#coordinates')).toContainText('X 101');
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
