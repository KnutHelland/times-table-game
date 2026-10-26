// Medal goals, [bronze, silver, gold]. A medal needs every field of its goal:
// minAccuracy (share right on the first try), maxAvg (seconds per answer), maxSeconds (whole level),
// maxMistakes, minScore.
const QUIZ_TIERS = {
  intro: { count: 10, timeLimit: null, medals: [{ minAccuracy: 0.6 }, { minAccuracy: 0.8, maxAvg: 8 }, { minAccuracy: 1, maxAvg: 4 }] },
  practice: { count: 12, timeLimit: null, medals: [{ minAccuracy: 0.7 }, { minAccuracy: 0.9, maxAvg: 5 }, { minAccuracy: 1, maxAvg: 2.5 }] },
  review: { count: 15, timeLimit: 10, medals: [{ minAccuracy: 0.8, maxAvg: 6 }, { minAccuracy: 0.9, maxAvg: 3.5 }, { minAccuracy: 1, maxAvg: 2 }] },
  master: { count: 20, timeLimit: 5, medals: [{ minAccuracy: 0.85, maxAvg: 4 }, { minAccuracy: 0.95, maxAvg: 2.5 }, { minAccuracy: 1, maxAvg: 1.5 }] },
  final: { count: 30, timeLimit: 3, medals: [{ minAccuracy: 0.9, maxAvg: 3 }, { minAccuracy: 1, maxAvg: 2 }, { minAccuracy: 1, maxAvg: 1.1 }] },
};

// Seconds per pair for [bronze, silver, gold], and the mistakes allowed for each.
const MATCH_TIERS = {
  intro: { perPair: [20, 12, 7], mistakes: [null, 3, 0] },
  practice: { perPair: [15, 9, 5], mistakes: [null, 2, 0] },
  master: { perPair: [10, 6, 3.5], mistakes: [3, 1, 0] },
};

const quiz = (game, source, tier, overrides = {}) => ({ game, source, ...QUIZ_TIERS[tier], ...overrides });

function match(source, tier, rounds = 2, pairs = 5) {
  const { perPair, mistakes } = MATCH_TIERS[tier];
  const medals = perPair.map((seconds, i) => ({ maxSeconds: seconds * rounds * pairs, maxMistakes: mistakes[i] ?? undefined }));
  return { game: 'match', source, rounds, pairs, medals };
}

// Reaching the gold score completes a balloon level, so it does not go on forever.
const balloons = (source, rise, scores, count = 4) =>
  ({ game: 'balloons', source, rise, count, target: scores[2], medals: scores.map(minScore => ({ minScore })) });

const streak = (source, length, timeLimit, maxSeconds) =>
  ({ game: 'type', streak: length, source, timeLimit, medals: maxSeconds.map(s => ({ maxSeconds: s })) });

// Snake: answer `count` questions by eating apples; the snake moves one tile per stepMs. Kinds: 'answer' (a × b = ?),
// 'factor' (a × ? = c), 'expression' (? = c). With multiple, an expression question shows every right way to
// write the answer (up to 3), and all of them must be eaten. Answering all questions is gold and completes the level.
const snake = (source, count, stepMs, apples, kinds, multiple = false) => ({
  game: 'snake', source, count, stepMs, apples, kinds, multiple, target: count,
  medals: [Math.ceil(count / 2), Math.ceil(count * 0.75), count].map(minScore => ({ minScore })),
});
const ALL_KINDS = ['answer', 'factor', 'expression'];

let UNITS = [];
let LEVELS = [];

