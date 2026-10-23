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

function runGame(ctx, config) {
  if (config.game === 'match') return runMatch(ctx, config);
  if (config.game === 'balloons') return runBalloons(ctx, config);
  return runQuiz(ctx, config);
}
