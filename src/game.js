export const CONFIG = { size: 200, vision: 4, maxHp: 100, moveTime: 0.14, attackTime: 0.24, foodHeal: 35, aggro: 4, leash: 8, bossHp: 620 };
export const WEAPONS = [
  { name: '野战小刀', short: '小刀', damage: 15, depth: 1, width: 1 },
  { name: '精钢长刀', short: '长刀', damage: 28, depth: 1, width: 3 },
  { name: '破军大剑', short: '大剑', damage: 48, depth: 2, width: 3 },
];
export const ENEMIES = {
  zombie: { name: '僵尸', hp: 45, damage: 10, speed: 0.55, windup: 0.8, color: '#93aa69' },
  wolf: { name: '野狼', hp: 30, damage: 12, speed: 0.29, windup: 0.65, color: '#b1b9bc' },
  orc: { name: '兽人', hp: 100, damage: 22, speed: 0.7, windup: 1, color: '#c08258' },
};
export const DIRECTIONS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export function random(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export class Game {
  constructor(seed = Date.now() >>> 0) {
    this.seed = seed;
    this.rng = random(seed);
    this.size = CONFIG.size;
    this.tiles = new Uint8Array(this.size * this.size).fill(1);
    this.seen = new Uint8Array(this.tiles.length);
    this.player = { x: 100, y: 100, hp: CONFIG.maxHp, weapon: 0, facing: 'down' };
    this.enemies = [];
    this.items = [];
    this.status = 'playing';
    this.stats = { time: 0, kills: 0, trees: 0, explored: 0 };
    this.attackCooldown = 0;
    this.invincible = 0;
    this.move = null;
    this.slash = null;
    this.effects = [];
    this.events = [];
    this.message = '向树林深处前进。空格挥刀，寻找下一片空地。';
    this.generate();
    this.reveal();
  }
  index(x, y) { return y * this.size + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  floor(x, y) { return this.inside(x, y) && this.tiles[this.index(x, y)] === 0; }
  carve(x, y) { if (this.inside(x, y)) this.tiles[this.index(x, y)] = 0; }
  rectangle(x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.carve(xx, yy); }
  generate() {
    const rooms = [];
    // Separate room placement from content placement; everything is fixed at world creation.
    for (let gy = 5; gy < 195; gy += 8) for (let gx = 5; gx < 195; gx += 8) {
      const x = gx + Math.floor(this.rng() * 5) - 2;
      const y = gy + Math.floor(this.rng() * 5) - 2;
      if (distance({ x, y }, this.player) < 7 || this.rng() < 0.16) continue;
      const w = 3 + Math.floor(this.rng() * 4), h = 3 + Math.floor(this.rng() * 4);
      this.rectangle(x - Math.floor(w / 2), y - Math.floor(h / 2), w, h);
      rooms.push({ x, y, w, h });
      const previous = rooms.at(-2);
      if (previous && distance(previous, { x, y }) <= 15 && this.rng() < 0.38) {
        let cx = previous.x, cy = previous.y;
        while (cx !== x) { cx += Math.sign(x - cx); this.carve(cx, cy); }
        while (cy !== y) { cy += Math.sign(y - cy); this.carve(cx, cy); }
      }
    }
    // Close the immediate spawn area before carving its exact 3×3 clearing.
    for (let y = 96; y <= 104; y++) for (let x = 96; x <= 104; x++) this.tiles[this.index(x, y)] = 1;
    this.rectangle(99, 99, 3, 3);
    this.rectangle(104, 98, 4, 4);
    rooms.push({ x: 106, y: 100, w: 4, h: 4 });
    const quadrant = Math.floor(this.rng() * 4);
    const bx = quadrant % 2 ? 160 + Math.floor(this.rng() * 28) : 12 + Math.floor(this.rng() * 28);
    const by = quadrant < 2 ? 12 + Math.floor(this.rng() * 28) : 160 + Math.floor(this.rng() * 28);
    this.boss = { x: bx, y: by, hp: CONFIG.bossHp, maxHp: CONFIG.bossHp, active: false, windup: null, cooldown: 1.2, phase: 0 };
    this.rectangle(bx - 3, by - 3, 7, 7);
    const occupied = new Set();
    const place = (x, y, type, data = {}) => {
      const k = this.index(x, y);
      if (!this.floor(x, y) || occupied.has(k) || distance({ x, y }, this.player) < 5 || distance({ x, y }, this.boss) <= 5) return false;
      occupied.add(k);
      if (ENEMIES[type]) this.enemies.push({ id: this.enemies.length, x, y, type, hp: ENEMIES[type].hp, active: false, cooldown: this.rng() * 0.6, windup: null, ...data });
      else this.items.push({ x, y, type, ...data });
      return true;
    };
    for (const room of rooms) {
      const d = distance(room, this.player);
      if (this.rng() < 0.65) place(room.x - 1, room.y, 'food');
      if (this.rng() < 0.13) place(room.x, room.y + 1, 'weapon', { level: d > 38 && this.rng() < 0.44 ? 2 : 1 });
      if (d > 8 && this.rng() < 0.64) {
        const type = d < 20 ? 'zombie' : d < 45 ? (this.rng() < 0.5 ? 'zombie' : 'wolf') : ['zombie', 'wolf', 'orc'][Math.floor(this.rng() * 3)];
        place(room.x, room.y, type);
        if (d > 45 && this.rng() < 0.25) place(room.x + 1, room.y - 1, this.rng() < 0.5 ? 'wolf' : 'orc');
      }
    }
    // Guaranteed early upgrade, still reached by exploration rather than a quest marker.
    this.rectangle(115, 103, 3, 3);
    this.items = this.items.filter(i => !(i.x === 116 && i.y === 104));
    this.enemies = this.enemies.filter(e => !(e.x === 116 && e.y === 104));
    this.items.push({ x: 116, y: 104, type: 'weapon', level: 1 });
    if (!this.items.some(i => i.x === 106 && i.y === 100)) this.items.push({ x: 106, y: 100, type: 'food' });
    if (!this.items.some(i => i.type === 'weapon' && i.level === 2)) {
      const room = rooms.find(r => distance(r, this.player) > 45 && distance(r, this.boss) > 6);
      if (room) this.items.push({ x: room.x, y: room.y + 1, type: 'weapon', level: 2 });
    }
  }
  reveal() {
    for (let y = this.player.y - 4; y <= this.player.y + 4; y++) for (let x = this.player.x - 4; x <= this.player.x + 4; x++) {
      if (!this.inside(x, y)) continue;
      const k = this.index(x, y);
      if (!this.seen[k]) { this.seen[k] = 1; this.stats.explored++; }
    }
  }
  visible(x, y) { return distance(this.player, { x, y }) <= CONFIG.vision; }
  occupied(x, y, except = null) {
    return this.enemies.some(e => e !== except && e.hp > 0 && e.x === x && e.y === y) || (this.boss.hp > 0 && this.boss.x === x && this.boss.y === y);
  }
  tryMove(direction) {
    if (this.status !== 'playing' || this.move || !DIRECTIONS[direction]) return false;
    this.player.facing = direction;
    const [dx, dy] = DIRECTIONS[direction], x = this.player.x + dx, y = this.player.y + dy;
    if (!this.floor(x, y) || this.occupied(x, y)) return false;
    this.move = { x: this.player.x, y: this.player.y, elapsed: 0, duration: CONFIG.moveTime };
    this.player.x = x; this.player.y = y;
    this.reveal();
    this.pickup();
    return true;
  }
  attackCells() {
    const [dx, dy] = DIRECTIONS[this.player.facing], w = WEAPONS[this.player.weapon];
    const cells = [];
    for (let d = 1; d <= w.depth; d++) for (let offset = -Math.floor(w.width / 2); offset <= Math.floor(w.width / 2); offset++) {
      const x = this.player.x + dx * d - dy * offset, y = this.player.y + dy * d + dx * offset;
      if (this.inside(x, y)) cells.push({ x, y });
    }
    return cells;
  }
  attack() {
    if (this.status !== 'playing' || this.attackCooldown > 0) return false;
    const cells = this.attackCells(), damage = WEAPONS[this.player.weapon].damage;
    this.attackCooldown = CONFIG.attackTime;
    this.slash = { cells, life: 0.18 };
    let chopped = 0, hits = 0;
    for (const c of cells) {
      const k = this.index(c.x, c.y);
      if (this.tiles[k]) { this.tiles[k] = 0; this.stats.trees++; chopped++; this.effects.push({ ...c, text: '木屑', kind: 'wood', life: 0.45 }); }
      for (const e of this.enemies) if (e.hp > 0 && e.x === c.x && e.y === c.y) {
        e.hp = Math.max(0, e.hp - damage); hits++;
        this.effects.push({ ...c, text: `−${damage}`, kind: 'hit', life: 0.55 });
        if (!e.hp) this.kill(e);
      }
      if (this.boss.hp > 0 && this.boss.x === c.x && this.boss.y === c.y) {
        this.boss.hp = Math.max(0, this.boss.hp - damage); hits++;
        this.effects.push({ ...c, text: `−${damage}`, kind: 'hit', life: 0.55 });
        if (!this.boss.hp) { this.stats.kills++; this.status = 'won'; this.message = '森林重归宁静。你击败了荒野领主！'; this.events.push('won'); }
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0);
    this.events.push(hits ? 'hit' : chopped ? 'chop' : 'slash');
    return true;
  }
  kill(e) {
    this.stats.kills++;
    if (this.rng() < 0.14) {
      this.items.push({ x: e.x, y: e.y, type: 'weapon', level: e.type === 'orc' && this.rng() < 0.65 ? 2 : 1 });
      this.message = '敌人掉落了武器。走过去拾取。';
    } else if (this.rng() < 0.38) {
      this.items.push({ x: e.x, y: e.y, type: 'food' });
      this.message = '发现战利品：食物。';
    } else this.message = `${ENEMIES[e.type].name}已被击败。道路安全了。`;
  }
  pickup() {
    const remaining = [];
    for (const i of this.items) {
      if (i.x !== this.player.x || i.y !== this.player.y) { remaining.push(i); continue; }
      if (i.type === 'food') {
        if (this.player.hp >= CONFIG.maxHp) { remaining.push(i); continue; }
        const amount = Math.min(CONFIG.foodHeal, CONFIG.maxHp - this.player.hp);
        this.player.hp += amount;
        this.message = `吃掉食物，恢复 ${amount} 点生命。`;
        this.effects.push({ x: i.x, y: i.y, text: `+${amount}`, kind: 'heal', life: 0.8 });
        this.events.push('heal');
      } else if (i.level > this.player.weapon) {
        this.player.weapon = i.level;
        this.message = `装备 ${WEAPONS[i.level].name}！挥砍范围与伤害提升。`;
        this.events.push('upgrade');
      }
    }
    this.items = remaining;
  }
  hurt(damage) {
    if (this.invincible > 0 || this.status !== 'playing') return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.invincible = 0.65;
    this.message = `受到 ${damage} 点伤害。移动躲开红色预警！`;
    this.events.push('hurt');
    if (!this.player.hp) { this.status = 'dead'; this.message = '士兵倒下了。下次出发，记得留一条退路。'; this.events.push('dead'); }
  }
  // BFS checks the actual connected clearing, including long winding paths.
  pathStep(from, to, maxDepth = this.tiles.length) {
    const queue = [{ x: from.x, y: from.y, first: null, depth: 0 }], seen = new Set([this.index(from.x, from.y)]);
    for (let j = 0; j < queue.length; j++) {
      const n = queue[j];
      if (n.x === to.x && n.y === to.y) return n.first;
      if (n.depth >= maxDepth) continue;
      for (const [dx, dy] of Object.values(DIRECTIONS)) {
        const x = n.x + dx, y = n.y + dy, key = this.index(x, y);
        if (!this.floor(x, y) || seen.has(key)) continue;
        seen.add(key);
        queue.push({ x, y, first: n.first || { x, y }, depth: n.depth + 1 });
      }
    }
    return null;
  }
  updateEnemies(dt) {
    for (const e of this.enemies) {
      const spec = ENEMIES[e.type], d = distance(e, this.player);
      if (e.active && d > CONFIG.leash) { e.active = false; e.windup = null; e.move = null; continue; }
      if (!e.active) {
        if (d > CONFIG.aggro || !this.pathStep(e, this.player)) continue;
        e.active = true;
      }
      if (e.move) { e.move.elapsed += dt; if (e.move.elapsed >= e.move.duration) e.move = null; }
      if (e.windup) {
        e.windup.remaining -= dt;
        if (e.windup.remaining <= 0) {
          if (e.windup.cells.some(c => c.x === this.player.x && c.y === this.player.y)) this.hurt(spec.damage);
          this.effects.push(...e.windup.cells.map(c => ({ ...c, kind: 'blast', text: '', life: 0.2 })));
          e.windup = null; e.cooldown = 0.65;
        }
        continue;
      }
      e.cooldown -= dt;
      if (e.cooldown > 0 || e.move) continue;
      if (manhattan(e, this.player) === 1) {
        e.windup = { cells: [{ x: this.player.x, y: this.player.y }], remaining: spec.windup, total: spec.windup };
      } else {
        const next = this.pathStep(e, this.player);
        if (next && !this.occupied(next.x, next.y, e) && !(next.x === this.player.x && next.y === this.player.y)) {
          e.move = { x: e.x, y: e.y, elapsed: 0, duration: spec.speed * 0.75 };
          e.x = next.x; e.y = next.y;
        }
        e.cooldown = spec.speed;
      }
    }
  }
  inArena() { return distance(this.player, this.boss) <= 3; }
  updateBoss(dt) {
    const b = this.boss;
    if (b.hp <= 0) return;
    if (!this.inArena()) {
      if (b.active || b.hp < b.maxHp) {
        b.active = false; b.hp = b.maxHp; b.windup = null; b.cooldown = 1.2;
        this.message = '已撤离战斗区域。荒野领主恢复了生命。';
      }
      return;
    }
    if (!b.active) { b.active = true; this.message = '荒野领主苏醒！躲开红格，趁攻击间隙挥刀。'; }
    if (b.windup) {
      b.windup.remaining -= dt;
      if (b.windup.remaining <= 0) {
        if (b.windup.cells.some(c => c.x === this.player.x && c.y === this.player.y)) this.hurt(28);
        this.effects.push(...b.windup.cells.map(c => ({ ...c, text: '', kind: 'blast', life: 0.32 })));
        b.windup = null; b.cooldown = b.hp < b.maxHp * 0.4 ? 0.85 : 1.25;
      }
      return;
    }
    b.cooldown -= dt;
    if (b.cooldown > 0) return;
    const cells = [], mode = b.phase++ % 3;
    for (let y = b.y - 3; y <= b.y + 3; y++) for (let x = b.x - 3; x <= b.x + 3; x++) {
      if (x === b.x && y === b.y) continue;
      const hit = mode === 0 ? Math.abs(x - this.player.x) <= 1 && Math.abs(y - this.player.y) <= 1
        : mode === 1 ? x === b.x || y === b.y
          : distance({ x, y }, b) === 2;
      if (hit) cells.push({ x, y });
    }
    const total = b.hp < b.maxHp * 0.4 ? 0.72 : 0.95;
    b.windup = { cells, remaining: total, total };
  }
  update(dt) {
    if (this.status !== 'playing') return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.stats.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    if (this.move) { this.move.elapsed += dt; if (this.move.elapsed >= this.move.duration) this.move = null; }
    if (this.slash) { this.slash.life -= dt; if (this.slash.life <= 0) this.slash = null; }
    this.effects = this.effects.filter(e => (e.life -= dt) > 0);
    this.updateEnemies(dt);
    if (this.status === 'playing') this.updateBoss(dt);
  }
  pause() { if (this.status === 'playing') { this.status = 'paused'; this.move = null; } }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  serialize() {
    return JSON.stringify({ version: 1, seed: this.seed, tiles: Array.from(this.tiles), seen: Array.from(this.seen), player: this.player, enemies: this.enemies, items: this.items, boss: this.boss, stats: this.stats, status: this.status, message: this.message, attackCooldown: this.attackCooldown, invincible: this.invincible });
  }
  static restore(raw) {
    const d = JSON.parse(raw);
    const validPoint = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < 200 && p.y >= 0 && p.y < 200;
    const nonnegative = n => Number.isFinite(n) && n >= 0;
    const validWarning = w => w === null || w && Array.isArray(w.cells) && w.cells.every(validPoint) && nonnegative(w.remaining) && Number.isFinite(w.total) && w.total > 0;
    const validMotion = m => !m || validPoint(m) && nonnegative(m.elapsed) && Number.isFinite(m.duration) && m.duration > 0;
    if (d.version !== 1 || d.tiles?.length !== 40000 || d.seen?.length !== 40000 || !validPoint(d.player) || !Number.isFinite(d.player.hp) || d.player.hp <= 0 || d.player.hp > 100 || !WEAPONS[d.player.weapon] || !DIRECTIONS[d.player.facing] || !Array.isArray(d.enemies) || !Array.isArray(d.items) || !validPoint(d.boss) || !Number.isFinite(d.boss.hp) || !Number.isFinite(d.stats?.time) || !['playing', 'paused', 'won'].includes(d.status)) throw new Error('无效或不兼容的存档');
    if (d.tiles.some(t => t !== 0 && t !== 1) || d.seen.some(t => t !== 0 && t !== 1) || d.enemies.some(e => !validPoint(e) || !ENEMIES[e.type] || !Number.isFinite(e.hp)) || d.items.some(i => !validPoint(i) || !['food', 'weapon'].includes(i.type) || i.type === 'weapon' && !WEAPONS[i.level])) throw new Error('存档内容损坏');
    if (!nonnegative(d.stats.time) || !nonnegative(d.stats.kills) || !nonnegative(d.stats.trees) || !nonnegative(d.stats.explored) || d.stats.explored > 40000 || !nonnegative(d.attackCooldown) || !nonnegative(d.invincible) || d.boss.maxHp !== CONFIG.bossHp || d.boss.hp < 0 || d.boss.hp > CONFIG.bossHp || !validWarning(d.boss.windup) || !Number.isFinite(d.boss.cooldown) || !Number.isInteger(d.boss.phase) || d.enemies.some(e => e.hp <= 0 || e.hp > ENEMIES[e.type].hp || !validWarning(e.windup) || !validMotion(e.move) || !Number.isFinite(e.cooldown))) throw new Error('存档状态损坏');
    const g = Object.create(Game.prototype);
    Object.assign(g, d, { size: 200, tiles: Uint8Array.from(d.tiles), seen: Uint8Array.from(d.seen), rng: random(d.seed ^ Math.floor(d.stats.time * 100)), effects: [], events: [], move: null, slash: null });
    g.status = d.status === 'won' ? 'won' : 'paused';
    return g;
  }
}
