// Игровой мир: карта, танки, снаряды, мины, огонь, бонусы. Без DOM — можно гонять в Node.
export const W = 13, H = 13;
export const T = { EMPTY: 0, STEEL: 1, BRICK: 2, WATER: 3, BUSH: 4, ICE: 5, BARREL: 6 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // вверх, вправо, вниз, влево
export const ROUND_TIME = 120;
export const SHRINK_AT = 70;      // с этой секунды арена сжимается
export const SHRINK_STEP = 0.32;  // секунд на одну клетку

// Порядок закрытия клеток: спираль от края к центру.
const SPIRAL = (() => {
  const out = [];
  let x0 = 0, y0 = 0, x1 = 12, y1 = 12;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
})();

// Арены. Параметры генерации: доля кирпича, кустов, бочек, льда.
export const THEMES = {
  field:  { name: 'Поле',    brick: 0.56, bush: 0.08, barrel: 0.035, ice: 0 },
  city:   { name: 'Город',   brick: 0.52, bush: 0.05, barrel: 0.055, ice: 0 },
  winter: { name: 'Зима',    brick: 0.48, bush: 0.08, barrel: 0.03,  ice: 0.12 },
  desert: { name: 'Пустыня', brick: 0.50, bush: 0.06, barrel: 0.045, ice: 0 },
};
export const THEME_IDS = Object.keys(THEMES);

// Сложность ботов.
export const DIFFICULTY = {
  easy:   { name: 'Лёгкий',  react: [0.45, 0.75], mineCd: [3, 5],     range: 6,  fleeDelay: 0.55, speed: -0.3, coins: 0.7 },
  normal: { name: 'Средний', react: [0.15, 0.4],  mineCd: [1.5, 3.5], range: 9,  fleeDelay: 0,    speed: 0,    coins: 1 },
  hard:   { name: 'Сложный', react: [0.06, 0.14], mineCd: [1, 2],     range: 12, fleeDelay: 0,    speed: 0.2,  coins: 1.5, focusHuman: true },
};

export const BONUS_TYPES = ['mines', 'range', 'speed', 'armor', 'rapid', 'shield', 'repair', 'remote', 'ricochet'];
const BONUS_WEIGHTS = { mines: 1.3, range: 1.3, speed: 1, armor: 0.8, rapid: 1, shield: 0.5, repair: 0.45, remote: 0.7, ricochet: 0.8 };
export const BONUS_INFO = {
  mines: '+1 мина', range: 'Взрыв дальше', speed: 'Скорость', armor: '+1 броня', rapid: 'Скорострельность',
  shield: 'Щит на 4 секунды', repair: 'Ремонт', remote: 'Радиомины ×3', ricochet: 'Рикошет ×8',
};

export const TANK_INFO = [
  { name: 'Вы',        body: '#5f6e3c', dark: '#3a4423', light: '#8b9a5e', camo: '#3d4a26', mark: '#f0c84a' },
  { name: 'Пустынник', body: '#a88b5b', dark: '#6b5636', light: '#cdb282', camo: '#7c6440', mark: '#b8402f' },
  { name: 'Сталь',     body: '#5d6975', dark: '#38414a', light: '#8794a0', camo: '#3f4a55', mark: '#b8402f' },
  { name: 'Ржавчина',  body: '#7e4c35', dark: '#4c2c1e', light: '#a87156', camo: '#573122', mark: '#b8402f' },
];

// Камуфляжи для танка игрока (только внешний вид, на силу не влияют).
// pattern: blobs — пятна, stripes — полосы, digital — пиксельный, shine — блестящий.
export const SKINS = {
  standard: { name: 'Штатный',   cost: 0,    body: '#5f6e3c', dark: '#3a4423', light: '#8b9a5e', camo: '#3d4a26', pattern: 'blobs' },
  forest:   { name: 'Лесной',    cost: 150,  body: '#4f6b34', dark: '#2c3d1c', light: '#7a9452', camo: '#22311a', camo2: '#7c6a3e', pattern: 'blobs' },
  desert:   { name: 'Пустынный', cost: 150,  body: '#c4a46c', dark: '#7d6440', light: '#e0c690', camo: '#a07c4c', camo2: '#e3d1a4', pattern: 'blobs' },
  winter:   { name: 'Зимний',    cost: 200,  body: '#d8dde0', dark: '#7d878e', light: '#f4f7f8', camo: '#9aa6ae', camo2: '#5f6a72', pattern: 'digital' },
  urban:    { name: 'Городской', cost: 200,  body: '#6f7378', dark: '#3d4044', light: '#9ba0a5', camo: '#4a4d51', camo2: '#aeb2b6', pattern: 'digital' },
  night:    { name: 'Ночной',    cost: 300,  body: '#2c3442', dark: '#141922', light: '#4c5a70', camo: '#1b2330', camo2: '#3d4b63', pattern: 'blobs' },
  tiger:    { name: 'Тигр',      cost: 350,  body: '#c9822e', dark: '#7a4713', light: '#e6a856', camo: '#2a1d10', pattern: 'stripes' },
  gold:     { name: 'Золотой',   cost: 800,  body: '#c9a227', dark: '#7d6210', light: '#f5dc7a', camo: '#a88516', pattern: 'shine' },
};
export const SKIN_IDS = Object.keys(SKINS);

// Модели танков (открываются в гараже). shape — пропорции для отрисовки.
export const MODELS = {
  lynx:    { name: 'Рысь',    desc: 'Сбалансированный',          cost: 0,   hp: 3, speed: 3.0, reload: 0.55, mines: 1, range: 2, shape: { w: 0.52, l: 0.80, tur: 0.34 } },
  hornet:  { name: 'Шершень', desc: 'Очень быстрый, но хрупкий', cost: 300, hp: 2, speed: 3.6, reload: 0.52, mines: 1, range: 2, shape: { w: 0.44, l: 0.86, tur: 0.30 } },
  bastion: { name: 'Бастион', desc: 'Толстая броня, медленный',  cost: 500, hp: 4, speed: 2.7, reload: 0.60, mines: 1, range: 2, shape: { w: 0.60, l: 0.82, tur: 0.40 } },
  sapper:  { name: 'Сапёр',   desc: 'Две мины и дальний взрыв',  cost: 700, hp: 3, speed: 3.1, reload: 0.55, mines: 2, range: 3, shape: { w: 0.54, l: 0.78, tur: 0.32 } },
};
export const MODEL_IDS = Object.keys(MODELS);

// Уровни внутри раунда: звёзды за попадания (+1) и уничтожение (+3).
export const LEVELS = [
  { stars: 0, name: 'Лёгкий' },
  { stars: 3, name: 'Средний',    perk: '+1 броня' },
  { stars: 7, name: 'Тяжёлый',    perk: 'двойной ствол: урон ×2, кирпич с 1 выстрела' },
  { stars: 12, name: 'Штурмовой', perk: '+1 броня, перезарядка быстрее' },
];

const SPAWNS = [[0, 12, 0], [12, 0, 2], [12, 12, 0], [0, 0, 2]];

function makeTank(id, x, y, dir, modelId, skin) {
  const m = MODELS[modelId] || MODELS.lynx;
  return {
    id, model: modelId in MODELS ? modelId : 'lynx', shape: m.shape, skin: skin || null,
    x, y, tx: x, ty: y, fx: x, fy: y, dir, angle: dir * Math.PI / 2,
    speed: m.speed, hp: m.hp, maxHp: m.hp, cd: 0.5, reload: m.reload, maxMines: m.mines, range: m.range,
    power: 1, level: 1, stars: 0, kills: 0,
    shield: 0, remote: 0, ricochet: 0, arrived: false,
    alive: true, want: -1, hold: false, fire: false, mine: false,
    recoil: 0, dist: 0, hitFlash: 0, burned: new Set(), ai: null,
  };
}

export class World {
  constructor(opts = {}) {
    this.rand = opts.rand || Math.random;
    this.theme = opts.theme in THEMES ? opts.theme : 'field';
    this.difficulty = opts.difficulty in DIFFICULTY ? opts.difficulty : 'normal';
    this.diff = DIFFICULTY[this.difficulty];
    this.peace = opts.peace || 0;          // секунды в начале раунда, когда боты не нападают (обучение)
    this.humans = opts.humans || [0];      // танки, которыми управляют люди
    const models = opts.models || [];
    const skins = opts.skins || [];
    this.tiles = new Uint8Array(W * H);
    this.brickHp = new Uint8Array(W * H);
    this.tanks = [];
    this.shells = [];
    this.mines = [];
    this.fires = [];
    this.bonuses = [];
    this.events = [];
    this.time = 0;
    this.fireGroup = 0;
    this.mineSeq = 0;
    this.mapDirty = true;
    this.generate();
    SPAWNS.forEach(([x, y, d], i) => {
      const t = makeTank(i, x, y, d, models[i], skins[i]);
      if (!this.humans.includes(i)) t.speed = Math.max(2, t.speed + this.diff.speed);
      this.tanks.push(t);
    });
  }

  idx(x, y) { return y * W + x; }
  inb(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
  tile(x, y) { return this.inb(x, y) ? this.tiles[this.idx(x, y)] : T.STEEL; }

  generate() {
    const r = this.rand;
    const th = THEMES[this.theme];
    const safe = new Set();
    for (const [sx, sy] of SPAWNS) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 3) continue;
        const x = sx + dx, y = sy + dy;
        if (this.inb(x, y)) safe.add(this.idx(x, y));
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, y);
      if (x % 2 === 1 && y % 2 === 1) {
        const v = r();
        this.tiles[i] = v < 0.8 ? T.STEEL : v < 0.9 ? (this.theme === 'winter' ? T.ICE : T.WATER) : T.EMPTY;
        continue;
      }
      if (safe.has(i)) {
        if (th.ice && r() < th.ice * 0.5) this.tiles[i] = T.ICE;
        continue;
      }
      const v = r();
      if (v < th.brick) { this.tiles[i] = T.BRICK; this.brickHp[i] = 2; }
      else if (v < th.brick + th.bush) this.tiles[i] = T.BUSH;
      else if (v < th.brick + th.bush + th.barrel) this.tiles[i] = T.BARREL;
      else if (v < th.brick + th.bush + th.barrel + th.ice) this.tiles[i] = T.ICE;
    }
  }

  tankAt(x, y, except) {
    for (const t of this.tanks) {
      if (!t.alive || t === except) continue;
      if ((t.tx === x && t.ty === y) || (t.fx === x && t.fy === y)) return t;
    }
    return null;
  }
  mineAt(x, y) { return this.mines.find(m => m.x === x && m.y === y) || null; }

  walkable(tt) { return tt === T.EMPTY || tt === T.BUSH || tt === T.ICE; }

  canEnter(x, y, t) {
    return this.walkable(this.tile(x, y)) && !this.mineAt(x, y) && !this.tankAt(x, y, t);
  }

  update(dt) {
    this.time += dt;
    for (const t of this.tanks) if (t.alive) this.updateTank(t, dt);
    this.updateShells(dt);
    this.updateMines(dt);
    this.updateFires(dt);
    for (const b of this.bonuses) b.age += dt;
    this.updateShrink();
  }

  // Ближайшие клетки, которые закроются, и через сколько секунд.
  upcomingShrink(n = 4) {
    const out = [];
    const done = this.shrinkIdx || 0;
    for (let i = 0; i < n && done + i < SPIRAL.length; i++) {
      const [x, y] = SPIRAL[done + i];
      out.push({ x, y, t: SHRINK_AT + (done + i) * SHRINK_STEP - this.time });
    }
    return out;
  }

  updateShrink() {
    if (this.time < SHRINK_AT) return;
    if (this.shrinkIdx === undefined) { this.shrinkIdx = 0; this.events.push({ type: 'shrinkStart' }); }
    while (this.shrinkIdx < SPIRAL.length && this.time >= SHRINK_AT + this.shrinkIdx * SHRINK_STEP) {
      const [x, y] = SPIRAL[this.shrinkIdx++];
      const i = this.idx(x, y);
      if (this.tiles[i] === T.STEEL) continue;
      this.tiles[i] = T.STEEL;
      this.brickHp[i] = 0;
      this.mapDirty = true;
      this.mines = this.mines.filter(m => !(m.x === x && m.y === y));
      this.bonuses = this.bonuses.filter(b => !(b.x === x && b.y === y));
      for (const t of this.tanks) {
        if (!t.alive) continue;
        if ((t.tx === x && t.ty === y) || (t.fx === x && t.fy === y)) this.damage(t, 99, -1, t.x, t.y, 'crush');
      }
      this.events.push({ type: 'crush', x, y });
    }
  }

  updateTank(t, dt) {
    t.cd = Math.max(0, t.cd - dt);
    t.recoil = Math.max(0, t.recoil - dt * 5);
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    t.shield = Math.max(0, t.shield - dt);

    const atCenter = t.x === t.tx && t.y === t.ty;
    if (atCenter) {
      t.fx = t.tx; t.fy = t.ty;
      this.pickBonus(t);
      let slid = false;
      // лёд: доехав до клетки со льдом, танк скользит дальше по направлению движения
      if (t.arrived && this.tile(t.tx, t.ty) === T.ICE) {
        const [dx, dy] = DIRS[t.dir];
        if (this.canEnter(t.tx + dx, t.ty + dy, t)) {
          t.tx += dx; t.ty += dy; slid = true;
          if (!t.sliding) this.events.push({ type: 'slide', x: t.x, y: t.y, tank: t.id });
          t.sliding = true;
        }
      }
      if (!slid) t.sliding = false;
      t.arrived = false;
      if (!slid && t.want >= 0) {
        t.dir = t.want;
        if (!t.hold) {
          const [dx, dy] = DIRS[t.want];
          if (this.canEnter(t.tx + dx, t.ty + dy, t)) { t.tx += dx; t.ty += dy; }
        }
      }
    } else if (t.want >= 0 && t.want === (t.dir + 2) % 4) {
      // разворот на полпути
      const ox = t.fx, oy = t.fy;
      t.fx = t.tx; t.fy = t.ty; t.tx = ox; t.ty = oy;
      t.dir = t.want;
      t.sliding = false;
    }

    if (t.x !== t.tx || t.y !== t.ty) {
      const step = t.speed * (t.sliding ? 1.25 : 1) * dt;
      const dx = t.tx - t.x, dy = t.ty - t.y;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= step) { t.x = t.tx; t.y = t.ty; t.arrived = true; }
      else { t.x += Math.sign(dx) * step; t.y += Math.sign(dy) * step; }
      t.dist += Math.min(step, d);
    }

    // плавный поворот корпуса (только визуально)
    const target = t.dir * Math.PI / 2;
    const diff = ((target - t.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const turn = dt * 14;
    t.angle += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;

    if (t.fire && t.cd <= 0) this.fireShell(t);
    if (t.mine) { this.mineAction(t); t.mine = false; }
  }

  fireShell(t) {
    const [dx, dy] = DIRS[t.dir];
    const s = { x: t.x + dx * 0.5, y: t.y + dy * 0.5, dx, dy, owner: t.id, speed: 10, power: t.power, bounces: 0 };
    if (t.ricochet > 0) { s.bounces = 1; t.ricochet--; }
    this.shells.push(s);
    t.cd = t.reload;
    t.recoil = 1;
    this.events.push({ type: 'shot', x: t.x + dx * 0.62, y: t.y + dy * 0.62, dir: t.dir, tank: t.id });
  }

  // Кнопка «мина»: если на поле есть радиомина этого танка — подорвать, иначе поставить мину.
  hasRemote(t) { return this.mines.some(m => m.owner === t.id && m.remote); }

  mineAction(t) {
    if (this.hasRemote(t)) {
      for (const m of this.mines) if (m.owner === t.id && m.remote) m.timer = Math.min(m.timer, 0.05);
      this.events.push({ type: 'detonate', x: t.x, y: t.y, tank: t.id });
      return;
    }
    this.placeMine(t);
  }

  placeMine(t) {
    const x = Math.round(t.x), y = Math.round(t.y);
    if (this.mines.filter(m => m.owner === t.id && !m.barrel).length >= t.maxMines) return;
    if (this.mineAt(x, y)) return;
    const tt = this.tile(x, y);
    if (!this.walkable(tt)) return;
    const remote = t.remote > 0;
    if (remote) t.remote--;
    this.mines.push({ id: ++this.mineSeq, x, y, timer: remote ? 30 : 2.5, range: t.range, owner: t.id, age: 0, remote });
    this.events.push({ type: 'mine', x, y, tank: t.id, remote });
  }

  updateShells(dt) {
    const out = [];
    for (const s of this.shells) {
      let alive = true;
      const steps = 3, st = s.speed * dt / steps;
      for (let k = 0; k < steps && alive; k++) {
        s.x += s.dx * st; s.y += s.dy * st;
        const cx = Math.round(s.x), cy = Math.round(s.y);
        const tt = this.inb(cx, cy) ? this.tiles[this.idx(cx, cy)] : T.STEEL;
        if (tt === T.STEEL) {
          this.events.push({ type: 'spark', x: s.x, y: s.y });
          if (s.bounces > 0) {
            // рикошет: снаряд отражается назад
            s.bounces--;
            s.dx = -s.dx; s.dy = -s.dy;
            s.x += s.dx * st * 2; s.y += s.dy * st * 2;
            s.rico = true;
            continue;
          }
          alive = false; break;
        }
        if (tt === T.BRICK) { alive = false; this.hitBrick(cx, cy, s); break; }
        if (tt === T.BARREL) { alive = false; this.blowBarrel(cx, cy, s.owner, 0.02); break; }
        for (const t of this.tanks) {
          if (!t.alive || t.id === s.owner) continue;
          if (Math.abs(t.x - s.x) < 0.42 && Math.abs(t.y - s.y) < 0.42) {
            this.damage(t, s.power || 1, s.owner, s.x, s.y, 'shell');
            alive = false;
            break;
          }
        }
        if (!alive) break;
        const m = this.mineAt(cx, cy);
        if (m && Math.abs(s.x - cx) < 0.35 && Math.abs(s.y - cy) < 0.35) { m.timer = 0; alive = false; }
      }
      if (alive) out.push(s);
    }
    // снаряды сталкиваются друг с другом
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (!a.dead && !b.dead && Math.abs(a.x - b.x) < 0.3 && Math.abs(a.y - b.y) < 0.3) {
        a.dead = b.dead = true;
        this.events.push({ type: 'spark', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
    this.shells = out.filter(s => !s.dead);
  }

  hitBrick(x, y, s) {
    const i = this.idx(x, y);
    this.brickHp[i] -= Math.min(this.brickHp[i], (s && s.power) || 1);
    if (this.brickHp[i] <= 0) this.destroyBrick(x, y, s ? s.owner : -1);
    else {
      this.mapDirty = true;
      this.events.push({ type: 'brickhit', x: s ? s.x : x, y: s ? s.y : y });
    }
  }

  destroyBrick(x, y, by = -1) {
    const i = this.idx(x, y);
    this.tiles[i] = T.EMPTY;
    this.brickHp[i] = 0;
    this.mapDirty = true;
    this.events.push({ type: 'brickbreak', x, y, by });
    if (this.rand() < 0.3) this.bonuses.push({ x, y, type: this.randomBonus(), age: 0 });
  }

  randomBonus() {
    let total = 0;
    for (const k of BONUS_TYPES) total += BONUS_WEIGHTS[k];
    let v = this.rand() * total;
    for (const k of BONUS_TYPES) { v -= BONUS_WEIGHTS[k]; if (v <= 0) return k; }
    return BONUS_TYPES[0];
  }

  // Бочка с топливом: превращается в мгновенную мину с радиусом 2.
  blowBarrel(x, y, by, delay) {
    const i = this.idx(x, y);
    if (this.tiles[i] !== T.BARREL) return;
    this.tiles[i] = T.EMPTY;
    this.mapDirty = true;
    this.mines.push({ id: ++this.mineSeq, x, y, timer: delay, range: 2, owner: by, age: 0, barrel: true });
    this.events.push({ type: 'barrel', x, y, by });
  }

  updateMines(dt) {
    for (const m of this.mines) { m.timer -= dt; m.age += dt; }
    for (let guard = 0; guard < 60; guard++) {
      const m = this.mines.find(q => q.timer <= 0);
      if (!m) break;
      this.explode(m);
    }
  }

  explode(m) {
    this.mines.splice(this.mines.indexOf(m), 1);
    const g = ++this.fireGroup;
    const cells = [[m.x, m.y]];
    for (const [dx, dy] of DIRS) {
      for (let i = 1; i <= m.range; i++) {
        const x = m.x + dx * i, y = m.y + dy * i;
        const tt = this.tile(x, y);
        if (tt === T.STEEL) break;
        cells.push([x, y]);
        if (tt === T.BRICK) { this.destroyBrick(x, y, m.owner); break; }
        if (tt === T.BARREL) { this.blowBarrel(x, y, m.owner, 0.12); break; }
      }
    }
    for (const [x, y] of cells) {
      this.fires.push({ x, y, t: 0.5, max: 0.5, group: g, owner: m.owner });
      const o = this.mineAt(x, y);
      if (o) o.timer = Math.min(o.timer, 0.08); // цепная реакция
      this.bonuses = this.bonuses.filter(b => !(b.x === x && b.y === y && b.age > 0.3));
    }
    this.events.push({ type: 'explode', x: m.x, y: m.y, cells, barrel: !!m.barrel });
  }

  updateFires(dt) {
    for (const f of this.fires) f.t -= dt;
    this.fires = this.fires.filter(f => f.t > 0);
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const x = Math.round(t.x), y = Math.round(t.y);
      for (const f of this.fires) {
        if (f.x === x && f.y === y && f.t > f.max - 0.35 && !t.burned.has(f.group)) {
          t.burned.add(f.group);
          this.damage(t, 3, f.owner, t.x, t.y, 'blast');
          if (!t.alive) break;
        }
      }
    }
  }

  damage(t, n, by, x, y, kind = 'shell') {
    if (!t.alive) return;
    if (t.shield > 0 && kind !== 'crush') {
      this.events.push({ type: 'shieldHit', x, y, tank: t.id });
      return;
    }
    t.hp -= n;
    t.hitFlash = 0.25;
    this.events.push({ type: 'hit', x, y, tank: t.id, by, kind });
    const killer = by >= 0 && by !== t.id ? this.tanks[by] : null;
    if (t.hp <= 0) {
      t.hp = 0;
      t.alive = false;
      t.want = -1; t.fire = false;
      this.events.push({ type: 'dead', x: t.x, y: t.y, tank: t.id, by, kind });
      if (killer) { killer.kills++; this.addStars(killer, 3); }
    } else if (killer) this.addStars(killer, 1);
  }

  addStars(t, n) {
    if (!t.alive) return;
    t.stars += n;
    while (t.level < LEVELS.length && t.stars >= LEVELS[t.level].stars) {
      t.level++;
      if (t.level === 2) { t.maxHp++; t.hp++; }
      else if (t.level === 3) { t.power = 2; t.speed = Math.max(2.2, t.speed - 0.2); }
      else if (t.level === 4) { t.maxHp++; t.hp++; t.reload = Math.max(0.25, t.reload * 0.8); }
      this.events.push({ type: 'levelup', x: t.x, y: t.y, tank: t.id, level: t.level });
    }
  }

  pickBonus(t) {
    const i = this.bonuses.findIndex(b => b.x === t.tx && b.y === t.ty);
    if (i < 0) return;
    const b = this.bonuses[i];
    this.bonuses.splice(i, 1);
    if (b.type === 'mines') t.maxMines = Math.min(4, t.maxMines + 1);
    else if (b.type === 'range') t.range = Math.min(6, t.range + 1);
    else if (b.type === 'speed') t.speed = Math.min(4.6, t.speed + 0.5);
    else if (b.type === 'armor') { t.maxHp = Math.min(6, t.maxHp + 1); t.hp = Math.min(t.maxHp, t.hp + 1); }
    else if (b.type === 'rapid') t.reload = Math.max(0.25, t.reload * 0.75);
    else if (b.type === 'shield') t.shield = 4;
    else if (b.type === 'repair') t.hp = t.maxHp;
    else if (b.type === 'remote') t.remote = Math.min(6, t.remote + 3);
    else if (b.type === 'ricochet') t.ricochet = Math.min(16, t.ricochet + 8);
    this.events.push({ type: 'pickup', x: b.x, y: b.y, bonus: b.type, tank: t.id });
  }
}
