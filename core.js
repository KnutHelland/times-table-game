const PROFILES_KEY = 'ttg.profiles.v1';
// the language last used on this device, for the screens shown before a player is chosen
const LANGUAGE_KEY = 'ttg.language.v1';
// saved before there were profiles; moved into the first profile that is created
const LEGACY_KEYS = { settings: 'ttg.settings.v1', scores: 'ttg.scores.v1', progress: 'ttg.progress.v1' };

const $ = id => document.getElementById(id);

// --- storage (may be unavailable in private windows) ---

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function replaceContents(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

// --- profiles: each player has their own settings, medals and high scores ---

const AVATARS = ['fox', 'cat', 'dog', 'panda', 'lion', 'unicorn', 'frog', 'owl',
  'tiger', 'koala', 'rabbit', 'bear', 'penguin', 'monkey', 'octopus', 'dragon'];
const PROFILE_PARTS = ['settings', 'scores', 'progress'];
const MAX_NAME_LENGTH = 20;

const profiles = { active: null, list: [], ...load(PROFILES_KEY, {}) };
const profileKey = (id, part) => `ttg.profile.${id}.${part}.v1`;
const activeProfile = () => profiles.list.find(profile => profile.id === profiles.active);
const avatarUrl = avatar => `avatars/${avatar}.svg`;
const sameName = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const loadOwn = (part, fallback) => profiles.active ? load(profileKey(profiles.active, part), fallback) : fallback;

function saveOwn(part, value) {
  if (profiles.active) save(profileKey(profiles.active, part), value);
}

function createProfile(name, avatar) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (profiles.list.length === 0) {
    for (const part of PROFILE_PARTS) {
      const legacy = load(LEGACY_KEYS[part], null);
      if (legacy === null) continue;
      save(profileKey(id, part), legacy);
      remove(LEGACY_KEYS[part]);
    }
  }
  // the new player gets the language shown while it was created (which is what the flags on the Welcome screen pick)
  save(profileKey(id, 'settings'), { ...load(profileKey(id, 'settings'), {}), lang: settings.lang });
  profiles.list.push({ id, name: name.trim(), avatar });
  save(PROFILES_KEY, profiles);
  return id;
}

function renameProfile(id, name) {
  profiles.list.find(profile => profile.id === id).name = name.trim();
  save(PROFILES_KEY, profiles);
}

// hidden feature: a player named Super has every level unlocked (but no medals); renaming makes it an ordinary player
const SUPER_NAME = 'Super';
const isSuperPlayer = () => sameName(activeProfile()?.name ?? '', SUPER_NAME);

function deleteProfile(id) {
  for (const part of PROFILE_PARTS) remove(profileKey(id, part));
  profiles.list = profiles.list.filter(profile => profile.id !== id);
  if (profiles.active === id) profiles.active = null;
  save(PROFILES_KEY, profiles);
}

const defaultSettings = () => ({
  lang: load(LANGUAGE_KEY, null) ?? load(LEGACY_KEYS.settings, {}).lang ?? browserLanguage(),
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  include1112: false,
  tab: 'levels',
});

const settings = { ...defaultSettings(), ...loadOwn('settings', {}) };

const rememberLanguage = () => save(LANGUAGE_KEY, settings.lang);

const t = (key, ...args) => {
  const value = (STRINGS[settings.lang] ?? STRINGS.en)[key];
  return typeof value === 'function' ? value(...args) : value;
};

// --- formatting ---

function formatNumber(value, decimals) {
  const text = value.toFixed(decimals);
  return text.replace('.', t('decimal'));
}

const formatTime = ms => `${formatNumber(ms / 1000, 1)} s`;
const formatSeconds = s => `${formatNumber(s, Number.isInteger(s) ? 0 : 1)} s`;
const expression = (a, b) => `${a} ${t('times')} ${b}`;

