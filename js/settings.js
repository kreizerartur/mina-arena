// Настройки игрока: рука, размер джойстика, звук, вибрация. Хранятся в браузере.
const KEY = 'mina-arena-settings';

export const STICK_SIZES = { m: 140, l: 170, xl: 200 };

export const settings = { hand: 'right', stick: 'l', sound: true, vibro: true, difficulty: 'normal' };

try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (s && typeof s === 'object') {
    if (s.hand === 'left' || s.hand === 'right') settings.hand = s.hand;
    if (s.stick in STICK_SIZES) settings.stick = s.stick;
    if (typeof s.sound === 'boolean') settings.sound = s.sound;
    if (typeof s.vibro === 'boolean') settings.vibro = s.vibro;
    if (['easy', 'normal', 'hard'].includes(s.difficulty)) settings.difficulty = s.difficulty;
  }
} catch (e) { /* хранилище недоступно — берём значения по умолчанию */ }

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* хранилище недоступно */ }
}
