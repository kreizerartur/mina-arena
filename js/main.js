// Управление, раунды, HUD, связка мира, ИИ, графики и звука.
import {
  World, ROUND_TIME, SHRINK_AT, TANK_INFO, MODELS, MODEL_IDS, LEVELS,
  THEMES, THEME_IDS, DIFFICULTY, SKINS, SKIN_IDS, BONUS_TYPES, BONUS_INFO,
} from './world.js?v=202611242311';
import { botThink } from './ai.js?v=202611242311';
import { Renderer } from './render.js?v=202611242311';
import { Sound } from './sound.js?v=202611242311';
import { Progress, LOGIN_REWARDS } from './progress.js?v=202611242311';
import { settings, saveSettings, STICK_SIZES } from './settings.js?v=202611242311';

const $ = id => document.getElementById(id);

// Защита от смеси версий: если браузер отдал старую страницу из своей памяти,
// а скрипт уже новый, один раз перезагружаемся с уникальным адресом.
if (!$('stickZone') || !$('btnMenu') || !$('btnSkip') || !$('hint')) {
  const u = new URL(location.href);
  if (!u.searchParams.has('r')) {
    u.searchParams.set('r', String(Date.now()));
    location.replace(u.toString());
  }
  throw new Error('Страница устарела, перезагрузка');
}

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
  if (!inTG || !settings.vibro) return;
  try { tg.HapticFeedback.impactOccurred(kind); } catch (e) { /* нет вибро */ }
}
function hapticTick() {
  if (!inTG || !settings.vibro) return;
  try { tg.HapticFeedback.selectionChanged(); } catch (e) { /* нет вибро */ }
}

const renderer = new Renderer($('cv'));
const sound = new Sound();
sound.on = settings.sound;

// Размеры пульта: джойстик по настройке, кнопки — по оставшемуся месту.
function applyLayout() {
  const app = $('app'), ctrl = $('controls');
  app.classList.toggle('lefty', settings.hand === 'left');
  const avail = Math.max(240, ctrl.clientWidth - 24);
  const stickPx = Math.round(Math.min(STICK_SIZES[settings.stick] || 170, avail * 0.56));
  const wb = avail - stickPx - 8;
  const fire = Math.round(Math.min(110, wb * 0.62));
  const mine = Math.round(Math.min(84, wb * 0.46));
  const btnsW = Math.round(fire * 0.84 + mine + 2);
  const ctrlH = Math.round(Math.max(stickPx, fire * 0.66 + 4 + mine) + 14);
  const st = app.style;
  st.setProperty('--stick', stickPx + 'px');
  st.setProperty('--fire', fire + 'px');
  st.setProperty('--mine', mine + 'px');
  st.setProperty('--btnsW', btnsW + 'px');
  st.setProperty('--ctrlH', ctrlH + 'px');
}
function onResize() { applyLayout(); renderer.resize(); }
window.addEventListener('resize', onResize);
if (inTG && tg.onEvent) tg.onEvent('viewportChanged', onResize);

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

