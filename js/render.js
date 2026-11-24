// Отрисовка кодом: земля, бетон, кирпич, вода, кусты, танки, мины, взрывы, частицы.
import { W, T, TANK_INFO, LEVELS, SKINS } from './world.js?v=202611242311';

const BRICK_COLORS = ['#9a5236', '#8d4a30', '#a65a3c', '#874630', '#93503a'];
const BONUS_STYLE = {
  mines:    { color: '#c0392b', glyph: '+1' },
  range:    { color: '#e67e22', glyph: '↔' },
  speed:    { color: '#2e86c1', glyph: '»' },
  armor:    { color: '#27ae60', glyph: '✚' },
  rapid:    { color: '#d4ac0d', glyph: 'ϟ' },
  shield:   { color: '#1f9bd1', glyph: '◯' },
  repair:   { color: '#d6457a', glyph: '♥︎' },
  remote:   { color: '#8e44ad', glyph: '⊙' },
  ricochet: { color: '#16a085', glyph: '↺' },
};

// Палитры арен.
const PALETTES = {
  field: {
    ground: '#7b6f50', grain: ['#857858', '#71664a', '#8e8263', '#665c42', '#958a6a'],
    patchA: 'rgba(92,110,56,0.26)', patchB: 'rgba(64,54,36,0.2)', grass: true,
    road: 'rgba(150,134,98,0.4)', rut: 'rgba(70,58,38,0.3)', stones: ['#9c937c', '#857d69'],
    tufts: 130, puddles: 6, cracks: 9, debris: 26,
    bricks: BRICK_COLORS, mortar: '#5a3222', brickSide: '#4a281b', brickSideA: '#6e3a26', brickSideB: '#643421',
  },
  city: {
    ground: '#5f6163', grain: ['#686a6c', '#56595b', '#717375', '#4f5254', '#7a7c7e'],
    patchA: 'rgba(40,42,44,0.28)', patchB: 'rgba(120,122,122,0.18)', grass: false,
    road: 'rgba(38,40,42,0.55)', rut: 'rgba(235,235,225,0.75)', stones: ['#8d8f90', '#707274'],
    tufts: 25, puddles: 9, cracks: 18, debris: 34,
    bricks: ['#8a5a4a', '#7b4e40', '#94604f', '#704638', '#865848'], mortar: '#4a3a33', brickSide: '#3e2e28', brickSideA: '#5c4036', brickSideB: '#523830',
  },
  winter: {
    ground: '#d6dfe5', grain: ['#e4ebf0', '#c9d4dc', '#f1f5f8', '#bfcbd4', '#dbe3e9'],
    patchA: 'rgba(255,255,255,0.45)', patchB: 'rgba(150,170,185,0.22)', grass: false,
    road: 'rgba(170,186,198,0.45)', rut: 'rgba(110,128,145,0.35)', stones: ['#8c969e', '#737d85'],
    tufts: 0, puddles: 0, cracks: 3, debris: 10, snow: true,
    bricks: BRICK_COLORS, mortar: '#5a3222', brickSide: '#4a281b', brickSideA: '#6e3a26', brickSideB: '#643421',
  },
  desert: {
    ground: '#c7a66a', grain: ['#d1b378', '#bd9c5f', '#d9bd85', '#b28e54', '#cdac6f'],
    patchA: 'rgba(160,120,70,0.2)', patchB: 'rgba(232,208,155,0.32)', grass: false,
    road: 'rgba(176,146,98,0.35)', rut: 'rgba(130,100,60,0.3)', stones: ['#b69a6c', '#9a7f55'],
    tufts: 40, puddles: 0, cracks: 6, debris: 14, dunes: true,
    bricks: ['#c99a62', '#b8895a', '#d2a56c', '#ad7f4f', '#c39460'], mortar: '#8a6a42', brickSide: '#7a5a36', brickSideA: '#a07646', brickSideB: '#946c40',
  },
};

