// ranking: time = fastest first; correct = most right, then fastest; mistakes = fewest mistakes, then fastest;
// score = most points, then fewest mistakes.
const FREE_MODES = {
  race10: { game: 'type', streak: 10, timeLimit: 8, ranking: 'time', name: 'timeRace', desc: 'timeRaceDesc' },
  race20: { game: 'type', streak: 20, timeLimit: 8, ranking: 'time', name: 'timeRaceDeluxe', desc: 'timeRaceDeluxeDesc' },
  exercise: { game: 'type', count: 20, ranking: 'correct', name: 'exercise', desc: 'exerciseDesc' },
  choice: { game: 'choice', count: 20, ranking: 'correct', name: 'game_choice', desc: 'exerciseDesc' },
  trueFalse: { game: 'trueFalse', count: 20, ranking: 'correct', name: 'game_trueFalse', desc: 'exerciseDesc' },
  pickQuestion: { game: 'pickQuestion', count: 20, ranking: 'correct', name: 'game_pickQuestion', desc: 'exerciseDesc' },
  missing: { game: 'missing', count: 20, ranking: 'correct', name: 'game_missing', desc: 'exerciseDesc' },
  match: { game: 'match', rounds: 3, pairs: 5, ranking: 'mistakes', name: 'game_match', desc: 'freeMatchDesc' },
  balloons: { game: 'balloons', rise: 7, count: 4, ranking: 'score', name: 'game_balloons', desc: 'freeBalloonsDesc' },
  // one Snake card with three difficulties, each with its own high scores; endless, like the balloons
  snakeEasy: { game: 'snake', difficulty: 'snakeEasy', stepMs: 650, apples: 3, kinds: ['answer'], ranking: 'score', name: 'game_snake', desc: 'freeSnakeDesc' },
  snakeMedium: { game: 'snake', difficulty: 'snakeMedium', stepMs: 500, apples: 4, kinds: ['answer', 'factor', 'expression'], ranking: 'score', name: 'game_snake', desc: 'freeSnakeDesc' },
  snakeHard: { game: 'snake', difficulty: 'snakeHard', stepMs: 380, apples: 5, kinds: ['answer', 'factor', 'expression'], multiple: true, ranking: 'score', name: 'game_snake', desc: 'freeSnakeDesc' },
};
const SNAKE_MODES = ['snakeEasy', 'snakeMedium', 'snakeHard'];
const MAX_SCORES = 10;
const SHOWN_SCORES = 5;

const emptyScores = () => Object.fromEntries(Object.keys(FREE_MODES).map(id => [id, []]));
const scores = { ...emptyScores(), ...loadOwn('scores', {}) };
const progress = loadProgress(); // level id -> { medal }

// medals saved under the old, position-based level ids are moved to the permanent ids the first time
function loadProgress() {
  const stored = loadOwn('progress', {});
  const migrated = migrateProgress(stored);
  if (migrated !== stored) saveOwn('progress', migrated);
  return migrated;
}

let runner = null;
let renderScreen = null; // redraws the visible screen, e.g. after a language switch
let updateReady = false; // a newer version of the game has been downloaded and is used after a reload
let installPrompt = null; // the browser's install dialog, only offered where the game can be installed
let currentScreen = null;

const SCREENS = ['menu', 'settings', 'intro', 'play', 'result', 'profiles', 'new-profile', 'rename-profile', 'import-profile',
  'delete-profile'];
const PROFILE_SCREENS = ['profiles', 'new-profile', 'rename-profile', 'import-profile', 'delete-profile'];
const START_SCREENS = ['menu', 'profiles', 'new-profile'];

function updateInstallButton() {
  $('install-button').hidden = !installPrompt || !START_SCREENS.includes(currentScreen);
}

// direction picks the transition: 'forward' slides the screen in from the right, 'back' from the left
function show(screen, render, direction = 'forward') {
  for (const id of SCREENS) $(id).hidden = id !== screen;
  const inGameOrProfiles = screen === 'play' || PROFILE_SCREENS.includes(screen);
  $('open-settings').hidden = inGameOrProfiles || screen === 'settings';
  $('open-profiles').hidden = inGameOrProfiles || !activeProfile();
  $('update-banner').hidden = !updateReady || screen === 'play';
  currentScreen = screen;
  updateInstallButton();
  $(screen).classList.remove('enter-forward', 'enter-back');
  flash($(screen), `enter-${direction}`);
  renderScreen = render;
  render?.();
  window.scrollTo(0, 0);
}

