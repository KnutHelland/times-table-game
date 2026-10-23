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

let UNITS = [];
let LEVELS = [];

// The order follows a common teaching order: 2, 10, 5, 1, square numbers, 4, 3, 9, then 6, 8, 7 and the
// hardest facts last. Each table is introduced with an easy gameplay and lots of time before it has to be typed.
// With the 11 and 12 tables on, every table goes up to 12 times, 11 comes after the 9s (its pattern is easy)
// and 12 right after the 6s (double the 6s).
function buildCourse(with1112) {
  const maxFactor = with1112 ? 12 : 10;
  const T = (...tables) => ({ tables, factors: range(1, maxFactor) });
  const SQUARES = { facts: 'squares', max: maxFactor };
  const TRICKY = { facts: 'tricky' };
  const EASY = T(1, 2, 5, 10);
  const FIRST_HALF = with1112 ? T(1, 2, 3, 4, 5, 9, 10, 11) : T(1, 2, 3, 4, 5, 9, 10);
  const ALL = T(...range(1, maxFactor));
  const upTo = with1112 ? '12' : '10';

  const units = [
    { title: ['unit_2'], levels: [
      quiz('choice', T(2), 'intro'),
      quiz('trueFalse', T(2), 'intro', { count: 12 }),
      quiz('type', T(2), 'intro'),
      match(T(2), 'intro'),
    ] },
    { title: ['unit_10and5'], levels: [
      quiz('choice', T(10), 'intro'),
      quiz('type', T(10), 'intro'),
      quiz('choice', T(5), 'intro'),
      quiz('type', T(5), 'intro'),
      balloons(T(2, 5, 10), 9, [5, 10, 15], 3),
    ] },
    { title: ['unit_1'], levels: [
      quiz('trueFalse', T(1, 10), 'intro', { count: 12 }),
      quiz('pickQuestion', T(2, 5, 10), 'practice'),
      quiz('type', EASY, 'review'),
    ] },
    { title: ['unit_squares'], levels: [
      quiz('choice', SQUARES, 'intro'),
      match(SQUARES, 'intro'),
      quiz('type', SQUARES, 'practice'),
    ] },
    { title: ['unit_4'], levels: [
      quiz('choice', T(4), 'intro'),
      quiz('type', T(4), 'intro'),
      quiz('missing', T(2, 4), 'practice'),
      balloons(T(2, 4, 5, 10), 8, [6, 12, 18]),
    ] },
    { title: ['unit_3'], levels: [
      quiz('choice', T(3), 'intro'),
      quiz('trueFalse', T(3), 'intro', { count: 12 }),
      quiz('type', T(3), 'intro'),
      match(T(3, 4), 'practice'),
    ] },
    { title: ['unit_9'], levels: [
      quiz('choice', T(9), 'intro'),
      quiz('pickQuestion', T(9), 'practice'),
      quiz('type', T(9), 'intro'),
      quiz('missing', T(3, 9), 'practice'),
    ] },
    with1112 && { title: ['unit_11'], levels: [
      quiz('choice', T(11), 'intro'),
      quiz('trueFalse', T(11), 'intro', { count: 12 }),
      quiz('type', T(11), 'intro'),
      match(T(10, 11), 'practice'),
    ] },
    { title: ['unit_review', with1112], levels: [
      quiz('type', FIRST_HALF, 'review', { count: 20, timeLimit: 6 }),
      balloons(FIRST_HALF, 7, [8, 15, 22]),
      streak(FIRST_HALF, 10, 6, [60, 35, 20]),
    ] },
    { title: ['unit_6'], levels: [
      quiz('choice', T(6), 'intro'),
      quiz('type', T(6), 'intro'),
      match(T(3, 6), 'practice'),
    ] },
    with1112 && { title: ['unit_12'], levels: [
      quiz('choice', T(12), 'intro'),
      quiz('type', T(12), 'intro'),
      quiz('missing', T(6, 12), 'practice'),
    ] },
    { title: ['unit_8'], levels: [
      quiz('choice', T(8), 'intro'),
      quiz('trueFalse', T(4, 8), 'practice'),
      quiz('type', T(8), 'intro'),
    ] },
    { title: ['unit_7'], levels: [
      quiz('choice', T(7), 'intro'),
      quiz('type', T(7), 'intro'),
      quiz('pickQuestion', T(6, 7, 8), 'practice'),
      quiz('missing', T(6, 7, 8), 'practice'),
    ] },
    { title: ['unit_tricky'], levels: [
      match(TRICKY, 'practice'),
      quiz('choice', TRICKY, 'review', { timeLimit: 5 }),
      quiz('type', TRICKY, 'review', { timeLimit: 5 }),
      balloons(TRICKY, 6, [8, 16, 24]),
    ] },
    { title: ['unit_mastery', upTo], levels: [
      quiz('trueFalse', ALL, 'master', { timeLimit: 3 }),
      quiz('choice', ALL, 'master', { timeLimit: 4 }),
      quiz('missing', ALL, 'master', { timeLimit: 6 }),
      match(ALL, 'master', 4),
      balloons(ALL, 5, [10, 18, 26]),
      quiz('type', ALL, 'master'),
      streak(ALL, 20, 4, [80, 50, 30]),
      // 11 and 12 bring bigger products with three digits, so gold gets a little more time
      quiz('type', ALL, 'final', with1112 ? { medals: [{ minAccuracy: 0.9, maxAvg: 3 }, { minAccuracy: 1, maxAvg: 2 }, { minAccuracy: 1, maxAvg: 1.2 }] } : {}),
    ] },
  ].filter(Boolean);

  UNITS = units;
  LEVELS = units.flatMap((unit, unitIndex) => unit.levels.map(level => ({ ...level, unitIndex })));
  LEVELS.forEach((level, index) => {
    level.number = index + 1;
    // the two courses keep separate medals; the 1–10 ids match the ids used before the setting existed
    level.id = `${with1112 ? '12:' : ''}${level.game}-${index + 1}`;
  });
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
