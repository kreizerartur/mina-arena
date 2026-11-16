// Постоянный прогресс: монеты, открытые танки, выбранный танк.
// Хранится в браузере; внутри Telegram дублируется в облако Telegram (CloudStorage).
import { MODELS } from './world.js';

const KEY = 'mina-arena-v1';
const fresh = () => ({ coins: 0, owned: ['lynx'], selected: 'lynx', matches: 0, wins: 0 });

function clean(raw) {
  const p = { ...fresh(), ...(raw && typeof raw === 'object' ? raw : {}) };
  p.coins = Math.max(0, Math.floor(Number(p.coins) || 0));
  p.owned = Array.isArray(p.owned) ? p.owned.filter(id => id in MODELS) : ['lynx'];
  if (!p.owned.includes('lynx')) p.owned.unshift('lynx');
  if (!p.owned.includes(p.selected)) p.selected = 'lynx';
  return p;
}

export class Progress {
  constructor(tg) {
    this.cloud = tg && tg.initData && tg.CloudStorage ? tg.CloudStorage : null;
    this.data = fresh();
    try { this.data = clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { /* хранилище недоступно */ }
  }

  // Подтянуть сохранение из облака Telegram (если оно богаче локального).
  loadCloud(onDone) {
    if (!this.cloud) return;
    try {
      this.cloud.getItem(KEY, (err, value) => {
        if (err || !value) return;
        try {
          const c = clean(JSON.parse(value));
          if (c.coins + c.owned.length * 1000 > this.data.coins + this.data.owned.length * 1000) {
            this.data = c;
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

  // Награда за матч. Возвращает разбивку для экрана итогов.
  reward({ kills, roundsWon, matchWon }) {
    const parts = [
      ['Участие', 10],
      [`Подбито танков: ${kills}`, kills * 10],
      [`Выиграно раундов: ${roundsWon}`, roundsWon * 20],
    ];
    if (matchWon) parts.push(['Победа в матче', 50]);
    const total = parts.reduce((a, p) => a + p[1], 0);
    this.data.coins += total;
    this.data.matches++;
    if (matchWon) this.data.wins++;
    this.save();
    return { parts, total };
  }
}
