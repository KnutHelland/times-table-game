const MODES = {
  race10: { kind: 'race', target: 10, name: 'timeRace', desc: 'timeRaceDesc' },
  race20: { kind: 'race', target: 20, name: 'timeRaceDeluxe', desc: 'timeRaceDeluxeDesc' },
  exercise: { kind: 'exercise', total: 20, name: 'exercise', desc: 'exerciseDesc' },
};
const SECONDS_PER_RACE_QUESTION = 8;
const MAX_SCORES = 10;
const SHOWN_SCORES = 5;
const SETTINGS_KEY = 'ttg.settings.v1';
const SCORES_KEY = 'ttg.scores.v1';

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

const settings = {
  lang: navigator.language?.match(/^(nb|nn|no)\b/) ? 'no' : 'en',
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  include1112: false,
  ...load(SETTINGS_KEY, {}),
};
const scores = { race10: [], race20: [], exercise: [], ...load(SCORES_KEY, {}) };

const t = (key, ...args) => {
  const value = STRINGS[settings.lang][key];
  return typeof value === 'function' ? value(...args) : value;
};

// --- formatting ---

function formatTime(ms) {
  const seconds = (ms / 1000).toFixed(1);
  return `${settings.lang === 'no' ? seconds.replace('.', ',') : seconds} s`;
}

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

function compareScores(mode, a, b) {
  if (MODES[mode].kind === 'exercise' && a.correct !== b.correct) return b.correct - a.correct;
  return a.time - b.time;
}

function describeScore(mode, score) {
  const time = formatTime(score.time);
  return MODES[mode].kind === 'exercise' ? t('correctOf', score.correct, MODES[mode].total, time) : time;
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
      osc.type = 'sine';
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

function flash(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // restart the CSS animation
  element.classList.add(className);
}

// --- screens ---

function show(screen) {
  for (const id of ['menu', 'play', 'result']) $(id).hidden = id !== screen;
}

function selectedTables() {
  return settings.tables.filter(n => n <= (settings.include1112 ? 12 : 10)).sort((a, b) => a - b);
}

function renderStatic() {
  document.documentElement.lang = settings.lang === 'no' ? 'nb' : 'en';
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const btn of document.querySelectorAll('[data-lang]')) {
    btn.setAttribute('aria-pressed', btn.dataset.lang === settings.lang);
  }
}

function renderMenu() {
  const chips = $('table-chips');
  chips.replaceChildren();
  for (let n = 1; n <= (settings.include1112 ? 12 : 10); n++) {
    const chip = document.createElement('button');
    chip.textContent = n;
    chip.setAttribute('aria-pressed', settings.tables.includes(n));
    chip.addEventListener('click', () => {
      settings.tables = settings.tables.includes(n)
        ? settings.tables.filter(x => x !== n)
        : [...settings.tables, n];
      save(SETTINGS_KEY, settings);
      renderMenu();
    });
    chips.append(chip);
  }
  $('include-11-12').checked = settings.include1112;
  $('table-warning').hidden = selectedTables().length > 0;

  const modes = $('modes');
  modes.replaceChildren();
  for (const [id, mode] of Object.entries(MODES)) {
    const card = document.createElement('button');
    card.className = 'mode';
    card.disabled = selectedTables().length === 0;
    const best = scores[id][0];
    card.innerHTML = `<strong></strong><span class="small"></span><span class="best"></span>`;
    card.children[0].textContent = t(mode.name);
    card.children[1].textContent = t(mode.desc);
    card.children[2].textContent = best ? `${t('best')}: ${describeScore(id, best)}` : '';
    card.addEventListener('click', () => startGame(id));
    modes.append(card);
  }
}

function renderScoreList(list, mode, highlight) {
  list.replaceChildren();
  if (scores[mode].length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = t('noScores');
    list.append(empty);
  }
  scores[mode].slice(0, SHOWN_SCORES).forEach(score => {
    const item = document.createElement('li');
    if (score === highlight) item.className = 'highlight';
    item.textContent = `${describeScore(mode, score)} – ${t('tablesShort')} ${formatTables(score.tables)}`;
    list.append(item);
  });
}

// --- game ---

let game = null;

function startGame(modeId) {
  const tables = selectedTables();
  if (tables.length === 0) return;
  game = {
    modeId,
    mode: MODES[modeId],
    tables,
    maxFactor: settings.include1112 ? 12 : 10,
    startTime: performance.now(),
    streak: 0,
    answered: 0,
    correct: 0,
    mistakes: [],
    question: null,
    input: '',
    correcting: false,
    feedback: null,
  };
  show('play');
  $('time-bar').hidden = game.mode.kind !== 'race';
  nextQuestion();
  requestAnimationFrame(tick);
}

function nextQuestion() {
  const previous = game.question;
  let question;
  do {
    const table = game.tables[Math.floor(Math.random() * game.tables.length)];
    const factor = 1 + Math.floor(Math.random() * game.maxFactor);
    question = Math.random() < 0.5 ? { a: table, b: factor } : { a: factor, b: table };
  } while (previous && question.a === previous.a && question.b === previous.b && game.maxFactor > 1);
  question.answer = question.a * question.b;
  game.question = question;
  game.questionStart = performance.now();
  game.input = '';
  game.correcting = false;
  game.feedback = null;
  renderPlay();
}

