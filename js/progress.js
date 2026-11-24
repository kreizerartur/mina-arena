// Постоянный прогресс: монеты, танки, камуфляжи, ежедневные задания и награда за вход, обучение.
// Хранится в браузере; внутри Telegram дублируется в облако Telegram (CloudStorage).
import { MODELS, SKINS } from './world.js?v=202611242311';

const KEY = 'mina-arena-v1';

function pl(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

// Виды ежедневных заданий: варианты цели и награды (по индексу).
export const QUEST_TYPES = {
  kills:     { n: [3, 5, 8],  reward: [40, 60, 90], text: n => `Подбейте ${n} ${pl(n, 'танк', 'танка', 'танков')}` },
  mineKills: { n: [1, 2],     reward: [50, 80],     text: n => `Подбейте ${n} ${pl(n, 'танк', 'танка', 'танков')} миной или бочкой` },
  roundsWon: { n: [1, 2, 3],  reward: [40, 60, 90], text: n => `Выиграйте ${n} ${pl(n, 'раунд', 'раунда', 'раундов')}` },
  pickups:   { n: [4, 8],     reward: [30, 50],     text: n => `Подберите ${n} ${pl(n, 'ящик', 'ящика', 'ящиков')} с бонусами` },
  bricks:    { n: [15, 30],   reward: [30, 50],     text: n => `Разрушьте ${n} ${pl(n, 'кирпичную стену', 'кирпичные стены', 'кирпичных стен')}` },
  matches:   { n: [2, 3],     reward: [30, 45],     text: n => `Сыграйте ${n} ${pl(n, 'матч', 'матча', 'матчей')} до конца` },
  heavy:     { n: [1],        reward: [60],         text: () => 'Прокачайте танк в бою до уровня «Тяжёлый»' },
  barrels:   { n: [3, 6],     reward: [30, 50],     text: n => `Взорвите ${n} ${pl(n, 'бочку', 'бочки', 'бочек')} с топливом` },
};

export const LOGIN_REWARDS = [20, 30, 40, 50, 60, 80, 150];

function dayStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function today() { return dayStr(new Date()); }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); }

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const fresh = () => ({
  coins: 0, owned: ['lynx'], selected: 'lynx', matches: 0, wins: 0,
  skins: ['standard'], skin: 'standard', tutorialDone: false,
  daily: null, login: { last: '', streak: 0 },
});

function clean(raw) {
  const p = { ...fresh(), ...(raw && typeof raw === 'object' ? raw : {}) };
  p.coins = Math.max(0, Math.floor(Number(p.coins) || 0));
  p.matches = Math.max(0, Math.floor(Number(p.matches) || 0));
  p.wins = Math.max(0, Math.floor(Number(p.wins) || 0));
  p.owned = Array.isArray(p.owned) ? p.owned.filter(id => id in MODELS) : ['lynx'];
  if (!p.owned.includes('lynx')) p.owned.unshift('lynx');
  if (!p.owned.includes(p.selected)) p.selected = 'lynx';
  p.skins = Array.isArray(p.skins) ? p.skins.filter(id => id in SKINS) : ['standard'];
  if (!p.skins.includes('standard')) p.skins.unshift('standard');
  if (!p.skins.includes(p.skin)) p.skin = 'standard';
  p.tutorialDone = p.tutorialDone === true;
  const d = p.daily;
  if (!d || typeof d.date !== 'string' || !Array.isArray(d.quests) ||
      !d.quests.every(q => q && q.type in QUEST_TYPES && Number.isFinite(q.n) && Number.isFinite(q.progress))) {
    p.daily = null;
  }
  const l = p.login;
  p.login = l && typeof l.last === 'string' && Number.isFinite(l.streak) ? { last: l.last, streak: Math.max(0, l.streak | 0) } : { last: '', streak: 0 };
  return p;
}