function renderStatic() {
  document.documentElement.lang = t('htmlLang');
  document.title = t('title');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  const profile = activeProfile();
  if (profile) {
    $('profile-avatar').src = avatarUrl(profile.avatar);
    $('open-profiles').setAttribute('aria-label', t('profileButton', profile.name));
    $('open-profiles').title = profile.name;
  }
}

function setLanguage(lang) {
  settings.lang = lang;
  saveOwn('settings', settings);
  rememberLanguage();
  renderStatic();
  renderScreen?.();
}

// a flag and the language's own name per language; used on the Welcome and Settings screens
function languagePicker() {
  const picker = el('div', 'lang');
  picker.setAttribute('role', 'group');
  for (const lang of LANGUAGES) {
    const button = el('button', 'lang-option');
    button.dataset.lang = lang;
    button.lang = STRINGS[lang].htmlLang;
    button.setAttribute('aria-pressed', lang === settings.lang);
    const flag = el('img', 'flag');
    flag.src = `flags/${STRINGS[lang].flag}.svg`;
    flag.alt = '';
    button.append(flag, el('span', '', STRINGS[lang].languageName));
    button.addEventListener('click', () => setLanguage(lang));
    picker.append(button);
  }
  return picker;
}

function medalBadge(medal, className = '') {
  const badge = el('span', `medal m${medal} ${className}`);
  badge.title = medal ? t(`medal${medal}`) : '';
  return badge;
}

// --- menu ---

function renderMenu() {
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.setAttribute('aria-pressed', button.dataset.tab === settings.tab);
  }
  $('tab-levels').hidden = settings.tab !== 'levels';
  $('tab-free').hidden = settings.tab !== 'free';
  renderLevelMap();
  renderFreePlay();
}

const medalOf = level => progress[level.id]?.medal ?? 0;
const isUnlocked = level => level.number === 1 || isSuperPlayer() || medalOf(LEVELS[level.number - 2]) > 0;
const gameName = level => t(level.streak ? 'game_streak' : `game_${level.game}`);

function renderLevelMap() {
  const summary = $('medal-summary');
  summary.replaceChildren();
  for (const medal of [3, 2, 1]) {
    const item = el('span', 'summary-item');
    item.append(medalBadge(medal), ` ${LEVELS.filter(level => medalOf(level) === medal).length}`);
    summary.append(item);
  }
  summary.append(el('span', 'small', `/ ${LEVELS.length}`));

  const map = $('level-map');
  map.replaceChildren();
  const current = LEVELS.find(level => isUnlocked(level) && medalOf(level) === 0);
  UNITS.forEach((unit, unitIndex) => {
    map.append(el('h3', 'unit-title', t(...unit.title)));
    const grid = el('div', 'level-grid');
    for (const level of LEVELS.filter(l => l.unitIndex === unitIndex)) {
      const tile = el('button', `level-tile${level === current ? ' current' : ''}`);
      tile.disabled = !isUnlocked(level);
      tile.title = tile.disabled ? t('locked') : `${t('level', level.number)}: ${gameName(level)}`;
      tile.append(el('span', 'tile-number', level.number), el('span', 'tile-game', gameName(level)), medalBadge(medalOf(level)));
      tile.addEventListener('click', () => showIntro(level));
      grid.append(tile);
    }
    map.append(grid);
  });
}

function selectedTables() {
  return settings.tables.filter(n => n <= (settings.include1112 ? 12 : 10)).sort((a, b) => a - b);
}

