import { ENEMIES, CONFIG } from './game.js';

const palettes = {
  soldier: { h: '#18251a', H: '#7d9760', G: '#a8bd7b', s: '#dcba83', S: '#f3d19a', b: '#445438', B: '#6c8150', l: '#35402d', e: '#152019', w: '#d9d8ad' },
  zombie: { h: '#455136', H: '#7a9456', G: '#acc37b', s: '#a0b47a', S: '#c0cc91', b: '#5e6651', B: '#89906d', l: '#3a4430', e: '#421c18', w: '#899477' },
  orc: { h: '#462d25', H: '#98543c', G: '#be7851', s: '#b99365', S: '#d4b384', b: '#71503c', B: '#a07351', l: '#493f32', e: '#431813', w: '#c2b8a0' },
};
const soldierPixels = [
  '    hhhhhhh     ', '   hHHHHHHHh    ', '  hHGGGGHHHHh   ', '  hHHHHHHHHHh   ',
  '   hsssssssh    ', '   sSeSSeSss    ', '   sSSSSSSss    ', '    ssssss      ',
  '  bBBbBBbBBb    ', ' bBBGbBBbBBBbw  ', ' sBBGbBBbBBBsw  ', ' ssBbbBBbbbssw  ',
  '   bbbbbbbb ww  ', '   lll  lll     ', '   lll  lll     ', '  eeee  eeee    ',
];
const wolfPixels = [
  '                ', '                ', '                ', '  hHh     hHh   ',
  '  hHHhhhhhHHh   ', '  hGGHHHHHGGh   ', '  hHeHGGHeHHh   ', '   HGGGGGGH     ',
  '    HHssHH      ', '    HHHHHH      ', '  hHHHHHHHHh    ', ' hHHHHHHHHHHh   ',
  ' hHHhHHHHhHHh   ', '  hh HH HH hh   ', '  ll ll ll ll   ', '  ee ee ee ee   ',
];
const wolfPalette = { h: '#384549', H: '#859596', G: '#b7c4be', s: '#d4d2b7', e: '#e2aa70', l: '#5a6a6c' };

export function sprite(ctx, x, y, scale, type = 'soldier', facing = 'down', time = 0) {
  const pixels = type === 'wolf' ? wolfPixels : soldierPixels;
  const palette = type === 'wolf' ? wolfPalette : palettes[type] || palettes.soldier;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (facing === 'left') { ctx.translate(16 * scale, 0); ctx.scale(-1, 1); }
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
    const color = palette[pixels[row][col]];
    if (!color) continue;
    ctx.fillStyle = color;
    ctx.fillRect(col * scale, row * scale + (row > 12 ? Math.sin(time * 12) * scale * 0.5 : 0), scale, scale);
  }
  ctx.restore();
}
export function weaponIcon(ctx, level = 0) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const s = ctx.canvas.width / 16;
  ctx.save(); ctx.translate(8 * s, 8 * s); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#6b4b2d'; ctx.fillRect(-s, 2 * s, 2 * s, 5 * s);
  ctx.fillStyle = '#c8a35b'; ctx.fillRect(-3 * s, s, 6 * s, s);
  ctx.fillStyle = '#b9c9bd'; ctx.fillRect(-s * (level === 2 ? 1.5 : 1), -s * (level + 4), s * (level === 2 ? 3 : 2), s * (level + 5));
  ctx.fillStyle = '#e6ecd4'; ctx.fillRect(-s, -s * (level + 4), s, s * (level + 5));
  ctx.restore();
}

