// ИИ ботов: убегать от взрывов, стрелять по линии, ставить мины с путём отхода, ломать кирпичи,
// собирать бонусы, взрывать бочки рядом с врагами, подрывать радиомины. Сила зависит от сложности.
import { W, T, DIRS } from './world.js?v=202611242311';

const key = (x, y) => y * W + x;
const rnd = (w, [a, b]) => a + w.rand() * (b - a);

function passable(w, x, y) {
  return w.walkable(w.tile(x, y)) && !w.mineAt(x, y);
}

export function blastCells(w, m) {
  const cells = [[m.x, m.y]];
  for (const [dx, dy] of DIRS) {
    for (let i = 1; i <= m.range; i++) {
      const x = m.x + dx * i, y = m.y + dy * i;
      const tt = w.tile(x, y);
      if (tt === T.STEEL) break;
      cells.push([x, y]);
      if (tt === T.BRICK || tt === T.BARREL) break;
    }
  }
  return cells;
}

// Клетки, которые скоро взорвутся: key -> секунд до взрыва (огонь = 0).
export function dangerMap(w) {
  if (w._dangerTime === w.time && w._danger) return w._danger;
  const d = new Map();
  for (const f of w.fires) d.set(key(f.x, f.y), 0);
  // радиомина может взорваться в любой момент — для всех считаем её «скорой»
  const ms = w.mines.map(m => ({ m, t: m.remote ? Math.min(m.timer, 1.5) : m.timer, cells: blastCells(w, m) }));
  // бочки, до которых дотянется взрыв, сами взорвутся следом
  for (const a of ms.slice()) {
    for (const [x, y] of a.cells) {
      if (w.tile(x, y) === T.BARREL) {
        const bm = { x, y, range: 2 };
        ms.push({ m: bm, t: a.t + 0.12, cells: blastCells(w, bm) });
      }
    }
  }
  for (let it = 0; it < 3; it++) {
    for (const a of ms) for (const [x, y] of a.cells) {
      const b = ms.find(o => o.m.x === x && o.m.y === y);
      if (b && b.t > a.t) b.t = a.t;
    }
  }
  for (const a of ms) for (const [x, y] of a.cells) {
    const k = key(x, y);
    const p = d.get(k);
    if (p === undefined || a.t < p) d.set(k, a.t);
  }
  // сжатие арены: ближайшие закрывающиеся клетки опасны
  for (const c of w.upcomingShrink(6)) {
    if (c.t > 4) continue;
    const k = key(c.x, c.y);
    const p = d.get(k);
    if (p === undefined || c.t < p) d.set(k, Math.max(0, c.t));
  }
  w._danger = d;
  w._dangerTime = w.time;
  return d;
}

function bfs(w, t, danger) {
  const sx = t.tx, sy = t.ty;
  const res = new Map();
  res.set(key(sx, sy), { x: sx, y: sy, d: 0, first: -1 });
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    const cur = res.get(key(x, y));
    if (cur.d >= 14) continue;
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
      if (!w.inb(nx, ny)) continue;
      const k = key(nx, ny);
      if (res.has(k) || !passable(w, nx, ny) || w.tankAt(nx, ny, t)) continue;
      if (danger) {
        const dt = danger.get(k);
        if (dt !== undefined && dt < (cur.d + 1) / t.speed + 0.35) continue;
      }
      res.set(k, { x: nx, y: ny, d: cur.d + 1, first: cur.first < 0 ? dir : cur.first });
      q.push([nx, ny]);
    }
  }
  return res;
}

function nearestSafe(nodes, danger) {
  let best = null;
  for (const n of nodes.values()) {
    if (danger.has(key(n.x, n.y))) continue;
    if (!best || n.d < best.d) best = n;
  }
  return best;
}

export function clearLine(w, x0, y0, x1, y1) {
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  let x = x0 + dx, y = y0 + dy;
  while (x !== x1 || y !== y1) {
    const tt = w.tile(x, y);
    if (tt === T.STEEL || tt === T.BRICK || tt === T.BARREL) return false;
    x += dx; y += dy;
  }
  return true;
}

