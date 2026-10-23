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
};
const MAX_SCORES = 10;
const SHOWN_SCORES = 5;

const scores = { ...Object.fromEntries(Object.keys(FREE_MODES).map(id => [id, []])), ...load(SCORES_KEY, {}) };
const progress = load(PROGRESS_KEY, {}); // level id -> { medal }

let runner = null;
let renderScreen = null; // redraws the visible screen, e.g. after a language switch

// direction picks the transition: 'forward' slides the screen in from the right, 'back' from the left
function show(screen, render, direction = 'forward') {
  for (const id of ['menu', 'settings', 'intro', 'play', 'result']) $(id).hidden = id !== screen;
  $('open-settings').hidden = screen === 'play' || screen === 'settings';
  $(screen).classList.remove('enter-forward', 'enter-back');
  flash($(screen), `enter-${direction}`);
  renderScreen = render;
  render?.();
  window.scrollTo(0, 0);
}

function renderStatic() {
  document.documentElement.lang = settings.lang === 'no' ? 'nb' : 'en';
  document.title = t('title');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', button.dataset.lang === settings.lang);
  }
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
const isUnlocked = level => level.number === 1 || medalOf(LEVELS[level.number - 2]) > 0;
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
    map.append(el('h3', 'unit-title', unit.title[settings.lang]));
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
      save(SETTINGS_KEY, settings);
      renderFreePlay();
    });
    chips.append(chip);
  }
  $('table-warning').hidden = selectedTables().length > 0;

  const modes = $('modes');
  modes.replaceChildren();
  for (const [id, mode] of Object.entries(FREE_MODES)) {
    const card = el('button', 'mode');
    card.disabled = selectedTables().length === 0;
    const best = scores[id][0];
    card.append(el('strong', '', t(mode.name)), el('span', 'small', t(mode.desc)),
      el('span', 'best', best ? `${t('best')}: ${describeScore(id, best)}` : ''));
    card.addEventListener('click', () => startFreePlay(id));
    modes.append(card);
  }
}

// --- level intro ---

function factsText(source) {
  if (source.facts === 'squares') return t('factsSquares', source.max);
  if (source.facts === 'tricky') return t('factsTricky');
  return t('factsTables', source.tables);
}

function detailsText(level) {
  const parts = [];
  if (level.game === 'match') parts.push(t('rounds', level.rounds, level.pairs));
  else if (level.game === 'balloons') parts.push(t('balloonWave', level.count), t('balloonTarget', level.target));
  else if (!level.streak) parts.push(t('questions', level.count));
  if (level.timeLimit) parts.push(t('timeLimit', formatSeconds(level.timeLimit)));
  return parts.join(', ');
}

function goalText(goal) {
  const parts = [];
  if (goal.minAccuracy === 1) parts.push(t('goalAllCorrect'));
  else if (goal.minAccuracy !== undefined) parts.push(t('goalAccuracy', Math.round(goal.minAccuracy * 100)));
  if (goal.maxAvg !== undefined) parts.push(t('goalAvg', formatSeconds(goal.maxAvg)));
  if (goal.maxSeconds !== undefined) parts.push(t('goalSeconds', formatSeconds(goal.maxSeconds)));
  if (goal.maxMistakes === 0) parts.push(t('goalNoMistakes'));
  else if (goal.maxMistakes !== undefined) parts.push(t('goalMistakes', goal.maxMistakes));
  if (goal.minScore !== undefined) parts.push(t('goalScore', goal.minScore));
  return parts.join(', ');
}

function goalList(level, result) {
  const list = el('ul', 'goals');
  level.medals.forEach((goal, index) => {
    const item = el('li');
    const reached = result && meetsGoal(goal, result);
    item.append(medalBadge(index + 1), el('strong', '', `${t(`medal${index + 1}`)}: `), goalText(goal));
    if (reached) item.append(el('span', 'reached', ' ✓'));
    list.append(item);
  });
  return list;
}

function levelHeading(level) {
  const heading = el('div', 'level-heading');
  heading.append(el('p', 'small', UNITS[level.unitIndex].title[settings.lang]),
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
    save(PROGRESS_KEY, progress);
  }
  if (medal > 0) playMedal();
  const unlockedNow = next && !nextWasUnlocked && isUnlocked(next);
  show('result', () => renderLevelResult(level, result, medal, medal > before, unlockedNow));
}

function levelStats(level, result) {
  if (level.game === 'balloons') return [t('statScore', result.score), t('statMistakes', result.wrong)];
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
  save(SCORES_KEY, scores);
  const rank = scores[modeId].indexOf(score) + 1;
  if (rank === 1) playMedal();
  show('result', () => renderFreeResult(modeId, tables, result, score, rank));
}

function renderFreeResult(modeId, tables, result, score, rank) {
  const mode = FREE_MODES[modeId];
  const container = $('result');
  container.replaceChildren(el('h2', '', `${t(mode.name)} – ${t('finished')}`));
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

// --- wiring ---

document.addEventListener('keydown', e => {
  if ($('play').hidden || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === 'Escape') return toMenu();
  if (runner?.key(e)) e.preventDefault(); // also keeps Enter from clicking a focused button
});

for (const button of document.querySelectorAll('[data-lang]')) {
  button.addEventListener('click', () => {
    settings.lang = button.dataset.lang;
    save(SETTINGS_KEY, settings);
    renderStatic();
    renderScreen?.();
  });
}

for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => {
    settings.tab = button.dataset.tab;
    save(SETTINGS_KEY, settings);
    renderMenu();
  });
}

$('include-11-12').addEventListener('change', e => {
  settings.include1112 = e.target.checked;
  const without = settings.tables.filter(n => n <= 10);
  settings.tables = settings.include1112 ? [...without, 11, 12] : without;
  save(SETTINGS_KEY, settings);
  buildCourse(settings.include1112);
});

$('open-settings').addEventListener('click', () => show('settings', () => {
  $('include-11-12').checked = settings.include1112;
}));
$('close-settings').addEventListener('click', toMenu);

$('quit').addEventListener('click', toMenu);

buildCourse(settings.include1112);
renderStatic();
toMenu();