function renderFreePlay() {
  const chips = $('table-chips');
  chips.replaceChildren();
  for (let n = 1; n <= (settings.include1112 ? 12 : 10); n++) {
    const chip = el('button', '', n);
    chip.setAttribute('aria-pressed', settings.tables.includes(n));
    chip.addEventListener('click', () => {
      settings.tables = settings.tables.includes(n) ? settings.tables.filter(x => x !== n) : [...settings.tables, n];
      saveOwn('settings', settings);
      renderFreePlay();
    });
    chips.append(chip);
  }
  $('table-warning').hidden = selectedTables().length > 0;

  const modes = $('modes');
  modes.replaceChildren();
  for (const [id, mode] of Object.entries(FREE_MODES)) {
    if (mode.game === 'snake') continue;
    const card = el('button', 'mode');
    card.disabled = selectedTables().length === 0;
    const best = scores[id][0];
    card.append(el('strong', '', t(mode.name)), el('span', 'small', t(mode.desc)),
      el('span', 'best', best ? `${t('best')}: ${describeScore(id, best)}` : ''));
    card.addEventListener('click', () => startFreePlay(id));
    modes.append(card);
  }
  if (snakeReached()) modes.append(snakeCard());
}

// Snake joins free play once the player has come as far as the first snake level
const snakeReached = () => isUnlocked(LEVELS.find(level => level.game === 'snake'));

function snakeCard() {
  const card = el('div', 'mode snake-mode');
  const buttons = el('div', 'difficulties');
  for (const id of SNAKE_MODES) {
    const button = el('button', '');
    button.disabled = selectedTables().length === 0;
    const best = scores[id][0];
    button.append(el('strong', '', t(FREE_MODES[id].difficulty)),
      el('span', 'best', best ? `${t('best')}: ${describeScore(id, best)}` : ''));
    button.addEventListener('click', () => startFreePlay(id));
    buttons.append(button);
  }
  card.append(el('strong', '', t('game_snake')), el('span', 'small', t('freeSnakeDesc')), buttons);
  return card;
}

const modeTitle = mode => mode.difficulty ? `${t(mode.name)} (${t(mode.difficulty)})` : t(mode.name);

// --- level intro ---

function factsText(source) {
  if (source.facts === 'squares') return t('factsSquares', source.max);
  if (source.facts === 'tricky') return source.tables ? t('factsTrickyPart', source.tables) : t('factsTricky');
  return t('factsTables', source.tables);
}

function detailsText(level) {
  const parts = [];
  if (level.game === 'match') parts.push(t('rounds', level.rounds, level.pairs));
  else if (level.game === 'snake') parts.push(t('questions', level.count));
  else if (level.game === 'balloons') parts.push(t('balloonWave', level.count), t('balloonTarget', level.target));
  else if (!level.streak) parts.push(t('questions', level.count));
  if (level.timeLimit) parts.push(t('timeLimit', formatSeconds(level.timeLimit)));
  return parts.join(', ');
}

function goalText(goal, level) {
  const parts = [];
  if (goal.minAccuracy === 1) parts.push(t('goalAllCorrect'));
  else if (goal.minAccuracy !== undefined) parts.push(t('goalAccuracy', Math.round(goal.minAccuracy * 100)));
  if (goal.maxAvg !== undefined) parts.push(t('goalAvg', formatSeconds(goal.maxAvg)));
  if (goal.maxSeconds !== undefined) parts.push(t('goalSeconds', formatSeconds(goal.maxSeconds)));
  if (goal.maxMistakes === 0) parts.push(t('goalNoMistakes'));
  else if (goal.maxMistakes !== undefined) parts.push(t('goalMistakes', goal.maxMistakes));
  if (goal.minScore !== undefined) parts.push(t(level.game === 'snake' ? 'goalSnake' : 'goalScore', goal.minScore));
  return parts.join(', ');
}

function goalList(level, result) {
  const list = el('ul', 'goals');
  level.medals.forEach((goal, index) => {
    const item = el('li');
    const reached = result && meetsGoal(goal, result);
    item.append(medalBadge(index + 1), el('strong', '', `${t(`medal${index + 1}`)}: `), goalText(goal, level));
    if (reached) item.append(el('span', 'reached', ' ✓'));
    list.append(item);
  });
  return list;
}

function levelHeading(level) {
  const heading = el('div', 'level-heading');
  heading.append(el('p', 'small', t(...UNITS[level.unitIndex].title)),
    el('h2', '', `${t('level', level.number)}: ${gameName(level)}`));
  return heading;
}