function lineTarget(w, t, range, diff) {
  const x = Math.round(t.x), y = Math.round(t.y);
  let best = null;
  for (const e of w.tanks) {
    if (!e.alive || e === t) continue;
    const ex = Math.round(e.x), ey = Math.round(e.y);
    if (ex !== x && ey !== y) continue;
    const d = Math.abs(ex - x) + Math.abs(ey - y);
    if (d === 0 || d > range) continue;
    if (w.tile(ex, ey) === T.BUSH && d > 2) continue; // в кустах не видно
    if (!clearLine(w, x, y, ex, ey)) continue;
    const dir = ex > x ? 1 : ex < x ? 3 : ey > y ? 2 : 0;
    const prio = d - (diff.focusHuman && w.humans.includes(e.id) ? 3 : 0);
    if (!best || prio < best.prio) best = { dir, d, e, prio };
  }
  return best;
}

// Бочка на линии огня, взрыв которой заденет врага, но не самого бота.
function barrelTarget(w, t) {
  const x = Math.round(t.x), y = Math.round(t.y);
  for (let dir = 0; dir < 4; dir++) {
    const [dx, dy] = DIRS[dir];
    for (let i = 1; i <= 7; i++) {
      const bx = x + dx * i, by = y + dy * i;
      const tt = w.tile(bx, by);
      if (tt === T.BARREL) {
        const cells = blastCells(w, { x: bx, y: by, range: 2 });
        const inCells = (px, py) => cells.some(([cx, cy]) => cx === px && cy === py);
        if (inCells(x, y)) break;
        if (w.tanks.some(e => e.alive && e !== t && inCells(Math.round(e.x), Math.round(e.y)))) return dir;
        break;
      }
      if (tt === T.STEEL || tt === T.BRICK) break;
    }
  }
  return -1;
}

function adjBrickDir(w, x, y) {
  for (let d = 0; d < 4; d++) if (w.tile(x + DIRS[d][0], y + DIRS[d][1]) === T.BRICK) return d;
  return -1;
}

function enemyInBlast(w, t) {
  const cells = blastCells(w, { x: t.tx, y: t.ty, range: t.range });
  return w.tanks.some(e => e.alive && e !== t &&
    cells.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y)));
}

function tryMine(w, t, danger, diff) {
  if (w.hasRemote(t)) return false;
  if (w.mines.filter(m => m.owner === t.id && !m.barrel).length >= t.maxMines) return false;
  if (w.mineAt(t.tx, t.ty)) return false;
  const d2 = new Map(danger);
  for (const [x, y] of blastCells(w, { x: t.tx, y: t.ty, range: t.range })) {
    const k = key(x, y);
    const p = d2.get(k);
    if (p === undefined || p > 2.5) d2.set(k, 2.5);
  }
  const safe = nearestSafe(bfs(w, t, d2), d2);
  if (!safe || safe.d === 0 || safe.d / t.speed > 1.9) return false;
  t.mine = true;
  t.hold = false;
  t.want = safe.first;
  t.ai.mineCd = rnd(w, diff.mineCd);
  return true;
}

// Подорвать свою радиомину, если враг в зоне взрыва, а сам бот — нет.
function remoteCheck(w, t) {
  const x = Math.round(t.x), y = Math.round(t.y);
  for (const m of w.mines) {
    if (m.owner !== t.id || !m.remote) continue;
    const cells = blastCells(w, m);
    const inCells = (px, py) => cells.some(([cx, cy]) => cx === px && cy === py);
    if (inCells(x, y)) continue;
    const enemyIn = w.tanks.some(e => e.alive && e !== t && inCells(Math.round(e.x), Math.round(e.y)));
    if (enemyIn || m.age > 8) return true;
  }
  return false;
}

