// Each runner draws into ctx.stage, reports through ctx.hud and calls ctx.finish(result) once.
// It returns { key(event) -> handled, rerender(), stop() }.
// A result has: questions, correct, wrong, accuracy, avgSeconds, elapsedMs, score, mistakes.

const QUIZ_GAMES = ['type', 'missing', 'choice', 'pickQuestion', 'trueFalse'];

// --- quiz: one question at a time, answered by typing or by picking an option ---

function runQuiz(ctx, config) {
  const { game, deck, count, streak, timeLimit } = config;
  const typed = game === 'type' || game === 'missing';
  const start = performance.now();
  const answerMs = [];
  const mistakes = [];
  let answered = 0, correct = 0, inARow = 0;
  let question, expected, options, input, correcting, wrongIndex, questionStart, feedback;
  let stopped = false;

  const prompt = el('p', 'prompt');
  const questionEl = el('div', 'question');
  const answerEl = el('div', 'answer');
  const timeBar = el('div', 'bar time-bar');
  const timeLeft = el('div');
  const feedbackEl = el('p', 'feedback');
  const controls = el('div', typed ? 'numpad' : game === 'trueFalse' ? 'options two' : 'options');
  timeBar.append(timeLeft);
  timeBar.hidden = !timeLimit;
  ctx.stage.replaceChildren(prompt, questionEl, ...(game === 'type' ? [answerEl] : []), timeBar, feedbackEl, controls);

  if (typed) {
    for (const key of ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'Backspace', '0', 'Enter']) {
      const button = el('button', key === 'Enter' ? 'enter' : '', { Backspace: '⌫', Enter: '⏎' }[key] ?? key);
      button.addEventListener('click', () => pressKey(key));
      controls.append(button);
    }
  }

  function nextQuestion() {
    question = deck.next();
    input = '';
    correcting = false;
    wrongIndex = null;
    feedback = '';
    questionStart = performance.now();
    if (game === 'type') expected = question.answer;
    if (game === 'missing') {
      question.hidden = Math.random() < 0.5 ? 'a' : 'b';
      expected = question[question.hidden];
    }
    if (game === 'choice') {
      options = shuffle([question.answer, ...wrongAnswers(question, 3)]).map(n => ({ value: n, correct: n === question.answer }));
    }
    if (game === 'pickQuestion') {
      options = shuffle([[question.a, question.b], ...wrongExpressions(question, 3)])
        .map(([a, b]) => ({ a, b, correct: a * b === question.answer }));
    }
    if (game === 'trueFalse') {
      question.shown = Math.random() < 0.5 ? question.answer : wrongAnswers(question, 1)[0];
      const isTrue = question.shown === question.answer;
      options = [{ label: 'true', correct: isTrue }, { label: 'false', correct: !isTrue }];
    }
    if (!typed) renderOptions();
    render();
  }

  function optionText(option) {
    if (game === 'choice') return String(option.value);
    if (game === 'pickQuestion') return expression(option.a, option.b);
    return t(option.label);
  }

  function renderOptions() {
    controls.replaceChildren();
    options.forEach((option, index) => {
      const button = el('button', 'option');
      button.addEventListener('click', () => pick(index));
      controls.append(button);
    });
  }

  function render() {
    prompt.textContent = t(`prompt_${game}`);
    if (game === 'missing') {
      const blank = `<span class="blank">${input || '?'}</span>`;
      const a = question.hidden === 'a' ? blank : question.a;
      const b = question.hidden === 'b' ? blank : question.b;
      questionEl.innerHTML = `${a} ${t('times')} ${b} = ${question.answer}`;
    } else if (game === 'pickQuestion') {
      questionEl.textContent = String(question.answer);
    } else if (game === 'trueFalse') {
      questionEl.textContent = `${expression(question.a, question.b)} = ${question.shown}`;
    } else {
      questionEl.textContent = expression(question.a, question.b);
    }
    answerEl.textContent = input || ' ';
    answerEl.classList.toggle('correcting', correcting);
    feedbackEl.textContent = feedback;
    if (!typed) {
      [...controls.children].forEach((button, index) => {
        button.textContent = optionText(options[index]);
        button.classList.toggle('reveal', correcting && options[index].correct);
        button.classList.toggle('wrong', correcting && index === wrongIndex);
      });
    }
    const progress = streak ? inARow / streak : answered / count;
    ctx.hud.progress(progress, streak ? t('inARow', inARow, streak) : t('questionOf', Math.min(answered + 1, count), count));
  }

  function solution() {
    if (game === 'missing') return `${expression(question.a, question.b)} = ${question.answer}`;
    if (game === 'trueFalse') return `${expression(question.a, question.b)} = ${question.answer}`;
    if (game === 'pickQuestion') return `${expression(question.a, question.b)} = ${question.answer}`;
    return String(question.answer);
  }

  function answerCorrect() {
    playCorrect();
    flash(questionEl, 'ok');
    answerMs.push(performance.now() - questionStart);
    answered++;
    correct++;
    inARow++;
    advance();
  }

  function answerWrong(given, index = null) {
    playWrong();
    flash(questionEl, 'fail');
    if (game === 'type') flash(answerEl, 'shake');
    answerMs.push(Math.min(performance.now() - questionStart, (timeLimit ?? Infinity) * 1000));
    const { a, b, answer } = question;
    mistakes.push({ a, b, answer, given });
    answered++;
    inARow = 0;
    correcting = true;
    wrongIndex = index;
    input = '';
    const howToContinue = typed ? t('typeItToContinue') : t('pickItToContinue');
    feedback = `${given === null ? t('timeUp') + ' ' : ''}${t('theAnswerIs', solution())} ${howToContinue}`;
    render();
  }

  function advance() {
    const done = streak ? inARow >= streak : answered >= count;
    if (done) finish();
    else nextQuestion();
  }

  function finish() {
    stopped = true;
    const elapsedMs = performance.now() - start;
    ctx.finish({
      questions: answered,
      correct,
      wrong: mistakes.length,
      accuracy: answered ? correct / answered : 0,
      avgSeconds: answerMs.reduce((sum, ms) => sum + ms, 0) / answerMs.length / 1000,
      elapsedMs,
      mistakes,
    });
  }

  function pressKey(key) {
    if (stopped || !typed) return;
    if (key === 'Enter') return submit();
    if (key === 'Backspace') input = input.slice(0, -1);
    else if (/^\d$/.test(key) && input.length < 3) input = (input + key).replace(/^0+(?=\d)/, '');
    render();
  }

  function submit() {
    if (input === '') return;
    const value = Number(input);
    if (correcting) {
      if (value === expected) advance();
      else {
        input = '';
        flash(game === 'type' ? answerEl : questionEl, 'shake');
        render();
      }
    } else if (value === expected) answerCorrect();
    else answerWrong(value);
  }

  function pick(index) {
    if (stopped) return;
    const option = options[index];
    if (correcting) {
      if (option.correct) advance();
      else flash(controls.children[index], 'shake');
    } else if (option.correct) answerCorrect();
    else answerWrong(optionText(option), index);
  }

  function tick() {
    if (stopped) return;
    const now = performance.now();
    ctx.hud.clock(formatTime(now - start));
    ctx.hud.stats({
      total: streak ? null : count,
      answered,
      correct,
      wrong: mistakes.length,
      answerMs: answerMs.reduce((sum, ms) => sum + ms, 0),
      currentMs: correcting ? 0 : now - questionStart,
      elapsedMs: now - start,
      progress: streak ? inARow / streak : answered / count,
    });
    if (timeLimit) {
      const limit = timeLimit * 1000;
      const left = correcting ? 0 : Math.max(0, limit - (now - questionStart));
      timeLeft.style.width = `${(left / limit) * 100}%`;
      if (!correcting && left === 0) answerWrong(null);
    }
    requestAnimationFrame(tick);
  }

  nextQuestion();
  requestAnimationFrame(tick);

  return {
    key(e) {
      if (typed && (/^\d$/.test(e.key) || e.key === 'Backspace' || e.key === 'Enter')) {
        pressKey(e.key);
        return true;
      }
      if (!typed) {
        const index = game === 'trueFalse'
          ? { ArrowLeft: 0, ArrowRight: 1, 1: 0, 2: 1 }[e.key]
          : { 1: 0, 2: 1, 3: 2, 4: 3 }[e.key];
        if (index !== undefined) {
          pick(index);
          return true;
        }
      }
      return false;
    },
    rerender: render,
    stop() { stopped = true; },
  };
}

