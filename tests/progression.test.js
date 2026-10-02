import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CONFIG, PROGRESSION } from '../src/game.js';

function scene() {const g=new Game(133);g.tiles.fill(0);g.enemies=[];g.items=[];g.player.facing='right';return g;}
function update(g,seconds) {for(let t=0;t<seconds;t+=.01)g.update(Math.min(.01,seconds-t));}
function enemy(g,type='zombie',x=51,y=50,hp=15) {const e={id:g.enemies.length,x,y,type,hp,active:false,cooldown:99,windup:null};g.enemies.push(e);return e;}

for(const type of ['zombie','wolf','orc']) test(`killing ${type} grants its experience once and shows an EXP effect`,()=>{
  const g=scene(),e=enemy(g,type);g.attack();
  assert.equal(g.stats.kills,1);assert.equal(g.enemies.length,0);assert.equal(g.player.xp,PROGRESSION.xp[type]);
  assert.ok(g.effects.some(effect=>effect.kind==='xp'&&effect.text===`+${PROGRESSION.xp[type]} EXP`));
  const items=g.items.length;g.kill(e);assert.equal(g.player.xp,PROGRESSION.xp[type]);assert.equal(g.stats.kills,1);assert.equal(g.items.length,items);
});

test('wood, supplies and nonlethal attacks grant no experience',()=>{
  const g=scene();const e=enemy(g,'orc',51,50,100);g.attack();assert.equal(e.hp,85);assert.equal(g.player.xp,0);
  g.enemies=[];g.tiles[g.index(51,50)]=1;g.attackCooldown=0;g.attack();assert.equal(g.stats.trees,1);assert.equal(g.player.xp,0);
  g.player.hp=50;g.items=[{x:50,y:50,type:'food'}];g.pickup();assert.equal(g.player.xp,0);
});

test('experience overflow earns multiple levels and distinct upgrade choices',()=>{
  const g=scene();g.gainExperience(220);
  assert.equal(g.player.level,3);assert.equal(g.player.xp,70);assert.equal(g.xpToNextLevel(),120);assert.equal(g.player.pendingUpgrades,2);assert.equal(g.status,'levelup');
  assert.equal(g.chooseUpgrade('health'),true);assert.equal(g.status,'levelup');assert.equal(g.player.pendingUpgrades,1);
  assert.equal(g.chooseUpgrade('speed'),true);assert.equal(g.status,'playing');assert.equal(g.player.pendingUpgrades,0);
  assert.equal(g.chooseUpgrade('health'),false);assert.equal(g.player.maxHp,120);assert.equal(g.player.speedUpgrades,1);
});

test('health upgrade raises max health, preserves missing health and updates food healing cap',()=>{
  const g=scene();g.player.hp=73;g.gainExperience(60);g.chooseUpgrade('health');
  assert.equal(g.player.maxHp,120);assert.equal(g.player.hp,93);
  g.items=[{x:50,y:50,type:'food'}];g.pickup();assert.equal(g.player.hp,120);assert.equal(g.items.length,0);
  g.items=[{x:50,y:50,type:'food'}];g.pickup();assert.equal(g.items.length,1);
  const restored=Game.restore(g.serialize());assert.equal(restored.player.hp,120);assert.equal(restored.player.maxHp,120);
});

test('speed upgrade actually permits an earlier next attack and scales swing animation',()=>{
  const g=scene(),base=scene();g.gainExperience(60);g.chooseUpgrade('speed');
  g.attack();base.attack();assert.ok(g.attackCooldown<base.attackCooldown);assert.ok(g.slash.duration<base.slash.duration);
  update(g,.22);update(base,.22);assert.equal(g.attack(),true);assert.equal(base.attack(),false);
  assert.equal(g.player.maxHp,100);
});

test('attack speed has a readable floor and cannot waste an upgrade at its cap',()=>{
  const g=scene();for(let i=0;i<12;i++){g.gainExperience(g.xpToNextLevel());assert.equal(g.chooseUpgrade('speed'),true);}
  assert.equal(g.attackInterval(),PROGRESSION.minAttackTime);
  g.gainExperience(g.xpToNextLevel());assert.equal(g.chooseUpgrade('speed'),false);assert.equal(g.player.pendingUpgrades,1);
  assert.equal(g.chooseUpgrade('health'),true);assert.equal(g.player.maxHp,120);
});

test('choosing an upgrade freezes the simulation and pause/resume cannot bypass it',()=>{
  const g=scene();enemy(g);g.tryMove('down');g.gainExperience(60);
  const before=g.serialize();update(g,1);assert.equal(g.serialize(),before);assert.equal(g.attack(),false);assert.equal(g.tryMove('left'),false);
  assert.equal(g.chooseUpgrade('damage'),false);g.pause();assert.equal(g.status,'paused');g.resume();assert.equal(g.status,'levelup');
  assert.equal(g.chooseUpgrade('health'),true);update(g,.05);assert.ok(g.stats.time>0);
});

test('one area attack rewards every defeated enemy even when a level is earned mid-swing',()=>{
  const g=scene();g.player.weapon=2;
  for(const y of [49,50,51])enemy(g,'wolf',51,y,1);
  g.attack();assert.equal(g.stats.kills,3);assert.equal(g.enemies.length,0);assert.equal(g.player.level,2);assert.equal(g.player.xp,15);assert.equal(g.player.pendingUpgrades,1);
});

test('unspent choices, experience and selected stats survive save/restore',()=>{
  const g=scene();g.gainExperience(220);g.chooseUpgrade('health');
  const restored=Game.restore(g.serialize());assert.deepEqual(restored.player,g.player);assert.equal(restored.status,'paused');restored.resume();assert.equal(restored.status,'levelup');
  restored.chooseUpgrade('speed');assert.equal(restored.status,'playing');assert.equal(restored.player.xp,70);assert.equal(restored.player.maxHp,120);assert.equal(restored.player.speedUpgrades,1);
});

test('older v2 saves default to level one without resetting world, health or equipment',()=>{
  const g=scene();g.player.hp=62;g.player.weapon=2;g.stats.kills=8;
  const old=JSON.parse(g.serialize());for(const key of ['maxHp','level','xp','healthUpgrades','speedUpgrades','pendingUpgrades'])delete old.player[key];
  const restored=Game.restore(JSON.stringify(old));assert.equal(restored.player.level,1);assert.equal(restored.player.xp,0);assert.equal(restored.player.hp,62);assert.equal(restored.player.weapon,2);assert.equal(restored.stats.kills,8);
});

test('corrupted progression is rejected and a fresh run resets all bonuses',()=>{
  const g=scene();g.gainExperience(60);g.chooseUpgrade('health');const raw=JSON.parse(g.serialize());raw.player.pendingUpgrades=2;
  assert.throws(()=>Game.restore(JSON.stringify(raw)),/成长/);
  const fresh=new Game(1);assert.equal(fresh.player.maxHp,CONFIG.maxHp);assert.equal(fresh.player.level,1);assert.equal(fresh.player.xp,0);assert.equal(fresh.player.speedUpgrades,0);
});

test('boss experience cannot obstruct victory with an upgrade dialog',()=>{
  const g=scene();g.player.x=g.boss.x-1;g.player.y=g.boss.y;g.boss.hp=1;g.attack();
  assert.equal(g.status,'won');assert.equal(g.player.level,3);assert.equal(g.player.xp,0);assert.equal(g.stats.kills,1);
});