export class Progress {
  constructor(tg) {
    this.cloud = tg && tg.initData && tg.CloudStorage ? tg.CloudStorage : null;
    this.data = fresh();
    try { this.data = clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { /* хранилище недоступно */ }
    this.ensureDaily();
  }

  // Подтянуть сохранение из облака Telegram (если оно богаче локального).
  loadCloud(onDone) {
    if (!this.cloud) return;
    const score = p => p.coins + p.owned.length * 1000 + p.skins.length * 300 + p.matches * 5;
    try {
      this.cloud.getItem(KEY, (err, value) => {
        if (err || !value) return;
        try {
          const c = clean(JSON.parse(value));
          if (score(c) > score(this.data)) {
            this.data = c;
            this.ensureDaily();
            this.save(true);
            if (onDone) onDone();
          }
        } catch (e) { /* битые данные — игнорируем */ }
      });
    } catch (e) { /* старый клиент */ }
  }

  save(localOnly) {
    const s = JSON.stringify(this.data);
    try { localStorage.setItem(KEY, s); } catch (e) { /* хранилище недоступно */ }
    if (this.cloud && !localOnly) { try { this.cloud.setItem(KEY, s); } catch (e) { /* нет облака */ } }
  }

  // ---------- танки ----------
  owns(id) { return this.data.owned.includes(id); }

  buy(id) {
    const m = MODELS[id];
    if (!m || this.owns(id) || this.data.coins < m.cost) return false;
    this.data.coins -= m.cost;
    this.data.owned.push(id);
    this.data.selected = id;
    this.save();
    return true;
  }

  select(id) {
    if (!this.owns(id)) return false;
    this.data.selected = id;
    this.save();
    return true;
  }

  // ---------- камуфляжи ----------
  ownsSkin(id) { return this.data.skins.includes(id); }

  buySkin(id) {
    const k = SKINS[id];
    if (!k || this.ownsSkin(id) || this.data.coins < k.cost) return false;
    this.data.coins -= k.cost;
    this.data.skins.push(id);
    this.data.skin = id;
    this.save();
    return true;
  }

  selectSkin(id) {
    if (!this.ownsSkin(id)) return false;
    this.data.skin = id;
    this.save();
    return true;
  }

  // ---------- обучение ----------
  setTutorialDone(v = true) {
    this.data.tutorialDone = v;
    this.save();
  }

  // ---------- ежедневные задания ----------
  ensureDaily() {
    const date = today();
    if (this.data.daily && this.data.daily.date === date) return false;
    const rnd = seeded('quests-' + date);
    const types = Object.keys(QUEST_TYPES);
    const quests = [];
    while (quests.length < 3) {
      const type = types[Math.floor(rnd() * types.length)];
      if (quests.some(q => q.type === type)) continue;
      const def = QUEST_TYPES[type];
      const i = Math.floor(rnd() * def.n.length);
      quests.push({ type, n: def.n[i], reward: def.reward[i], progress: 0, claimed: false });
    }
    this.data.daily = { date, quests };
    this.save(true);
    return true;
  }

  questText(q) { return QUEST_TYPES[q.type].text(q.n); }

  // Засчитать прогресс. Возвращает задания, выполненные именно сейчас.
  addQuest(type, amount = 1) {
    this.ensureDaily();
    const done = [];
    for (const q of this.data.daily.quests) {
      if (q.type !== type || q.claimed || q.progress >= q.n) continue;
      q.progress = Math.min(q.n, q.progress + amount);
      if (q.progress >= q.n) done.push(q);
    }
    return done;
  }

  claimQuest(i) {
    this.ensureDaily();
    const q = this.data.daily.quests[i];
    if (!q || q.claimed || q.progress < q.n) return 0;
    q.claimed = true;
    this.data.coins += q.reward;
    this.save();
    return q.reward;
  }

  claimableCount() {
    this.ensureDaily();
    return this.data.daily.quests.filter(q => !q.claimed && q.progress >= q.n).length;
  }

  // ---------- награда за вход ----------
  loginStatus() {
    const l = this.data.login, t = today();
    if (l.last === t) return { canClaim: false, day: ((l.streak - 1) % 7) + 1, reward: 0 };
    const streak = l.last === yesterday() ? l.streak + 1 : 1;
    const day = ((streak - 1) % 7) + 1;
    return { canClaim: true, day, streak, reward: LOGIN_REWARDS[day - 1] };
  }

  claimLogin() {
    const st = this.loginStatus();
    if (!st.canClaim) return 0;
    this.data.login = { last: today(), streak: st.streak };
    this.data.coins += st.reward;
    this.save();
    return st.reward;
  }

  // ---------- награда за матч ----------
  reward({ kills, roundsWon, matchWon, mult = 1, diffName = '' }) {
    const parts = [
      ['Участие', 10],
      [`Подбито танков: ${kills}`, kills * 10],
      [`Выиграно раундов: ${roundsWon}`, roundsWon * 20],
    ];
    if (matchWon) parts.push(['Победа в матче', 50]);
    let total = parts.reduce((a, p) => a + p[1], 0);
    if (mult !== 1) {
      const bonus = Math.round(total * mult) - total;
      parts.push([`Сложность «${diffName}» ×${String(mult).replace('.', ',')}`, bonus]);
      total += bonus;
    }
    this.data.coins += total;
    this.data.matches++;
    if (matchWon) this.data.wins++;
    this.save();
    return { parts, total };
  }
}
