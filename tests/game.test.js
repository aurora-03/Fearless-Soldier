import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CONFIG, ENEMIES, WEAPONS } from '../src/game.js';

function sandbox() {
  const g = new Game(71);
  g.tiles.fill(0); g.enemies = []; g.items = []; g.boss.x = 80; g.boss.y = 80;
  return g;
}
function tick(g, seconds) { for (let t = 0; t < seconds; t += .05) g.update(.05); }
function monster(x, y, type = 'zombie') { return { id: 0, x, y, type, hp: ENEMIES[type].hp, active: false, cooldown: 0, windup: null }; }

test('world is fixed 100×100 with exact 3×3 spawn and 7×7 remote arena', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const g = new Game(seed);
    assert.equal(g.tiles.length, 10000);
    for (let y = 48; y <= 52; y++) for (let x = 48; x <= 52; x++) assert.equal(g.floor(x, y), x >= 49 && x <= 51 && y >= 49 && y <= 51);
    assert.ok(Math.max(Math.abs(g.boss.x - 50), Math.abs(g.boss.y - 50)) >= 28);
    for (let y = g.boss.y - 3; y <= g.boss.y + 3; y++) for (let x = g.boss.x - 3; x <= g.boss.x + 3; x++) assert.ok(g.floor(x, y));
    assert.ok(g.items.some(i => i.type === 'weapon' && i.level === 1));
    assert.ok(g.items.some(i => i.type === 'weapon' && i.level === 2));
    for (const type of Object.keys(ENEMIES)) assert.ok(g.enemies.some(e => e.type === type));
    for (const e of g.enemies) { assert.ok(g.floor(e.x, e.y)); assert.ok(Math.max(Math.abs(e.x - 50), Math.abs(e.y - 50)) > 8); }
  }
});
test('same seed produces fixed world and new seed changes terrain', () => {
  assert.deepEqual(new Game(10).tiles, new Game(10).tiles);
  assert.notDeepEqual(new Game(10).tiles, new Game(11).tiles);
});
test('9×9 vision reveals through wood and remembered terrain persists', () => {
  const g = sandbox(); assert.equal(g.stats.explored, 81);
  assert.equal(g.visible(54, 54), true); assert.equal(g.visible(55, 50), false);
  g.tiles[g.index(51, 50)] = 1; assert.equal(g.visible(54, 50), true);
  g.player.x = 70; g.reveal(); assert.equal(g.seen[g.index(50, 50)], 1);
});
test('weapons have correct cardinal attack shapes in every orientation', () => {
  const g = sandbox();
  for (const facing of ['up', 'down', 'left', 'right']) for (let level = 0; level < 3; level++) {
    g.player.facing = facing; g.player.weapon = level;
    const cells = g.attackCells(); assert.equal(cells.length, [1, 3, 6][level]);
    assert.equal(new Set(cells.map(c => g.index(c.x, c.y))).size, cells.length);
    for (const c of cells) {
      const forward = facing === 'up' ? 50 - c.y : facing === 'down' ? c.y - 50 : facing === 'left' ? 50 - c.x : c.x - 50;
      assert.ok(forward >= 1 && forward <= WEAPONS[level].depth);
    }
  }
});
test('one attack clears all six greatsword tiles, never generates content', () => {
  const g = sandbox(); g.player.weapon = 2;
  for (const c of g.attackCells()) g.tiles[g.index(c.x, c.y)] = 1;
  g.attack(); assert.equal(g.stats.trees, 6);
  for (const c of g.attackCells()) assert.ok(g.floor(c.x, c.y));
  assert.equal(g.items.length, 0); assert.equal(g.enemies.length, 0);
  assert.equal(g.attack(), false);
});
test('grid movement blocks wood, boundaries and occupied cells; attacking keeps movement', () => {
  const g = sandbox(); g.tiles[g.index(51, 50)] = 1;
  assert.equal(g.tryMove('right'), false); assert.equal(g.player.facing, 'right');
  g.attack(); tick(g, .3); assert.equal(g.tryMove('right'), true);
  const movement = g.move; g.attack(); assert.equal(g.move, movement);
  tick(g, .2); assert.equal(g.player.x, 51);
  g.enemies.push(monster(52, 50)); assert.equal(g.tryMove('right'), false);
  g.player.x = 0; assert.equal(g.tryMove('left'), false);
});
test('food remains at full health, heals when stepped on; weapons never downgrade', () => {
  const g = sandbox(); g.items = [{ x: 51, y: 50, type: 'food' }];
  g.tryMove('right'); assert.equal(g.items.length, 1);
  g.player.hp = 40; g.pickup(); assert.equal(g.player.hp, 75); assert.equal(g.items.length, 0);
  g.items = [{ x: 51, y: 50, type: 'weapon', level: 2 }, { x: 51, y: 50, type: 'weapon', level: 1 }];
  g.pickup(); assert.equal(g.player.weapon, 2);
});
test('isolated monsters cannot aggro or cross wood, then chase through an opened road', () => {
  const g = sandbox(); g.tiles.fill(1); g.carve(50, 50); g.carve(53, 50);
  const e = monster(53, 50); g.enemies = [e]; tick(g, 1);
  assert.equal(e.active, false); assert.equal(e.x, 53);
  g.carve(51, 50); g.carve(52, 50); tick(g, .1);
  assert.equal(e.active, true); assert.equal(e.x, 52); assert.ok(g.floor(e.x, e.y));
});
test('monsters follow connected paths around obstacles', () => {
  const g = sandbox(); g.tiles.fill(1);
  for (const [x,y] of [[50,50],[50,51],[51,51],[52,51],[52,50]]) g.carve(x,y);
  assert.deepEqual(g.pathStep({ x: 52, y: 50 }, g.player), { x: 52, y: 51 });
});
test('aggro follows a long connected detour, not an artificial path length cap', () => {
  const g = sandbox(); g.tiles.fill(1);
  for (let y = 50; y <= 62; y++) { g.carve(50, y); g.carve(53, y); }
  for (let x = 50; x <= 53; x++) g.carve(x, 62);
  const e = monster(53, 50); g.enemies = [e]; g.update(.05);
  assert.equal(e.active, true); assert.equal(e.y, 51);
});
test('enemy telegraph locks target cell and is dodged by moving', () => {
  const g = sandbox(), e = monster(51, 50); g.enemies = [e];
  g.update(.05); assert.ok(e.windup); assert.equal(g.player.hp, 100);
  g.tryMove('left'); tick(g, .9); assert.equal(g.player.hp, 100);
});
test('telegraphed enemy attack damages player and grants hit protection', () => {
  const g = sandbox(), e = monster(51, 50); g.enemies = [e];
  tick(g, .95); assert.equal(g.player.hp, 90);
  g.hurt(22); assert.equal(g.player.hp, 90);
});
test('monster disengages without healing, resumes wandering, and never respawns', () => {
  const g = sandbox(), e = monster(51, 50); e.hp = 7; e.active = true; g.enemies = [e];
  g.player.x = 70; g.update(.05); assert.equal(e.x, 51); assert.equal(e.hp, 7); assert.equal(e.active, false);
  tick(g, 2); assert.equal(e.hp, 7); assert.equal(e.active, false);
  g.player.x = e.x - 1; g.player.y = e.y; g.player.facing = 'right'; g.attack(); assert.equal(g.enemies.length, 0); assert.equal(g.stats.kills, 1);
  tick(g, 15); assert.equal(g.enemies.length, 0);
});
test('kills can drop food and both exploration and kills yield weapons', () => {
  const g = sandbox(), e = monster(51, 50, 'orc');
  g.rng = () => .01; g.kill(e); assert.equal(g.items.at(-1).type, 'weapon'); assert.equal(g.items.at(-1).level, 2);
  let n = 0; g.rng = () => n++ === 0 ? .2 : .1; g.kill(e); assert.equal(g.items.at(-1).type, 'food');
});
test('boss has telegraphed patterns, delayed damage, and fully heals on retreat', () => {
  const g = sandbox(); g.player.x = 79; g.player.y = 80;
  g.update(.05); assert.equal(g.boss.active, true);
  tick(g, 1.3); assert.ok(g.boss.windup); assert.equal(g.player.hp, 100);
  tick(g, 1); assert.equal(g.player.hp, 72);
  g.boss.hp = 30; g.player.x = 76; g.update(.05);
  assert.equal(g.boss.active, false); assert.equal(g.boss.hp, CONFIG.bossHp); assert.equal(g.boss.windup, null);
});
test('boss victory ends simulation with final stats', () => {
  const g = sandbox(); g.player.x = 79; g.player.y = 80; g.player.facing = 'right'; g.boss.hp = 10;
  g.attack(); assert.equal(g.status, 'won'); assert.equal(g.stats.kills, 1); assert.ok(g.events.includes('won'));
  const time = g.stats.time; tick(g, 2); assert.equal(g.stats.time, time);
});
test('pause freezes movement, cooldown, enemies, warnings, and timer', () => {
  const g = sandbox(); g.tryMove('right'); g.enemies = [monster(52, 50)]; g.pause();
  const before = g.serialize(); tick(g, 2); assert.equal(g.serialize(), before); assert.equal(g.tryMove('left'), false); assert.equal(g.attack(), false);
  g.resume(); tick(g, .1); assert.ok(g.stats.time > 0);
});
test('save/restore preserves full world and enemy health, always resumes paused', () => {
  const g = new Game(923); g.player.weapon = 2; g.player.hp = 51; g.attack(); g.enemies[0].hp = 3; tick(g, .4);
  const restored = Game.restore(g.serialize());
  assert.deepEqual(restored.tiles, g.tiles); assert.deepEqual(restored.seen, g.seen); assert.deepEqual(restored.player, g.player);
  assert.deepEqual(restored.items, g.items); assert.deepEqual(restored.enemies, g.enemies); assert.deepEqual(restored.stats, g.stats); assert.deepEqual(restored.boss, g.boss);
  assert.equal(restored.status, 'paused');
});
test('death ends run, dead and corrupted saves cannot be resumed', () => {
  const g = sandbox(); g.hurt(100); assert.equal(g.status, 'dead'); assert.equal(g.player.hp, 0);
  assert.throws(() => Game.restore(g.serialize())); assert.throws(() => Game.restore('{broken'));
  const good = JSON.parse(new Game(1).serialize()); good.player.weapon = 7; assert.throws(() => Game.restore(JSON.stringify(good)));
  const warning = JSON.parse(new Game(1).serialize()); warning.enemies[0].windup = { cells: 'broken', remaining: 1, total: 1 }; assert.throws(() => Game.restore(JSON.stringify(warning)));
});
test('in-progress boss warning and recovery are resumable across saves', () => {
  const g = sandbox(); g.player.x = 79; g.player.y = 80; tick(g, 1.5);
  assert.ok(g.boss.windup);
  const restored = Game.restore(g.serialize()); assert.deepEqual(restored.boss.windup, g.boss.windup);
  restored.resume(); tick(restored, 1); assert.equal(restored.player.hp, 72);
});
