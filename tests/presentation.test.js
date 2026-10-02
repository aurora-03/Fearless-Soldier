import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CONFIG } from '../src/game.js';
import { Renderer, cameraFrame } from '../src/render.js';

function context(width = 900, height = 900) {
  const translations = [];
  const ctx = { canvas: { width, height }, translations,
    save() {}, restore() {}, translate(x,y) { translations.push({ x,y }); },
    scale() {}, rotate() {}, fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, ellipse() {}, arc() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {}, clip() {}, fillText() {}, strokeText() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return ctx;
}

test('soldier stays at the identical screen center throughout every movement frame', () => {
  const g = new Game(45); g.tiles.fill(0); g.enemies = []; g.items = []; g.boss.hp = 0;
  const ctx = context(), map = context(180,180);
  const r = new Renderer({ getContext: () => ctx }, { getContext: () => map });
  function origin() { ctx.translations.length = 0; r.world(g, 0); return ctx.translations.find(p => p.x > 100 && p.y > 100); }
  const resting = origin();
  for (const dir of ['right', 'down', 'left', 'up']) {
    g.tryMove(dir);
    for (let i = 0; i < 5; i++) { assert.deepEqual(origin(), resting); g.update(CONFIG.moveTime / 4); }
  }
});

test('new worlds have a quarter of the original area and all content stays in bounds', () => {
  const g = new Game(17);
  assert.equal(g.size, 100); assert.equal(g.tiles.length, 10000);
  assert.deepEqual({ x:g.player.x, y:g.player.y }, { x:50, y:50 });
  for (const obj of [...g.enemies, ...g.items, g.boss]) assert.ok(g.inside(obj.x,obj.y));
});

test('world transform is continuous across tile boundaries and centered at world edges', () => {
  const g = new Game(17); g.tiles.fill(0); g.enemies=[]; g.items=[]; g.boss.hp=0;
  const before=cameraFrame(g,1360,768);
  const landmark=before.project(52,50);
  g.tryMove('right');
  assert.deepEqual(cameraFrame(g,1360,768).project(52,50),landmark);
  let previous=landmark.x;
  for(let i=0;i<7;i++) {
    g.update(.02);
    const f=cameraFrame(g,1360,768),point=f.project(52,50);
    assert.ok(previous-point.x>=0 && previous-point.x <= f.tile*.15+.001);
    assert.deepEqual(f.project(f.camera.x,f.camera.y),{x:680,y:384});
    previous=point.x;
  }
  g.player.x=0;g.player.y=0;g.move=null;
  assert.deepEqual(cameraFrame(g,800,600).project(0,0),{x:400,y:300});
});

test('pause and save preserve the exact mid-step camera position', () => {
  const g = new Game(17);g.carve(51,50);g.tryMove('right');g.update(.05);
  const before=cameraFrame(g,1360,768).camera;
  g.pause(); assert.deepEqual(cameraFrame(g,1360,768).camera,before);
  const restored=Game.restore(g.serialize());
  assert.deepEqual(cameraFrame(restored,1360,768).camera,before);
  restored.resume();restored.update(.02);assert.ok(cameraFrame(restored,1360,768).camera.x>before.x);
});

test('melee hit drives enemy recoil and visible player weapon swing', () => {
  const g = new Game(42); g.tiles.fill(0); g.enemies = []; g.items = [];
  const e = { id:0, x:g.player.x+1, y:g.player.y, type:'orc', hp:100, active:false, cooldown:0, windup:null };
  g.enemies = [e]; g.player.facing = 'right'; g.attack();
  assert.ok(g.slash.duration > 0);
  assert.equal(g.slash.facing, 'right');
  assert.ok(e.reaction?.remaining > 0);
  assert.ok(g.effects.some(effect => effect.kind === 'spark'));
  assert.ok(g.impactPause > 0);
});

test('monster attack releases an animated strike after its warning', () => {
  const g = new Game(42); g.tiles.fill(0); g.enemies = []; g.items = [];
  const e = { id:0, x:g.player.x+1, y:g.player.y, type:'orc', hp:100, active:true, cooldown:0, windup:null };
  g.enemies = [e];
  for (let i=0;i<23;i++) g.update(.05);
  assert.ok(e.strike?.remaining > 0);
  assert.ok(g.effects.some(effect => effect.kind === 'enemy-slash'));
});