function formatTables(tables) {
  const parts = [];
  for (let i = 0; i < tables.length; i++) {
    let end = i;
    while (tables[end + 1] === tables[end] + 1) end++;
    parts.push(end - i >= 2 ? `${tables[i]}–${tables[end]}` : tables.slice(i, end + 1).join(', '));
    i = end;
  }
  return parts.join(', ');
}

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const randomItem = list => list[Math.floor(Math.random() * list.length)];

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- sound: generated tones, so there are no audio files to load ---

let audio;

function beep(notes) {
  try {
    audio ??= new AudioContext();
    let start = audio.currentTime;
    for (const [frequency, duration] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + duration);
      start += duration * 0.8;
    }
  } catch {}
}

const playCorrect = () => beep([[660, 0.09], [990, 0.14]]);
const playWrong = () => beep([[220, 0.25]]);
const playMedal = () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]);

function flash(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // restart the CSS animation
  element.classList.add(className);
}

// --- questions ---

// A fact source is { tables, factors }, { facts: 'squares', max } or { facts: 'tricky' }.
function factsFor(source) {
  if (source.facts === 'squares') return range(1, source.max ?? 10).map(n => [n, n]);
  if (source.facts === 'tricky') return range(6, 9).flatMap(a => range(6, 9).map(b => [a, b]));
  const factors = source.factors ?? range(1, 10);
  return source.tables.flatMap(table => factors.map(factor => [table, factor]));
}

// How often a factor's facts come up in free play: the 1s and 10s rarely, the hard tables most often.
const FACTOR_WEIGHTS = { 1: 1, 10: 1, 2: 3, 5: 3, 11: 3, 3: 5, 4: 5, 9: 5, 6: 8, 7: 8, 8: 8, 12: 8 };

// A fact is as easy as its easiest factor (1 × 7 and 10 × 8 are easy), so it is repeated by that factor's weight.
function weightByDifficulty(facts) {
  return facts.flatMap(([a, b]) => Array(Math.min(FACTOR_WEIGHTS[a], FACTOR_WEIGHTS[b])).fill([a, b]));
}

// Draws every fact once in random order before any repeats, which spreads practice evenly.
class Deck {
  constructor(facts) {
    this.facts = facts;
    this.pile = [];
    this.last = null;
  }

  next() {
    if (this.pile.length === 0) this.pile = shuffle(this.facts);
    let [a, b] = this.pile.pop();
    if (this.last && this.facts.length > 1 && a * b === this.last.answer && this.pile.length > 0) {
      this.pile.unshift([a, b]);
      [a, b] = this.pile.pop();
    }
    if (a !== b && Math.random() < 0.5) [a, b] = [b, a];
    this.last = { a, b, answer: a * b };
    return this.last;
  }
}

// Plausible wrong answers: neighbouring facts, off-by-one and swapped digits.
function wrongAnswers(question, count) {
  const { a, b, answer } = question;
  const candidates = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, answer + 1, answer - 1,
    answer + 10, answer - 10, Number(String(answer).split('').reverse().join('')), a + b];
  const unique = [...new Set(candidates)].filter(n => n > 0 && n !== answer);
  const picked = shuffle(unique).slice(0, count);
  for (let offset = 2; picked.length < count; offset++) {
    if (!picked.includes(answer + offset)) picked.push(answer + offset);
  }
  return picked;
}

// Expressions close to the question whose product differs from its answer.
function wrongExpressions(question, count) {
  const { a, b, answer } = question;
  const candidates = [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b], [a + 1, b + 1], [a - 1, b - 1],
    [a, b + 2], [a + 2, b], [a, b - 2], [a - 2, b]];
  const maxFactor = settings.include1112 ? 12 : 10;
  const seen = new Set([answer]);
  const picked = [];
  for (const [x, y] of shuffle(candidates)) {
    if (x < 1 || y < 1 || x > maxFactor || y > maxFactor || seen.has(x * y) || picked.length >= count) continue;
    seen.add(x * y);
    picked.push(Math.random() < 0.5 ? [x, y] : [y, x]);
  }
  return picked;
}