// Джойстик: нажимать можно в любом месте своей половины пульта, направление
// считается от центра круга. Стрелка нужного направления подсвечивается.
const stickZone = $('stickZone'), stick = $('stick'), knob = $('knob');
const arrows = [...stick.querySelectorAll('.arr')]; // u, r, d, l — совпадает с направлениями 0..3
let stickId = null;
function setStickDir(d) {
  if (d === input.stickDir) return;
  input.stickDir = d;
  arrows.forEach((a, i) => a.classList.toggle('lit', i === d));
  if (d >= 0) hapticTick();
}
function stickMove(e) {
  const r = stick.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy), max = r.width * 0.32;
  const k = len > max ? max / len : 1;
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  const dead = r.width * 0.09;
  if (len < dead) setStickDir(-1);
  else if (Math.abs(dx) > Math.abs(dy)) setStickDir(dx > 0 ? 1 : 3);
  else setStickDir(dy > 0 ? 2 : 0);
}
stickZone.addEventListener('pointerdown', e => {
  if (stickId !== null) return;
  stickId = e.pointerId;
  try { stickZone.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
  stick.classList.add('on');
  stickMove(e);
  sound.init();
});
stickZone.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
function stickEnd(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  setStickDir(-1);
  stick.classList.remove('on');
  knob.style.transform = '';
}
stickZone.addEventListener('pointerup', stickEnd);
stickZone.addEventListener('pointercancel', stickEnd);
stickZone.addEventListener('contextmenu', e => e.preventDefault());

function holdButton(el, on, off) {
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
    el.classList.add('down'); on(); sound.init();
  });
  const end = () => { el.classList.remove('down'); off(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
holdButton($('btnFire'), () => { input.touchFire = true; }, () => { input.touchFire = false; });
holdButton($('btnMine'), () => { input.mineReq = true; haptic('light'); }, () => {});
for (const el of [$('btnFire'), $('btnMine')]) el.addEventListener('contextmenu', e => e.preventDefault());

function resetInput() {
  input.held = []; input.keyFire = false; input.touchFire = false; input.mineReq = false;
  setStickDir(-1);
  knob.style.transform = '';
  stick.classList.remove('on');
  stickId = null;
  for (const b of [$('btnFire'), $('btnMine')]) b.classList.remove('down');
}

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
let paused = false;
let lastTheme = '';
let matchDifficulty = 'normal';
let matchQuestsDone = [];
let tutorial = null; // { step, t } — обучение в первом раунде первого матча

function menuIcon() {
  $('btnMenu').textContent = paused ? '▶' : (world && phase !== 'menu' ? '⏸' : '⚙');
}

function setDeadControls(on) {
  $('controls').classList.toggle('dead', on);
  $('btnSkip').classList.toggle('hidden', !on);
}

const progress = new Progress(tg);

// ---------- Подсказки обучения ----------
const TUTORIAL_STEPS = [
  'Это ваш танк — над ним жёлтая стрелка. Двигайтесь джойстиком (на компьютере — WASD или стрелки).',
  'Нажмите «ОГОНЬ» (пробел): снаряд летит прямо и ломает кирпич.',
  'Нажмите «МИНА» (E) и сразу уезжайте за угол: взрыв идёт крестом и задевает всех, вас тоже.',
  'Из кирпичей выпадают ящики с бонусами — наезжайте на них. Красные бочки взрываются от выстрела.',
  'Теперь бой! За попадания танк получает ★ и растёт в уровне. Удачи!',
];

function hint(text) {
  const h = $('hint');
  if (!text) { h.className = 'hidden'; return; }
  h.innerHTML = text;
  h.className = '';
}

function tutorialAdvance(step) {
  if (!tutorial || tutorial.step >= step) return;
  tutorial.step = step;
  tutorial.t = 0;
  hint(`<b>Обучение ${Math.min(step + 1, 5)}/5.</b> ${TUTORIAL_STEPS[step]}`);
  sound.play('beep');
  if (step === 4 && world) world.peace = world.time + 2; // боты вступают в бой
}

function tutorialTick(dt) {
  if (!tutorial || phase !== 'play') return;
  tutorial.t += dt;
  const p = world.tanks[0];
  if (tutorial.step === 0 && p.dist >= 2) tutorialAdvance(1);
  else if (tutorial.step === 2 && tutorial.mined && tutorial.t > 3) tutorialAdvance(3);
  else if (tutorial.step === 3 && tutorial.t > 10) tutorialAdvance(4);
  else if (tutorial.step === 4 && tutorial.t > 7) hint(null);
  // защита: если игрок застрял на подсказке, боты всё равно начинают через минуту
  if (tutorial.step < 4 && world.time > 60) tutorialAdvance(4);
}

// ---------- Меню ----------
function statBar(label, v) {
  const pct = Math.round(Math.max(0.08, Math.min(1, v)) * 100);
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function modelStats(m) {
  return statBar('Броня', m.hp / 4) + statBar('Скорость', (m.speed - 2) / 1.7) +
    statBar('Огонь', 0.45 / m.reload) + statBar('Мины', (m.mines + m.range - 2) / 3);
}

function showScreen(html, cls = '') {
  const s = $('screen');
  s.innerHTML = html;
  s.className = 'overlay' + (cls ? ' ' + cls : '');
  s.scrollTop = 0;
}

// Нарисовать танк игрока (модель + камуфляж) в маленьких canvas с атрибутом data-tank.
function drawPreviews() {
  for (const c of document.querySelectorAll('canvas[data-tank]')) {
    const size = 64, dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const model = c.dataset.model || progress.data.selected;
    const s = 52;
    const t = {
      id: 0, model, shape: MODELS[model].shape, skin: c.dataset.skin || progress.data.skin,
      x: size / 2 / s - 0.5, y: size / 2 / s - 0.5 + 0.04, angle: 0, level: Number(c.dataset.level || 1),
      recoil: 0, dist: 0, hitFlash: 0,
    };
    renderer.drawTank(ctx, t, s, false);
  }
}

function showMenu() {
  phase = 'menu';
  paused = false;
  world = null;
  tutorial = null;
  hint(null);
  hideBanner();
  setDeadControls(false);
  resetInput();
  renderScore();
  menuIcon();
  progress.ensureDaily();
  const d = progress.data, m = MODELS[d.selected];
  const login = progress.loginStatus();
  const claimable = progress.claimableCount();
  const loginCard = login.canClaim
    ? `<div class="card gift"><div class="ch"><div class="cn"><b>Награда за вход · день ${login.day}</b>
         <small>Заходите каждый день — награда растёт до 7-го дня</small></div>
         <button class="sm buy" data-act="login"><i class="coin"></i> +${login.reward}</button></div></div>`
    : '';
  showScreen(`
    <h1>Минная арена</h1>
    <div class="coins"><i class="coin"></i> ${d.coins}</div>
    ${loginCard}
    <div class="card sel"><div class="ch"><canvas data-tank></canvas><div class="cn"><b>${m.name}</b><small>${m.desc} · камуфляж «${SKINS[d.skin].name}»</small></div></div>${modelStats(m)}</div>
    <div class="set"><span>Сложность ботов</span>
      ${seg('difficulty', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]))}
      <small>Монеты за матч: лёгкий ×0,7 · средний ×1 · сложный ×1,5</small>
    </div>
    <button data-act="start" class="big">В бой</button>
    <div class="row2">
      <button data-act="quests" class="mid">Задания${claimable ? ` <i class="badge">${claimable}</i>` : ''}</button>
      <button data-act="garage" class="mid">Гараж</button>
    </div>
    <button data-act="settings" class="mid">Настройки</button>
    <div class="how">
      <p><b>Пушка</b> бьёт по прямой. <b>Мина</b> взрывается через 2,5 с крестом и задевает всех, вас тоже. <b>Бочки</b> взрываются от выстрела или от мины.</p>
      <p><b>Арены</b> меняются каждый раунд: поле, город, зима (на льду танк заносит), пустыня.</p>
      <p><b>Уровни в бою:</b> попадание даёт ★, уничтожение — ★★★. ${LEVELS.slice(1).map(l => `${l.name} (${l.stars}★): ${l.perk}`).join('; ')}.</p>
      <p><b>Бонусы:</b> ${BONUS_TYPES.map(b => BONUS_INFO[b]).join(', ')}. С радиоминой кнопка «Мина» превращается в «Взрыв».</p>
      <p>С 70-й секунды арена сжимается — уходите с красных клеток.</p>
    </div>`);
  drawPreviews();
}

function showQuests() {
  progress.ensureDaily();
  const d = progress.data;
  const qs = d.daily.quests.map((q, i) => {
    const pct = Math.round(q.progress / q.n * 100);
    const btn = q.claimed ? '<button class="sm on" disabled>Получено</button>'
      : q.progress >= q.n ? `<button class="sm buy" data-act="claim" data-id="${i}"><i class="coin"></i> +${q.reward}</button>`
        : `<span class="rw-pre"><i class="coin"></i> ${q.reward}</span>`;
    return `<div class="card quest${q.claimed ? ' done' : ''}"><div class="ch"><div class="cn"><b>${progress.questText(q)}</b>
      <small>${q.progress} из ${q.n}</small></div>${btn}</div>
      <div class="stat"><div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join('');
  const st = progress.loginStatus();
  const streak = st.canClaim ? st.day - 1 : st.day;
  const days = LOGIN_REWARDS.map((r, i) =>
    `<div class="day${i < streak ? ' got' : ''}${st.canClaim && i === st.day - 1 ? ' next' : ''}"><small>${i + 1}</small><b>${r}</b></div>`).join('');
  const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const left = Math.max(0, mid - now), hh = Math.floor(left / 3600000), mm = Math.floor(left / 60000) % 60;
  showScreen(`
    <h1>Задания</h1>
    <div class="coins"><i class="coin"></i> ${d.coins}</div>
    <p class="sub">Новые задания через ${hh} ч ${mm} мин</p>
    ${qs}
    <div class="set"><span>Награда за вход</span><div class="days">${days}</div>
      <small>${st.canClaim ? `Сегодня можно забрать награду за ${st.day}-й день.` : 'Сегодняшняя награда получена. Пропуск дня начинает серию заново.'}</small>
    </div>
    ${st.canClaim ? `<button data-act="login" class="mid">Забрать <i class="coin"></i> ${st.reward}</button>` : ''}
    <button data-act="menu" class="mid">Назад</button>`);
}

function showGarage(tab = 'models') {
  const d = progress.data;
  let cards;
  if (tab === 'models') {
    cards = MODEL_IDS.map(id => {
      const m = MODELS[id];
      const owned = progress.owns(id), sel = d.selected === id;
      const btn = sel ? '<button class="sm on" disabled>Выбран</button>'
        : owned ? `<button class="sm" data-act="select" data-id="${id}">Выбрать</button>`
          : `<button class="sm buy" data-act="buy" data-id="${id}" ${d.coins < m.cost ? 'disabled' : ''}><i class="coin"></i> ${m.cost}</button>`;
      return `<div class="card${sel ? ' sel' : ''}${owned ? '' : ' locked'}">
        <div class="ch"><canvas data-tank data-model="${id}"></canvas><div class="cn"><b>${m.name}</b><small>${m.desc}</small></div>${btn}</div>${modelStats(m)}</div>`;
    }).join('');
  } else {
    cards = `<div class="grid">${SKIN_IDS.map(id => {
      const k = SKINS[id];
      const owned = progress.ownsSkin(id), sel = d.skin === id;
      const btn = sel ? '<button class="sm on" disabled>Надет</button>'
        : owned ? `<button class="sm" data-act="skin" data-id="${id}">Надеть</button>`
          : `<button class="sm buy" data-act="buyskin" data-id="${id}" ${d.coins < k.cost ? 'disabled' : ''}><i class="coin"></i> ${k.cost}</button>`;
      return `<div class="card skin${sel ? ' sel' : ''}"><canvas data-tank data-skin="${id}"></canvas><b>${k.name}</b>${btn}</div>`;
    }).join('')}</div>
    <p class="sub">Камуфляж меняет только внешний вид, на силу танка не влияет. Позже его можно будет купить и за Telegram Stars.</p>`;
  }
  showScreen(`
    <h1>Гараж</h1>
    <div class="coins"><i class="coin"></i> ${d.coins}</div>
    <div class="seg tabs">
      <button data-act="garage" data-id="models" class="${tab === 'models' ? 'on' : ''}">Танки</button>
      <button data-act="garage" data-id="skins" class="${tab === 'skins' ? 'on' : ''}">Камуфляж</button>
    </div>
    ${cards}
    <p class="sub" style="margin-top:10px">Монеты дают за матчи, задания и ежедневный вход.</p>
    <button data-act="menu" class="mid">Назад</button>`);
  $('screen').dataset.tab = tab;
  drawPreviews();
}

// Настройки: из меню (from = 'menu') или из паузы во время боя (from = 'pause').
function seg(key, options) {
  return `<div class="seg">${options.map(([v, label]) =>
    `<button data-set="${key}" data-v="${v}" class="${String(settings[key]) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

function showSettings(from) {
  const inBattle = from === 'pause';
  showScreen(`
    <h1>${inBattle ? 'Пауза' : 'Настройки'}</h1>
    <p class="sub">${inBattle ? 'Бой остановлен' : 'Изменения сразу видны на пульте внизу'}</p>
    <div class="set"><span>Рука</span>
      ${seg('hand', [['right', 'Правша'], ['left', 'Левша']])}
      <small>${settings.hand === 'left' ? 'Джойстик справа, кнопки «Огонь» и «Мина» слева.' : 'Джойстик слева, кнопки «Огонь» и «Мина» справа.'}</small>
    </div>
    <div class="set"><span>Размер джойстика</span>
      ${seg('stick', [['m', 'Средний'], ['l', 'Большой'], ['xl', 'Огромный']])}
      <small>На узком экране джойстик может быть чуть меньше выбранного, чтобы поместились кнопки.</small>
    </div>
    <div class="set"><span>Звук</span>${seg('sound', [['true', 'Вкл'], ['false', 'Выкл']])}</div>
    <div class="set"><span>Вибрация</span>${seg('vibro', [['true', 'Вкл'], ['false', 'Выкл']])}
      <small>Работает, когда игра открыта в Telegram.</small>
    </div>
    ${inBattle
      ? '<button data-act="resume" class="big">Продолжить</button><button data-act="quit" class="mid">Выйти в меню</button><p class="sub" style="margin-top:8px">При выходе матч не засчитывается, монеты не начисляются.</p>'
      : `<button data-act="retutor" class="mid">Пройти обучение заново</button>
         <button data-act="menu" class="mid">Готово</button>`}`, 'settings');
  $('screen').dataset.from = from;
}

function changeSetting(key, v) {
  if (key === 'hand') settings.hand = v === 'left' ? 'left' : 'right';
  else if (key === 'stick' && v in STICK_SIZES) settings.stick = v;
  else if (key === 'sound') { settings.sound = v === 'true'; sound.on = settings.sound; if (sound.on) { sound.init(); sound.play('beep'); } }
  else if (key === 'vibro') { settings.vibro = v === 'true'; haptic('medium'); }
  else if (key === 'difficulty' && v in DIFFICULTY) { settings.difficulty = v; saveSettings(); showMenu(); return; }
  saveSettings();
  onResize();
  showSettings($('screen').dataset.from || 'menu');
}

function pauseGame() {
  if (!world || phase === 'menu' || paused) return;
  paused = true;
  resetInput();
  menuIcon();
  showSettings('pause');
}

function resumeGame() {
  paused = false;
  resetInput();
  menuIcon();
  $('screen').className = 'overlay hidden';
  last = performance.now();
  acc = 0;
}

// ---------- Задания: учёт событий боя ----------
function questDone(list) {
  for (const q of list) {
    matchQuestsDone.push(q);
    banner(`Задание выполнено!<small>${progress.questText(q)}</small>`, 'small');
    setTimeout(() => { if (phase === 'play' || phase === 'countdown') hideBanner(); }, 2200);
    sound.play('pickup');
    haptic('medium');
  }
}

function trackEvent(e) {
  if (AUTO) return;
  if (e.type === 'dead' && e.by === 0 && e.tank !== 0) {
    matchKills++;
    questDone(progress.addQuest('kills'));
    if (e.kind === 'blast') questDone(progress.addQuest('mineKills'));
  } else if (e.type === 'pickup' && e.tank === 0) questDone(progress.addQuest('pickups'));
  else if (e.type === 'brickbreak' && e.by === 0) questDone(progress.addQuest('bricks'));
  else if (e.type === 'barrel' && e.by === 0) questDone(progress.addQuest('barrels'));
  else if (e.type === 'levelup' && e.tank === 0 && e.level === 3) questDone(progress.addQuest('heavy'));
}

// После гибели игрока: досчитать раунд без отрисовки и сразу показать итог.
function skipRound() {
  if (phase !== 'play' || !world || world.tanks[0].alive || paused) return;
  const limit = ROUND_TIME * 60 + 60;
  for (let i = 0; i < limit; i++) {
    if (world.tanks.filter(t => t.alive).length <= 1 || world.time >= ROUND_TIME) break;
    for (const t of world.tanks) if (t.alive && t.id !== 0) botThink(world, t, STEP);
    world.update(STEP);
    for (const e of world.events) trackEvent(e);
    world.events.length = 0;
  }
  renderer.parts = [];
  setDeadControls(false);
  hideBanner();
  endRound();
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
    const col = i === 0 ? SKINS[progress.data.skin].body : t.body;
    return `<div class="sc${i === 0 ? ' me' : ''}${dead}"><i style="background:${col}"></i><b>${dots}</b></div>`;
  }).join('');
}

function startMatch() {
  wins = [0, 0, 0, 0];
  round = 0;
  matchKills = 0;
  matchQuestsDone = [];
  lastTheme = '';
  botModels = MODEL_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const learn = !progress.data.tutorialDone && !AUTO;
  matchDifficulty = learn ? 'easy' : settings.difficulty;
  tutorial = learn ? { step: -1, t: 0 } : null;
  paused = false;
  $('screen').className = 'overlay hidden';
  resetInput();
  sound.init();
  startRound();
}

function startRound() {
  round++;
  const choices = THEME_IDS.filter(t => t !== lastTheme);
  const theme = tutorial && round === 1 ? 'field' : choices[Math.floor(Math.random() * choices.length)];
  lastTheme = theme;
  world = new World({
    models: [progress.data.selected, ...botModels],
    skins: [progress.data.skin],
    theme,
    difficulty: matchDifficulty,
    peace: tutorial && round === 1 ? 1e9 : 0,
  });
  if (AUTO) world.tanks[0].diffOverride = DIFFICULTY.normal;
  renderer.reset(world);
  phase = 'countdown';
  phaseT = 2.4;
  lastBeep = 0;
  playerDownShown = false;
  input.mineReq = false;
  setDeadControls(false);
  if (!(tutorial && round === 1)) { tutorial = null; hint(null); }
  renderScore();
  menuIcon();
}

function endRound() {
  setDeadControls(false);
  const alive = world.tanks.filter(t => t.alive);
  const winner = alive.length === 1 ? alive[0] : null;
  if (winner) wins[winner.id]++;
  if (winner && winner.id === 0 && !AUTO) questDone(progress.addQuest('roundsWon'));
  if (tutorial) { progress.setTutorialDone(); tutorial = null; hint(null); }
  progress.save();
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
  if (!AUTO) questDone(progress.addQuest('matches'));
  hideBanner();
  const champ = wins.indexOf(Math.max(...wins));
  const rows = TANK_INFO.map((t, i) =>
    `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${i === 0 ? SKINS[progress.data.skin].body : t.body};margin-right:6px"></span>${t.name}</td><td class="w">${'●'.repeat(wins[i])}</td></tr>`).join('');
  const dm = DIFFICULTY[matchDifficulty];
  const rw = AUTO ? { parts: [], total: 0 }
    : progress.reward({ kills: matchKills, roundsWon: wins[0], matchWon: champ === 0, mult: dm.coins, diffName: dm.name });
  const sign = v => (v >= 0 ? '+' : '−') + Math.abs(v);
  const rwRows = rw.parts.map(([a, b]) => `<tr><td>${a}</td><td class="w">${sign(b)}</td></tr>`).join('');
  const qDone = matchQuestsDone.length
    ? `<p class="sub">Выполнено заданий: ${matchQuestsDone.length} — заберите награду в «Заданиях»</p>` : '';
  setDeadControls(false);
  menuIcon();
  showScreen(`
    <h1>${champ === 0 ? 'Победа!' : 'Поражение'}</h1>
    <p class="sub">${champ === 0 ? 'Арена ваша' : `Матч выиграл: ${TANK_INFO[champ].name}`} · раундов: ${round} · ${dm.name.toLowerCase()} уровень</p>
    <table>${rows}</table>
    <table class="rw">${rwRows}<tr class="tot"><td>Итого</td><td class="w"><i class="coin"></i> ${sign(rw.total)}</td></tr></table>
    <div class="coins"><i class="coin"></i> ${progress.data.coins}</div>
    ${qDone}
    <button data-act="start" class="big">Новый матч</button>
    <div class="row2">
      <button data-act="quests" class="mid">Задания${progress.claimableCount() ? ` <i class="badge">${progress.claimableCount()}</i>` : ''}</button>
      <button data-act="garage" class="mid">Гараж</button>
    </div>
    <button data-act="menu" class="mid">В меню</button>`);
}

function handleEvents() {
  if (!world.events.length) return;
  renderer.onEvents(world.events);
  for (const e of world.events) {
    trackEvent(e);
    if (e.type === 'shot') { sound.play('shot'); if (e.tank === 0) { haptic('light'); if (tutorial && tutorial.step === 1) tutorialAdvance(2); } }
    else if (e.type === 'explode') { sound.play('explode'); haptic('medium'); }
    else if (e.type === 'dead') { sound.play('dead'); haptic('heavy'); renderScore(); }
    else if (e.type === 'levelup') { if (e.tank === 0) { sound.play('pickup'); haptic('medium'); } }
    else if (e.type === 'hit') { sound.play('hit'); if (e.tank === 0) haptic('heavy'); }
    else if (e.type === 'shieldHit') { sound.play('brick'); }
    else if (e.type === 'brickhit' || e.type === 'brickbreak') sound.play('brick');
    else if (e.type === 'mine') {
      sound.play('mine');
      if (e.tank === 0 && tutorial && tutorial.step === 2) { tutorial.mined = true; tutorial.t = 0; }
    }
    else if (e.type === 'detonate') sound.play('beep');
    else if (e.type === 'pickup') {
      if (e.tank === 0) {
        sound.play('pickup'); haptic('light');
        const s = renderer.ts;
        renderer.spawn('label', (e.x + 0.5) * s, (e.y + 0.5) * s - s * 0.8,
          { vy: -s * 0.7, life: 1.4, drag: 1, size: s * 0.32, color: '#fff1a8', text: BONUS_INFO[e.bonus] });
        if (tutorial && tutorial.step === 3) tutorialAdvance(4);
      }
    }
    else if (e.type === 'crush') sound.play('crush');
    else if (e.type === 'shrinkStart') { banner('Арена сжимается!', 'small'); setTimeout(() => { if (phase === 'play') hideBanner(); }, 1800); }
  }
  world.events.length = 0;
}

// Кнопка мины: «ВЗРЫВ», когда на поле есть своя радиомина; счётчик радиомин.
let mineLabel = '';
function updateMineButton() {
  let label = 'МИНА|E';
  if (world && phase !== 'menu') {
    const p = world.tanks[0];
    if (p.alive && world.hasRemote(p)) label = 'ВЗРЫВ|радио';
    else if (p.alive && p.remote > 0) label = `МИНА|радио ×${p.remote}`;
  }
  if (label === mineLabel) return;
  mineLabel = label;
  const [a, b] = label.split('|');
  const btn = $('btnMine');
  btn.innerHTML = `<b>${a}</b><small>${b}</small>`;
  btn.classList.toggle('remote', a === 'ВЗРЫВ');
}

function tick(dt) {
  if (phase === 'menu' || !world || paused) return;

  if (phase === 'countdown') {
    phaseT -= dt;
    const n = Math.ceil(phaseT - 0.6);
    const arena = THEMES[world.theme].name;
    if (n > 0) {
      banner(`${n}<small>Раунд ${round} · ${arena}</small>`);
      if (n !== lastBeep) { lastBeep = n; sound.play('beep'); }
    } else {
      banner('В бой!');
      if (lastBeep !== 0) { lastBeep = 0; sound.play('go'); }
    }
    if (phaseT <= 0) {
      phase = 'play';
      hideBanner();
      if (tutorial && tutorial.step < 0) tutorialAdvance(0);
    }
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
  tutorialTick(dt);

  if (phase === 'play') {
    if (!p.alive && !playerDownShown) {
      playerDownShown = true;
      banner('Вас подбили<small>досматриваем ×2 или пропустите раунд</small>', 'small');
      resetInput();
      if (!AUTO) setDeadControls(true);
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
  updateMineButton();
  requestAnimationFrame(frame);
}

$('screen').addEventListener('click', e => {
  const s = e.target.closest('button[data-set]');
  if (s) { changeSetting(s.dataset.set, s.dataset.v); return; }
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === 'start') startMatch();
  else if (act === 'garage') showGarage(id === 'skins' ? 'skins' : 'models');
  else if (act === 'menu') showMenu();
  else if (act === 'quests') showQuests();
  else if (act === 'settings') showSettings('menu');
  else if (act === 'resume') resumeGame();
  else if (act === 'quit') showMenu();
  else if (act === 'retutor') { progress.setTutorialDone(false); banner('Обучение будет в следующем матче', 'small'); setTimeout(hideBanner, 1600); }
  else if (act === 'select') { progress.select(id); showGarage('models'); }
  else if (act === 'buy') { if (progress.buy(id)) { sound.init(); sound.play('pickup'); } showGarage('models'); }
  else if (act === 'skin') { progress.selectSkin(id); renderScore(); showGarage('skins'); }
  else if (act === 'buyskin') { if (progress.buySkin(id)) { sound.init(); sound.play('pickup'); } renderScore(); showGarage('skins'); }
  else if (act === 'claim') {
    const got = progress.claimQuest(Number(id));
    if (got) { sound.init(); sound.play('pickup'); haptic('medium'); }
    showQuests();
  } else if (act === 'login') {
    const got = progress.claimLogin();
    if (got) { sound.init(); sound.play('pickup'); haptic('medium'); }
    if ($('screen').querySelector('.days')) showQuests(); else showMenu();
  }
});
$('btnMenu').addEventListener('click', () => {
  if (paused) resumeGame();
  else if (world && phase !== 'menu') pauseGame();
  else if (phase === 'menu') showSettings('menu');
});
$('btnSkip').addEventListener('click', skipRound);
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (paused) resumeGame(); else pauseGame(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// Только для отладки из консоли.
window.__game = {
  get world() { return world; }, get phase() { return phase; }, get wins() { return wins; }, get paused() { return paused; },
  get tutorial() { return tutorial; },
  progress, renderer, settings, skipRound, showQuests, showGarage,
  step(sec) { for (let i = 0; i < sec * 60; i++) tick(STEP); renderer.draw(world, STEP, performance.now(), 0); updateTimer(); updateMineButton(); },
};

applyLayout();
renderer.resize();
showMenu();
progress.loadCloud(() => { if (phase === 'menu') showMenu(); });
requestAnimationFrame(frame);