function showIntro(level) {
  show('intro', () => {
    const back = el('button', 'link', t('back'));
    back.addEventListener('click', toMenu);
    const start = el('button', 'primary big', t('start'));
    start.addEventListener('click', () => startLevel(level));
    const best = el('p', 'best-line');
    best.append(`${t('yourBest')}: `, medalOf(level) ? medalBadge(medalOf(level)) : '',
      medalOf(level) ? ` ${t(`medal${medalOf(level)}`)}` : t('noMedal'));
    $('intro').replaceChildren(back, levelHeading(level),
      el('p', '', level.streak ? t('howTo_streak', level.streak) : t(`howTo_${level.game}`)),
      el('p', 'facts', `${factsText(level.source)}. ${detailsText(level)}.`),
      el('h3', '', t('goals')), goalList(level), best, start);
    start.focus();
  });
}

// --- playing ---

function startGame(config, onFinish) {
  runner?.stop();
  show('play', null);
  $('stage').className = `stage stage-${config.game}`;
  $('set-progress').style.width = '0';
  const track = $('medal-track');
  track.replaceChildren();
  delete track.dataset.key;
  const ctx = {
    stage: $('stage'),
    hud: {
      // only touch the DOM on changes, since the runners call these on every animation frame
      clock: text => { if ($('clock').textContent !== text) $('clock').textContent = text; },
      progress: (fraction, label) => {
        const width = `${Math.min(1, fraction) * 100}%`;
        if ($('set-progress').style.width !== width) $('set-progress').style.width = width;
        if ($('set-label').textContent !== label) $('set-label').textContent = label;
      },
      stats: stats => {
        if (!config.medals) return;
        const outlooks = config.medals.map(goal => medalOutlook(goal, stats));
        const key = outlooks.join();
        if (track.dataset.key === key) return;
        track.dataset.key = key;
        track.replaceChildren(...outlooks.map((outlook, i) => {
          const badge = medalBadge(i + 1, outlook);
          badge.title = `${t(`medal${i + 1}`)}: ${t(`outlook_${outlook}`)}`;
          return badge;
        }));
      },
    },
    finish: result => {
      runner.stop();
      runner = null;
      onFinish(result);
    },
  };
  runner = runGame(ctx, config);
  renderScreen = () => runner?.rerender();
}

function startLevel(level) {
  startGame({ ...level, deck: new Deck(factsFor(level.source)) }, result => finishLevel(level, result));
}

function finishLevel(level, result) {
  const next = LEVELS[level.number];
  const nextWasUnlocked = next && isUnlocked(next);
  const medal = medalFor(level, result);
  const before = medalOf(level);
  if (medal > before) {
    progress[level.id] = { medal };
    saveOwn('progress', progress);
  }
  if (medal > 0) playMedal();
  const unlockedNow = next && !nextWasUnlocked && isUnlocked(next);
  show('result', () => renderLevelResult(level, result, medal, medal > before, unlockedNow));
}

function levelStats(level, result) {
  if (level.game === 'balloons') return [t('statScore', result.score), t('statMistakes', result.wrong)];
  if (level.game === 'snake') return [t('statAnswered', result.score, level.count), t('statTime', formatTime(result.elapsedMs))];
  if (level.game === 'match' || level.streak) return [t('statTime', formatTime(result.elapsedMs)), t('statMistakes', result.wrong)];
  return [t('statCorrect', result.correct, result.questions), t('statAvg', formatSeconds(Math.round(result.avgSeconds * 10) / 10)),
    t('statTime', formatTime(result.elapsedMs))];
}

function renderLevelResult(level, result, medal, improved, unlockedNow) {
  const container = $('result');
  container.replaceChildren(levelHeading(level));

  const verdict = el('div', 'verdict');
  verdict.append(medalBadge(medal, 'large'), el('span', '', medal ? `${t(`medal${medal}`)}!` : t('noMedalResult')));
  container.append(verdict);
  if (improved && medal > 0) container.append(el('p', 'record', t('newBest')));
  if (unlockedNow) container.append(el('p', 'record', t('unlocked')));

  const stats = el('ul', 'stats');
  for (const line of levelStats(level, result)) stats.append(el('li', '', line));
  container.append(stats, goalList(level, result));
  if (result.mistakes?.length) container.append(mistakeList(result.mistakes));

  const buttons = el('div', 'buttons');
  const next = LEVELS[level.number];
  if (next && isUnlocked(next)) {
    const nextButton = el('button', 'primary', t('nextLevel'));
    nextButton.addEventListener('click', () => showIntro(next));
    buttons.append(nextButton);
  }
  const again = el('button', next && isUnlocked(next) ? '' : 'primary', t('tryAgain'));
  again.addEventListener('click', () => startLevel(level));
  const menu = el('button', '', t('menu'));
  menu.addEventListener('click', toMenu);
  buttons.append(again, menu);
  container.append(buttons);
}