function renderPlay() {
  const { mode, question } = game;
  $('question').textContent = `${question.a} ${t('times')} ${question.b}`;
  $('answer').textContent = game.input || ' ';
  $('answer').classList.toggle('correcting', game.correcting);
  $('feedback').textContent = game.feedback ? game.feedback.map(([key, arg]) => t(key, arg)).join(' ') : '';

  const done = mode.kind === 'race' ? game.streak : game.answered;
  const total = mode.kind === 'race' ? mode.target : mode.total;
  $('set-progress').style.width = `${(done / total) * 100}%`;
  $('set-label').textContent = mode.kind === 'race'
    ? t('inARow', game.streak, mode.target)
    : t('questionOf', Math.min(game.answered + 1, total), total);
}

function tick() {
  if (!game || game.finished) return;
  const now = performance.now();
  $('clock').textContent = formatTime(now - game.startTime);
  if (game.mode.kind === 'race') {
    const limit = SECONDS_PER_RACE_QUESTION * 1000;
    const left = game.correcting ? 0 : Math.max(0, limit - (now - game.questionStart));
    $('time-left').style.width = `${(left / limit) * 100}%`;
    if (!game.correcting && left === 0) answerWrong(null);
  }
  requestAnimationFrame(tick);
}

function pressKey(key) {
  if (!game || game.finished) return;
  if (key === 'Enter') return submit();
  if (key === 'Backspace') game.input = game.input.slice(0, -1);
  else if (/^\d$/.test(key) && game.input.length < 3) game.input = (game.input + key).replace(/^0+(?=\d)/, '');
  renderPlay();
}

function submit() {
  if (game.input === '') return;
  const value = Number(game.input);
  const { answer } = game.question;
  if (game.correcting) {
    if (value === answer) afterQuestion();
    else {
      game.input = '';
      flash($('answer'), 'shake');
      renderPlay();
    }
  } else if (value === answer) {
    answerCorrect();
  } else {
    answerWrong(value);
  }
}

function answerCorrect() {
  playCorrect();
  flash($('question'), 'ok');
  game.correct++;
  game.answered++;
  game.streak++;
  afterQuestion();
}

function answerWrong(given) {
  playWrong();
  flash($('question'), 'fail');
  flash($('answer'), 'shake');
  const { a, b, answer } = game.question;
  game.mistakes.push({ a, b, answer, given });
  game.answered++;
  game.streak = 0;
  game.correcting = true;
  game.input = '';
  game.feedback = given === null ? [['timeUp'], ['wrongTypeIt', answer]] : [['wrongTypeIt', answer]];
  renderPlay();
}

function afterQuestion() {
  const { mode } = game;
  const finished = mode.kind === 'race' ? game.streak >= mode.target : game.answered >= mode.total;
  if (finished) finishGame();
  else nextQuestion();
}

function finishGame() {
  game.finished = true;
  const { modeId, mode } = game;
  const score = {
    time: performance.now() - game.startTime,
    correct: game.correct,
    tables: game.tables,
    date: new Date().toISOString(),
  };
  scores[modeId] = [...scores[modeId], score].sort((a, b) => compareScores(modeId, a, b)).slice(0, MAX_SCORES);
  save(SCORES_KEY, scores);
  const rank = scores[modeId].indexOf(score) + 1;

  $('result-title').textContent = `${t(mode.name)} – ${t('finished')}`;
  $('result-main').textContent = mode.kind === 'race'
    ? t('finishedIn', formatTime(score.time))
    : t('correctOf', score.correct, mode.total, formatTime(score.time));
  $('result-record').textContent = rank === 1 ? t('newRecord') : rank > 0 && rank <= SHOWN_SCORES ? t('rank', rank) : '';

  const mistakes = $('result-mistakes');
  mistakes.replaceChildren();
  if (mode.kind === 'exercise' && game.mistakes.length > 0) {
    const heading = document.createElement('h3');
    heading.textContent = `${t('mistakes')} (${game.mistakes.length})`;
    const list = document.createElement('ul');
    list.className = 'mistakes';
    for (const m of game.mistakes) {
      const item = document.createElement('li');
      const given = m.given === null ? t('noAnswer') : `${t('youAnswered')} ${m.given}`;
      item.textContent = `${m.a} ${t('times')} ${m.b} = ${m.answer} (${given})`;
      list.append(item);
    }
    mistakes.append(heading, list);
  }
  renderScoreList($('result-scores'), modeId, score);
  if (rank === 1) playCorrect();
  show('result');
}

function toMenu() {
  if (game) game.finished = true;
  game = null;
  renderMenu();
  show('menu');
}

// --- wiring ---

document.addEventListener('keydown', e => {
  if ($('play').hidden || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === 'Escape') return toMenu();
  if (/^\d$/.test(e.key) || e.key === 'Backspace' || e.key === 'Enter') {
    e.preventDefault(); // also keeps Enter from clicking a focused button
    pressKey(e.key);
  }
});

for (const btn of $('numpad').querySelectorAll('button')) {
  btn.addEventListener('click', () => pressKey(btn.dataset.key));
}

for (const btn of document.querySelectorAll('[data-lang]')) {
  btn.addEventListener('click', () => {
    settings.lang = btn.dataset.lang;
    save(SETTINGS_KEY, settings);
    renderStatic();
    renderMenu();
    if (game && !game.finished) renderPlay();
  });
}

$('include-11-12').addEventListener('change', e => {
  settings.include1112 = e.target.checked;
  const without = settings.tables.filter(n => n <= 10);
  settings.tables = settings.include1112 ? [...without, 11, 12] : without;
  save(SETTINGS_KEY, settings);
  renderMenu();
});

$('quit').addEventListener('click', toMenu);
$('to-menu').addEventListener('click', toMenu);
$('again').addEventListener('click', () => startGame(game.modeId));

renderStatic();
renderMenu();
