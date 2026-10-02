import { ENEMIES } from './game.js';
import { sprite, paintWeapon, WEAPON_ART } from './art.js';
export { sprite, weaponIcon } from './art.js';

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
    const rest=facing==='left'||facing==='down'?-.55:.55;
    const stroke = p < .16 ? -.95 - .25 * p/.16 : p < .72 ? -1.2 + 2.4 * (1 - Math.pow(1-(p-.16)/.56,3)) : 1.2 - (1.2-rest)*(p-.72)/.28;
    const rotation = angle + (swing?.charging ? rest - 1.85 * p : swing ? stroke : rest);
    const hands=enemy==='boss'?{right:[.4,.27],left:[-.4,.27],down:[.4,.27],up:[.4,.24]}:enemy?{right:[.30,.22],left:[-.30,.22],down:[.3,.22],up:[.3,.19]}:{right:[.21,.17],left:[-.21,.17],down:[.21,.17],up:[.21,.12]};
    const hand = hands[facing]||hands.right;
    const hx=x+hand[0]*tile,hy=y+hand[1]*tile;
    // Grip is attached beside the body, with the blade leading the strike.
    paintWeapon(ctx,hx,hy,tile/(enemy==='boss'?43:enemy?47:55),enemy==='boss'?'hammer':enemy?'cleaver':WEAPON_ART[level].kind,rotation);
    ctx.save();ctx.translate(hx,hy);
    ctx.fillStyle=enemy?'#536451':'#425865';ctx.fillRect(-tile*.036,-tile*.026,tile*.063,tile*.059);
    ctx.fillStyle=enemy?'#a6a174':'#b4c1ab';ctx.fillRect(-tile*.033,-tile*.026,tile*.046,tile*.016);
    ctx.restore();
  }
  arc(x, y, tile, angle, p, level = 0, enemy = false) {
    const ctx=this.ctx;
    if(p<.13||p>.97)return;
    const phase=Math.min(1,Math.max(0,(p-.13)/.63));
    const alpha=Math.sin(Math.PI*(p-.13)/.87);
    if(enemy==='wolf'||enemy==='zombie') {
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
      for(let k=0;k<3;k++) {
        ctx.strokeStyle=k===1?'#ffe7c5':'#e8ad8b';ctx.lineWidth=tile*.018;
        ctx.beginPath();ctx.moveTo(tile*(.16+phase*.15),tile*(-.2+k*.14));ctx.lineTo(tile*(.45+phase*.3),tile*(-.3+k*.14));ctx.lineTo(tile*(.52+phase*.3),tile*(-.23+k*.14));ctx.stroke();
      }ctx.restore();return;
    }
    const radius=tile*(enemy?.89:WEAPON_ART[level].radius),end=angle-1.2+2.4*(1-Math.pow(1-phase,3));
    const start=Math.max(angle-1.2,end-1.38),segments=24;
    const outer=[],inner=[];
    for(let i=0;i<=segments;i++) {
      const u=i/segments,theta=start+(end-start)*u,r=radius*(.93+.07*u),thickness=tile*(enemy?.12:.14)*Math.sin(Math.PI*u);
      outer.push([x+Math.cos(theta)*r,y+Math.sin(theta)*r]);inner.push([x+Math.cos(theta)*(r-thickness),y+Math.sin(theta)*(r-thickness)]);
    }
    ctx.save();ctx.globalAlpha=alpha;
    const gradient=ctx.createLinearGradient(...outer[0],...outer.at(-1));
    gradient.addColorStop(0,enemy?'#c8684420':`${WEAPON_ART[level].color}12`);gradient.addColorStop(.65,enemy?'#e9b378a0':`${WEAPON_ART[level].color}b0`);gradient.addColorStop(1,'#fdf7e6');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(...outer[0]);for(const point of outer.slice(1))ctx.lineTo(...point);for(const point of inner.reverse())ctx.lineTo(...point);ctx.closePath();ctx.fill();
    ctx.lineWidth=Math.max(1,tile*.014);ctx.strokeStyle=enemy?'#ffe4b2':WEAPON_ART[level].color;
    ctx.beginPath();ctx.moveTo(...outer[8]);for(const point of outer.slice(9))ctx.lineTo(...point);ctx.stroke();
    const tip=outer.at(-1);ctx.fillStyle='#fff6cf';ctx.fillRect(tip[0]-tile*.018,tip[1]-tile*.018,tile*.035,tile*.035);
    ctx.restore();
  }
  burst(x,y,tile,t,kind,seed=0,direction=null) {
    const ctx=this.ctx,wood=kind==='wood',n=wood?13:11;
    ctx.save();ctx.globalAlpha=Math.max(0,1-t)*.95;
    for(let k=0;k<n;k++) {
      const variation=((seed+k*137)%97)/97,angle=k*Math.PI*2/n+variation*.9;
      const radius=tile*(.045+t*(.25+variation*.5)),drift=direction?tile*t*.08:0;
      const px=x+Math.cos(angle)*radius+(direction?.[0]||0)*drift,py=y+Math.sin(angle)*radius+t*t*tile*(wood?.32:.11)+(direction?.[1]||0)*drift;
      if(wood) {
        ctx.save();ctx.translate(px,py);ctx.rotate(angle+t*3);
        ctx.fillStyle=k%3===0?'#8fba68':k%3===1?'#c7a874':'#8d6a43';
        ctx.fillRect(-tile*.02,-tile*.012,tile*(k%3===0?.06:.075),tile*.026);
        ctx.fillStyle=k%3===0?'#c0d890':'#e1c393';ctx.fillRect(-tile*.02,-tile*.012,tile*.048,tile*.008);ctx.restore();
      } else {
        ctx.strokeStyle=k%3===0?'#f9ecd0':k%3===1?'#f4c482':'#c78c57';ctx.lineWidth=tile*(k%2?.013:.023);
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(angle)*tile*.065*(1-t),py-Math.sin(angle)*tile*.065*(1-t));ctx.stroke();
      }
    }
    if(!wood&&t<.5) {
      const size=tile*.15*(1-t*2);ctx.strokeStyle='#fff5d1';ctx.lineWidth=tile*.019;
      ctx.beginPath();ctx.moveTo(x-size,y-size*.25);ctx.lineTo(x+size,y+size*.25);ctx.moveTo(x+size*.25,y-size);ctx.lineTo(x-size*.25,y+size);ctx.stroke();
    }
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
        ctx.save();ctx.fillStyle=item.level===2?'#89d5e51f':'#b7c99915';ctx.beginPath();ctx.ellipse(a.x,a.y+tile*.2,tile*.29,tile*.1,0,0,Math.PI*2);ctx.fill();
        ctx.translate(a.x,a.y+bob);ctx.rotate(-Math.PI/4);paintWeapon(ctx,-tile*.12,0,tile/65,WEAPON_ART[item.level].kind);ctx.restore();
        ctx.fillStyle=item.level===2?'#cfedf0':'#ece5ba';ctx.fillRect(a.x+tile*.22,a.y-tile*.25,s*.5,s*2);ctx.fillRect(a.x+tile*.20,a.y-tile*.225,s*1.5,s*.5);
      }
    }
    if (game.slash) {
      const s=game.slash, t=1-s.life/s.duration;
      this.arc(center.x,center.y,tile,facingAngle[s.facing],t,s.weapon);
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
      const scale=tile/(isBoss?12:type==='orc'?20:type==='wolf'?19:22);
      const foot=isBoss?.61:type==='wolf'?.31:.35,shadow=isBoss?.5:type==='wolf'?.35:type==='orc'?.29:.22;
      ctx.fillStyle='#08141135';ctx.beginPath();ctx.ellipse(a.x,a.y+tile*foot,tile*(shadow+.055),tile*.1,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=isBoss?'#211b167a':'#0a16135c';ctx.beginPath();ctx.ellipse(a.x,a.y+tile*foot,tile*shadow,tile*.063,0,0,Math.PI*2);ctx.fill();
      if (windup && isBoss) { ctx.strokeStyle='#e4a06377'; ctx.lineWidth=tile*.05; ctx.beginPath(); ctx.arc(a.x,a.y,tile*(.4+progress({remaining:windup.remaining,duration:windup.total})*.3),0,Math.PI*2); ctx.stroke(); }
      if (isPlayer && game.invincible>0) ctx.globalAlpha=Math.floor(this.t*18)%2?.55:1;
      const pose={windup:windup?1-windup.remaining/windup.total:0,strike:strike?Math.sin(progress(strike)*Math.PI):0,swing:isPlayer&&game.slash?1-game.slash.life/game.slash.duration:0};
      sprite(ctx,a.x-8*scale,a.y-8*scale,scale,isBoss?'boss':type,facing,(isPlayer?game.move:entity.move)?this.t:0,!!recoil && recoil.remaining>.11,pose);
      ctx.globalAlpha=1;
      if (isPlayer) this.weapon(a.x,a.y,tile,facing,p.weapon,game.slash);
      else if (type==='orc'||isBoss) {
        const animation=strike?{life:strike.remaining,duration:strike.duration}:windup?{life:windup.remaining/windup.total*.22,duration:.22,charging:true}:null;
        this.weapon(a.x,a.y,tile*(isBoss?1.35:1),facing,2,animation,isBoss?'boss':'orc');
      }
      if (!isPlayer && !isBoss && (entity.active||entity.hp<ENEMIES[type].hp)) {
        const y=a.y-8*scale-tile*.06,h=Math.max(3,tile*.028);
        ctx.fillStyle='#12201de0';ctx.fillRect(a.x-tile*.29-1,y-1,tile*.58+2,h+2);
        ctx.fillStyle='#be805e';ctx.fillRect(a.x-tile*.29,y,tile*.58*entity.hp/ENEMIES[type].hp,h);
        ctx.fillStyle='#ebbd83';ctx.fillRect(a.x-tile*.29,y,tile*.58*entity.hp/ENEMIES[type].hp,1);
      }
    };
    for (const e of game.enemies) drawEntity(e,e.type);
    if (game.boss.hp>0) drawEntity(game.boss,'orc',false,true);
    drawEntity(p,'soldier',true);
    for (const e of game.effects) {
      if (!inView(e.x,e.y)) continue;
      const a=project(e.x,e.y), t=1-e.life/(e.duration||.6);
      if (e.kind==='spark'||e.kind==='wood') {
        this.burst(a.x,a.y,tile,t,e.kind,Math.abs(e.x*137+e.y*337),e.direction);
      } else if (e.kind==='enemy-slash') {
        const angle=Math.atan2(e.target.y-e.y,e.target.x-e.x);
        this.arc(a.x,a.y,tile,angle,t,e.type==='orc'?1:0,e.type);
      } else if (e.kind==='blast') {
        ctx.save();ctx.globalAlpha=(1-t)*.55;ctx.strokeStyle='#efb184';ctx.lineWidth=tile*.025;
        ctx.beginPath();ctx.ellipse(a.x,a.y+tile*.22,tile*(.08+t*.35),tile*(.04+t*.16),0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
      else if (e.kind==='shockwave') {
        ctx.save();ctx.globalAlpha=(1-t)*.8;ctx.strokeStyle='#e9c08e';ctx.lineWidth=tile*.034;
        ctx.beginPath();ctx.ellipse(a.x,a.y+tile*.3,tile*(.35+t*2.7),tile*(.17+t*1.35),0,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#91694b77';ctx.lineWidth=tile*.09;ctx.beginPath();ctx.ellipse(a.x,a.y+tile*.3,tile*(.26+t*2.5),tile*(.13+t*1.25),0,0,Math.PI*2);ctx.stroke();
        for(let k=0;k<10;k++){const q=k*Math.PI/5,r=tile*(.18+t*1.4);ctx.fillStyle=k%2?'#b29a72':'#ddc49b';ctx.fillRect(a.x+Math.cos(q)*r,a.y+Math.sin(q)*r*.5-tile*Math.sin(t*Math.PI)*.18,tile*.045,tile*.07);}
        ctx.restore();
      } else if (e.kind==='death') {
        const scale=tile/(e.type==='orc'?20:e.type==='wolf'?19:22);
        ctx.save();ctx.globalAlpha=Math.pow(1-t,1.4);ctx.translate(a.x,a.y+tile*.18*t);ctx.rotate(t*.28);ctx.scale(1,1-t*.5);
        sprite(ctx,-8*scale,-8*scale,scale,e.type);ctx.restore();
        ctx.save();ctx.globalAlpha=(1-t)*.3;ctx.fillStyle='#aeab88';ctx.beginPath();ctx.ellipse(a.x,a.y+tile*.33,tile*(.16+t*.24),tile*.06,0,0,Math.PI*2);ctx.fill();ctx.restore();
      } else {
        const y=a.y-tile*.46-t*tile*.24+(e.kind==='xp'?tile*.25:0);
        ctx.save();ctx.font=`bold ${tile*(e.kind==='xp'?.13:.19)}px monospace`;ctx.textAlign='center';ctx.lineWidth=Math.max(2,tile*.025);ctx.strokeStyle='#14231fea';
        ctx.strokeText(e.text||'',a.x,y);ctx.fillStyle=e.kind==='heal'?'#d9ecb0':e.kind==='xp'?'#a6e2ed':'#fff2d0';ctx.fillText(e.text||'',a.x,y);ctx.restore();
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