export class Renderer {
  constructor(world, minimap) { this.ctx = world.getContext('2d'); this.mapCtx = minimap.getContext('2d'); this.t = 0; }
  tree(x, y, px, py, tile) {
    const ctx = this.ctx, s = tile / 24, n = ((x * 371 + y * 739) ^ (x * y * 13)) >>> 0;
    const r = (xx, yy, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(px + xx * s), Math.round(py + yy * s), Math.ceil(w * s), Math.ceil(h * s)); };
    r(2, 18, 21, 5, '#172616');
    r(10, 15, 5, 9, '#5b4630'); r(11, 16, 2, 8, '#987044');
    r(4, 12, 17, 6, '#1b361d'); r(2, 9, 20, 5, '#234024');
    r(5, 5, 15, 8, n % 2 ? '#34522a' : '#2e4b29');
    r(8, 1, 9, 7, '#405d2e'); r(10, 0, 5, 3, '#516a37');
    r(5, 7, 4, 2, '#607644'); r(9, 3, 4, 2, '#688144');
    r(4, 12, 5, 2, '#476232'); r(14, 8, 5, 2, '#3b5929');
    r(17, 13, 3, 2, '#1d341c');
  }
  world(game, dt = 0) {
    this.t += dt;
    const ctx = this.ctx, size = ctx.canvas.width, tile = size / 9;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#121b12'; ctx.fillRect(0, 0, size, size);
    const p = game.player;
    // Camera and visible grid remain aligned to the logical tile; player motion animates within it.
    const left = p.x - 4, top = p.y - 4;
    const pos = (x, y) => ({ x: (x - left) * tile, y: (y - top) * tile });
    const terrain = (x, y) => {
      const px = (x - left) * tile, py = (y - top) * tile;
      if (!game.inside(x, y)) { ctx.fillStyle = '#172119'; ctx.fillRect(px, py, tile, tile); return; }
      const n = (x * 931 + y * 337 + x * y * 17) >>> 0;
      const arena = Math.max(Math.abs(x - game.boss.x), Math.abs(y - game.boss.y)) <= 3;
      const wood = !game.floor(x, y);
      ctx.fillStyle = arena ? ['#625542', '#685a46', '#5b503f'][n % 3] : wood ? ['#293922', '#2c3c24', '#27371f'][n % 3] : ['#657249', '#69774d', '#607044', '#6d794f'][n % 4];
      ctx.fillRect(px, py, tile, tile);
      ctx.fillStyle = arena ? '#88785b55' : '#9fa96735';
      for (let k = 0; k < 4; k++) ctx.fillRect(px + ((n >> k * 3) % 20 + 2) * tile / 24, py + ((n >> k * 4) % 20 + 2) * tile / 24, tile / 24 * 2, tile / 24);
      ctx.strokeStyle = '#15201014'; ctx.lineWidth = 1; ctx.strokeRect(px, py, tile, tile);
      if (wood) this.tree(x, y, px, py, tile);
      else if (arena && (Math.abs(x - game.boss.x) === 3 || Math.abs(y - game.boss.y) === 3)) {
        ctx.fillStyle = '#c2a26b35'; ctx.fillRect(px + 3, py + 3, tile - 6, 3);
      }
    };
    for (let y = top; y < top + 9; y++) for (let x = left; x < left + 9; x++) terrain(x, y);
    const warning = w => {
      if (!w) return;
      for (const c of w.cells) {
        if (!game.visible(c.x, c.y)) continue;
        const a = pos(c.x, c.y);
        ctx.fillStyle = `rgba(220,65,42,${0.28 + (1 - w.remaining / w.total) * 0.27})`;
        ctx.fillRect(a.x + 2, a.y + 2, tile - 4, tile - 4);
        ctx.strokeStyle = '#ef9b6c'; ctx.lineWidth = 2; ctx.strokeRect(a.x + 4, a.y + 4, tile - 8, tile - 8);
        ctx.fillStyle = '#ffd4a0'; ctx.font = `bold ${tile / 3}px monospace`; ctx.textAlign = 'center'; ctx.fillText('!', a.x + tile / 2, a.y + tile * 0.65);
      }
    };
    for (const e of game.enemies) warning(e.windup);
    warning(game.boss.windup);
    for (const item of game.items) {
      if (!game.visible(item.x, item.y)) continue;
      const a = pos(item.x, item.y), s = tile / 24;
      ctx.fillStyle = '#17241755'; ctx.fillRect(a.x + 6 * s, a.y + 17 * s, 12 * s, 3 * s);
      if (item.type === 'food') {
        ctx.fillStyle = '#f1d07f'; ctx.fillRect(a.x + 9 * s, a.y + 7 * s, 6 * s, 2 * s);
        ctx.fillStyle = '#75552d'; ctx.fillRect(a.x + 7 * s, a.y + 9 * s, 10 * s, 9 * s);
        ctx.fillStyle = '#c6a568'; ctx.fillRect(a.x + 8 * s, a.y + 9 * s, 8 * s, 8 * s);
        ctx.fillStyle = '#f0d998'; ctx.fillRect(a.x + 10 * s, a.y + 12 * s, 4 * s, 2 * s);
        ctx.fillRect(a.x + 11 * s, a.y + 11 * s, 2 * s, 4 * s);
      } else {
        const bob = Math.sin(this.t * 3) * s;
        ctx.fillStyle = item.level === 2 ? '#e6c16d' : '#c8dbb1';
        ctx.fillRect(a.x + 11 * s, a.y + 5 * s + bob, (item.level + 1) * s, 10 * s);
        ctx.fillStyle = '#927448'; ctx.fillRect(a.x + 8 * s, a.y + 14 * s + bob, 8 * s, 2 * s);
        ctx.fillStyle = '#c9a268'; ctx.fillRect(a.x + 11 * s, a.y + 16 * s + bob, 2 * s, 4 * s);
        ctx.fillStyle = '#ffecae'; ctx.fillRect(a.x + 18 * s, a.y + 5 * s, s, 3 * s); ctx.fillRect(a.x + 17 * s, a.y + 6 * s, 3 * s, s);
      }
    }
    const drawEntity = (entity, type, isPlayer = false) => {
      if (!isPlayer && !game.visible(entity.x, entity.y)) return;
      const move = isPlayer ? game.move : entity.move;
      const mix = move ? Math.min(1, move.elapsed / move.duration) : 1;
      const xx = move ? move.x + (entity.x - move.x) * mix : entity.x;
      const yy = move ? move.y + (entity.y - move.y) * mix : entity.y;
      const a = pos(xx, yy);
      ctx.fillStyle = '#0a130b55'; ctx.beginPath(); ctx.ellipse(a.x + tile / 2, a.y + tile * 0.84, tile * 0.24, tile * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      if (isPlayer && game.invincible > 0 && Math.floor(this.t * 18) % 2) ctx.globalAlpha = 0.5;
      sprite(ctx, a.x + tile / 6, a.y + tile / 7, tile / 24, type, isPlayer ? p.facing : entity.x > p.x ? 'left' : 'right', move ? this.t : 0);
      ctx.globalAlpha = 1;
      if (isPlayer) {
        const dirs = { up: [0.5, 0.04], right: [0.94, 0.5], down: [0.5, 0.95], left: [0.06, 0.5] };
        const [ax, ay] = dirs[p.facing]; ctx.fillStyle = '#f1d18b'; ctx.fillRect(a.x + tile * ax - 2, a.y + tile * ay - 2, 4, 4);
      } else if (entity.active || entity.hp < ENEMIES[type].hp) {
        ctx.fillStyle = '#2c271e'; ctx.fillRect(a.x + tile * 0.2, a.y + 4, tile * 0.6, 4);
        ctx.fillStyle = '#dd9971'; ctx.fillRect(a.x + tile * 0.2, a.y + 4, tile * 0.6 * entity.hp / ENEMIES[type].hp, 4);
      }
    };
    for (const e of game.enemies) drawEntity(e, e.type);
    const b = game.boss;
    if (b.hp > 0 && game.visible(b.x, b.y)) {
      const a = pos(b.x, b.y);
      ctx.fillStyle = '#29191570'; ctx.beginPath(); ctx.ellipse(a.x + tile / 2, a.y + tile * 0.94, tile * 0.44, tile * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      sprite(ctx, a.x - tile / 12, a.y - tile / 4, tile / 14, 'orc');
      ctx.fillStyle = '#f1bf6c'; ctx.fillRect(a.x + tile * .15, a.y - tile * .15, tile * .1, tile * .2); ctx.fillRect(a.x + tile * .7, a.y - tile * .15, tile * .1, tile * .2);
    }
    drawEntity(p, 'soldier', true);
    if (game.slash) for (const c of game.slash.cells) {
      const a = pos(c.x, c.y);
      ctx.fillStyle = `rgba(255,231,157,${game.slash.life * 2.4})`; ctx.fillRect(a.x + 3, a.y + 3, tile - 6, tile - 6);
      ctx.strokeStyle = '#fff2bd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x + 8, a.y + tile - 8); ctx.lineTo(a.x + tile - 8, a.y + 8); ctx.stroke();
    }
    for (const e of game.effects) {
      if (!game.visible(e.x, e.y)) continue;
      const a = pos(e.x, e.y);
      if (e.kind === 'blast') { ctx.fillStyle = '#ffd09577'; ctx.fillRect(a.x + 3, a.y + 3, tile - 6, tile - 6); }
      else if (e.kind === 'wood') {
        ctx.fillStyle = '#c3a66c'; for (let k = 0; k < 5; k++) ctx.fillRect(a.x + tile / 2 + Math.cos(k * 1.4) * (1 - e.life) * tile / 2, a.y + tile / 2 + Math.sin(k * 1.4) * (1 - e.life) * tile / 2, 4, 4);
      } else { ctx.font = `bold ${tile * .23}px monospace`; ctx.textAlign = 'center'; ctx.fillStyle = e.kind === 'heal' ? '#e1f1a7' : '#ffe7b2'; ctx.fillText(e.text, a.x + tile / 2, a.y + tile * .2 - (1 - e.life) * 16); }
    }
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * .18, size / 2, size / 2, size * .72);
    gradient.addColorStop(0, '#08140800'); gradient.addColorStop(1, '#08140865'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  }
  minimap(game) {
    const ctx = this.mapCtx, scale = 4, cols = 58, rows = 44;
    const left = game.player.x - Math.floor(cols / 2), top = game.player.y - Math.floor(rows / 2);
    ctx.fillStyle = '#101913'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const wx = left + x, wy = top + y;
      if (!game.inside(wx, wy) || !game.seen[game.index(wx, wy)]) continue;
      ctx.fillStyle = game.floor(wx, wy) ? '#849064' : '#3c5236'; ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    // Enemy dots only exist inside the live 9×9 view, never from remembered terrain.
    for (const e of game.enemies) if (game.visible(e.x, e.y)) { ctx.fillStyle = '#d9916a'; ctx.fillRect((e.x - left) * scale, (e.y - top) * scale, 4, 4); }
    const px = (game.player.x - left) * scale, py = (game.player.y - top) * scale;
    ctx.strokeStyle = '#cfcb9355'; ctx.strokeRect(px - 4 * scale, py - 4 * scale, 9 * scale, 9 * scale);
    ctx.fillStyle = '#f5d481'; ctx.fillRect(px - 1, py - 1, 6, 6);
  }
}