// --- match: connect expressions to their answers by dragging or tapping ---

function runMatch(ctx, config) {
  const { deck, rounds, pairs } = config;
  const start = performance.now();
  const total = rounds * pairs;
  let round = 0, matched = 0, mistakes = 0;
  let items = [], selected = null, dragLine = null;
  let stopped = false;

  const prompt = el('p', 'prompt');
  const board = el('div', 'match');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const left = el('div', 'match-col');
  const right = el('div', 'match-col');
  board.append(svg, left, right);
  ctx.stage.replaceChildren(prompt, board);

  function newRound() {
    const facts = [];
    for (let tries = 0; facts.length < pairs && tries < 500; tries++) {
      const question = deck.next();
      if (!facts.some(f => f.answer === question.answer)) facts.push(question);
    }
    items = [
      ...facts.map(f => ({ side: 'left', answer: f.answer, a: f.a, b: f.b })),
      ...shuffle(facts).map(f => ({ side: 'right', answer: f.answer })),
    ];
    left.replaceChildren();
    right.replaceChildren();
    for (const item of items) {
      item.el = el('button', 'match-item');
      item.el.addEventListener('pointerdown', e => pointerDown(e, item));
      (item.side === 'left' ? left : right).append(item.el);
    }
    selected = null;
    render();
  }

  function render() {
    prompt.textContent = t('prompt_match');
    for (const item of items) {
      item.el.textContent = item.side === 'left' ? expression(item.a, item.b) : item.answer;
      item.el.classList.toggle('done', !!item.done);
      item.el.classList.toggle('selected', item === selected);
    }
    drawLines();
    ctx.hud.progress(matched / total, t('roundOf', Math.min(round + 1, rounds), rounds));
  }

  function anchor(item) {
    const box = item.el.getBoundingClientRect();
    const origin = board.getBoundingClientRect();
    return { x: (item.side === 'left' ? box.right : box.left) - origin.left, y: box.top + box.height / 2 - origin.top };
  }

  function line(from, to, className) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    element.setAttribute('class', className);
    element.setAttribute('x1', from.x);
    element.setAttribute('y1', from.y);
    element.setAttribute('x2', to.x);
    element.setAttribute('y2', to.y);
    return element;
  }

  function drawLines() {
    svg.replaceChildren();
    for (const item of items) {
      if (item.side === 'left' && item.done) svg.append(line(anchor(item), anchor(item.partner), 'done'));
    }
    if (dragLine) svg.append(line(anchor(dragLine.item), dragLine.to, 'drag'));
  }

  function pointerDown(e, item) {
    if (stopped || item.done) return;
    e.preventDefault();
    if (selected && selected.side !== item.side) return attempt(selected, item);
    selected = item;
    const origin = board.getBoundingClientRect();
    dragLine = { item, to: { x: e.clientX - origin.left, y: e.clientY - origin.top } };
    render();
  }

  function pointerMove(e) {
    if (!dragLine) return;
    const origin = board.getBoundingClientRect();
    dragLine.to = { x: e.clientX - origin.left, y: e.clientY - origin.top };
    drawLines();
  }

  function pointerUp(e) {
    if (!dragLine) return;
    const from = dragLine.item;
    dragLine = null;
    const target = items.find(item => item.el === document.elementFromPoint(e.clientX, e.clientY)?.closest('.match-item'));
    if (target && target.side !== from.side && !target.done) attempt(from, target);
    else render();
  }

  function attempt(first, second) {
    dragLine = null;
    selected = null;
    const [l, r] = first.side === 'left' ? [first, second] : [second, first];
    if (l.answer === r.answer) {
      playCorrect();
      l.done = r.done = true;
      l.partner = r;
      matched++;
      if (items.every(item => item.done)) {
        round++;
        if (round >= rounds) return finish();
        setTimeout(() => !stopped && newRound(), 450);
      }
    } else {
      playWrong();
      mistakes++;
      flash(l.el, 'fail');
      flash(r.el, 'fail');
    }
    render();
  }

  function finish() {
    stopped = true;
    render();
    ctx.finish({
      questions: total,
      correct: total,
      wrong: mistakes,
      accuracy: total / (total + mistakes),
      elapsedMs: performance.now() - start,
    });
  }

  function tick() {
    if (stopped) return;
    ctx.hud.clock(formatTime(performance.now() - start));
    ctx.hud.stats({ wrong: mistakes, elapsedMs: performance.now() - start, progress: matched / total });
    requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('resize', drawLines);
  newRound();
  requestAnimationFrame(tick);

  return {
    key: () => false,
    rerender: render,
    stop() {
      stopped = true;
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('resize', drawLines);
    },
  };
}

