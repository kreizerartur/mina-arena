// Управление, раунды, HUD, связка мира, ИИ, графики и звука.
import { World, ROUND_TIME, SHRINK_AT, TANK_INFO, MODELS, MODEL_IDS, LEVELS } from './world.js';
import { botThink } from './ai.js';
import { Renderer } from './render.js';
import { Sound } from './sound.js';
import { Progress } from './progress.js';

const $ = id => document.getElementById(id);
const WINS_TO_MATCH = 3;
const AUTO = new URLSearchParams(location.search).has('auto'); // отладка: бот за игрока

// ---------- Telegram ----------
const tg = window.Telegram && window.Telegram.WebApp;
const inTG = !!(tg && tg.initData);
if (inTG) {
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg.setHeaderColor) tg.setHeaderColor('#1a1c17');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#1a1c17');
  } catch (e) { /* старые клиенты */ }
}
function haptic(kind) {
  if (!inTG) return;
  try { tg.HapticFeedback.impactOccurred(kind); } catch (e) { /* нет вибро */ }
}

const renderer = new Renderer($('cv'));
const sound = new Sound();
window.addEventListener('resize', () => renderer.resize());
if (inTG && tg.onEvent) tg.onEvent('viewportChanged', () => renderer.resize());

// ---------- Ввод ----------
const input = { held: [], stickDir: -1, keyFire: false, touchFire: false, mineReq: false };
const KEY_DIR = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

window.addEventListener('keydown', e => {
  if (e.code in KEY_DIR) {
    const d = KEY_DIR[e.code];
    if (!input.held.includes(d)) input.held.push(d);
    e.preventDefault();
  } else if (e.code === 'Space') { input.keyFire = true; e.preventDefault(); }
  else if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'ShiftLeft') { if (!e.repeat) input.mineReq = true; }
});
window.addEventListener('keyup', e => {
  if (e.code in KEY_DIR) input.held = input.held.filter(d => d !== KEY_DIR[e.code]);
  else if (e.code === 'Space') input.keyFire = false;
});
window.addEventListener('blur', () => { input.held = []; input.keyFire = false; input.touchFire = false; });

const stick = $('stick'), knob = $('knob');
let stickId = null;
function stickMove(e) {
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy), max = r.width / 2 - 20;
  const k = len > max ? max / len : 1;
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  if (len < 14) input.stickDir = -1;
  else if (Math.abs(dx) > Math.abs(dy)) input.stickDir = dx > 0 ? 1 : 3;
  else input.stickDir = dy > 0 ? 2 : 0;
}
stick.addEventListener('pointerdown', e => {
  stickId = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  stickMove(e);
  sound.init();
});
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
function stickEnd(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  input.stickDir = -1;
  knob.style.transform = '';
}
stick.addEventListener('pointerup', stickEnd);
stick.addEventListener('pointercancel', stickEnd);