function hash(a, b) {
  let h = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function layer(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, x };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.shake = 0;
    this.world = null;
    this.stamps = new Map();
    this.resize();
  }

  resize() {
    const st = this.cv.parentElement;
    const cw = st.clientWidth, ch = st.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = cw; this.ch = ch;
    this.ts = Math.max(8, Math.floor(Math.min(cw, ch) / W));
    this.bw = this.ts * W;
    this.ox = Math.floor((cw - this.bw) / 2);
    this.oy = Math.floor((ch - this.bw) / 2);
    if (this.world) this.rebuild(true);
  }

  reset(world) {
    this.world = world;
    this.P = PALETTES[world.theme] || PALETTES.field;
    this.parts = [];
    this.shake = 0;
    this.stamps = new Map();
    this.rebuild(true);
  }

  rebuild(full) {
    const bw = this.bw;
    if (full || !this.ground) {
      this.ground = layer(bw, bw, this.dpr);
      this.paintGround(this.ground.x);
      this.decals = layer(bw, bw, this.dpr);
    }
    this.tilesL = layer(bw, bw, this.dpr);
    this.paintTiles(this.tilesL.x);
    this.world.mapDirty = false;
  }

  // ---------- статичные слои ----------
  paintGround(g) {
    const bw = this.bw, s = this.ts, P = this.P || PALETTES.field, th = this.world.theme;
    g.fillStyle = P.ground;
    g.fillRect(0, 0, bw, bw);

    // лёгкая разница оттенка по клеткам
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const h = hash(x * 3 + 1, y * 5 + 2);
      g.fillStyle = h < 0.5 ? `rgba(255,240,200,${0.02 + h * 0.06})` : `rgba(30,24,10,${(h - 0.5) * 0.12})`;
      g.fillRect(x * s, y * s, s, s);
    }

    // дороги крест-накрест через центр
    const mid = Math.floor(W / 2) * s;
    g.fillStyle = P.road;
    g.fillRect(0, mid + s * 0.08, bw, s * 0.84);
    g.fillRect(mid + s * 0.08, 0, s * 0.84, bw);
    if (th === 'city') {
      // разметка: прерывистая линия по оси и зебра у перекрёстка
      g.strokeStyle = P.rut;
      g.lineWidth = Math.max(1.5, s * 0.05);
      g.setLineDash([s * 0.4, s * 0.3]);
      g.beginPath(); g.moveTo(0, mid + s * 0.5); g.lineTo(bw, mid + s * 0.5); g.stroke();
      g.beginPath(); g.moveTo(mid + s * 0.5, 0); g.lineTo(mid + s * 0.5, bw); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(235,235,225,0.6)';
      for (let i = 0; i < 5; i++) {
        g.fillRect(mid - s * 0.9, mid + s * (0.15 + i * 0.15), s * 0.7, s * 0.07);
        g.fillRect(mid + s * (0.15 + i * 0.15), mid - s * 0.9, s * 0.07, s * 0.7);
      }
      g.fillStyle = 'rgba(150,150,145,0.5)';
      g.fillRect(0, mid + s * 0.04, bw, Math.max(1, s * 0.04));
      g.fillRect(0, mid + s * 0.92, bw, Math.max(1, s * 0.04));
      g.fillRect(mid + s * 0.04, 0, Math.max(1, s * 0.04), bw);
      g.fillRect(mid + s * 0.92, 0, Math.max(1, s * 0.04), bw);
    } else {
      g.strokeStyle = P.rut;
      g.lineWidth = Math.max(1.5, s * 0.07);
      g.setLineDash([s * 0.5, s * 0.14]);
      for (const o of [0.3, 0.7]) {
        g.beginPath(); g.moveTo(0, mid + s * o); g.lineTo(bw, mid + s * o); g.stroke();
        g.beginPath(); g.moveTo(mid + s * o, 0); g.lineTo(mid + s * o, bw); g.stroke();
      }
      g.setLineDash([]);
    }

    // пятна (на поле — с травой)
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * bw, y = Math.random() * bw, r = s * (0.7 + Math.random() * 1.6);
      const a = Math.random() < 0.6;
      g.fillStyle = a ? P.patchA : P.patchB;
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, Math.random() * 3, 0, Math.PI * 2); g.fill();
      if (a && P.grass) {
        g.strokeStyle = 'rgba(86,108,50,0.75)';
        g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < 26; k++) {
          const an = Math.random() * Math.PI * 2, d = Math.random() * r * 0.85;
          const bx = x + Math.cos(an) * d, by = y + Math.sin(an) * d * 0.7;
          g.moveTo(bx, by);
          g.lineTo(bx + (Math.random() - 0.5) * 3, by - s * (0.06 + Math.random() * 0.09));
        }
        g.stroke();
      }
    }

    // зернистость
    const n = (bw * bw) / 6;
    for (let i = 0; i < n; i++) {
      g.fillStyle = P.grain[i % P.grain.length];
      g.globalAlpha = 0.35 + Math.random() * 0.4;
      const sz = Math.random() < 0.9 ? 1 : 2;
      g.fillRect(Math.random() * bw, Math.random() * bw, sz, sz);
    }
    g.globalAlpha = 1;

    // сугробы со следами (зима)
    if (P.snow) {
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * bw, y = Math.random() * bw, r = s * (0.25 + Math.random() * 0.5);
        g.fillStyle = 'rgba(120,140,160,0.25)';
        g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.25, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(110,128,145,0.3)';
      for (let i = 0; i < 4; i++) {
        let x = Math.random() * bw, y = Math.random() * bw;
        const ang = Math.random() * Math.PI * 2;
        for (let k = 0; k < 10; k++) {
          g.beginPath(); g.ellipse(x + (k % 2) * 3, y, 1.6, 2.4, ang, 0, Math.PI * 2); g.fill();
          x += Math.cos(ang) * s * 0.18; y += Math.sin(ang) * s * 0.18;
        }
      }
    }

    // песчаная рябь (пустыня)
    if (P.dunes) {
      g.strokeStyle = 'rgba(140,105,60,0.28)';
      g.lineWidth = 1;
      for (let i = 0; i < 46; i++) {
        const x = Math.random() * bw, y = Math.random() * bw, len = s * (0.6 + Math.random() * 1.2);
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y - s * 0.08, x + len * 0.6, y + s * 0.08, x + len, y);
        g.stroke();
      }
    }

    // лужи с бликом
    for (let i = 0; i < P.puddles; i++) {
      const x = Math.random() * bw, y = Math.random() * bw, r = s * (0.18 + Math.random() * 0.22);
      g.fillStyle = 'rgba(52,46,32,0.5)';
      g.beginPath(); g.ellipse(x, y, r * 1.15, r * 0.75, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = th === 'city' ? 'rgba(60,72,82,0.8)' : 'rgba(70,96,108,0.75)';
      g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(210,230,235,0.35)';
      g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.15, r * 0.3, r * 0.1, 0.3, 0, Math.PI * 2); g.fill();
    }

    // канализационные люки (город)
    if (th === 'city') {
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * bw, y = Math.random() * bw, r = s * 0.16;
        g.fillStyle = '#3c3e40';
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#7d8082';
        g.lineWidth = 1;
        g.stroke();
        g.beginPath();
        for (let k = -2; k <= 2; k++) { g.moveTo(x - r * 0.8, y + k * r * 0.3); g.lineTo(x + r * 0.8, y + k * r * 0.3); }
        g.stroke();
      }
    }

    // камни с тенью
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * bw, y = Math.random() * bw, r = Math.random() * s * 0.08 + 1;
      g.fillStyle = 'rgba(30,26,18,0.4)';
      g.beginPath(); g.ellipse(x + r * 0.5, y + r * 0.6, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = Math.random() < 0.5 ? P.stones[0] : P.stones[1];
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    }

    // пучки травы
    g.lineWidth = 1;
    for (let i = 0; i < P.tufts; i++) {
      const x = Math.random() * bw, y = Math.random() * bw;
      g.strokeStyle = th === 'desert' ? 'rgba(150,120,60,0.8)' : (Math.random() < 0.6 ? 'rgba(96,112,58,0.75)' : 'rgba(150,140,88,0.75)');
      g.beginPath();
      for (let k = -1; k <= 1; k++) {
        g.moveTo(x + k * 1.5, y);
        g.lineTo(x + k * 3 + (Math.random() - 0.5) * 2, y - s * (0.08 + Math.random() * 0.1));
      }
      g.stroke();
    }

    // трещины
    g.strokeStyle = th === 'winter' ? 'rgba(120,140,160,0.3)' : 'rgba(40,34,24,0.28)';
    for (let i = 0; i < P.cracks; i++) {
      let x = Math.random() * bw, y = Math.random() * bw;
      g.lineWidth = 1 + Math.random();
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * s * 1.2; y += (Math.random() - 0.5) * s * 1.2; g.lineTo(x, y); }
      g.stroke();
    }

    // мелкий мусор войны: доски, гильзы, железки
    for (let i = 0; i < P.debris; i++) {
      const x = Math.random() * bw, y = Math.random() * bw, k = Math.random();
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * Math.PI);
      if (k < 0.4) { g.fillStyle = '#6b5334'; g.fillRect(-s * 0.12, -s * 0.02, s * 0.24, s * 0.04); }
      else if (k < 0.75) { g.fillStyle = '#b89a4a'; g.fillRect(-s * 0.04, -1, s * 0.08, 2); }
      else { g.fillStyle = '#4a4640'; g.fillRect(-s * 0.06, -s * 0.03, s * 0.12, s * 0.06); }
      g.restore();
    }
  }

  paintTiles(g) {
    const w = this.world, s = this.ts;
    // лёд лежит на земле, его рисуем первым
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (w.tile(x, y) === T.ICE) this.drawIce(g, x * s, y * s, s, x, y);
    }
    // тени всех стен, потом сами стены — чтобы тень не ложилась на соседний блок
    g.fillStyle = 'rgba(0,0,0,0.33)';
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const t = w.tile(x, y);
      if (t === T.STEEL || t === T.BRICK) g.fillRect(x * s + s * 0.1, y * s + s * 0.12, s, s);
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const t = w.tile(x, y);
      if (t === T.STEEL) this.drawConcrete(g, x * s, y * s, s, x, y);
      else if (t === T.BRICK) this.drawBrick(g, x * s, y * s, s, x, y, w.brickHp[w.idx(x, y)]);
      else if (t === T.BARREL) this.drawBarrel(g, x * s, y * s, s, x, y);
    }
  }

  snowCap(g, x0, y0, s, top, tx, ty) {
    g.fillStyle = 'rgba(250,252,255,0.95)';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 + s, y0);
    const n = 5;
    for (let i = n; i >= 0; i--) {
      const px = x0 + (s / n) * i;
      g.lineTo(px, y0 + top * (0.25 + hash(tx * 7 + i, ty * 3) * 0.3));
    }
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(160,180,200,0.35)';
    g.fillRect(x0, y0 + top * 0.22, s, Math.max(1, s * 0.02));
  }

  // Бетонный блок: верхняя грань + тёмная боковая (даёт высоту).
  drawConcrete(g, x0, y0, s, tx, ty) {
    const h = s * 0.17, top = s - h;
    const v = hash(tx * 17 + 3, ty * 29 + 5);
    const th = this.world.theme;
    g.fillStyle = '#4e5256';
    g.fillRect(x0, y0 + top, s, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x0, y0 + top + h * 0.5, s, Math.max(1, s * 0.02));
    g.fillRect(x0 + s * 0.5, y0 + top, Math.max(1, s * 0.02), h);
    const gr = g.createLinearGradient(x0, y0, x0 + s, y0 + top);
    gr.addColorStop(0, th === 'desert' ? '#b0a58f' : '#9da1a5');
    gr.addColorStop(1, th === 'desert' ? '#8f846e' : '#7c8084');
    g.fillStyle = gr;
    g.fillRect(x0, y0, s, top);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x0, y0, s, Math.max(1, s * 0.05));
    g.fillRect(x0, y0, Math.max(1, s * 0.05), top);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x0 + s - Math.max(1, s * 0.05), y0, Math.max(1, s * 0.05), top);
    g.strokeStyle = 'rgba(60,64,68,0.6)';
    g.lineWidth = 1;
    g.strokeRect(x0 + s * 0.16 + 0.5, y0 + s * 0.14 + 0.5, s * 0.68, top - s * 0.28);

    if (v < 0.22) {
      g.save();
      g.beginPath(); g.rect(x0 + s * 0.16, y0 + top * 0.36, s * 0.68, top * 0.26); g.clip();
      g.fillStyle = '#c9a227';
      g.fillRect(x0, y0, s, s);
      g.strokeStyle = '#2a2a26';
      g.lineWidth = s * 0.07;
      g.beginPath();
      for (let i = -2; i < 8; i++) { g.moveTo(x0 + i * s * 0.16, y0 + top); g.lineTo(x0 + i * s * 0.16 + s * 0.4, y0); }
      g.stroke();
      g.restore();
    } else if (v < 0.5) {
      g.strokeStyle = 'rgba(40,42,44,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0 + s * 0.2, y0 + s * 0.05);
      g.lineTo(x0 + s * 0.42, y0 + top * 0.4);
      g.lineTo(x0 + s * 0.36, y0 + top * 0.7);
      g.lineTo(x0 + s * 0.6, y0 + top);
      g.stroke();
      if (th !== 'desert' && th !== 'winter') {
        g.fillStyle = 'rgba(86,112,52,0.55)';
        g.beginPath(); g.ellipse(x0 + s * 0.78, y0 + top * 0.8, s * 0.14, s * 0.08, 0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(x0 + s * 0.14, y0 + top * 0.9, s * 0.09, s * 0.05, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (v < 0.7) {
      g.fillStyle = '#6a6e72';
      g.beginPath(); g.arc(x0 + s * 0.5, y0 + top * 0.5, s * 0.19, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3f4346';
      g.lineWidth = Math.max(1, s * 0.03);
      g.stroke();
      g.beginPath();
      g.moveTo(x0 + s * 0.36, y0 + top * 0.5); g.lineTo(x0 + s * 0.64, y0 + top * 0.5);
      g.moveTo(x0 + s * 0.5, y0 + top * 0.5 - s * 0.14); g.lineTo(x0 + s * 0.5, y0 + top * 0.5 + s * 0.14);
      g.stroke();
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = 'rgba(50,52,54,0.3)';
      g.fillRect(x0 + s * (0.1 + hash(tx * 9 + i, ty) * 0.75), y0 + top * (0.1 + hash(tx, ty * 9 + i) * 0.75), 2, 2);
    }
    g.fillStyle = '#c9cdd1';
    for (const [a, b] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
      g.beginPath(); g.arc(x0 + s * a, y0 + top * b, Math.max(1, s * 0.035), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [a, b] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
      g.beginPath(); g.arc(x0 + s * a + 1, y0 + top * b + 1, Math.max(0.6, s * 0.018), 0, Math.PI * 2); g.fill();
    }
    if (th === 'winter') this.snowCap(g, x0, y0, s, top, tx, ty);
  }

  // Кирпичная стена (в пустыне — песчаник): кладка сверху + боковая грань.
  drawBrick(g, x0, y0, s, tx, ty, hp) {
    const P = this.P || PALETTES.field, th = this.world.theme;
    const h = s * 0.17, top = s - h;
    g.fillStyle = P.brickSide;
    g.fillRect(x0, y0 + top, s, h);
    const fb = s / 3;
    for (let c = 0; c < 3; c++) {
      g.fillStyle = c % 2 ? P.brickSideA : P.brickSideB;
      g.fillRect(x0 + c * fb + 1, y0 + top + 1, fb - 2, h - 2);
    }
    g.fillStyle = P.mortar;
    g.fillRect(x0, y0, s, top);
    const rows = th === 'desert' ? 3 : 4, rh = top / rows, bwid = th === 'desert' ? s / 1.6 : s / 2;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? -bwid / 2 : 0;
      for (let c = 0; c < 3; c++) {
        const bx = x0 + off + c * bwid, by = y0 + r * rh;
        const l = Math.max(bx, x0), rgt = Math.min(bx + bwid, x0 + s);
        if (rgt - l < 2) continue;
        const k = hash(tx * 7 + c, ty * 5 + r);
        if (hp === 1 && k < 0.3) {
          g.fillStyle = '#2a1810';
          g.fillRect(l + 1, by + 1, rgt - l - 2, rh - 2);
          continue;
        }
        g.fillStyle = P.bricks[Math.floor(k * P.bricks.length)];
        g.fillRect(l + 1, by + 1, rgt - l - 2, rh - 2);
        g.fillStyle = 'rgba(255,225,195,0.16)';
        g.fillRect(l + 1, by + 1, rgt - l - 2, Math.max(1, rh * 0.2));
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(l + 1, by + rh - 1 - Math.max(1, rh * 0.14), rgt - l - 2, Math.max(1, rh * 0.14));
        if (k > 0.86) { g.fillStyle = 'rgba(40,20,12,0.35)'; g.fillRect(l + (rgt - l) * 0.4, by + rh * 0.3, 2, 2); }
      }
    }
    if (th === 'field' && hash(tx * 31, ty * 13) < 0.3) {
      g.fillStyle = 'rgba(80,104,48,0.4)';
      g.beginPath(); g.ellipse(x0 + s * 0.2, y0 + top * 0.92, s * 0.16, s * 0.06, 0, 0, Math.PI * 2); g.fill();
    }
    if (th === 'city' && hash(tx * 11, ty * 19) < 0.25) {
      // граффити-полоса
      g.fillStyle = hash(tx, ty) < 0.5 ? 'rgba(200,70,60,0.55)' : 'rgba(70,150,200,0.55)';
      g.fillRect(x0 + s * 0.15, y0 + top * 0.45, s * 0.7, Math.max(2, s * 0.08));
    }
    if (hp === 1) {
      g.strokeStyle = 'rgba(25,12,8,0.85)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x0 + s * 0.2, y0 + top * 0.08);
      g.lineTo(x0 + s * 0.45, y0 + top * 0.45);
      g.lineTo(x0 + s * 0.35, y0 + top * 0.8);
      g.moveTo(x0 + s * 0.45, y0 + top * 0.45);
      g.lineTo(x0 + s * 0.82, y0 + top * 0.62);
      g.stroke();
      g.fillStyle = 'rgba(20,14,10,0.3)';
      g.fillRect(x0, y0, s, top);
    }
    if (th === 'winter') this.snowCap(g, x0, y0, s, top, tx, ty);
  }

  // Лёд: гладкий, с трещинами и бликами.
  drawIce(g, x0, y0, s, tx, ty) {
    const gr = g.createLinearGradient(x0, y0, x0 + s, y0 + s);
    gr.addColorStop(0, '#cfe8f3');
    gr.addColorStop(1, '#9fc9dc');
    g.fillStyle = gr;
    rr(g, x0 + 1, y0 + 1, s - 2, s - 2, s * 0.12);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 + s * 0.15, y0 + s * 0.3); g.lineTo(x0 + s * 0.4, y0 + s * 0.15);
    g.moveTo(x0 + s * 0.55, y0 + s * 0.8); g.lineTo(x0 + s * 0.85, y0 + s * 0.6);
    g.stroke();
    g.strokeStyle = 'rgba(80,130,160,0.45)';
    g.beginPath();
    const cx = x0 + s * (0.3 + hash(tx, ty) * 0.4), cy = y0 + s * (0.3 + hash(ty, tx) * 0.4);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + hash(tx * 3, ty * 5 + i) * 1.2;
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * s * 0.35, cy + Math.sin(a) * s * 0.35);
    }
    g.stroke();
    g.strokeStyle = 'rgba(120,170,195,0.6)';
    rr(g, x0 + 1, y0 + 1, s - 2, s - 2, s * 0.12);
    g.stroke();
  }

  // Бочка с топливом (вид сверху).
  drawBarrel(g, x0, y0, s, tx, ty) {
    const cx = x0 + s * 0.5, cy = y0 + s * 0.48, r = s * 0.33;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(cx + s * 0.08, cy + s * 0.1, r, r * 0.95, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#e25b45');
    gr.addColorStop(1, '#8a2418');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4e130b';
    g.lineWidth = Math.max(1, s * 0.035);
    g.stroke();
    g.strokeStyle = 'rgba(60,15,8,0.7)';
    g.lineWidth = Math.max(1, s * 0.025);
    g.beginPath(); g.arc(cx, cy, r * 0.72, 0, Math.PI * 2); g.stroke();
    // крышка-пробка и знак огня
    g.fillStyle = '#c9cdd1';
    g.beginPath(); g.arc(cx + r * 0.42, cy - r * 0.38, r * 0.13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c230';
    g.beginPath();
    g.moveTo(cx, cy - r * 0.42);
    g.lineTo(cx + r * 0.36, cy + r * 0.26);
    g.lineTo(cx - r * 0.36, cy + r * 0.26);
    g.closePath();
    g.fill();
    g.fillStyle = '#2a2a26';
    g.font = `bold ${Math.round(s * 0.2)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', cx, cy + r * 0.04);
    if (this.world.theme === 'winter') {
      g.fillStyle = 'rgba(250,252,255,0.9)';
      g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.55, r * 0.4, r * 0.18, -0.3, 0, Math.PI * 2); g.fill();
    }
  }

  // ---------- динамика ----------
  drawWater(ctx, x0, y0, s, now, tx, ty) {
    const th = this.world.theme;
    ctx.fillStyle = th === 'desert' ? '#8c7a4a' : th === 'city' ? '#4a4c4e' : '#5a5136';
    rr(ctx, x0 + s * 0.01, y0 + s * 0.01, s * 0.98, s * 0.98, s * 0.2);
    ctx.fill();
    ctx.fillStyle = th === 'desert' ? '#6f7a3c' : th === 'city' ? '#3a3c3e' : '#48512f';
    rr(ctx, x0 + s * 0.05, y0 + s * 0.05, s * 0.9, s * 0.9, s * 0.2);
    ctx.fill();
    const g = ctx.createRadialGradient(x0 + s * 0.5, y0 + s * 0.5, s * 0.05, x0 + s * 0.5, y0 + s * 0.5, s * 0.55);
    g.addColorStop(0, th === 'desert' ? '#1c5f66' : '#1f4755');
    g.addColorStop(1, th === 'desert' ? '#3a8a8a' : '#356a78');
    ctx.fillStyle = g;
    rr(ctx, x0 + s * 0.1, y0 + s * 0.1, s * 0.8, s * 0.8, s * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,225,235,0.3)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const yy = y0 + s * (0.3 + k * 0.2) + Math.sin(now / 650 + tx * 1.7 + k * 2 + ty) * s * 0.04;
      const sh = Math.sin(now / 900 + k + tx) * s * 0.05;
      ctx.beginPath();
      ctx.moveTo(x0 + s * 0.22 + sh, yy);
      ctx.quadraticCurveTo(x0 + s * 0.5 + sh, yy - s * 0.06, x0 + s * 0.78 + sh, yy);
      ctx.stroke();
    }
    const tw = 0.5 + 0.5 * Math.sin(now / 300 + tx * 3 + ty);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.4})`;
    ctx.fillRect(x0 + s * (0.3 + hash(tx, ty) * 0.3), y0 + s * 0.36, Math.max(1.5, s * 0.05), 1.5);
    ctx.fillRect(x0 + s * (0.45 + hash(ty, tx) * 0.2), y0 + s * 0.62, Math.max(1.5, s * 0.04), 1.5);
    if (th !== 'city') {
      ctx.strokeStyle = '#5d7a35';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = hash(tx * 3 + i, ty * 7), sway = Math.sin(now / 700 + i + tx) * s * 0.02;
        const bx = x0 + s * (0.12 + a * 0.2), by = y0 + s * (0.86 - i * 0.03);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + sway + (i - 2) * s * 0.012, by - s * (0.16 + a * 0.12));
      }
      ctx.stroke();
    }
  }

  // Укрытие: куст (поле), маскировочная сеть (город), ель (зима), сухой кустарник (пустыня).
  drawBush(ctx, x0, y0, s, tx, ty, alpha, now = 0) {
    const th = this.world.theme;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x0 + s * 0.58, y0 + s * 0.62, s * 0.5, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;

    if (th === 'city') {
      // натянутая маскировочная сеть на шестах
      ctx.fillStyle = '#4d5a33';
      rr(ctx, x0 + s * 0.02, y0 + s * 0.04, s * 0.96, s * 0.92, s * 0.08);
      ctx.fill();
      ctx.save();
      rr(ctx, x0 + s * 0.02, y0 + s * 0.04, s * 0.96, s * 0.92, s * 0.08);
      ctx.clip();
      const cols = ['#6b6a3c', '#3a4426', '#7a6a44', '#56643a'];
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = cols[i % cols.length];
        const a = hash(tx * 5 + i, ty * 9), b = hash(tx * 13, ty * 3 + i);
        ctx.beginPath(); ctx.ellipse(x0 + s * a, y0 + s * b, s * 0.2, s * 0.12, a * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(30,30,20,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -1; k < 7; k++) {
        ctx.moveTo(x0 + k * s * 0.17, y0); ctx.lineTo(x0 + k * s * 0.17 + s * 0.5, y0 + s);
        ctx.moveTo(x0 + k * s * 0.17 + s * 0.5, y0); ctx.lineTo(x0 + k * s * 0.17, y0 + s);
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#2a2a22';
      for (const [a, b] of [[0.12, 0.14], [0.88, 0.14], [0.12, 0.86], [0.88, 0.86]]) {
        ctx.beginPath(); ctx.arc(x0 + s * a, y0 + s * b, s * 0.04, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (th === 'winter') {
      // ель сверху: звёздчатые ярусы и снег
      const cx = x0 + s * 0.5, cy = y0 + s * 0.5;
      const tiers = [[0.48, '#1f3a26'], [0.36, '#2a4c32'], [0.24, '#36603f']];
      for (const [r, col] of tiers) {
        ctx.fillStyle = col;
        ctx.beginPath();
        const pts = 9;
        for (let i = 0; i < pts * 2; i++) {
          const a = (i / (pts * 2)) * Math.PI * 2 + hash(tx, ty) + Math.sin(now / 1200 + tx) * 0.02;
          const rad = (i % 2 ? r * 0.62 : r) * s;
          ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(250,252,255,0.9)';
      for (let i = 0; i < 9; i++) {
        const a = hash(tx * 7 + i, ty * 3) * Math.PI * 2, d = s * (0.08 + hash(tx + i, ty * 5) * 0.32);
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 0.045, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#5a3d22';
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const desert = th === 'desert';
    const tiers = desert
      ? [['#6b5a2e', 0.26, 7], ['#7d6b38', 0.2, 6], ['#8f7d44', 0.13, 5]]
      : [['#263a17', 0.3, 7], ['#365220', 0.24, 6], ['#4a6b2c', 0.17, 5]];
    tiers.forEach(([col, rad, n], ti) => {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = hash(tx * 13 + i + ti * 31, ty * 3 + ti);
        const b = hash(tx * 5 + ti, ty * 11 + i + ti * 17);
        const sway = Math.sin(now / 900 + i * 1.7 + tx + ti) * s * 0.012 * (ti + 1);
        const cx = x0 + s * (0.2 + a * 0.6) + sway, cy = y0 + s * (0.2 + b * 0.6) - ti * s * 0.02;
        ctx.beginPath(); ctx.arc(cx, cy, s * (rad + a * 0.08), 0, Math.PI * 2); ctx.fill();
      }
    });
    if (desert) {
      // сухие ветки
      ctx.strokeStyle = 'rgba(70,52,28,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = hash(tx * 3 + i, ty * 13) * Math.PI * 2;
        ctx.moveTo(x0 + s * 0.5, y0 + s * 0.5);
        ctx.lineTo(x0 + s * 0.5 + Math.cos(a) * s * 0.42, y0 + s * 0.5 + Math.sin(a) * s * 0.42);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(150,185,95,0.6)';
      for (let i = 0; i < 7; i++) {
        const a = hash(tx + i * 3, ty * 17), b = hash(tx * 19, ty + i);
        ctx.beginPath(); ctx.arc(x0 + s * (0.2 + a * 0.55), y0 + s * (0.16 + b * 0.55), s * 0.045, 0, Math.PI * 2); ctx.fill();
      }
      if (hash(tx * 41, ty * 43) < 0.35) {
        ctx.fillStyle = '#b8402f';
        for (let i = 0; i < 4; i++) {
          const a = hash(tx * 2 + i, ty * 23), b = hash(tx * 29, ty * 2 + i);
          ctx.beginPath(); ctx.arc(x0 + s * (0.25 + a * 0.5), y0 + s * (0.25 + b * 0.5), s * 0.025, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Рисунок камуфляжа внутри уже заданной области обрезки (центр в 0,0).
  paintCamo(ctx, info, pattern, w, h, s, seed) {
    if (pattern === 'stripes') {
      ctx.strokeStyle = info.camo;
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const y = i * h * 0.15;
        ctx.moveTo(-w / 2, y + h * 0.04);
        ctx.lineTo(-w * 0.15, y - h * 0.03);
        ctx.lineTo(w * 0.1, y + h * 0.05);
        ctx.lineTo(w / 2, y - h * 0.02);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (pattern === 'digital') {
      const cell = Math.max(2, s * 0.07);
      for (let y = -h / 2; y < h / 2; y += cell) for (let x = -w / 2; x < w / 2; x += cell) {
        const v = hash(Math.round(x / cell) + seed * 31, Math.round(y / cell) + seed * 17);
        if (v < 0.22) ctx.fillStyle = info.camo;
        else if (v < 0.36 && info.camo2) ctx.fillStyle = info.camo2;
        else continue;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x, y, cell, cell);
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (pattern === 'shine') {
      const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,250,210,0.55)');
      g.addColorStop(0.55, 'rgba(255,250,210,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      return;
    }
    // blobs
    const cols = info.camo2 ? [info.camo, info.camo2] : [info.camo];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const a = hash(seed * 7 + i, 3), b = hash(seed * 11, i + 5), c = hash(i, seed + 9);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.ellipse((a - 0.5) * w, (b - 0.5) * h, s * (0.1 + c * 0.1), s * (0.06 + a * 0.07), c * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  hullPath(ctx, fx, fy, ch) {
    ctx.beginPath();
    ctx.moveTo(-fx + ch, -fy);
    ctx.lineTo(fx - ch, -fy);
    ctx.lineTo(fx, -fy + ch);
    ctx.lineTo(fx, fy - ch * 0.6);
    ctx.lineTo(fx - ch * 0.6, fy);
    ctx.lineTo(-fx + ch * 0.6, fy);
    ctx.lineTo(-fx, fy - ch * 0.6);
    ctx.lineTo(-fx, -fy + ch);
    ctx.closePath();
  }

  drawTank(ctx, t, s, dead) {
    const base = TANK_INFO[t.id] || TANK_INFO[0];
    const skin = t.skin && SKINS[t.skin];
    const info = skin ? { ...base, ...skin, mark: base.mark } : base;
    const pattern = skin ? skin.pattern : 'blobs';
    const px = (t.x + 0.5) * s, py = (t.y + 0.5) * s;
    const body = dead ? '#302d29' : info.body;
    const dark = dead ? '#1b1917' : info.dark;
    const light = dead ? '#423e39' : info.light;
    const camo = dead ? '#252220' : (info.camo || info.dark);
    const steel = dead ? '#1d1c1a' : '#2c2d2a';
    const model = t.model || 'lynx';
    const sh = t.shape || { w: 0.52, l: 0.8, tur: 0.34 };
    const hw = sh.w * s, hl = sh.l * s, lvl = dead ? 1 : (t.level || 1);
    const fx = hw / 2, fy = hl / 2;
    const ch = (model === 'hornet' ? 0.15 : model === 'bastion' ? 0.05 : 0.09) * s;
    const trackX = fx + 0.035 * s, trackW = 0.2 * s, trackL = Math.min(0.92 * s, hl + 0.08 * s);
    const lw = Math.max(1, s * 0.028);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t.angle);

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    rr(ctx, -trackX - trackW / 2 + 0.07 * s, -trackL / 2 + 0.1 * s, trackX * 2 + trackW, trackL, 0.1 * s);
    ctx.fill();

    // отвал сапёра (перед корпусом)
    if (model === 'sapper') {
      ctx.fillStyle = steel;
      rr(ctx, -fx - 0.06 * s, -fy - 0.075 * s, hw + 0.12 * s, 0.07 * s, 0.02 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,190,180,0.35)';
      ctx.fillRect(-fx - 0.04 * s, -fy - 0.07 * s, hw + 0.08 * s, 0.018 * s);
    }

    // гусеницы
    for (const side of [-1, 1]) {
      const cx = side * trackX;
      ctx.fillStyle = dead ? '#161513' : '#1f1f1c';
      rr(ctx, cx - trackW / 2, -trackL / 2, trackW, trackL, 0.05 * s);
      ctx.fill();
      ctx.strokeStyle = dead ? '#2b2a27' : '#4d4d44';
      ctx.lineWidth = Math.max(1, s * 0.03);
      const step = 0.105 * s;
      const off = (t.dist * s * 0.9) % step;
      ctx.beginPath();
      for (let yy = -trackL / 2 + off; yy < trackL / 2 - 1; yy += step) {
        ctx.moveTo(cx - trackW * 0.44, yy);
        ctx.lineTo(cx + trackW * 0.44, yy);
      }
      ctx.stroke();
      // блик по внешней кромке
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(cx + side * trackW * 0.3 - 0.01 * s, -trackL / 2 + 0.04 * s, 0.02 * s, trackL - 0.08 * s);
      // надгусеничная полка
      ctx.fillStyle = dark;
      ctx.fillRect(cx - side * trackW * 0.5 - (side > 0 ? 0 : trackW * 0.5), -fy + ch, trackW * 0.5, hl - ch * 1.6);
      if (lvl >= 2) { // бортовые экраны из трёх плит
        const sx0 = cx - trackW / 2, plateL = (hl - ch * 2) / 3;
        for (let k = 0; k < 3; k++) {
          const y0 = -fy + ch + k * plateL;
          ctx.fillStyle = body;
          ctx.fillRect(sx0, y0 + 0.5, trackW, plateL - 1);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(sx0, y0 + 0.5, trackW, Math.max(1, s * 0.02));
          ctx.strokeStyle = dark;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx0 + 0.5, y0 + 0.5, trackW - 1, plateL - 1);
        }
      }
    }

    // выхлопные трубы шершня
    if (model === 'hornet') {
      ctx.fillStyle = steel;
      ctx.fillRect(-fx * 0.62, fy - 0.01 * s, 0.07 * s, 0.07 * s);
      ctx.fillRect(fx * 0.62 - 0.07 * s, fy - 0.01 * s, 0.07 * s, 0.07 * s);
    }

    // корпус с объёмом
    const hg = ctx.createLinearGradient(-fx, 0, fx, 0);
    hg.addColorStop(0, light);
    hg.addColorStop(0.3, body);
    hg.addColorStop(1, dark);
    this.hullPath(ctx, fx, fy, ch);
    ctx.fillStyle = hg;
    ctx.fill();

    // камуфляж (пятна внутри контура корпуса)
    ctx.save();
    this.hullPath(ctx, fx, fy, ch);
    ctx.clip();
    if (!dead) this.paintCamo(ctx, info, pattern, hw, hl, s, t.id);
    // лобовой лист
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(-fx, -fy, hw, ch + 0.07 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-fx, -fy + ch + 0.07 * s, hw, Math.max(1, s * 0.02));
    // моторный отсек
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-fx + 0.06 * s, fy - 0.25 * s, hw - 0.12 * s, 0.2 * s);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = fy - 0.22 * s + i * 0.045 * s;
      ctx.moveTo(-fx + 0.09 * s, yy); ctx.lineTo(fx - 0.09 * s, yy);
    }
    ctx.stroke();
    ctx.restore();

    this.hullPath(ctx, fx, fy, ch);
    ctx.strokeStyle = dark;
    ctx.lineWidth = lw;
    ctx.stroke();

    // детали корпуса по моделям
    if (!dead) {
      ctx.fillStyle = '#efe7bd';
      ctx.fillRect(-fx + ch * 0.9, -fy + 0.025 * s, 0.045 * s, 0.03 * s);
      ctx.fillRect(fx - ch * 0.9 - 0.045 * s, -fy + 0.025 * s, 0.045 * s, 0.03 * s);
    }
    if (model === 'bastion') {
      ctx.fillStyle = dark;
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 0.15 * s - 0.05 * s, -fy + 0.03 * s, 0.1 * s, 0.07 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 0.15 * s - 0.05 * s, -fy + 0.03 * s, 0.1 * s, 0.018 * s);
    } else if (model === 'sapper') {
      for (const mx of [-0.11, 0.11]) {
        ctx.fillStyle = '#2c301f';
        ctx.beginPath(); ctx.arc(mx * s, fy - 0.12 * s, 0.065 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dead ? '#3a1a14' : '#b8402f';
        ctx.beginPath(); ctx.arc(mx * s, fy - 0.12 * s, 0.022 * s, 0, Math.PI * 2); ctx.fill();
      }
    } else if (model === 'hornet') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-fx + 0.04 * s, -0.12 * s, 0.03 * s, 0.26 * s);
      ctx.fillRect(fx - 0.07 * s, -0.12 * s, 0.03 * s, 0.26 * s);
    } else {
      // ящик ЗИП на борту
      ctx.fillStyle = light;
      ctx.fillRect(-fx + 0.035 * s, 0.0 * s, 0.07 * s, 0.14 * s);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      ctx.strokeRect(-fx + 0.035 * s + 0.5, 0.5, 0.07 * s - 1, 0.14 * s - 1);
    }

    // башня и ствол
    const rec = dead ? 0 : t.recoil * 0.09 * s;
    const tur = (sh.tur + (lvl >= 4 ? 0.05 : 0)) * s;
    const tr = model === 'hornet' ? tur / 2 : model === 'bastion' ? 0.06 * s : 0.11 * s;
    ctx.save();
    if (dead) { ctx.translate(0.05 * s, 0.03 * s); ctx.rotate(0.55); }
    ctx.translate(0, rec * 0.35);

    const barrel = (bx, bwid) => {
      const tip = -0.66 * s + rec * 0.65;
      const bg = ctx.createLinearGradient(bx - bwid / 2, 0, bx + bwid / 2, 0);
      bg.addColorStop(0, dead ? '#2a2826' : '#55564e');
      bg.addColorStop(0.45, dead ? '#3a3835' : '#8a8b80');
      bg.addColorStop(1, dead ? '#141312' : '#2b2c28');
      ctx.fillStyle = bg;
      ctx.fillRect(bx - bwid / 2, tip, bwid, -tip - tur * 0.3);
      // эжектор и дульный тормоз
      ctx.fillRect(bx - bwid * 0.75, tip + 0.2 * s, bwid * 1.5, 0.09 * s);
      ctx.fillStyle = steel;
      ctx.fillRect(bx - bwid * 0.85, tip - 0.01 * s, bwid * 1.7, 0.075 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - bwid * 0.85, tip + 0.022 * s, bwid * 1.7, Math.max(1, 0.014 * s));
    };
    if (lvl >= 3) { barrel(-0.075 * s, 0.062 * s); barrel(0.075 * s, 0.062 * s); }
    else barrel(0, 0.085 * s);

    // маска орудия
    ctx.fillStyle = dark;
    rr(ctx, -tur * 0.36, -tur / 2 - 0.035 * s, tur * 0.72, 0.09 * s, 0.02 * s);
    ctx.fill();

    // башня
    const tg = ctx.createRadialGradient(-tur * 0.2, -tur * 0.15, tur * 0.05, 0, 0, tur * 0.85);
    tg.addColorStop(0, light);
    tg.addColorStop(0.5, body);
    tg.addColorStop(1, dark);
    rr(ctx, -tur / 2, -tur / 2, tur, tur * 1.14, Math.min(tr, tur / 2));
    ctx.fillStyle = tg;
    ctx.fill();
    if (!dead) {
      ctx.save();
      rr(ctx, -tur / 2, -tur / 2, tur, tur * 1.14, Math.min(tr, tur / 2));
      ctx.clip();
      if (pattern === 'blobs') {
        ctx.fillStyle = camo;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(tur * 0.18, tur * 0.28, tur * 0.34, tur * 0.2, 0.6 + t.id, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else this.paintCamo(ctx, info, pattern, tur, tur * 1.14, s * 0.6, t.id + 5);
      // опознавательная полоса
      ctx.fillStyle = info.mark;
      ctx.fillRect(-tur / 2, tur * 0.42, tur, 0.04 * s);
      ctx.restore();
    }
    rr(ctx, -tur / 2, -tur / 2, tur, tur * 1.14, Math.min(tr, tur / 2));
    ctx.strokeStyle = dark;
    ctx.lineWidth = lw;
    ctx.stroke();

    // командирская башенка и люк
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(tur * 0.2, tur * 0.12, 0.062 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(tur * 0.2, tur * 0.12, 0.04 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -tur * 0.36, tur * 0.02, 0.085 * s, 0.065 * s, 0.015 * s);
    ctx.fill();

    // антенна
    ctx.strokeStyle = dead ? 'rgba(0,0,0,0.4)' : 'rgba(20,20,18,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-tur * 0.38, tur * 0.5);
    ctx.lineTo(-tur * 0.38 - 0.1 * s, tur * 0.5 + 0.24 * s);
    ctx.stroke();

    if (lvl >= 4) { // навесная броня башни и дымовые мортирки
      ctx.fillStyle = dark;
      ctx.fillRect(-tur / 2 - 0.045 * s, -tur * 0.3, 0.05 * s, tur * 0.7);
      ctx.fillRect(tur / 2 - 0.005 * s, -tur * 0.3, 0.05 * s, tur * 0.7);
      ctx.fillStyle = '#8c8d84';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(-tur / 2 - 0.02 * s, -tur * 0.2 + i * tur * 0.24, 0.016 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(tur / 2 + 0.02 * s, -tur * 0.2 + i * tur * 0.24, 0.016 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    if (dead) { // тлеющие угли
      ctx.fillStyle = `rgba(255,120,40,${0.35 + 0.25 * Math.sin(performance.now() / 180 + t.id)})`;
      ctx.beginPath(); ctx.arc(-0.06 * s, 0.1 * s, 0.035 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0.09 * s, -0.12 * s, 0.025 * s, 0, Math.PI * 2); ctx.fill();
    } else if (t.hitFlash > 0) {
      this.hullPath(ctx, fx + trackW * 0.6, Math.max(fy, trackL / 2), ch);
      ctx.fillStyle = `rgba(255,240,220,${Math.min(0.7, t.hitFlash * 3)})`;
      ctx.fill();
    }
    ctx.restore();
  }

  drawMine(ctx, m, s, now) {
    if (m.barrel) return; // горящая бочка — это эффект взрыва, мину не рисуем
    const cx = (m.x + 0.5) * s, cy = (m.y + 0.5) * s, r = s * 0.25;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.arc(cx + s * 0.05, cy + s * 0.07, r, 0, Math.PI * 2); ctx.fill();
    if (m.remote) {
      // радиомина: квадратный корпус, антенна, синий огонёк
      ctx.fillStyle = '#3b3f4a';
      rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.3);
      ctx.fill();
      ctx.strokeStyle = '#15171c';
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.stroke();
      ctx.fillStyle = '#5a5f6e';
      rr(ctx, cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, r * 0.2);
      ctx.fill();
      ctx.strokeStyle = '#c9cdd1';
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath(); ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 1.1, cy - r * 1.3); ctx.stroke();
      const on = (now % 900) < 300;
      ctx.fillStyle = on ? '#4fc3ff' : '#18445a';
      if (on) { ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }
    // взрыватели-рожки
    ctx.strokeStyle = '#191b12';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.3;
      ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r * 1.22, cy + Math.sin(a) * r * 1.22);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#6b7150');
    g.addColorStop(0.6, '#3f432e');
    g.addColorStop(1, '#22251a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15170f';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    const period = m.timer < 0.9 ? 140 : 520;
    const on = (now % period) < period / 2;
    ctx.fillStyle = on ? '#ff3b2f' : '#5a1510';
    if (on) { ctx.shadowColor = '#ff3b2f'; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawBonus(ctx, b, s, now) {
    const st = BONUS_STYLE[b.type];
    const bob = Math.sin(now / 300 + b.x) * s * 0.03;
    const cx = (b.x + 0.5) * s, cy = (b.y + 0.5) * s + bob, h = s * 0.31;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(cx - h + s * 0.07, cy - h + s * 0.09 - bob, h * 2, h * 2);
    // деревянный ящик из досок
    ctx.fillStyle = '#8f6c3b';
    ctx.fillRect(cx - h, cy - h, h * 2, h * 2);
    const planks = 4, pw = h * 2 / planks;
    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(60,40,15,0.18)' : 'rgba(255,225,160,0.1)';
      ctx.fillRect(cx - h + i * pw, cy - h, pw, h * 2);
      ctx.fillStyle = 'rgba(50,32,12,0.55)';
      ctx.fillRect(cx - h + i * pw, cy - h, 1, h * 2);
    }
    // рама и металлические уголки
    ctx.strokeStyle = '#5a401f';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.strokeRect(cx - h, cy - h, h * 2, h * 2);
    ctx.fillStyle = '#b9bcc0';
    const k = h * 0.34;
    for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillRect(cx + ax * h - (ax > 0 ? k : 0), cy + ay * h - (ay > 0 ? k * 0.35 : 0), k, k * 0.35);
      ctx.fillRect(cx + ax * h - (ax > 0 ? k * 0.35 : 0), cy + ay * h - (ay > 0 ? k : 0), k * 0.35, k);
    }
    // трафарет типа бонуса
    ctx.fillStyle = st.color;
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(s * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.glyph, cx, cy + 1);
  }

  drawFire(ctx, f, s) {
    const a = f.t / f.max;
    const cx = (f.x + 0.5) * s, cy = (f.y + 0.5) * s;
    const r = s * (0.55 + (1 - a) * 0.2) * (0.92 + Math.random() * 0.16);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,248,200,${a})`);
    g.addColorStop(0.35, `rgba(255,190,70,${a * 0.95})`);
    g.addColorStop(0.75, `rgba(220,80,20,${a * 0.7})`);
    g.addColorStop(1, 'rgba(120,30,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // ---------- частицы ----------
  spawn(kind, x, y, o = {}) {
    const p = {
      kind, x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.5, max: o.life || 0.5,
      size: o.size || 4, grow: o.grow || 0, color: o.color || '#fff', rot: Math.random() * 6, drag: o.drag ?? 2,
      text: o.text || '', ang: o.ang || 0,
    };
    this.parts.push(p);
  }

  burst(px, py, n, kind, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (o.speed || 40) * (0.3 + Math.random());
      this.spawn(kind, px + (Math.random() - 0.5) * (o.spread || 0), py + (Math.random() - 0.5) * (o.spread || 0), {
        ...o, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (o.life || 0.5) * (0.6 + Math.random() * 0.8),
      });
    }
  }

  onEvents(events) {
    const s = this.ts;
    const P = v => (v + 0.5) * s;
    for (const e of events) {
      if (e.type === 'shot') {
        this.spawn('flash', P(e.x), P(e.y), { size: s * 0.55, life: 0.08, ang: e.dir * Math.PI / 2 });
        this.burst(P(e.x), P(e.y), 5, 'smoke', { speed: s * 0.9, size: s * 0.12, grow: s * 0.7, life: 0.7, color: '185,180,170' });
        // стреляная гильза остаётся на земле
        const g = this.decals.x;
        g.save();
        g.translate(P(e.x) + (Math.random() - 0.5) * s * 0.9, P(e.y) + (Math.random() - 0.5) * s * 0.9);
        g.rotate(Math.random() * Math.PI);
        g.fillStyle = 'rgba(190,160,80,0.8)';
        g.fillRect(-s * 0.045, -1, s * 0.09, 2);
        g.restore();
      } else if (e.type === 'spark' || e.type === 'hit') {
        this.burst(P(e.x), P(e.y), e.type === 'hit' ? 12 : 7, 'spark', { speed: s * 5, size: 2, life: 0.25, color: '#ffd27a', drag: 6 });
        if (e.type === 'hit') this.shake = Math.min(12, this.shake + 3);
      } else if (e.type === 'brickhit' || e.type === 'brickbreak') {
        const big = e.type === 'brickbreak';
        const x = big ? P(e.x) : P(e.x), y = big ? P(e.y) : P(e.y);
        this.burst(x, y, big ? 14 : 6, 'debris', { speed: s * 3, size: s * 0.09, life: 0.6, color: '#8d4a30', drag: 4, spread: big ? s * 0.6 : 0 });
        this.burst(x, y, big ? 6 : 2, 'smoke', { speed: s * 0.6, size: s * 0.2, grow: s * 0.8, life: 0.9, color: '150,120,95', spread: s * 0.4 });
        if (big) this.rubble(x, y, s);
      } else if (e.type === 'explode') {
        for (const [x, y] of e.cells) {
          this.burst(P(x), P(y), 3, 'fire', { speed: s * 1.2, size: s * 0.35, grow: -s * 0.4, life: 0.4, color: '#ffb347', spread: s * 0.5 });
          this.burst(P(x), P(y), 2, 'smoke', { speed: s * 0.7, size: s * 0.3, grow: s * 0.9, life: 1.4, color: '70,66,60', spread: s * 0.5 });
          this.scorch(P(x), P(y), s * 0.5);
        }
        this.burst(P(e.x), P(e.y), 10, 'debris', { speed: s * 4, size: s * 0.07, life: 0.7, color: '#3a3328', drag: 3 });
        this.spawn('ring', P(e.x), P(e.y), { size: s * 0.3, grow: s * 7, life: 0.28, color: 'rgba(255,240,200,0.9)' });
        this.burst(P(e.x), P(e.y), 8, 'spark', { speed: s * 7, size: 2, life: 0.35, color: '#ffe9a0', drag: 5 });
        this.burst(P(e.x), P(e.y), 6, 'fire', { speed: s * 0.5, size: s * 0.07, grow: -s * 0.03, life: 1.4, color: '#ff8a2a', spread: s * 0.8, drag: 1 });
        this.crater(P(e.x), P(e.y), s * 0.34);
        if (e.barrel) {
          // горящее топливо: больше огня и чёрный дым
          this.burst(P(e.x), P(e.y), 16, 'fire', { speed: s * 2.4, size: s * 0.45, grow: -s * 0.45, life: 0.7, color: '#ff7a1a', spread: s * 0.3 });
          this.burst(P(e.x), P(e.y), 10, 'smoke', { speed: s * 0.9, size: s * 0.3, grow: s * 0.6, life: 1.6, color: '25,22,20', spread: s * 0.4 });
          this.oil(P(e.x), P(e.y), s * 0.8);
        }
        this.flash = Math.min(0.5, (this.flash || 0) + (e.barrel ? 0.32 : 0.22));
        this.shake = Math.min(14, this.shake + (e.barrel ? 9 : 7));
      } else if (e.type === 'barrel') {
        this.burst(P(e.x), P(e.y), 8, 'debris', { speed: s * 4, size: s * 0.08, life: 0.7, color: '#8a2418', drag: 3 });
      } else if (e.type === 'shieldHit') {
        this.spawn('ring', P(e.x), P(e.y), { size: s * 0.3, grow: s * 2, life: 0.3, color: '#7fd4ff' });
        this.burst(P(e.x), P(e.y), 8, 'spark', { speed: s * 4, size: 2, life: 0.25, color: '#bfeaff', drag: 6 });
      } else if (e.type === 'detonate') {
        this.spawn('ring', P(e.x), P(e.y), { size: s * 0.2, grow: s * 1.6, life: 0.3, color: '#4fc3ff' });
      } else if (e.type === 'slide') {
        this.burst(P(e.x), P(e.y), 6, 'smoke', { speed: s * 1.2, size: s * 0.06, grow: s * 0.25, life: 0.5, color: '235,245,255' });
      } else if (e.type === 'dead') {
        this.burst(P(e.x), P(e.y), 22, 'fire', { speed: s * 2.2, size: s * 0.4, grow: -s * 0.5, life: 0.6, color: '#ffa53a', spread: s * 0.4 });
        this.burst(P(e.x), P(e.y), 14, 'smoke', { speed: s * 1, size: s * 0.35, grow: s * 1.2, life: 2, color: '40,38,35', spread: s * 0.5 });
        this.burst(P(e.x), P(e.y), 16, 'debris', { speed: s * 5, size: s * 0.1, life: 0.9, color: '#2b2a26', drag: 3 });
        this.scorch(P(e.x), P(e.y), s * 0.9);
        this.oil(P(e.x), P(e.y), s);
        this.flash = Math.min(0.6, (this.flash || 0) + 0.35);
        this.shake = Math.min(16, this.shake + 10);
      } else if (e.type === 'levelup') {
        this.spawn('ring', P(e.x), P(e.y), { size: s * 0.3, grow: s * 3, life: 0.6, color: '#ffd95a' });
        this.spawn('label', P(e.x), P(e.y) - s * 0.9, { vy: -s * 0.8, life: 1.6, drag: 1, size: s * 0.34, color: '#ffd95a', text: '★ ' + LEVELS[e.level - 1].name });
      } else if (e.type === 'pickup') {
        this.spawn('ring', P(e.x), P(e.y), { size: s * 0.2, grow: s * 2.4, life: 0.4, color: '#ffe68a' });
      } else if (e.type === 'mine') {
        this.burst(P(e.x), P(e.y), 4, 'smoke', { speed: s * 0.4, size: s * 0.12, grow: s * 0.4, life: 0.5, color: '140,125,100' });
      } else if (e.type === 'crush') {
        this.burst(P(e.x), P(e.y), 6, 'smoke', { speed: s * 0.8, size: s * 0.25, grow: s * 0.8, life: 0.8, color: '160,160,155', spread: s * 0.6 });
        this.shake = Math.min(8, this.shake + 1.5);
      }
    }
  }

  scorch(x, y, r) {
    const g = this.decals.x;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(20,16,12,0.45)');
    gr.addColorStop(1, 'rgba(20,16,12,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Воронка: тёмное дно и светлый вал выброшенной земли.
  crater(x, y, r) {
    const g = this.decals.x;
    g.fillStyle = 'rgba(150,134,100,0.5)';
    g.beginPath(); g.ellipse(x, y, r * 1.25, r * 1.05, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(18,14,10,0.85)');
    gr.addColorStop(0.75, 'rgba(46,38,26,0.75)');
    gr.addColorStop(1, 'rgba(60,50,34,0.3)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(20,16,12,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      g.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.8);
      g.lineTo(x + Math.cos(a) * r * (1.5 + Math.random() * 0.7), y + Math.sin(a) * r * (1.3 + Math.random() * 0.6));
    }
    g.stroke();
  }

  // Обломки кирпича на месте разрушенной стены.
  rubble(x, y, s) {
    const g = this.decals.x;
    g.fillStyle = 'rgba(70,45,30,0.35)';
    g.beginPath(); g.ellipse(x, y, s * 0.42, s * 0.36, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 12; i++) {
      g.save();
      g.translate(x + (Math.random() - 0.5) * s * 0.8, y + (Math.random() - 0.5) * s * 0.8);
      g.rotate(Math.random() * Math.PI);
      const w = s * (0.06 + Math.random() * 0.09), h = s * (0.04 + Math.random() * 0.04);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(-w / 2 + 1, -h / 2 + 1.5, w, h);
      g.fillStyle = BRICK_COLORS[i % BRICK_COLORS.length];
      g.fillRect(-w / 2, -h / 2, w, h);
      g.restore();
    }
  }

  // Масляное пятно и куски металла под подбитым танком.
  oil(x, y, s) {
    const g = this.decals.x;
    g.fillStyle = 'rgba(12,10,9,0.55)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(x + (Math.random() - 0.5) * s * 0.7, y + (Math.random() - 0.5) * s * 0.7, s * (0.18 + Math.random() * 0.2), s * (0.12 + Math.random() * 0.14), Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 8; i++) {
      g.save();
      g.translate(x + (Math.random() - 0.5) * s * 1.5, y + (Math.random() - 0.5) * s * 1.5);
      g.rotate(Math.random() * Math.PI);
      g.fillStyle = i % 2 ? '#3b3935' : '#252422';
      g.fillRect(-s * 0.05, -s * 0.02, s * 0.1, s * 0.04);
      g.restore();
    }
  }

  stampTracks(t) {
    const s = this.ts;
    const last = this.stamps.get(t.id) ?? -1;
    if (t.dist - last < 0.16) return;
    this.stamps.set(t.id, t.dist);
    const g = this.decals.x;
    g.save();
    g.translate((t.x + 0.5) * s, (t.y + 0.5) * s);
    g.rotate(t.angle);
    g.fillStyle = 'rgba(45,38,26,0.16)';
    g.fillRect(-0.4 * s, -0.03 * s, 0.17 * s, 0.07 * s);
    g.fillRect(0.23 * s, -0.03 * s, 0.17 * s, 0.07 * s);
    g.restore();
  }

  updateParticles(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.size = Math.max(0.5, p.size + p.grow * dt);
      p.rot += dt * 6;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }

  drawParticles(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        // дым не разрастается больше клетки, иначе закрывает поле тёмными пятнами
        ctx.fillStyle = `rgba(${p.color},${a * 0.45})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.min(p.size, this.ts * 0.9), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.globalAlpha = a;
        ctx.fillStyle = a > 0.6 ? '#fff0a8' : p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'label') {
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.font = `bold ${Math.round(p.size)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        const half = ctx.measureText(p.text).width / 2 + 4;
        const lx = Math.max(half, Math.min(this.bw - half, p.x));
        ctx.strokeText(p.text, lx, Math.max(p.size, p.y));
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, lx, Math.max(p.size, p.y));
        ctx.globalAlpha = 1;
      } else if (p.kind === 'flash') {
        // дульная вспышка: язык пламени вперёд и два боковых
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.fillStyle = '#ffd36a';
        ctx.beginPath();
        ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.22, -p.size * 0.1); ctx.lineTo(p.size * 0.6, 0);
        ctx.lineTo(p.size * 0.18, p.size * 0.12); ctx.lineTo(0, p.size * 0.2); ctx.lineTo(-p.size * 0.18, p.size * 0.12);
        ctx.lineTo(-p.size * 0.6, 0); ctx.lineTo(-p.size * 0.22, -p.size * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath(); ctx.ellipse(0, -p.size * 0.25, p.size * 0.12, p.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- кадр ----------
  draw(w, dt, now, playerId) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);
    if (!w) return;
    if (w.mapDirty) this.rebuild(false);
    this.updateParticles(dt);
    const s = this.ts, bw = this.bw;

    this.shake = Math.max(0, this.shake - dt * 30);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(this.ox + sx, this.oy + sy);

    for (const t of w.tanks) {
      if (!t.alive) continue;
      this.stampTracks(t);
      // пыль из-под гусениц и выхлоп на ходу
      const fxv = Math.sin(t.angle), fyv = -Math.cos(t.angle);
      const cx = (t.x + 0.5) * s, cy = (t.y + 0.5) * s;
      const moving = t.x !== t.tx || t.y !== t.ty;
      if (moving && Math.random() < dt * 22) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.spawn('smoke', cx - fxv * s * 0.42 - fyv * side * s * 0.3, cy - fyv * s * 0.42 + fxv * side * s * 0.3, {
          vx: -fxv * s * 0.5 + (Math.random() - 0.5) * s * 0.3, vy: -fyv * s * 0.5 + (Math.random() - 0.5) * s * 0.3,
          size: s * 0.07, grow: s * 0.3, life: 0.55, color: '150,136,104', drag: 2.5,
        });
      }
      if (Math.random() < dt * (moving ? 9 : 2.5)) {
        this.spawn('smoke', cx - fxv * s * 0.44, cy - fyv * s * 0.44, {
          vx: -fxv * s * 0.35, vy: -fyv * s * 0.35 - s * 0.15, size: s * 0.05, grow: s * 0.22, life: 0.7, color: '55,52,48', drag: 1.5,
        });
      }
    }
    ctx.drawImage(this.ground.c, 0, 0, bw, bw);
    ctx.drawImage(this.decals.c, 0, 0, bw, bw);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (w.tile(x, y) === T.WATER) this.drawWater(ctx, x * s, y * s, s, now, x, y);
    }
    ctx.drawImage(this.tilesL.c, 0, 0, bw, bw);

    // предупреждение о сжатии
    for (const c of w.upcomingShrink(6)) {
      if (c.t > 2.5 || w.tile(c.x, c.y) === T.STEEL) continue;
      const pulse = 0.25 + 0.25 * Math.sin(now / 90);
      ctx.fillStyle = `rgba(220,40,30,${pulse})`;
      ctx.fillRect(c.x * s, c.y * s, s, s);
    }

    for (const b of w.bonuses) this.drawBonus(ctx, b, s, now);
    for (const m of w.mines) this.drawMine(ctx, m, s, now);
    for (const t of w.tanks) if (!t.alive) this.drawTank(ctx, t, s, true);
    for (const t of w.tanks) if (t.alive) this.drawTank(ctx, t, s, false);
    // щит: прозрачный пузырь, мигает перед окончанием
    for (const t of w.tanks) {
      if (!t.alive || !(t.shield > 0)) continue;
      if (t.shield < 1 && (now % 200) < 100) continue;
      const px = (t.x + 0.5) * s, py = (t.y + 0.5) * s, r = s * (0.62 + Math.sin(now / 150) * 0.02);
      const g = ctx.createRadialGradient(px, py, r * 0.6, px, py, r);
      g.addColorStop(0, 'rgba(120,210,255,0.05)');
      g.addColorStop(1, 'rgba(120,210,255,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(170,230,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const sh of w.shells) {
      const px = (sh.x + 0.5) * s, py = (sh.y + 0.5) * s;
      ctx.strokeStyle = 'rgba(255,220,140,0.35)';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - sh.dx * s * 0.6, py - sh.dy * s * 0.6); ctx.stroke();
      ctx.fillStyle = '#fff6d0';
      ctx.shadowColor = '#ffc04a'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px, py, s * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (Math.random() < dt * 40) {
        this.spawn('smoke', px - sh.dx * s * 0.2, py - sh.dy * s * 0.2, { size: s * 0.04, grow: s * 0.16, life: 0.35, color: '210,205,195', drag: 1 });
      }
    }

    for (const f of w.fires) this.drawFire(ctx, f, s);

    const pl = w.tanks[playerId];
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (w.tile(x, y) !== T.BUSH) continue;
      const inside = pl && pl.alive && Math.round(pl.x) === x && Math.round(pl.y) === y;
      this.drawBush(ctx, x * s, y * s, s, x, y, inside ? 0.55 : 1, now);
    }

    // дым над подбитыми танками
    for (const t of w.tanks) {
      if (!t.alive && Math.random() < dt * 6) {
        this.spawn('smoke', (t.x + 0.5) * s, (t.y + 0.5) * s, { vx: 6, vy: -10, size: s * 0.12, grow: s * 0.5, life: 1.6, color: '45,43,40', drag: 0.5 });
      }
    }
    this.drawParticles(ctx);

    // полоски брони и метка игрока
    for (const t of w.tanks) {
      if (!t.alive) continue;
      const px = (t.x + 0.5) * s, py = (t.y + 0.5) * s;
      const n = t.maxHp, pw = s * 0.15, gap = 2, total = n * pw + (n - 1) * gap;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < t.hp ? (t.id === playerId ? '#f0c84a' : '#e05a45') : 'rgba(0,0,0,0.5)';
        ctx.fillRect(px - total / 2 + i * (pw + gap), py - s * 0.62, pw, Math.max(2, s * 0.06));
      }
      if (t.level > 1) {
        ctx.fillStyle = '#ffd95a';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.font = `${Math.round(s * 0.24)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = '★'.repeat(t.level - 1);
        ctx.strokeText(txt, px, py - s * 0.78);
        ctx.fillText(txt, px, py - s * 0.78);
      }
      if (t.id === playerId) {
        const bob = Math.sin(now / 200) * 2, up = t.level > 1 ? s * 0.2 : 0;
        ctx.fillStyle = '#f0c84a';
        ctx.beginPath();
        ctx.moveTo(px - s * 0.12, py - s * 0.85 - up + bob);
        ctx.lineTo(px + s * 0.12, py - s * 0.85 - up + bob);
        ctx.lineTo(px, py - s * 0.7 - up + bob);
        ctx.closePath();
        ctx.fill();
      }
    }

    // затемнение по краям и вспышка от взрывов
    const vg = ctx.createRadialGradient(bw / 2, bw / 2, bw * 0.35, bw / 2, bw / 2, bw * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, bw, bw);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,236,190,${Math.min(0.35, this.flash)})`;
      ctx.fillRect(0, 0, bw, bw);
      this.flash = Math.max(0, this.flash - dt * 2.2);
    }

    // рамка арены: бетонный бордюр
    ctx.strokeStyle = '#1c1a15';
    ctx.lineWidth = 5;
    ctx.strokeRect(-2.5, -2.5, bw + 5, bw + 5);
    ctx.strokeStyle = '#6f7275';
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, -2, bw + 4, bw + 4);
    ctx.restore();
  }
}