function mistakeList(mistakes) {
  const wrapper = el('div');
  const list = el('ul', 'mistakes');
  for (const m of mistakes) {
    const given = m.given === null ? t('noAnswer') : `${t('youAnswered')} ${m.given}`;
    list.append(el('li', '', `${expression(m.a, m.b)} = ${m.answer} (${given})`));
  }
  wrapper.append(el('h3', '', `${t('mistakes')} (${mistakes.length})`), list);
  return wrapper;
}

// --- free play ---

function compareScores(modeId, a, b) {
  const { ranking } = FREE_MODES[modeId];
  if (ranking === 'correct' && a.correct !== b.correct) return b.correct - a.correct;
  if (ranking === 'mistakes' && a.wrong !== b.wrong) return a.wrong - b.wrong;
  if (ranking === 'score') return b.score - a.score || a.wrong - b.wrong;
  return a.time - b.time;
}

function describeScore(modeId, score) {
  const mode = FREE_MODES[modeId];
  const time = formatTime(score.time);
  if (mode.ranking === 'correct') return t('correctOf', score.correct, mode.count, time);
  if (mode.ranking === 'mistakes') return `${time} – ${t('statMistakes', score.wrong)}`;
  if (mode.game === 'snake') return t('rightAnswers', score.score);
  if (mode.ranking === 'score') return `${t('points', score.score)} – ${t('statMistakes', score.wrong)}`;
  return time;
}

function startFreePlay(modeId) {
  const tables = selectedTables();
  if (tables.length === 0) return;
  const mode = FREE_MODES[modeId];
  const factors = range(1, settings.include1112 ? 12 : 10);
  startGame({ ...mode, deck: new Deck(weightByDifficulty(factsFor({ tables, factors }))) },
    result => finishFreePlay(modeId, tables, result));
}

function finishFreePlay(modeId, tables, result) {
  const score = { time: result.elapsedMs, correct: result.correct, wrong: result.wrong, score: result.score,
    tables, date: new Date().toISOString() };
  scores[modeId] = [...scores[modeId], score].sort((a, b) => compareScores(modeId, a, b)).slice(0, MAX_SCORES);
  saveOwn('scores', scores);
  const rank = scores[modeId].indexOf(score) + 1;
  if (rank === 1) playMedal();
  show('result', () => renderFreeResult(modeId, tables, result, score, rank));
}

function renderFreeResult(modeId, tables, result, score, rank) {
  const mode = FREE_MODES[modeId];
  const container = $('result');
  container.replaceChildren(el('h2', '', `${modeTitle(mode)} – ${t('finished')}`));
  container.append(el('p', 'result-main',
    mode.ranking === 'time' ? t('finishedIn', formatTime(score.time)) : describeScore(modeId, score)));
  const record = rank === 1 ? t('newRecord') : rank > 0 && rank <= SHOWN_SCORES ? t('rank', rank) : '';
  if (record) container.append(el('p', 'record', record));
  if (mode.ranking === 'correct' && result.mistakes.length) container.append(mistakeList(result.mistakes));

  const buttons = el('div', 'buttons');
  const again = el('button', 'primary', t('again'));
  again.addEventListener('click', () => startFreePlay(modeId));
  const menu = el('button', '', t('menu'));
  menu.addEventListener('click', toMenu);
  buttons.append(again, menu);

  const list = el('ol', 'scores');
  if (scores[modeId].length === 0) list.append(el('li', 'empty', t('noScores')));
  for (const entry of scores[modeId].slice(0, SHOWN_SCORES)) {
    list.append(el('li', entry === score ? 'highlight' : '',
      `${describeScore(modeId, entry)} – ${t('tablesShort')} ${formatTables(entry.tables)}`));
  }
  container.append(buttons, el('h3', '', t('highscores')), list);
}

function toMenu() {
  runner?.stop();
  runner = null;
  show('menu', renderMenu, 'back');
}