function holdButton(el, on, off) {
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('down'); on(); sound.init(); });
  const end = () => { el.classList.remove('down'); off(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
holdButton($('btnFire'), () => { input.touchFire = true; }, () => { input.touchFire = false; });
holdButton($('btnMine'), () => { input.mineReq = true; haptic('light'); }, () => {});
for (const el of [stick, $('btnFire'), $('btnMine')]) el.addEventListener('contextmenu', e => e.preventDefault());

function applyInput(p) {
  p.want = input.held.length ? input.held[input.held.length - 1] : input.stickDir;
  p.hold = false;
  p.fire = input.keyFire || input.touchFire;
  if (input.mineReq) { p.mine = true; input.mineReq = false; }
}

// ---------- Раунды ----------
let world = null;
let phase = 'menu'; // menu | countdown | play | roundEnd
let phaseT = 0;
let wins = [0, 0, 0, 0];
let round = 0;
let lastBeep = 0;
let playerDownShown = false;
let botModels = ['lynx', 'lynx', 'lynx'];
let matchKills = 0;

const progress = new Progress(tg);

// ---------- Меню и гараж ----------
function statBar(label, v) {
  const pct = Math.round(Math.max(0.08, Math.min(1, v)) * 100);
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function modelStats(m) {
  return statBar('Броня', m.hp / 4) + statBar('Скорость', (m.speed - 2) / 1.7) +
    statBar('Огонь', 0.45 / m.reload) + statBar('Мины', (m.mines + m.range - 2) / 3);
}

function showMenu() {
  phase = 'menu';
  hideBanner();
  const d = progress.data, m = MODELS[d.selected];
  $('screen').innerHTML = `
    <h1>Минная арена</h1>
    <p class="sub">Прототип · танки и мины</p>
    <div class="coins"><i class="coin"></i> ${d.coins}</div>
    <div class="card sel"><div class="ch"><b>${m.name}</b><small>${m.desc}</small></div>${modelStats(m)}</div>
    <button data-act="start" class="big">В бой</button>
    <button data-act="garage" class="mid">Гараж</button>
    <div class="how">
      <p><b>Пушка</b> бьёт по прямой. <b>Мина</b> взрывается через 2,5 с крестом и задевает всех, вас тоже.</p>
      <p><b>Уровни в бою:</b> попадание даёт ★, уничтожение — ★★★. ${LEVELS.slice(1).map(l => `${l.name} (${l.stars}★): ${l.perk}`).join('; ')}.</p>
      <p>С 70-й секунды арена сжимается — уходите с красных клеток.</p>
      <p class="keys">Телефон: джойстик слева, кнопки справа.<br>Компьютер: WASD / стрелки, пробел — огонь, E — мина.</p>
    </div>`;
  $('screen').classList.remove('hidden');
}

function showGarage() {
  const d = progress.data;
  const cards = MODEL_IDS.map(id => {
    const m = MODELS[id];
    const owned = progress.owns(id), sel = d.selected === id;
    const btn = sel ? '<button class="sm on" disabled>Выбран</button>'
      : owned ? `<button class="sm" data-act="select" data-id="${id}">Выбрать</button>`
        : `<button class="sm buy" data-act="buy" data-id="${id}" ${d.coins < m.cost ? 'disabled' : ''}><i class="coin"></i> ${m.cost}</button>`;
    return `<div class="card${sel ? ' sel' : ''}${owned ? '' : ' locked'}">
      <div class="ch"><b>${m.name}</b><small>${m.desc}</small>${btn}</div>${modelStats(m)}</div>`;
  }).join('');
  $('screen').innerHTML = `
    <h1>Гараж</h1>
    <div class="coins"><i class="coin"></i> ${d.coins}</div>
    ${cards}
    <p class="sub" style="margin-top:10px">Монеты дают за матчи: участие, подбитые танки, выигранные раунды и победу.</p>
    <button data-act="menu" class="mid">Назад</button>`;
  $('screen').classList.remove('hidden');
}

function banner(html, cls = '') {
  const b = $('banner');
  b.innerHTML = html;
  b.className = cls;
}
function hideBanner() { $('banner').className = 'hidden'; }

function renderScore() {
  $('score').innerHTML = TANK_INFO.map((t, i) => {
    const dots = '●'.repeat(wins[i]) + '○'.repeat(Math.max(0, WINS_TO_MATCH - wins[i]));
    const dead = world && !world.tanks[i].alive ? ' dead' : '';
    return `<div class="sc${i === 0 ? ' me' : ''}${dead}"><i style="background:${t.body}"></i><b>${dots}</b></div>`;
  }).join('');
}

function startMatch() {
  wins = [0, 0, 0, 0];
  round = 0;
  matchKills = 0;
  botModels = MODEL_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  $('screen').classList.add('hidden');
  sound.init();
  startRound();
}

function startRound() {
  round++;
  world = new World({ models: [progress.data.selected, ...botModels] });
  renderer.reset(world);
  phase = 'countdown';
  phaseT = 2.4;
  lastBeep = 0;
  playerDownShown = false;
  input.mineReq = false;
  renderScore();
}

function endRound() {
  const alive = world.tanks.filter(t => t.alive);
  const winner = alive.length === 1 ? alive[0] : null;
  if (winner) wins[winner.id]++;
  phase = 'roundEnd';
  phaseT = 3;
  renderScore();
  if (!winner) banner('Ничья<small>никто не выжил</small>');
  else if (winner.id === 0) { banner('Раунд за вами!'); haptic('heavy'); }
  else banner(`Раунд: ${TANK_INFO[winner.id].name}<small>вас подбили</small>`);
}

function showMatchEnd() {
  phase = 'menu';
  hideBanner();
  const champ = wins.indexOf(Math.max(...wins));
  const rows = TANK_INFO.map((t, i) =>
    `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${t.body};margin-right:6px"></span>${t.name}</td><td class="w">${'●'.repeat(wins[i])}</td></tr>`).join('');
  const rw = AUTO ? { parts: [], total: 0 } : progress.reward({ kills: matchKills, roundsWon: wins[0], matchWon: champ === 0 });
  const rwRows = rw.parts.map(([a, b]) => `<tr><td>${a}</td><td class="w">+${b}</td></tr>`).join('');
  $('screen').innerHTML = `
    <h1>${champ === 0 ? 'Победа!' : 'Поражение'}</h1>
    <p class="sub">${champ === 0 ? 'Арена ваша' : `Матч выиграл: ${TANK_INFO[champ].name}`} · раундов: ${round}</p>
    <table>${rows}</table>
    <table class="rw">${rwRows}<tr class="tot"><td>Итого</td><td class="w"><i class="coin"></i> +${rw.total}</td></tr></table>
    <div class="coins"><i class="coin"></i> ${progress.data.coins}</div>
    <button data-act="start" class="big">Новый матч</button>
    <button data-act="garage" class="mid">Гараж</button>`;
  $('screen').classList.remove('hidden');
}

function handleEvents() {
  if (!world.events.length) return;
  renderer.onEvents(world.events);
  for (const e of world.events) {
    if (e.type === 'shot') { sound.play('shot'); if (e.tank === 0) haptic('light'); }
    else if (e.type === 'explode') { sound.play('explode'); haptic('medium'); }
    else if (e.type === 'dead') { sound.play('dead'); haptic('heavy'); renderScore(); if (e.by === 0 && e.tank !== 0) matchKills++; }
    else if (e.type === 'levelup') { if (e.tank === 0) { sound.play('pickup'); haptic('medium'); } }
    else if (e.type === 'hit') { sound.play('hit'); if (e.tank === 0) haptic('heavy'); }
    else if (e.type === 'brickhit' || e.type === 'brickbreak') sound.play('brick');
    else if (e.type === 'mine') sound.play('mine');
    else if (e.type === 'pickup') { if (e.tank === 0) { sound.play('pickup'); haptic('light'); } }
    else if (e.type === 'crush') sound.play('crush');
    else if (e.type === 'shrinkStart') { banner('Арена сжимается!', 'small'); setTimeout(() => { if (phase === 'play') hideBanner(); }, 1800); }
  }
  world.events.length = 0;
}

function tick(dt) {
  if (phase === 'menu' || !world) return;

  if (phase === 'countdown') {
    phaseT -= dt;
    const n = Math.ceil(phaseT - 0.6);
    if (n > 0) {
      banner(`${n}<small>Раунд ${round}</small>`);
      if (n !== lastBeep) { lastBeep = n; sound.play('beep'); }
    } else {
      banner('В бой!');
      if (lastBeep !== 0) { lastBeep = 0; sound.play('go'); }
    }
    if (phaseT <= 0) { phase = 'play'; hideBanner(); }
    return;
  }

  const p = world.tanks[0];
  if (phase === 'play') {
    if (p.alive) { if (AUTO) botThink(world, p, dt); else applyInput(p); }
    for (const t of world.tanks) if (t.alive && t.id !== 0) botThink(world, t, dt);
  } else {
    for (const t of world.tanks) { t.want = -1; t.fire = false; t.mine = false; t.hold = false; }
  }

  const reps = phase === 'play' && !p.alive ? 2 : 1; // после гибели игрока — ускоренный досмотр
  for (let i = 0; i < reps; i++) {
    world.update(dt);
    handleEvents();
  }

  if (phase === 'play') {
    if (!p.alive && !playerDownShown) {
      playerDownShown = true;
      banner('Вас подбили<small>досматриваем раунд ×2</small>', 'small');
    }
    if (world.tanks.filter(t => t.alive).length <= 1 || world.time >= ROUND_TIME) endRound();
  } else if (phase === 'roundEnd') {
    phaseT -= dt;
    if (phaseT <= 0) {
      if (wins.some(w => w >= WINS_TO_MATCH)) showMatchEnd();
      else startRound();
    }
  }
}

function updateTimer() {
  if (!world) return;
  const left = Math.max(0, ROUND_TIME - world.time);
  const m = Math.floor(left / 60), s = Math.floor(left % 60);
  const el = $('timer');
  el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  el.classList.toggle('warn', world.time >= SHRINK_AT - 5);
}

// ---------- Цикл ----------
const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) { tick(STEP); acc -= STEP; }
  renderer.draw(world, dt, now, 0);
  updateTimer();
  requestAnimationFrame(frame);
}

$('screen').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === 'start') startMatch();
  else if (act === 'garage') showGarage();
  else if (act === 'menu') showMenu();
  else if (act === 'select') { progress.select(id); showGarage(); }
  else if (act === 'buy') { if (progress.buy(id)) { sound.init(); sound.play('pickup'); } showGarage(); }
});
$('btnSound').addEventListener('click', () => {
  sound.on = !sound.on;
  $('btnSound').textContent = sound.on ? '🔊' : '🔇';
});

// Только для отладки из консоли.
window.__game = {
  get world() { return world; }, get phase() { return phase; }, get wins() { return wins; }, progress, renderer,
  step(sec) { for (let i = 0; i < sec * 60; i++) tick(STEP); renderer.draw(world, STEP, performance.now(), 0); updateTimer(); },
};

renderScore();
showMenu();
progress.loadCloud(() => { if (phase === 'menu') showMenu(); });
requestAnimationFrame(frame);
