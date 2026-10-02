import { Game, CONFIG, WEAPONS, PROGRESSION } from './game.js';
import { Renderer, sprite, weaponIcon } from './render.js';
import { Sound } from './audio.js';

const $ = id => document.getElementById(id);
const renderer = new Renderer($('world'), $('minimap'));
const SAVE_KEY = 'fearless-soldier.save.v2';
const sound = new Sound();
const held = new Map();
const keys = { w: 'up', arrowup: 'up', d: 'right', arrowright: 'right', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left' };
let game = new Game(), started = false, last = performance.now(), saveElapsed = 0, hudElapsed = 0;
let saveError = false, hasSave = false, newConfirm = false;
let toastRemaining = 0;
const formatTime = t => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { game = Game.restore(raw); hasSave = true; if (game.status === 'won') started = true; }
  else if (localStorage.getItem('fearless-soldier.save.v1')) {
    $('version-note').hidden = false;
    $('version-note').textContent = '地图已缩为 100×100。旧版存档仍保留，本版将从新地图开始。';
  }
} catch { $('save-state').textContent = '存档不可用'; saveError = true; }

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  $('world').width = Math.round(window.innerWidth * ratio);
  $('world').height = Math.round(window.innerHeight * ratio);
}
window.addEventListener('resize', resize);
resize();

