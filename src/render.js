import { ENEMIES, CONFIG, DIRECTIONS } from './game.js';

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

export function sprite(ctx, x, y, scale, type = 'soldier', facing = 'down', time = 0, flash = false) {
  const pixels = type === 'wolf' ? wolfPixels : soldierPixels;
  const palette = type === 'wolf' ? wolfPalette : palettes[type] || palettes.soldier;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (facing === 'left') { ctx.translate(16 * scale, 0); ctx.scale(-1, 1); }
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
    let color = palette[pixels[row][col]];
    if (pixels[row][col] === 'w') continue;
    if (type === 'soldier' && facing === 'up' && row >= 4 && row <= 7) color = row < 6 ? '#6e8554' : '#52673f';
    if (!color) continue;
    ctx.fillStyle = flash ? '#fff0c2' : color;
    ctx.fillRect(col * scale, row * scale + (row > 12 ? Math.sin(time * 16 + (col > 7 ? Math.PI : 0)) * scale * 0.7 : 0), scale, scale);
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

export function visualPosition(entity, move = entity.move) {
  const t = move ? Math.min(1, move.elapsed / move.duration) : 1;
  return { x: move ? move.x + (entity.x - move.x) * t : entity.x,
    y: move ? move.y + (entity.y - move.y) * t : entity.y };
}

// Both the world and every entity share this continuous camera transform.
// The player anchor is always exactly (width/2, height/2), including at map edges.
export function cameraFrame(game, width, height) {
  const camera = visualPosition(game.player, game.move);
  const tile = Math.min(width, height) / 9;
  return { camera, tile, center: { x: width / 2, y: height / 2 },
    project: (x, y) => ({ x: width / 2 + (x - camera.x) * tile, y: height / 2 + (y - camera.y) * tile }) };
}

const facingAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const progress = action => action ? Math.max(0, Math.min(1, 1 - action.remaining / action.duration)) : 0;

export class Renderer {
  constructor(world, minimap) { this.ctx = world.getContext('2d'); this.mapCtx = minimap.getContext('2d'); this.t = 0; }
  tree(x, y, px, py, tile, fog = false) {
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
    if (fog) { ctx.fillStyle = '#09140caa'; ctx.fillRect(px, py, Math.ceil(tile) + 1, Math.ceil(tile) + 1); }
  }
  weapon(x, y, tile, facing, level, swing = null, enemy = false) {
    const ctx = this.ctx, angle = facingAngle[facing] ?? 0;
    const p = swing ? 1 - swing.life / swing.duration : 0;
    const rotation = angle + (swing?.charging ? .65 - 1.9 * p : swing ? -1.25 + 2.65 * Math.sin(p * Math.PI / 2) : .65);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    const s = tile / 24;
    ctx.fillStyle = enemy ? '#ba8a61' : '#d9bb87'; ctx.fillRect(2 * s, -2 * s, 4 * s, 4 * s);
    ctx.fillStyle = '#6f492c'; ctx.fillRect(5 * s, -s, 4 * s, 2 * s);
    ctx.fillStyle = enemy ? '#ad7e4c' : '#d8b775'; ctx.fillRect(8 * s, -3 * s, s, 6 * s);
    ctx.fillStyle = enemy ? '#a77958' : level === 2 ? '#d6dfc8' : '#c5d4cd';
    ctx.fillRect(9 * s, -s * (level === 2 ? 1.7 : 1), (4 + level * 3) * s, s * (level === 2 ? 3.4 : 2));
    ctx.fillStyle = enemy ? '#e3ab73' : '#f1f2ce'; ctx.fillRect(9 * s, -s * (level === 2 ? 1.7 : 1), (4 + level * 3) * s, s);
    ctx.restore();
  }
  arc(x, y, tile, angle, p, level = 0, enemy = false) {
    const ctx = this.ctx, radius = tile * (.58 + level * .18), end = angle - 1.25 + 2.65 * p;
    ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * .95;
    ctx.lineCap = 'round'; ctx.strokeStyle = enemy ? '#f09b75' : '#fff3ad'; ctx.lineWidth = tile * .09;
    ctx.beginPath(); ctx.arc(x, y, radius, Math.max(angle - 1.25, end - 1.5), end); ctx.stroke();
    ctx.strokeStyle = enemy ? '#c74f3866' : '#efd58f55'; ctx.lineWidth = tile * .18;
    ctx.beginPath(); ctx.arc(x, y, radius - tile * .07, Math.max(angle - 1.25, end - 1.5), end); ctx.stroke();
    ctx.restore();
  }
  world(game, dt = 0) {
    this.t += dt;
    const ctx = this.ctx, width = ctx.canvas.width, height = ctx.canvas.height;
    const { camera, tile, center, project } = cameraFrame(game, width, height);
    this.lastFrame = { camera, tile, player: center };
    const p = game.player;
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
    ctx.fillStyle = '#121b12'; ctx.fillRect(0, 0, width, height);
    const left = Math.floor(camera.x - width / tile / 2) - 1, right = Math.ceil(camera.x + width / tile / 2) + 1;
    const top = Math.floor(camera.y - height / tile / 2) - 1, bottom = Math.ceil(camera.y + height / tile / 2) + 1;
    const inView = (x, y) => Math.abs(x - camera.x) <= 4.5 && Math.abs(y - camera.y) <= 4.5;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const a = project(x, y), px = Math.floor(a.x - tile / 2), py = Math.floor(a.y - tile / 2);
      if (!game.inside(x, y)) { ctx.fillStyle = '#112016'; ctx.fillRect(px, py, Math.ceil(tile) + 1, Math.ceil(tile) + 1); continue; }
      const live = inView(x, y), remembered = game.seen[game.index(x, y)];
      // Unknown peripheral canopy is decorative fog, never hidden terrain or entities.
      if (!live && !remembered) { ctx.fillStyle = '#243520'; ctx.fillRect(px, py, Math.ceil(tile) + 1, Math.ceil(tile) + 1); this.tree(x,y,px,py,tile,true); continue; }
      const n = (x * 931 + y * 337 + x * y * 17) >>> 0;
      const arena = Math.max(Math.abs(x - game.boss.x), Math.abs(y - game.boss.y)) <= 3;
      const wood = !game.floor(x,y);
      ctx.fillStyle = arena ? ['#625542','#685a46','#5b503f'][n % 3] : wood ? ['#293922','#2c3c24','#27371f'][n % 3] : ['#657249','#69774d','#607044','#6d794f'][n % 4];
      ctx.fillRect(px, py, Math.ceil(tile) + 1, Math.ceil(tile) + 1);
      ctx.fillStyle = arena ? '#88785b55' : '#9fa96735';
      for (let k=0; k<4; k++) ctx.fillRect(px + ((n >> k*3) % 20 + 2)*tile/24, py + ((n >> k*4) % 20 + 2)*tile/24, tile/12,tile/24);
      ctx.strokeStyle = '#15201014'; ctx.lineWidth = 1; ctx.strokeRect(px,py,tile,tile);
      if (wood) this.tree(x,y,px,py,tile);
      if (!live) { ctx.fillStyle='#071009a8'; ctx.fillRect(px,py,Math.ceil(tile)+1,Math.ceil(tile)+1); }
    }
    const warning = w => {
      if (!w) return;
      for (const c of w.cells) {
        if (!inView(c.x,c.y)) continue;
        const a = project(c.x,c.y), ratio = 1 - w.remaining/w.total;
        ctx.fillStyle = `rgba(220,65,42,${.24+ratio*.28})`; ctx.fillRect(a.x-tile/2+2,a.y-tile/2+2,tile-4,tile-4);
        ctx.strokeStyle='#f1a779'; ctx.lineWidth=2; ctx.strokeRect(a.x-tile/2+4,a.y-tile/2+4,tile-8,tile-8);
        ctx.fillStyle='#ffe0b1'; ctx.font=`bold ${tile/4}px monospace`; ctx.textAlign='center'; ctx.fillText('!',a.x,a.y+tile*.09);
      }
    };
    for (const e of game.enemies) warning(e.windup);
    warning(game.boss.windup);
    for (const item of game.items) {
      if (!inView(item.x,item.y)) continue;
      const a = project(item.x,item.y), s = tile/24;
      ctx.fillStyle='#17241755'; ctx.fillRect(a.x-6*s,a.y+5*s,12*s,3*s);
      if (item.type === 'food') {
        ctx.fillStyle='#f1d07f'; ctx.fillRect(a.x-3*s,a.y-5*s,6*s,2*s);
        ctx.fillStyle='#75552d'; ctx.fillRect(a.x-5*s,a.y-3*s,10*s,9*s);
        ctx.fillStyle='#c6a568'; ctx.fillRect(a.x-4*s,a.y-3*s,8*s,8*s);
        ctx.fillStyle='#f0d998'; ctx.fillRect(a.x-2*s,a.y,4*s,2*s); ctx.fillRect(a.x-s,a.y-s,2*s,4*s);
      } else {
        const bob=Math.sin(this.t*3)*s;
        ctx.fillStyle=item.level===2?'#e6c16d':'#c8dbb1'; ctx.fillRect(a.x-s,a.y-7*s+bob,(item.level+1)*s,10*s);
        ctx.fillStyle='#927448'; ctx.fillRect(a.x-4*s,a.y+2*s+bob,8*s,2*s);
        ctx.fillStyle='#c9a268'; ctx.fillRect(a.x-s,a.y+4*s+bob,2*s,4*s);
        ctx.fillStyle='#ffecae'; ctx.fillRect(a.x+6*s,a.y-7*s,s,3*s); ctx.fillRect(a.x+5*s,a.y-6*s,3*s,s);
      }
    }
    if (game.slash) {
      const s=game.slash, t=1-s.life/s.duration;
      this.arc(center.x,center.y,tile,facingAngle[s.facing],t,s.weapon);
      ctx.fillStyle=`rgba(255,222,134,${s.life*.5})`;
      for (const c of s.cells) { const a=project(c.x,c.y); ctx.fillRect(a.x-tile/2+3,a.y-tile/2+3,tile-6,tile-6); }
    }
    const drawEntity = (entity,type,isPlayer=false,isBoss=false) => {
      if (!isPlayer && !inView(entity.x,entity.y)) return;
      const visual=isPlayer?camera:visualPosition(entity), a=isPlayer?{...center}:project(visual.x,visual.y);
      let facing=isPlayer?(game.slash?.facing||p.facing):!entity.active?(entity.facing||'down'):Math.abs(p.x-entity.x)>Math.abs(p.y-entity.y)?(p.x<entity.x?'left':'right'):(p.y<entity.y?'up':'down');
      const windup=entity.windup, strike=entity.strike, recoil=entity.reaction;
      if (!isPlayer && (strike || windup?.cells.length)) {
        const dx = strike ? strike.dx : windup.cells[0].x - entity.x;
        const dy = strike ? strike.dy : windup.cells[0].y - entity.y;
        facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      }
      if (!isPlayer) {
        if (recoil) { const t=progress(recoil), amount=Math.sin(t*Math.PI)*tile*.17; a.x+=recoil.direction[0]*amount; a.y+=recoil.direction[1]*amount; }
        else if (strike) { const amount=Math.sin(progress(strike)*Math.PI)*tile*.24; a.x+=strike.dx*amount; a.y+=strike.dy*amount; }
        else if (windup && windup.cells.length) { const target=windup.cells[0], amount=(1-windup.remaining/windup.total)*tile*.07; a.x-=Math.sign(target.x-entity.x)*amount; a.y-=Math.sign(target.y-entity.y)*amount; }
      }
      const scale=tile/(isBoss?14:24);
      ctx.fillStyle=isBoss?'#29191580':'#0a130b66'; ctx.beginPath(); ctx.ellipse(a.x,a.y+tile*.32,tile*(isBoss?.42:.23),tile*.075,0,0,Math.PI*2); ctx.fill();
      if (windup && isBoss) { ctx.strokeStyle='#e4a06377'; ctx.lineWidth=tile*.05; ctx.beginPath(); ctx.arc(a.x,a.y,tile*(.4+progress({remaining:windup.remaining,duration:windup.total})*.3),0,Math.PI*2); ctx.stroke(); }
      if (isPlayer && game.invincible>0) ctx.globalAlpha=Math.floor(this.t*18)%2?.55:1;
      sprite(ctx,a.x-8*scale,a.y-8*scale,scale,type,facing,(isPlayer?game.move:entity.move)?this.t:0,!!recoil && recoil.remaining>.11);
      ctx.globalAlpha=1;
      if (isBoss) {
        ctx.fillStyle='#f1bf6c'; ctx.fillRect(a.x-tile*.34,a.y-tile*.62,tile*.1,tile*.22); ctx.fillRect(a.x+tile*.24,a.y-tile*.62,tile*.1,tile*.22);
      }
      if (isPlayer) this.weapon(a.x,a.y,tile,facing,p.weapon,game.slash);
      else if (type!=='wolf') {
        const animation=strike?{life:strike.remaining,duration:strike.duration}:windup?{life:windup.remaining/windup.total*.22,duration:.22,charging:true}:null;
        this.weapon(a.x,a.y,tile*(isBoss?1.35:.85),facing,type==='orc'?2:0,animation,true);
      }
      if (!isPlayer && !isBoss && (entity.active||entity.hp<ENEMIES[type].hp)) {
        ctx.fillStyle='#252a1c'; ctx.fillRect(a.x-tile*.3,a.y-tile*.43,tile*.6,4);
        ctx.fillStyle='#edb078'; ctx.fillRect(a.x-tile*.3,a.y-tile*.43,tile*.6*entity.hp/ENEMIES[type].hp,4);
      }
    };
    for (const e of game.enemies) drawEntity(e,e.type);
    if (game.boss.hp>0) drawEntity(game.boss,'orc',false,true);
    drawEntity(p,'soldier',true);
    for (const e of game.effects) {
      if (!inView(e.x,e.y)) continue;
      const a=project(e.x,e.y), t=1-e.life/(e.duration||.6);
      if (e.kind==='spark'||e.kind==='wood') {
        const n=e.kind==='spark'?8:5;
        ctx.save(); ctx.globalAlpha=Math.min(1,e.life*5);
        for(let k=0;k<n;k++) {
          const angle=k*Math.PI*2/n+.3, r=(e.kind==='spark'?.15:.08)*tile+t*tile*.42;
          const x=a.x+Math.cos(angle)*r,y=a.y+Math.sin(angle)*r;
          ctx.fillStyle=e.kind==='spark'?(k%2?'#fff1b5':'#e4a56e'):'#c3a66c';
          ctx.fillRect(x,y,tile*.04,tile*.04);
        } ctx.restore();
      } else if (e.kind==='enemy-slash') {
        const angle=Math.atan2(e.target.y-e.y,e.target.x-e.x);
        this.arc(a.x,a.y,tile,angle,t,e.type==='orc'?1:0,true);
      } else if (e.kind==='blast') { ctx.fillStyle=`rgba(255,146,88,${e.life*1.2})`; ctx.fillRect(a.x-tile/2+3,a.y-tile/2+3,tile-6,tile-6); }
      else if (e.kind==='shockwave') {
        ctx.save(); ctx.globalAlpha=e.life*1.6; ctx.strokeStyle='#d7a06b'; ctx.lineWidth=tile*.08;
        ctx.beginPath(); ctx.ellipse(a.x,a.y+tile*.2,tile*(.4+t*2.8),tile*(.2+t*1.4),0,0,Math.PI*2); ctx.stroke(); ctx.restore();
      } else if (e.kind==='death') {
        ctx.save(); ctx.globalAlpha=e.life*1.3; ctx.translate(a.x,a.y); ctx.rotate(t*.8);
        sprite(ctx,-tile/3,-tile/3,tile/24,e.type); ctx.restore();
      } else {
        ctx.font=`bold ${tile*.2}px monospace`; ctx.textAlign='center'; ctx.fillStyle=e.kind==='heal'?'#e1f1a7':'#fff0c5';
        ctx.fillText(e.text||'',a.x,a.y-tile*.43-t*tile*.3);
      }
    }
    const gradient=ctx.createRadialGradient(center.x,center.y,Math.min(width,height)*.28,center.x,center.y,Math.max(width,height)*.7);
    gradient.addColorStop(0,'#08140800'); gradient.addColorStop(1,'#08140885'); ctx.fillStyle=gradient; ctx.fillRect(0,0,width,height);
    if (game.invincible>.5) { ctx.fillStyle=`rgba(160,45,28,${(game.invincible-.5)*.4})`; ctx.fillRect(0,0,width,height); }
  }
  minimap(game) {
    const ctx=this.mapCtx, size=ctx.canvas.width, radius=size/2, scale=4, camera=visualPosition(game.player,game.move);
    ctx.clearRect(0,0,size,size); ctx.save(); ctx.beginPath(); ctx.arc(radius,radius,radius-2,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='#0d180f'; ctx.fillRect(0,0,size,size);
    const span=Math.ceil(radius/scale), project=(x,y)=>({x:radius+(x-camera.x)*scale,y:radius+(y-camera.y)*scale});
    for(let y=Math.floor(camera.y)-span;y<=Math.ceil(camera.y)+span;y++) for(let x=Math.floor(camera.x)-span;x<=Math.ceil(camera.x)+span;x++) {
      if(!game.inside(x,y)||!game.seen[game.index(x,y)]) continue;
      const a=project(x,y); ctx.fillStyle=game.floor(x,y)?'#91a575':'#3b5438'; ctx.fillRect(Math.floor(a.x-scale/2),Math.floor(a.y-scale/2),scale+1,scale+1);
    }
    for(const e of game.enemies) if(game.visible(e.x,e.y)) {const a=project(e.x,e.y);ctx.fillStyle='#df9a6a';ctx.fillRect(a.x-2,a.y-2,4,4);}
    ctx.strokeStyle='#d4cf9270'; ctx.lineWidth=1; ctx.strokeRect(radius-4.5*scale,radius-4.5*scale,9*scale,9*scale);
    ctx.fillStyle='#f7d586'; ctx.beginPath();ctx.arc(radius,radius,3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}