// The order follows a common teaching order: 2, 10, 5, 1, square numbers, 4, 3, 9, then 6, 8, 7 and the
// hardest facts last. Each table is introduced with an easy gameplay and lots of time before it has to be typed.
// With the 11 and 12 tables on, every table goes up to 12 times, 11 comes after the 9s (its pattern is easy)
// and 12 right after the 6s (double the 6s).
//
// Each level is [n, level], where n is its permanent number in the unit: medals are stored by the id
// `<unit>-<n>`, so a number is never changed or reused, and a new level takes the next free number wherever it
// is placed. The two courses keep separate medals (ids of the 11-and-12 course start with '12:').
function createCourse(with1112) {
  const maxFactor = with1112 ? 12 : 10;
  const T = (...tables) => ({ tables, factors: range(1, maxFactor) });
  const SQUARES = { facts: 'squares', max: maxFactor };
  const TRICKY = { facts: 'tricky' };
  const TRICKY_67 = { facts: 'tricky', tables: [6, 7] };
  const TRICKY_89 = { facts: 'tricky', tables: [8, 9] };
  const EASY = T(1, 2, 5, 10);
  const FIRST_HALF = with1112 ? T(1, 2, 3, 4, 5, 9, 10, 11) : T(1, 2, 3, 4, 5, 9, 10);
  const ALL = T(...range(1, maxFactor));
  const upTo = with1112 ? '12' : '10';

  const units = [
    { key: 'two', title: ['unit_2'], levels: [
      [1, quiz('choice', T(2), 'intro')],
      [2, quiz('trueFalse', T(2), 'intro', { count: 12 })],
      [3, quiz('type', T(2), 'intro')],
      [4, match(T(2), 'intro')],
    ] },
    { key: 'tenFive', title: ['unit_10and5'], levels: [
      [1, quiz('choice', T(10), 'intro')],
      [2, quiz('type', T(10), 'intro')],
      [3, quiz('choice', T(5), 'intro')],
      [4, quiz('type', T(5), 'intro')],
      [5, balloons(T(2, 5, 10), 9, [5, 10, 15], 3)],
    ] },
    { key: 'one', title: ['unit_1'], levels: [
      [1, quiz('trueFalse', T(1, 10), 'intro', { count: 12 })],
      [2, quiz('pickQuestion', T(2, 5, 10), 'practice')],
      [3, quiz('type', EASY, 'review')],
    ] },
    { key: 'squares', title: ['unit_squares'], levels: [
      [1, quiz('choice', SQUARES, 'intro')],
      [2, match(SQUARES, 'intro')],
      [3, quiz('type', SQUARES, 'practice')],
      [4, snake(SQUARES, 6, 520, 3, ['answer'])],
    ] },
    { key: 'four', title: ['unit_4'], levels: [
      [1, quiz('choice', T(4), 'intro')],
      [2, quiz('type', T(4), 'intro')],
      [3, quiz('missing', T(2, 4), 'practice')],
      [4, balloons(T(2, 4, 5, 10), 8, [6, 12, 18])],
      [5, snake(T(2, 4), 8, 500, 3, ['answer', 'factor'])],
    ] },
    { key: 'three', title: ['unit_3'], levels: [
      [1, quiz('choice', T(3), 'intro')],
      [2, quiz('trueFalse', T(3), 'intro', { count: 12 })],
      [3, quiz('type', T(3), 'intro')],
      [4, match(T(3, 4), 'practice')],
      [5, snake(T(3, 4), 8, 480, 3, ['answer', 'factor'])],
    ] },
    { key: 'nine', title: ['unit_9'], levels: [
      [1, quiz('choice', T(9), 'intro')],
      [2, quiz('pickQuestion', T(9), 'practice')],
      [3, quiz('type', T(9), 'intro')],
      [4, quiz('missing', T(3, 9), 'practice')],
      [5, snake(T(3, 9), 10, 460, 4, ALL_KINDS)],
    ] },
    with1112 && { key: 'eleven', title: ['unit_11'], levels: [
      [1, quiz('choice', T(11), 'intro')],
      [2, quiz('trueFalse', T(11), 'intro', { count: 12 })],
      [3, quiz('type', T(11), 'intro')],
      [4, match(T(10, 11), 'practice')],
      [5, snake(T(10, 11), 10, 450, 4, ALL_KINDS)],
    ] },
    { key: 'review', title: ['unit_review', with1112], levels: [
      [1, quiz('type', FIRST_HALF, 'review', { count: 20, timeLimit: 6 })],
      [2, balloons(FIRST_HALF, 7, [8, 15, 22])],
      [3, streak(FIRST_HALF, 10, 6, [60, 35, 20])],
      [4, snake(FIRST_HALF, 12, 430, 4, ALL_KINDS)],
    ] },
    { key: 'six', title: ['unit_6'], levels: [
      [1, quiz('choice', T(6), 'intro')],
      [2, quiz('type', T(6), 'intro')],
      [3, match(T(3, 6), 'practice')],
      [4, snake(T(3, 6), 12, 410, 4, ALL_KINDS)],
    ] },
    with1112 && { key: 'twelve', title: ['unit_12'], levels: [
      [1, quiz('choice', T(12), 'intro')],
      [2, quiz('type', T(12), 'intro')],
      [3, quiz('missing', T(6, 12), 'practice')],
      [4, snake(T(6, 12), 12, 400, 4, ALL_KINDS)],
    ] },
    { key: 'eight', title: ['unit_8'], levels: [
      [1, quiz('choice', T(8), 'intro')],
      [2, quiz('trueFalse', T(4, 8), 'practice')],
      [3, quiz('type', T(8), 'intro')],
      [4, snake(T(4, 8), 12, 390, 4, ALL_KINDS, true)],
    ] },
    { key: 'seven', title: ['unit_7'], levels: [
      [1, quiz('choice', T(7), 'intro')],
      [2, quiz('type', T(7), 'intro')],
      [3, quiz('pickQuestion', T(6, 7, 8), 'practice')],
      [4, quiz('missing', T(6, 7, 8), 'practice')],
      [5, snake(T(6, 7, 8), 14, 380, 4, ALL_KINDS, true)],
    ] },
    // 6–9 × 6–9: first each half with plenty of time, then all 16 facts, faster and faster
    { key: 'tricky', title: ['unit_tricky'], levels: [
      [5, quiz('choice', TRICKY_67, 'intro')],
      [6, quiz('trueFalse', TRICKY_89, 'intro', { count: 12 })],
      [1, match(TRICKY, 'practice')],
      [7, quiz('type', TRICKY_67, 'practice')],
      [8, quiz('type', TRICKY_89, 'practice')],
      [2, quiz('choice', TRICKY, 'review', { timeLimit: 5 })],
      [3, quiz('type', TRICKY, 'review', { timeLimit: 5 })],
      [4, balloons(TRICKY, 6, [8, 16, 24])],
      [9, snake(TRICKY, 14, 370, 5, ALL_KINDS, true)],
    ] },
    // all facts; every level a little harder than the one before, up to the final test
    { key: 'master', title: ['unit_mastery', upTo], levels: [
      [9, quiz('trueFalse', ALL, 'review', { timeLimit: 5 })],
      [10, quiz('choice', ALL, 'review', { timeLimit: 6 })],
      [1, quiz('trueFalse', ALL, 'master', { timeLimit: 3 })],
      [11, quiz('pickQuestion', ALL, 'master', { timeLimit: 6 })],
      [2, quiz('choice', ALL, 'master', { timeLimit: 4 })],
      [12, match(ALL, 'practice', 3)],
      [3, quiz('missing', ALL, 'master', { timeLimit: 6 })],
      [13, quiz('type', ALL, 'review', { count: 20, timeLimit: 6 })],
      [14, balloons(ALL, 6, [8, 15, 22])],
      [17, snake(ALL, 16, 355, 5, ALL_KINDS, true)],
      [15, streak(ALL, 10, 6, [60, 35, 20])],
      [4, match(ALL, 'master', 4)],
      [5, balloons(ALL, 5, [10, 18, 26])],
      [6, quiz('type', ALL, 'master')],
      [16, quiz('missing', ALL, 'master', { count: 25, timeLimit: 4 })],
      [18, snake(ALL, 20, 340, 5, ALL_KINDS, true)],
      [7, streak(ALL, 20, 4, [80, 50, 30])],
      // 11 and 12 bring bigger products with three digits, so gold gets a little more time
      [8, quiz('type', ALL, 'final', with1112 ? { medals: [{ minAccuracy: 0.9, maxAvg: 3 }, { minAccuracy: 1, maxAvg: 2 }, { minAccuracy: 1, maxAvg: 1.2 }] } : {})],
    ] },
  ].filter(Boolean);

  return units.map(unit => ({
    ...unit,
    levels: unit.levels.map(([n, level]) => ({ ...level, n, id: `${with1112 ? '12:' : ''}${unit.key}-${n}` })),
  }));
}