function save() {
  if (!started) return;
  try {
    if (game.status === 'dead') { localStorage.removeItem(SAVE_KEY); hasSave = false; $('save-state').textContent = '本局已结束'; }
    else { localStorage.setItem(SAVE_KEY, game.serialize()); hasSave = true; $('save-state').textContent = '进度已保存'; }
    saveError = false;
  } catch { saveError = true; $('save-state').textContent = '无法保存 · 存储不可用'; }
}
function startFresh() {
  game = new Game((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  started = true; newConfirm = false; held.clear(); saveElapsed = 0;
  $('version-note').hidden = true;
  save(); updateUI();
}
function pause() {
  if (!started || !['playing', 'levelup'].includes(game.status)) return;
  game.pause(); held.clear(); save(); updateUI();
}
function updateUI() {
  const p = game.player, weapon = WEAPONS[p.weapon], explored = (game.stats.explored / game.tiles.length * 100).toFixed(1);
  $('health-value').innerHTML = `${p.hp} <small>/ ${p.maxHp}</small>`;
  $('health-fill').style.width = `${p.hp / p.maxHp * 100}%`;
  $('health-fill').style.filter = p.hp / p.maxHp < .3 ? 'sepia(1) saturate(4) hue-rotate(320deg)' : '';
  $('level-badge').textContent = `LV.${p.level}`;
  $('xp-value').textContent = `${p.xp} / ${game.xpToNextLevel()}`;
  $('xp-fill').style.width = `${p.xp / game.xpToNextLevel() * 100}%`;
  $('attack-rate').textContent = `攻速 ${(1 / game.attackInterval()).toFixed(2)} 次/秒`;
  $('weapon-name').textContent = weapon.name;
  $('weapon-description').textContent = `伤害 ${weapon.damage} · ${['前方 1 格', '前方一排 3 格', '前方两排 6 格'][p.weapon]}`;
  $('weapon-tier').textContent = ['I', 'II', 'III'][p.weapon];
  weaponIcon($('weapon-icon').getContext('2d'), p.weapon);
  $('coordinates').textContent = `X ${p.x.toString().padStart(3, '0')} · Y ${p.y.toString().padStart(3, '0')}`;
  $('mission-time').textContent = formatTime(game.stats.time);
  $('tree-count').textContent = game.stats.trees;
  $('kill-count').textContent = game.stats.kills;
  $('explored-value').textContent = `${explored}%`;
  $('explore-fill').style.width = `${explored}%`;
  $('message').textContent = game.message;
  $('status-label').textContent = !started ? '等待出发' : ({ playing: '正在探索', paused: '行动暂停', levelup: '选择升级强化', dead: '行动失败', won: '任务完成' })[game.status];
  $('pause-button').disabled = !started || ['dead', 'won'].includes(game.status);
  $('pause-button').textContent = game.status === 'paused' && started ? '▷' : 'Ⅱ';
  $('pause-button').setAttribute('aria-label', game.status === 'paused' && started ? '继续游戏' : '暂停游戏');
  $('boss-hud').hidden = !game.boss.active || game.boss.hp <= 0 || !started;
  $('boss-value').textContent = `${game.boss.hp} / ${game.boss.maxHp}`;
  $('boss-fill').style.width = `${game.boss.hp / game.boss.maxHp * 100}%`;
  const overlay = !started || game.status !== 'playing';
  $('overlay').hidden = !overlay;
  $('result-stats').hidden = true;
  $('new-button').hidden = true;
  $('overlay-controls').hidden = false;
  $('primary-button').hidden = false;
  $('upgrade-options').hidden = true;
  document.querySelector('.overlay-card').classList.toggle('upgrading', game.status === 'levelup' && started && !newConfirm);
  if (!overlay) { renderer.minimap(game); return; }
  if (newConfirm) {
    $('overlay-tag').textContent = 'NEW OPERATION';
    $('overlay-title').textContent = '重新出发？';
    $('overlay-copy').innerHTML = '这会覆盖当前一局的进度。<br>地图、装备和探索记录将重新开始。';
    $('primary-button').innerHTML = '确认新开局 <span>→</span>';
    $('new-button').hidden = false; $('new-button').textContent = '返回当前进度';
  } else if (started && game.status === 'levelup') {
    $('overlay-tag').textContent = 'LEVEL UP';
    $('overlay-title').textContent = `升级至 LV.${p.level}`;
    $('overlay-copy').textContent = `获得 ${p.pendingUpgrades} 次强化机会，选择你的成长方向。`;
    $('health-preview').textContent = `${p.maxHp} → ${p.maxHp + PROGRESSION.healthBonus} 生命上限`;
    $('speed-preview').textContent = `${(1 / game.attackInterval()).toFixed(2)} → ${(1 / game.attackInterval(p.speedUpgrades + 1)).toFixed(2)} 次/秒`;
    $('speed-upgrade').disabled = game.attackInterval() <= PROGRESSION.minAttackTime;
    if ($('speed-upgrade').disabled) $('speed-preview').textContent = '攻击速度已达上限';
    $('upgrade-options').hidden = false;
    $('primary-button').hidden = true;
    $('overlay-controls').hidden = true;
  } else if (!started || game.status === 'paused') {
    $('overlay-tag').textContent = !started ? 'OPERATION · 001' : 'OPERATION PAUSED';
    $('overlay-title').textContent = !started ? '无畏士兵' : '稍作休整';
    $('overlay-copy').innerHTML = !started ? (hasSave ? '你的探索进度已保留。<br>准备好，再次走进森林。' : '从一片空地出发，<br>用手中的刀，开辟你的生路。') : '行动已暂停，森林也在等待。<br>整顿呼吸，继续你的旅程。';
    $('primary-button').innerHTML = `${hasSave || started ? '继续探索' : '开始拓荒'} <span>→</span>`;
    $('new-button').hidden = !(hasSave || started); $('new-button').textContent = '重新开局';
  } else {
    const won = game.status === 'won';
    $('overlay-tag').textContent = won ? 'MISSION COMPLETE' : 'SOLDIER DOWN';
    $('overlay-title').textContent = won ? '荒野已平定' : '倒在了征途';
    $('overlay-copy').innerHTML = won ? '荒野领主已被击败。<br>你用一把刀，走出了自己的路。' : '这一局的进度已清除。<br>新的森林，等待下一次出发。';
    $('primary-button').innerHTML = '再次出发 <span>→</span>';
    $('result-stats').hidden = false;
    $('result-stats').innerHTML = `<div><b>${formatTime(game.stats.time)}</b><span>行动用时</span></div><div><b>${explored}%</b><span>探索比例</span></div><div><b>${game.stats.kills}</b><span>敌人击败</span></div><div><b>${p.level}</b><span>最终等级</span></div>`;
    $('overlay-controls').hidden = true;
  }
  renderer.minimap(game);
}

$('primary-button').addEventListener('click', () => {
  sound.unlock();
  if (newConfirm || ['dead', 'won'].includes(game.status)) { startFresh(); return; }
  if (hasSave || started) { started = true; game.resume(); held.clear(); save(); updateUI(); }
  else startFresh();
  $('primary-button').blur();
});
$('new-button').addEventListener('click', () => { newConfirm = !newConfirm; updateUI(); });
function selectUpgrade(type) {
  if (!game.chooseUpgrade(type)) return;
  held.clear(); sound.unlock(); save(); updateUI();
}
$('health-upgrade').addEventListener('click', () => selectUpgrade('health'));
$('speed-upgrade').addEventListener('click', () => selectUpgrade('speed'));
$('pause-button').addEventListener('click', () => {
  sound.unlock();
  if (['playing', 'levelup'].includes(game.status)) pause();
  else if (game.status === 'paused') { game.resume(); newConfirm = false; updateUI(); }
  $('pause-button').blur();
});
$('sound-button').addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  sound.unlock();
  $('sound-button').textContent = sound.enabled ? '♪' : '♩×';
  $('sound-button').setAttribute('aria-label', sound.enabled ? '关闭音效' : '开启音效');
  $('sound-button').blur();
});
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (keys[key] || event.code === 'Space' || key === 'escape') event.preventDefault();
  if (!started) return;
  if (key === 'escape' && !event.repeat) {
    if (['playing', 'levelup'].includes(game.status)) pause();
    else if (game.status === 'paused') { newConfirm = false; game.resume(); held.clear(); updateUI(); }
    return;
  }
  if (game.status === 'levelup') {
    if (['1', '2'].includes(key)) { event.preventDefault(); if (!event.repeat) selectUpgrade(key === '1' ? 'health' : 'speed'); }
    return;
  }
  if (game.status !== 'playing') return;
  if (keys[key] && !event.repeat) { held.delete(key); held.set(key, keys[key]); game.tryMove(keys[key]); }
  if (event.code === 'Space' && !event.repeat) { sound.unlock(); game.attack(); updateUI(); }
});
document.addEventListener('keyup', event => held.delete(event.key.toLowerCase()));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

