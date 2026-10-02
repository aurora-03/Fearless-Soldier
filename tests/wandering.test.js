import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, ENEMIES } from '../src/game.js';

function scene(type='zombie') {
  const g=new Game(12);g.tiles.fill(1);g.items=[];
  g.carve(50,50);g.rectangle(18,18,5,5);
  const e={id:0,x:20,y:20,type,hp:ENEMIES[type].hp,active:false,cooldown:0,windup:null,wanderCooldown:0};
  g.enemies=[e];g.rng=()=>0;
  return {g,e};
}
function tick(g,seconds) {for(let t=0;t<seconds;t+=.05) g.update(.05);}

for(const type of Object.keys(ENEMIES)) test(`${type} wanders offscreen before meeting the soldier with smooth movement`,()=>{
  const {g,e}=scene(type);const before=g.tiles.slice();
  assert.equal(g.visible(e.x,e.y),false);
  g.update(.05);
  assert.equal(e.active,false);assert.equal(e.x,20);assert.equal(e.y,19);assert.equal(e.facing,'up');
  assert.deepEqual({x:e.move.x,y:e.move.y},{x:20,y:20});
  g.update(.05);assert.ok(e.move.elapsed>0 && e.move.elapsed<e.move.duration);
  assert.equal(g.player.hp,100);assert.equal(e.hp,ENEMIES[type].hp);assert.deepEqual(g.tiles,before);
});

test('wanderers stay on connected ground and cannot overlap other enemies, trees, player or boundaries',()=>{
  const {g,e}=scene();g.tiles.fill(1);g.rectangle(0,0,2,1);g.carve(50,50);
  e.x=0;e.y=0;
  const blocker={...e,id:1,x:1,y:0};g.enemies.push(blocker);
  tick(g,3);assert.deepEqual({x:e.x,y:e.y},{x:0,y:0});assert.deepEqual({x:blocker.x,y:blocker.y},{x:1,y:0});
  g.enemies=[e];g.player.x=1;g.player.y=0;e.wanderCooldown=0;
  g.wanderEnemy(e,.05);assert.equal(e.x,0);assert.equal(e.move,undefined);
});

test('long idle wandering never leaves its enclosed clearing or consumes supplies',()=>{
  const {g,e}=scene();g.rng=(()=>{let x=3;return()=>((x=Math.imul(x,1664525)+1013904223>>>0)/4294967296);})();
  g.items=[{x:19,y:19,type:'food'}];
  for(let i=0;i<600;i++) {
    g.update(.05);assert.ok(e.x>=18&&e.x<=22&&e.y>=18&&e.y<=22);assert.ok(g.floor(e.x,e.y));assert.equal(e.active,false);
  }
  assert.equal(g.items.length,1);assert.equal(g.enemies.length,1);assert.equal(g.stats.kills,0);
});

test('detection overrides idle rest, completes the current step and then pursues the soldier',()=>{
  const {g,e}=scene();g.tiles.fill(1);g.rectangle(50,50,5,1);
  e.x=53;e.y=50;e.wanderCooldown=100;
  e.move={x:54,y:50,elapsed:.1,duration:.7};
  g.update(.05);assert.equal(e.active,true);assert.equal(e.x,53);assert.ok(e.move.elapsed>.1);
  tick(g,.7);assert.ok(e.x<53);assert.equal(e.active,true);
});

test('pause and save preserve patrol position, direction, animation and rest timer',()=>{
  const {g,e}=scene();g.update(.05);g.update(.05);g.pause();
  const raw=g.serialize();tick(g,2);assert.equal(g.serialize(),raw);
  const restored=Game.restore(raw);assert.deepEqual(restored.enemies[0],e);
  restored.resume();restored.update(.05);assert.ok(restored.enemies[0].move.elapsed>e.move.elapsed);
});

test('existing v2 saves without wandering fields still resume and begin patrolling',()=>{
  const {g}=scene();delete g.enemies[0].wanderCooldown;delete g.enemies[0].facing;
  const restored=Game.restore(g.serialize());restored.resume();tick(restored,3);
  assert.ok(restored.enemies[0].wanderCooldown>=0);assert.equal(restored.enemies[0].active,false);
  assert.ok(['up','right','down','left'].includes(restored.enemies[0].facing));
});
