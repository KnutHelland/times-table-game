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

const balloons = (source, seconds, rise, scores) =>
  ({ game: 'balloons', source, seconds, rise, medals: scores.map(minScore => ({ minScore })) });

const streak = (source, length, timeLimit, maxSeconds) =>
  ({ game: 'type', streak: length, source, timeLimit, medals: maxSeconds.map(s => ({ maxSeconds: s })) });

const T = (...tables) => ({ tables });
const T12 = (...tables) => ({ tables, factors: range(1, 12) });
const SQUARES = { facts: 'squares' };
const TRICKY = { facts: 'tricky' };
const EASY = T(1, 2, 5, 10);
const FIRST_HALF = T(1, 2, 3, 4, 5, 9, 10);
const ALL = T(...range(1, 10));
const ALL12 = T12(...range(1, 12));

// The order follows a common teaching order: 2, 10, 5, 1, square numbers, 4, 3, 9, then 6, 8, 7 and the
// hardest facts last. Each table is introduced with an easy gameplay and lots of time before it has to be typed.
const UNITS = [
  { title: { en: 'The 2 table', no: '2-gangen' }, levels: [
    quiz('choice', T(2), 'intro'),
    quiz('trueFalse', T(2), 'intro', { count: 12 }),
    quiz('type', T(2), 'intro'),
    match(T(2), 'intro'),
  ] },
  { title: { en: 'The 10 and 5 tables', no: '10- og 5-gangen' }, levels: [
    quiz('choice', T(10), 'intro'),
    quiz('type', T(10), 'intro'),
    quiz('choice', T(5), 'intro'),
    quiz('type', T(5), 'intro'),
    balloons(T(2, 5, 10), 45, 9, [5, 10, 15]),
  ] },
  { title: { en: 'The 1 table and a review', no: '1-gangen og repetisjon' }, levels: [
    quiz('trueFalse', T(1, 10), 'intro', { count: 12 }),
    quiz('pickQuestion', T(2, 5, 10), 'practice'),
    quiz('type', EASY, 'review'),
  ] },
  { title: { en: 'Square numbers', no: 'Kvadrattall' }, levels: [
    quiz('choice', SQUARES, 'intro'),
    match(SQUARES, 'intro'),
    quiz('type', SQUARES, 'practice'),
  ] },
  { title: { en: 'The 4 table: double the 2s', no: '4-gangen: dobbelt av 2-gangen' }, levels: [
    quiz('choice', T(4), 'intro'),
    quiz('type', T(4), 'intro'),
    quiz('missing', T(2, 4), 'practice'),
    balloons(T(2, 4, 5, 10), 45, 8, [6, 12, 18]),
  ] },
  { title: { en: 'The 3 table', no: '3-gangen' }, levels: [
    quiz('choice', T(3), 'intro'),
    quiz('trueFalse', T(3), 'intro', { count: 12 }),
    quiz('type', T(3), 'intro'),
    match(T(3, 4), 'practice'),
  ] },
  { title: { en: 'The 9 table: 10 times minus once', no: '9-gangen: ti ganger minus én gang' }, levels: [
    quiz('choice', T(9), 'intro'),
    quiz('pickQuestion', T(9), 'practice'),
    quiz('type', T(9), 'intro'),
    quiz('missing', T(3, 9), 'practice'),
  ] },
  { title: { en: 'Review: 1–5, 9 and 10', no: 'Repetisjon: 1–5, 9 og 10' }, levels: [
    quiz('type', FIRST_HALF, 'review', { count: 20, timeLimit: 6 }),
    balloons(FIRST_HALF, 60, 7, [8, 15, 22]),
    streak(FIRST_HALF, 10, 6, [60, 35, 20]),
  ] },
  { title: { en: 'The 6 table: double the 3s', no: '6-gangen: dobbelt av 3-gangen' }, levels: [
    quiz('choice', T(6), 'intro'),
    quiz('type', T(6), 'intro'),
    match(T(3, 6), 'practice'),
  ] },
  { title: { en: 'The 8 table: double the 4s', no: '8-gangen: dobbelt av 4-gangen' }, levels: [
    quiz('choice', T(8), 'intro'),
    quiz('trueFalse', T(4, 8), 'practice'),
    quiz('type', T(8), 'intro'),
  ] },
  { title: { en: 'The 7 table', no: '7-gangen' }, levels: [
    quiz('choice', T(7), 'intro'),
    quiz('type', T(7), 'intro'),
    quiz('pickQuestion', T(6, 7, 8), 'practice'),
    quiz('missing', T(6, 7, 8), 'practice'),
  ] },
  { title: { en: 'The tricky ones: 6–9 times 6–9', no: 'De vanskelige: 6–9 ganger 6–9' }, levels: [
    match(TRICKY, 'practice'),
    quiz('choice', TRICKY, 'review', { timeLimit: 5 }),
    quiz('type', TRICKY, 'review', { timeLimit: 5 }),
    balloons(TRICKY, 60, 6, [8, 16, 24]),
  ] },
  { title: { en: 'Mastery: 1–10', no: 'Mester: 1–10' }, levels: [
    quiz('trueFalse', ALL, 'master', { timeLimit: 3 }),
    quiz('choice', ALL, 'master', { timeLimit: 4 }),
    quiz('missing', ALL, 'master', { timeLimit: 6 }),
    match(ALL, 'master', 4),
    balloons(ALL, 60, 5, [10, 18, 26]),
    quiz('type', ALL, 'master'),
    streak(ALL, 20, 4, [80, 50, 30]),
    quiz('type', ALL, 'final'),
  ] },
  { title: { en: 'Bonus: 11 and 12', no: 'Bonus: 11 og 12' }, levels: [
    quiz('choice', T12(11), 'intro'),
    quiz('type', T12(11), 'practice'),
    quiz('choice', T12(12), 'intro'),
    quiz('type', T12(12), 'practice'),
    balloons(ALL12, 60, 5, [10, 18, 26]),
    quiz('type', ALL12, 'final', { medals: [{ minAccuracy: 0.9, maxAvg: 3 }, { minAccuracy: 1, maxAvg: 2 }, { minAccuracy: 1, maxAvg: 1.2 }] }),
  ] },
];

const LEVELS = UNITS.flatMap((unit, unitIndex) => unit.levels.map(level => ({ ...level, unitIndex })));
LEVELS.forEach((level, index) => {
  level.number = index + 1;
  level.id = `${level.game}-${index + 1}`;
});

function meetsGoal(goal, result) {
  const epsilon = 1e-9;
  return (goal.minAccuracy === undefined || result.accuracy >= goal.minAccuracy - epsilon)
    && (goal.maxAvg === undefined || result.avgSeconds <= goal.maxAvg)
    && (goal.maxSeconds === undefined || result.elapsedMs / 1000 <= goal.maxSeconds)
    && (goal.maxMistakes === undefined || result.wrong <= goal.maxMistakes)
    && (goal.minScore === undefined || result.score >= goal.minScore);
}

// 0 = no medal, 1 = bronze, 2 = silver, 3 = gold.
function medalFor(level, result) {
  for (let medal = 3; medal >= 1; medal--) {
    if (meetsGoal(level.medals[medal - 1], result)) return medal;
  }
  return 0;
}