// Small generated portraits use the same actual pixel art as the world.
sprite($('hero').getContext('2d'), 0, 0, 6);
sprite($('portrait').getContext('2d'), 0, 0, 4);
updateUI();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.08); last = now;
  if (started && game.status === 'playing') {
    game.update(dt);
    if (!game.move && held.size) game.tryMove([...held.values()].at(-1));
    saveElapsed += dt;
    if (saveElapsed >= 2) { save(); saveElapsed = 0; }
    if (game.events.includes('upgrade') || game.events.includes('heal') || game.events.includes('hurt') || game.events.includes('growth')) updateUI();
  }
  if (game.events.some(event => ['dead','won','levelup'].includes(event))) { held.clear(); save(); updateUI(); }
  for (const event of game.events) sound.play(event,game.player.weapon);
  if (game.events.some(event => ['upgrade','heal','growth'].includes(event))) {
    $('toast').textContent = game.message; $('toast').hidden = false; toastRemaining = 2;
  }
  game.events.length = 0;
  if (toastRemaining > 0 && game.status === 'playing') { toastRemaining -= dt; if (toastRemaining <= 0) $('toast').hidden = true; }
  hudElapsed += dt;
  if (hudElapsed >= 0.1) { updateUI(); hudElapsed = 0; }
  renderer.world(game, game.status === 'playing' && started ? dt : 0);
  if (saveError) $('save-state').textContent = '无法保存 · 存档不可用';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