function buildCourse(with1112) {
  UNITS = createCourse(with1112);
  LEVELS = UNITS.flatMap((unit, unitIndex) => unit.levels.map(level => ({ ...level, unitIndex })));
  LEVELS.forEach((level, index) => { level.number = index + 1; });
}

// --- medals saved before level ids were permanent ---

// Until then a level's id was `<game>-<position in the course>`, so adding levels moved the medals of every later
// level. The units had this many levels then (levels #1 to #size).
const LEGACY_UNIT_SIZES = {
  two: 4, tenFive: 5, one: 3, squares: 3, four: 4, three: 4, nine: 4, eleven: 4, review: 3, six: 3, twelve: 3,
  eight: 3, seven: 4, tricky: 4, master: 8,
};
const LEGACY_GAMES = ['choice', 'trueFalse', 'type', 'match', 'balloons', 'missing', 'pickQuestion'];

function legacyIdMap() {
  const map = {};
  for (const with1112 of [false, true]) {
    const oldOrder = createCourse(with1112).flatMap(unit => unit.levels
      .filter(level => level.n <= LEGACY_UNIT_SIZES[unit.key])
      .sort((a, b) => a.n - b.n));
    oldOrder.forEach((level, index) => { map[`${with1112 ? '12:' : ''}${level.game}-${index + 1}`] = level.id; });
  }
  return map;
}