// --- balloons: a multiple-choice wave of balloons per question; pop the right one before it flies away ---

const BALLOON_COLORS = ['#e8a0a0', '#9ec5e8', '#a8d8a8', '#e8d49a', '#c8a8e0', '#f0b890'];

function runBalloons(ctx, config) {
  const { deck, rise, count = 4, target } = config;
  const start = performance.now();
  const mistakes = [];
  let score = 0, wrongPops = 0, speedFactor = 1, last = performance.now();
  let question = null, wave = [], waveStart = 0, lost = false;
  let stopped = false;

  const sky = el('div', 'sky');
  const questionEl = el('div', 'sky-question');
  const feedbackEl = el('p', 'feedback');
  sky.append(questionEl);
  ctx.stage.replaceChildren(el('p', 'prompt'), sky, feedbackEl);

  function render() {
    setText(ctx.stage.querySelector('.prompt'), t('prompt_balloons'));
    if (question) setText(questionEl, expression(question.a, question.b));
    ctx.hud.progress(target ? score / target : 0, target ? t('pointsOf', score, target) : t('points', score));
    ctx.hud.clock(formatTime(performance.now() - start));
    ctx.hud.stats({ score, wrong: mistakes.length, elapsedMs: performance.now() - start });
  }

  // All balloons of a wave start within a few hundred milliseconds, one per lane in random order.
  function releaseWave() {
    question = deck.next();
    const values = shuffle([question.answer, ...wrongAnswers(question, count - 1)]);
    const lanes = shuffle(range(0, count - 1));
    const width = sky.clientWidth;
    wave = values.map((value, i) => {
      const balloon = { value, delay: Math.random() * 400, y: -80, el: el('button', 'balloon', value) };
      balloon.el.style.left = `${((lanes[i] + 0.5) / count) * width - 32}px`;
      balloon.el.style.background = randomItem(BALLOON_COLORS);
      balloon.el.style.transform = 'translateY(80px)';
      balloon.el.addEventListener('pointerdown', e => {
        e.preventDefault();
        hit(balloon);
      });
      sky.append(balloon.el);
      return balloon;
    });
    waveStart = 0;
    flash(questionEl, 'ok');
    render();
  }

  function remove(balloon, className) {
    wave = wave.filter(b => b !== balloon);
    balloon.el.style.pointerEvents = 'none';
    if (!className) return balloon.el.remove();
    balloon.el.classList.add(className);
    setTimeout(() => balloon.el.remove(), 500);
  }

  function hit(balloon) {
    if (stopped || lost || !wave.includes(balloon)) return;
    if (balloon.value === question.answer) {
      playCorrect();
      score++;
      remove(balloon, 'popped');
      for (const other of [...wave]) remove(other, 'cheer');
      feedbackEl.textContent = '';
      render();
      if (target && score >= target) return setTimeout(finish, 500);
      setTimeout(() => !stopped && releaseWave(), 450);
    } else {
      playWrong();
      wrongPops++;
      mistakes.push({ a: question.a, b: question.b, answer: question.answer, given: balloon.value });
      speedFactor *= 1.15; // only mistakes speed the game up, so a fluent player can go on forever
      remove(balloon, 'burst');
      flash(sky, 'fail');
    }
  }

  function loseWave() {
    lost = true;
    playWrong();
    flash(sky, 'fail');
    mistakes.push({ a: question.a, b: question.b, answer: question.answer, given: null });
    feedbackEl.textContent = t('theAnswerIs', `${expression(question.a, question.b)} = ${question.answer}`);
    for (const balloon of [...wave]) remove(balloon, 'burst');
    setTimeout(finish, 1500);
  }

  function loop(now) {
    if (stopped) return;
    const dt = Math.min(now - last, 100); // a hidden tab pauses the game instead of jumping ahead
    last = now;
    if (!lost && wave.length) {
      waveStart += dt;
      const speed = (sky.clientHeight / rise) * speedFactor;
      for (const balloon of [...wave]) {
        if (waveStart < balloon.delay) continue;
        balloon.y += (speed * dt) / 1000;
        balloon.el.style.transform = `translateY(${-balloon.y}px)`;
        if (balloon.y > sky.clientHeight) {
          if (balloon.value === question.answer) {
            loseWave();
            break;
          }
          remove(balloon);
        }
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    ctx.finish({
      questions: score + (lost ? 1 : 0),
      correct: score,
      wrong: mistakes.length,
      accuracy: score / Math.max(1, score + wrongPops + (lost ? 1 : 0)),
      elapsedMs: performance.now() - start,
      score,
      mistakes,
    });
  }

  releaseWave();
  requestAnimationFrame(loop);

  return { key: () => false, rerender: render, stop() { stopped = true; } };
}

// --- snake: steer with two turn buttons and eat the apple(s) with the right answer ---

const SNAKE_COLS = 9;
const SNAKE_ROWS = 11;
const SNAKE_DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
const SNAKE_KEYS = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
const SNAKE_START_DELAY = 1200;
const AHEAD_MIN = 4; // an apple is always this many tiles or more straight ahead when a question starts
const AHEAD_MAX = 7;

function runSnake(ctx, config) {
  const { deck, count, stepMs, apples: appleCount, kinds, multiple } = config;
  const maxFactor = settings.include1112 ? 12 : 10;
  const start = performance.now();
  const mistakes = [];
  let snake = [{ x: 4, y: 7 }, { x: 4, y: 8 }, { x: 4, y: 9 }]; // head first
  let dir = 0, queued = [], grow = 0;
  let question = null, apples = [], rightLeft = 0, score = 0;
  let last = performance.now(), sinceStep = -SNAKE_START_DELAY, over = false, stopped = false;
  let cell = 30;

  const prompt = el('p', 'prompt');
  const questionEl = el('div', 'question snake-question');
  const canvas = el('canvas', 'snake-board');
  const feedbackEl = el('p', 'feedback');
  // a D-pad: ▲ on top, ◀ ▼ ▶ below
  const controls = el('div', 'snake-controls');
  const arrows = ['▲', '▶', '▼', '◀'].map((symbol, direction) => {
    const button = el('button', `dir dir-${direction}`, symbol);
    // pointerdown instead of click: the snake must turn the moment the finger touches
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      steer(direction);
    });
    controls.append(button);
    return button;
  });
  ctx.stage.replaceChildren(prompt, questionEl, canvas, feedbackEl, controls);

  const wrap = (x, y) => ({ x: (x + SNAKE_COLS) % SNAKE_COLS, y: (y + SNAKE_ROWS) % SNAKE_ROWS });
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const distance = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.min(dx, SNAKE_COLS - dx) + Math.min(dy, SNAKE_ROWS - dy);
  };
  const label = value => Array.isArray(value) ? expression(value[0], value[1]) : String(value);

  // factors near the right one, so the wrong apples are plausible
  function wrongFactors(factor, n) {
    const candidates = range(1, maxFactor).filter(v => v !== factor);
    return shuffle(candidates.sort((x, y) => Math.abs(x - factor) - Math.abs(y - factor)).slice(0, n * 2)).slice(0, n);
  }

  // every way to write the answer as a product of two factors in the game, each in random order
  function expressionsFor(answer) {
    return range(1, maxFactor).filter(x => answer % x === 0 && answer / x >= x && answer / x <= maxFactor)
      .map(x => Math.random() < 0.5 ? [x, answer / x] : [answer / x, x]);
  }

  function makeQuestion() {
    const fact = deck.next();
    const { a, b, answer } = fact;
    const kind = randomItem(kinds);
    if (kind === 'factor') {
      return { fact, text: `${a} ${t('times')} ? = ${answer}`, rights: [b], wrongs: wrongFactors(b, appleCount - 1) };
    }
    if (kind === 'expression') {
      const all = expressionsFor(answer);
      const rights = multiple ? shuffle(all).slice(0, Math.min(3, appleCount - 1)) : [[a, b]];
      return { fact, text: `? = ${answer}`, rights, wrongs: wrongExpressions(fact, appleCount - rights.length) };
    }
    return { fact, text: expression(a, b), rights: [answer], wrongs: wrongAnswers(fact, appleCount - 1) };
  }

  function placeApples() {
    const values = shuffle([
      ...question.rights.map(value => ({ value, right: true })),
      ...question.wrongs.map(value => ({ value, right: false })),
    ]);
    const head = snake[0];
    const [dx, dy] = SNAKE_DIRECTIONS[dir];
    const lineLength = dx ? SNAKE_COLS : SNAKE_ROWS;
    const line = range(1, lineLength - 1).map(k => wrap(head.x + dx * k, head.y + dy * k));
    const bodyOnLine = line.findIndex(c => snake.some(s => same(s, c)));
    const reachable = bodyOnLine === -1 ? line.length : bodyOnLine;
    const aheadOptions = range(AHEAD_MIN, Math.min(AHEAD_MAX, reachable));
    const placed = [];
    // the first of the shuffled apples goes straight ahead, so going straight is usually a wrong answer
    if (aheadOptions.length) placed.push({ ...line[randomItem(aheadOptions) - 1], ...values.shift() });
    const aheadIndex = placed.length ? line.findIndex(c => same(c, placed[0])) : -1;
    const keepClear = line.slice(0, aheadIndex + 1);
    const free = range(0, SNAKE_COLS * SNAKE_ROWS - 1)
      .map(i => ({ x: i % SNAKE_COLS, y: Math.floor(i / SNAKE_COLS) }))
      .filter(c => distance(c, head) >= 3 && !snake.some(s => same(s, c)) && !keepClear.some(k => same(k, c)));
    for (const value of values) {
      const spots = free.filter(c => !placed.some(p => distance(p, c) < 2));
      if (!spots.length) break;
      placed.push({ ...randomItem(spots), ...value });
    }
    apples = placed;
    rightLeft = apples.filter(apple => apple.right).length;
  }

  function nextQuestion() {
    question = makeQuestion();
    placeApples();
    feedbackEl.textContent = '';
    flash(questionEl, 'ok');
    render();
  }

  // up to two quick presses are remembered, one used per step; the current and the opposite direction are ignored
  function steer(direction) {
    if (stopped || over || queued.length >= 2) return;
    const heading = queued.at(-1) ?? dir;
    if (direction === heading || direction === (heading + 2) % 4) return;
    queued.push(direction);
  }

  function step() {
    if (queued.length) dir = queued.shift();
    const [dx, dy] = SNAKE_DIRECTIONS[dir];
    const next = wrap(snake[0].x + dx, snake[0].y + dy);
    const body = grow ? snake : snake.slice(0, -1); // the tail moves away this step unless the snake grows
    if (body.some(c => same(c, next))) return lose(null);
    snake.unshift(next);
    if (grow) grow--;
    else snake.pop();
    const apple = apples.find(a => same(a, next));
    if (!apple) return;
    if (!apple.right) return lose(apple);
    playCorrect();
    grow++;
    apples = apples.filter(a => a !== apple);
    rightLeft--;
    if (rightLeft > 0) return;
    score++;
    apples = [];
    if (score >= count) return finish();
    nextQuestion();
  }

  function lose(apple) {
    over = true;
    playWrong();
    flash(canvas, 'shake');
    const { a, b, answer } = question.fact;
    if (apple) {
      mistakes.push({ a, b, answer, given: label(apple.value) });
      feedbackEl.textContent = t('theAnswerIs', question.rights.map(label).join(', '));
    } else {
      feedbackEl.textContent = t('snakeCrashed');
    }
    draw();
    setTimeout(finish, 1800);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    const lostQuestion = over ? 1 : 0;
    ctx.finish({
      questions: score + lostQuestion,
      correct: score,
      wrong: mistakes.length,
      accuracy: score / Math.max(1, score + lostQuestion),
      elapsedMs: performance.now() - start,
      score,
      mistakes,
    });
  }

  // the board fills the width, but stays short enough that the turn buttons fit on the screen
  function layout() {
    const top = canvas.getBoundingClientRect().top + window.scrollY;
    const roomBelow = controls.getBoundingClientRect().bottom - canvas.getBoundingClientRect().bottom + 8;
    const byWidth = ctx.stage.clientWidth / SNAKE_COLS;
    const byHeight = (window.innerHeight - top - roomBelow) / SNAKE_ROWS;
    cell = Math.max(20, Math.floor(Math.min(byWidth, byHeight)));
    const ratio = window.devicePixelRatio || 1;
    canvas.style.width = `${cell * SNAKE_COLS}px`;
    canvas.style.height = `${cell * SNAKE_ROWS}px`;
    canvas.width = cell * SNAKE_COLS * ratio;
    canvas.height = cell * SNAKE_ROWS * ratio;
    canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    const g = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const color = name => css.getPropertyValue(name).trim();
    g.fillStyle = color('--sky');
    g.fillRect(0, 0, cell * SNAKE_COLS, cell * SNAKE_ROWS);
    g.fillStyle = color('--line');
    for (let x = 0; x < SNAKE_COLS; x++) {
      for (let y = 0; y < SNAKE_ROWS; y++) if ((x + y) % 2) g.fillRect(x * cell, y * cell, cell, cell);
    }

    for (const apple of apples) {
      const cx = (apple.x + 0.5) * cell;
      const cy = (apple.y + 0.5) * cell;
      g.beginPath();
      g.arc(cx, cy, cell * 0.47, 0, Math.PI * 2);
      g.fillStyle = '#d9473f';
      g.fill();
      if (over && apple.right) {
        g.lineWidth = 3;
        g.strokeStyle = color('--ok');
        g.stroke();
      }
      const text = label(apple.value);
      let size = Math.floor(cell * 0.45);
      g.font = `600 ${size}px system-ui, sans-serif`;
      while (size > 8 && g.measureText(text).width > cell * 0.9) g.font = `600 ${--size}px system-ui, sans-serif`;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, cx, cy + 1);
    }

    snake.forEach((part, i) => {
      const inset = i === 0 ? 1 : 3;
      g.fillStyle = i === 0 ? '#1f7a43' : color('--ok');
      g.beginPath();
      g.roundRect(part.x * cell + inset, part.y * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.3);
      g.fill();
    });
    // eyes on the head, looking where it goes
    const head = snake[0];
    const [dx, dy] = SNAKE_DIRECTIONS[dir];
    g.fillStyle = '#fff';
    for (const side of [-1, 1]) {
      const ex = (head.x + 0.5 + dx * 0.2 + dy * side * 0.2) * cell;
      const ey = (head.y + 0.5 + dy * 0.2 - dx * side * 0.2) * cell;
      g.beginPath();
      g.arc(ex, ey, cell * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  }

  function render() {
    prompt.textContent = rightLeft > 1 ? t('snakeEatAll', rightLeft) : t('prompt_snake');
    setText(questionEl, question.text);
    ['dirUp', 'dirRight', 'dirDown', 'dirLeft'].forEach((key, i) => arrows[i].setAttribute('aria-label', t(key)));
    ctx.hud.progress(score / count, t('questionOf', Math.min(score + 1, count), count));
  }

  function loop(now) {
    if (stopped) return;
    const dt = Math.min(now - last, 100); // a hidden tab pauses the game instead of jumping ahead
    last = now;
    if (!over) {
      sinceStep += dt;
      while (sinceStep >= stepMs && !over && !stopped) {
        sinceStep -= stepMs;
        step();
      }
      if (!stopped) draw();
    }
    ctx.hud.clock(formatTime(now - start));
    ctx.hud.stats({ score, wrong: mistakes.length, elapsedMs: now - start, progress: score / count });
    requestAnimationFrame(loop);
  }

  nextQuestion();
  layout();
  window.addEventListener('resize', layout);
  requestAnimationFrame(loop);

  return {
    key(e) {
      const direction = SNAKE_KEYS[e.key];
      if (direction === undefined) return false;
      steer(direction);
      return true;
    },
    rerender() {
      render();
      draw();
    },
    stop() {
      stopped = true;
      window.removeEventListener('resize', layout);
    },
    // the live game state, for scripted tests and debugging
    inspect: () => ({ snake, dir, queued, apples, question, rightLeft, score, over, cols: SNAKE_COLS, rows: SNAKE_ROWS }),
  };
}

function runGame(ctx, config) {
  if (config.game === 'match') return runMatch(ctx, config);
  if (config.game === 'balloons') return runBalloons(ctx, config);
  if (config.game === 'snake') return runSnake(ctx, config);
  return runQuiz(ctx, config);
}