export function botThink(w, t, dt) {
  // diffOverride — сила бота, играющего за человека (режим отладки ?auto=1 и тесты)
  const diff = t.diffOverride || w.diff;
  const ai = t.ai || (t.ai = {
    aim: 0, mineCd: rnd(w, diff.mineCd), jitter: new Map(), jt: 0, react: rnd(w, diff.react), dangerSince: -1,
  });
  ai.mineCd -= dt;
  ai.jt -= dt;
  t.fire = false;
  t.mine = false;
  const calm = w.time < w.peace; // обучение: боты пока не нападают

  if (!calm && w.hasRemote(t) && remoteCheck(w, t)) t.mine = true;

  const atCenter = t.x === t.tx && t.y === t.ty;
  if (!atCenter) {
    if (!calm) {
      const lt = lineTarget(w, t, diff.range, diff);
      if (lt && lt.dir === t.dir) t.fire = true;
    }
    return;
  }

  const danger = dangerMap(w);
  if (danger.has(key(t.tx, t.ty))) {
    if (ai.dangerSince < 0) ai.dangerSince = w.time;
    // на лёгкой сложности бот замечает опасность с опозданием
    if (w.time - ai.dangerSince >= diff.fleeDelay) {
      const safe = nearestSafe(bfs(w, t, danger), danger);
      t.hold = false;
      t.want = safe ? safe.first : -1;
      ai.aim = 0;
      return;
    }
  } else ai.dangerSince = -1;

  if (!calm) {
    const lt = lineTarget(w, t, diff.range, diff);
    if (lt) {
      if (lt.d <= t.range && ai.mineCd <= 0 && tryMine(w, t, danger, diff)) return;
      t.hold = true;
      t.want = lt.dir;
      if (t.dir === lt.dir) { ai.aim += dt; if (ai.aim > ai.react) t.fire = true; }
      else ai.aim = 0;
      return;
    }
    const bdir = barrelTarget(w, t);
    if (bdir >= 0) {
      t.hold = true;
      t.want = bdir;
      if (t.dir === bdir) { ai.aim += dt; if (ai.aim > ai.react) t.fire = true; }
      return;
    }
  }
  ai.aim = 0;

  if (ai.mineCd <= 0) {
    const nearBrick = adjBrickDir(w, t.tx, t.ty) >= 0;
    const wantMine = (!calm && enemyInBlast(w, t)) || (nearBrick && w.rand() < 0.25);
    if (wantMine && tryMine(w, t, danger, diff)) return;
  }

  if (ai.jt <= 0) { ai.jitter = new Map(); ai.jt = 2.5; }
  const enemies = w.tanks.filter(e => e.alive && e !== t);
  const nodes = bfs(w, t, danger);
  let best = null;
  for (const n of nodes.values()) {
    const nk = key(n.x, n.y);
    if (danger.has(nk)) continue;
    let s = -n.d;
    if (w.bonuses.some(b => b.x === n.x && b.y === n.y)) s += 12;
    if (w.tile(n.x, n.y) === T.ICE) s -= 0.5;
    let minE = 99;
    if (!calm) {
      for (const e of enemies) {
        const ex = Math.round(e.x), ey = Math.round(e.y);
        const md = Math.abs(ex - n.x) + Math.abs(ey - n.y);
        minE = Math.min(minE, md);
        if ((ex === n.x || ey === n.y) && md > 1 && md <= 8 && clearLine(w, n.x, n.y, ex, ey)) {
          s += 7 + (diff.focusHuman && w.humans.includes(e.id) ? 3 : 0);
        }
      }
      s -= minE * 0.35;
    }
    if (adjBrickDir(w, n.x, n.y) >= 0) s += 2;
    if (!ai.jitter.has(nk)) ai.jitter.set(nk, w.rand() * 3);
    s += ai.jitter.get(nk);
    if (!best || s > best.s) best = { s, n };
  }

  if (!best || best.n.d === 0) {
    const bd = adjBrickDir(w, t.tx, t.ty);
    if (bd >= 0) { t.hold = true; t.want = bd; if (t.dir === bd) t.fire = true; return; }
    t.want = -1; t.hold = false;
    return;
  }
  t.hold = false;
  t.want = best.n.first;
}