const isLegacyId = id => LEGACY_GAMES.includes(/^(?:12:)?([A-Za-z]+)-\d+$/.exec(id)?.[1]);

// level id -> { medal }, with old ids moved to the permanent ones (the better medal wins if both exist)
function migrateProgress(progress) {
  if (!Object.keys(progress).some(isLegacyId)) return progress;
  const map = legacyIdMap();
  const migrated = {};
  for (const [id, entry] of Object.entries(progress)) {
    const newId = isLegacyId(id) ? map[id] : id;
    if (newId && (migrated[newId]?.medal ?? 0) < entry.medal) migrated[newId] = entry;
  }
  return migrated;
}

function meetsGoal(goal, result) {
  const epsilon = 1e-9;
  return (goal.minAccuracy === undefined || result.accuracy >= goal.minAccuracy - epsilon)
    && (goal.maxAvg === undefined || result.avgSeconds <= goal.maxAvg)
    && (goal.maxSeconds === undefined || result.elapsedMs / 1000 <= goal.maxSeconds)
    && (goal.maxMistakes === undefined || result.wrong <= goal.maxMistakes)
    && (goal.minScore === undefined || result.score >= goal.minScore);
}

// How a medal looks mid-game from the live stats a runner reports:
// 'lost' = can no longer be reached, 'onTrack' = reached if the player keeps this pace, 'possible' = in between.
function medalOutlook(goal, s) {
  const checks = [];
  if (goal.minAccuracy !== undefined && s.total) {
    const best = (s.correct + s.total - s.answered) / s.total;
    checks.push(best < goal.minAccuracy - 1e-9 ? 'lost' : s.answered === 0 || s.correct / s.answered >= goal.minAccuracy - 1e-9 ? 'onTrack' : 'possible');
  }
  if (goal.maxAvg !== undefined && s.total) {
    const usedMs = s.answerMs + s.currentMs;
    const timed = s.answered + (s.currentMs > 0 ? 1 : 0);
    // even if every remaining answer were instant, the average can't get below this
    const bestAvg = usedMs / s.total / 1000;
    checks.push(bestAvg > goal.maxAvg ? 'lost' : timed === 0 || usedMs / timed / 1000 <= goal.maxAvg ? 'onTrack' : 'possible');
  }
  if (goal.maxSeconds !== undefined) {
    const seconds = s.elapsedMs / 1000;
    const projected = s.progress > 0 ? seconds / s.progress : seconds;
    checks.push(seconds > goal.maxSeconds ? 'lost' : projected <= goal.maxSeconds ? 'onTrack' : 'possible');
  }
  if (goal.maxMistakes !== undefined) checks.push(s.wrong > goal.maxMistakes ? 'lost' : 'onTrack');
  if (goal.minScore !== undefined) checks.push(s.score >= goal.minScore ? 'onTrack' : 'possible');
  if (checks.includes('lost')) return 'lost';
  return checks.every(check => check === 'onTrack') ? 'onTrack' : 'possible';
}

// 0 = no medal, 1 = bronze, 2 = silver, 3 = gold.
function medalFor(level, result) {
  for (let medal = 3; medal >= 1; medal--) {
    if (meetsGoal(level.medals[medal - 1], result)) return medal;
  }
  return 0;
}