function switchProfile(id) {
  profiles.active = id;
  save(PROFILES_KEY, profiles);
  replaceContents(settings, { ...defaultSettings(), ...loadOwn('settings', {}) });
  replaceContents(scores, { ...emptyScores(), ...loadOwn('scores', {}) });
  replaceContents(progress, loadProgress());
  rememberLanguage();
  buildCourse(settings.include1112);
  renderStatic();
  toMenu();
}

// --- wiring ---

document.addEventListener('keydown', e => {
  if ($('play').hidden || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === 'Escape') return toMenu();
  if (runner?.key(e)) e.preventDefault(); // also keeps Enter from clicking a focused button
});

for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => {
    settings.tab = button.dataset.tab;
    saveOwn('settings', settings);
    renderMenu();
  });
}

$('include-11-12').addEventListener('change', e => {
  settings.include1112 = e.target.checked;
  const without = settings.tables.filter(n => n <= 10);
  settings.tables = settings.include1112 ? [...without, 11, 12] : without;
  saveOwn('settings', settings);
  buildCourse(settings.include1112);
});

$('open-settings').addEventListener('click', () => show('settings', () => {
  $('include-11-12').checked = settings.include1112;
  $('languages').replaceChildren(languagePicker());
  renderSaveCode();
}));

// the current player's save code, to copy as a backup or to another device
function renderSaveCode() {
  const profile = activeProfile();
  const code = el('textarea', 'save-code');
  code.readOnly = true;
  code.rows = 4;
  code.value = makeSaveCode(profile, { settings, progress, scores });
  code.setAttribute('aria-label', t('saveCode'));
  code.addEventListener('focus', () => code.select());
  const copied = el('span', 'copied', t('copied'));
  copied.hidden = true;
  const copy = el('button', '', t('copy'));
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.value);
      copied.hidden = false;
    } catch {
      code.focus(); // the clipboard needs https; the selected code can still be copied by hand
    }
  });
  const row = el('div', 'copy-row');
  row.append(copy, copied);
  $('save-code').replaceChildren(el('h3', '', t('saveCode')), el('p', 'small', t('saveCodeHelp', profile.name)), code, row);
}
$('close-settings').addEventListener('click', toMenu);

$('quit').addEventListener('click', toMenu);
$('open-profiles').addEventListener('click', () => showProfiles());
// Chrome and Edge announce when the game can be installed; other browsers never do, so there the button stays hidden
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  updateInstallButton();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  updateInstallButton();
});
$('install-button').addEventListener('click', () => {
  const prompt = installPrompt; // a prompt can only be shown once
  installPrompt = null;
  updateInstallButton();
  prompt?.prompt();
});

const RELOADED_FOR_UPDATE_KEY = 'ttg.reloadedForUpdate';
$('update-banner').addEventListener('click', () => {
  try { sessionStorage.setItem(RELOADED_FOR_UPDATE_KEY, '1'); } catch {}
  location.reload();
});

if (!activeProfile()) profiles.active = null;
buildCourse(settings.include1112);
renderStatic();
// The installed app is often shared by a family, so it asks who is playing every time it starts (but not after
// reloading for an update). In a browser tab the last player just continues.
const installedApp = !matchMedia('(display-mode: browser)').matches;
let reloadedForUpdate = false;
try {
  reloadedForUpdate = sessionStorage.getItem(RELOADED_FOR_UPDATE_KEY) === '1';
  sessionStorage.removeItem(RELOADED_FOR_UPDATE_KEY);
} catch {}
const askWhoIsPlaying = installedApp && !reloadedForUpdate;
if (profiles.active && !askWhoIsPlaying) toMenu();
else showProfiles('forward', false);

// offline support and home screen install; service workers only work over http(s), not from disk
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller; // false on the very first visit, which is no update
  const offerUpdate = () => {
    updateReady = true;
    if ($('play').hidden) $('update-banner').hidden = false;
  };
  navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'updated') offerUpdate(); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) offerUpdate(); });
  navigator.serviceWorker.register('sw.js');
  const checkForUpdate = () => {
    navigator.serviceWorker.controller?.postMessage('checkForUpdate');
    navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {}); // offline
  };
  checkForUpdate();
  // an installed app is often resumed from the background instead of started, so also check when it is shown again
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
}
