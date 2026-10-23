# Times table learning game – specification

This file is the complete specification of the game. It is written so that it can be given as a prompt to generate a very similar game from scratch, and it is kept up to date with every change to the code.

## Platform

- A single web page made of plain HTML, CSS and JavaScript (classic `<script>` tags, no modules, no build step, no dependencies), so it works when `index.html` is opened directly from disk.
- Works with mouse, touch and keyboard, on phone and desktop (content column max 460 px). Light and dark color scheme follow the system.
- All state (settings, level medals, free play high scores) is kept in `localStorage`; the game must also work when storage is unavailable.
- Animations run on `requestAnimationFrame`; time only advances while frames run, so a hidden tab pauses the balloon game instead of jumping ahead.

## Look and feel

- Very simple, calm UI with no flashy elements that take attention away from the questions.
- Right answer: a brief green flash behind the question and a short rising two-tone sound. Wrong answer: a brief red flash, a small shake and a low tone. Earning a medal (or a free play high score) plays a short four-note fanfare. All sounds are generated with the Web Audio API (no audio files).
- Medals are shown as small filled circles in bronze, silver and gold; an empty grey ring means no medal.

## Languages

- English and Norwegian (bokmål), switched on the Settings screen. The first visit picks Norwegian when the browser language is `nb`, `nn` or `no`, otherwise English. The choice is remembered.
- The multiplication sign is `×` in English and `·` (a raised dot) in Norwegian, everywhere an expression is shown. Because of that, `·` must not be used as a separator in any game text (use `–`).
- Decimal separator for times: `.` in English, `,` in Norwegian (`12.3 s` / `12,3 s`).

## Menu

Two tabs, remembered between visits: **Levels** (default) and **Free play**. A ⚙ button in the header (hidden while playing) opens Settings.

## Settings

A screen with a Back button and:

- **Language:** English / Norsk buttons.
- **Include the 11 and 12 tables** (checkbox, off by default), with a short explanation: when on, the 11 and 12 tables and the factors 11 and 12 are part of the levels and free play, and the levels with and without them keep separate medals. When off, 11 and 12 never appear anywhere in the game.

## Levels

A course in the style of typingclub.com: levels are played in order, each one is strategically planned to make the player fluent in one part of the times tables, and each can be replayed to improve its medal.

### Level map

- A summary line with the number of gold, silver and bronze medals and the total number of levels.
- Levels are grouped in units, each with a heading (for example "The 4 table: double the 2s"). Each level is a tile with its number, the gameplay name and its best medal.
- Level 1 is always open. A level unlocks when the level before it has at least a bronze medal. Locked tiles are dimmed and disabled. The first open level without a medal is outlined as the current one.

### Level intro

Tapping a tile opens an intro screen: unit name, "Level N: <gameplay>", a short how-to for the gameplay, what is practised ("The 2 table", "Square numbers, 1 × 1 to 10 × 10", "6, 7, 8 and 9 times 6, 7, 8 and 9"), the number of questions / rounds / duration and any time limit per question, the goal for each medal, the player's best medal, and a Start button.

### Medals

Every level has three goals, one per medal; the best medal whose goal is fully met is awarded. Finishing without meeting the bronze goal gives no medal. A goal combines some of:

- `minAccuracy`: share of questions answered right on the first try (1 = "all right on the first try"),
- `maxAvg`: average seconds per answer (measured from when the question is shown to the first answer; a timeout counts as the full time limit),
- `maxSeconds`: total time for the level,
- `maxMistakes`: wrong attempts allowed (0 = "no mistakes"),
- `minScore`: points (balloon game).

Only the best medal per level is stored.

### Level result

Shows the unit and level title, the medal earned (large circle plus "Gold!" / "Silver!" / "Bronze!" or "No medal this time"), "New personal best!" when the medal improved, "The next level is unlocked." when it just became available, the stats (quiz: right on the first try, average seconds per answer, total time; match and in-a-row: total time and mistakes; balloons: score and mistakes), the three goals with a ✓ on each one reached, the list of mistakes ("7 × 8 = 56 (you answered 54)") and buttons Next level (when unlocked), Try again and Menu.

### Questions

- A level practises a set of facts: given tables times the factors 1–10 (1–12 with 11 and 12), the square numbers 1×1 to 10×10 (to 12×12 with 11 and 12), or the "tricky" facts 6–9 × 6–9.
- Facts are drawn like from a shuffled deck: every fact once before any repeats, never the same answer twice in a row, and the two factors are shown in random order.
- Plausible wrong answers come from neighbouring facts (a×(b±1), (a±1)×b), off-by-one, ±10, swapped digits and a+b.

### Gameplays

All gameplays show the progress bar and a label at the top and a running clock (levels with a points target show "4 of 15 points"). Quit (or Esc) returns to the menu.

1. **Type the answer:** the question is shown large and the answer is typed on an on-screen numpad (7 8 9 / 4 5 6 / 1 2 3 / ⌫ 0 ⏎) or the keyboard (digits, Backspace, Enter), max 3 digits, submitted with Enter.
2. **Missing number:** `4 × _ = 24` – one factor is hidden; the player types it on the numpad into the blank.
3. **Multiple choice:** four answer buttons in a 2×2 grid (keys 1–4 also work).
4. **Find the question:** a number is shown, and the player picks which of four expressions gives it (keys 1–4). The wrong expressions are neighbours with a different product.
5. **True or false:** a statement like `7 × 8 = 54` is shown (half of them true); buttons True / False (also ← / → or 1 / 2).
6. **Match the pairs:** rounds of 5 expressions in a left column and their answers shuffled in a right column (answers are unique within a round). The player connects a pair by dragging a line from one to the other, or by tapping one and then the other. A right pair stays connected with a green line; a wrong pair flashes red and counts as a mistake. The next round starts when all pairs are connected.
7. **Balloon pop** (multiple choice with balloons): for each question a wave of balloons (4, or 3 in the first balloon level) is let go almost at the same time (within 0.4 s), one per lane in random order, from below a sky field; the question is shown at the top. One balloon has the answer, the others plausible wrong answers. Popping the right balloon gives +1 point, pops all the other balloons of the wave in a cheerful way (they swell, brighten and fade), and the next wave follows shortly after. Wrong balloons that float out at the top cost nothing. Popping a wrong balloon bursts it, counts as a mistake and makes the balloons 15 % faster (up to 3× speed), and the player must still pop the right one. Each right pop also speeds things up by 2 %. If the right balloon floats out at the top, the game is over: it shows "The answer is 8 × 9 = 72." and ends 1.5 s later. In a level, reaching the gold score completes the level; the score decides the medal, and the result lists the mistakes. In free play it goes on until a right balloon gets away.
8. **In a row:** the Type-the-answer gameplay where N answers must be right in a row; a mistake resets the count to 0. The total time decides the medal.

In all question gameplays: after a wrong answer (or when the time limit runs out, "Time is up!") the correct answer is shown ("The answer is 56. Type it to continue." / "Pick it to continue.") and the player must give the correct answer before continuing. In the choice gameplays the right option is outlined in green and the wrong pick in red. When a level has a time limit per question, a thin bar under the question shrinks while time runs.

### Difficulty curve

From really basic with plenty of time to think, to so hard that a quick adult will struggle to get gold. Quiz levels use one of these tiers (questions, time limit per question, and the [bronze, silver, gold] goals):

| Tier | Questions | Limit | Bronze | Silver | Gold |
|---|---|---|---|---|---|
| intro | 10 | none | 60 % right | 80 % right, ≤ 8 s per answer | all right, ≤ 4 s |
| practice | 12 | none | 70 % | 90 %, ≤ 5 s | all right, ≤ 2.5 s |
| review | 15 | 10 s | 80 %, ≤ 6 s | 90 %, ≤ 3.5 s | all right, ≤ 2 s |
| master | 20 | 5 s | 85 %, ≤ 4 s | 95 %, ≤ 2.5 s | all right, ≤ 1.5 s |
| final | 30 | 3 s | 90 %, ≤ 3 s | all right, ≤ 2 s | all right, ≤ 1.1 s |

Match levels use seconds per pair [bronze, silver, gold] and mistakes allowed: intro [20, 12, 7] s with [any, 3, 0] mistakes; practice [15, 9, 5] s with [any, 2, 0]; master [10, 6, 3.5] s with [3, 1, 0]. The time goal is seconds per pair × number of pairs.

### Level list

The order follows a common teaching order (2, 10, 5, 1, square numbers, 4, 3, 9, then 6, 8, 7 and the hardest facts last). Each table is introduced with an easy gameplay and lots of time before it has to be typed. "T" = tables; balloon levels list the seconds a balloon takes to rise through the field at the start and the points for [bronze, silver, gold] (gold also completes the level).

There are two courses, depending on the 11-and-12 setting (see Settings), and levels are numbered consecutively within the course:

- **Without 11 and 12** (52 levels): every table goes up to 10 times, and the units marked "with 11 and 12 only" are left out. The 11 and 12 tables never appear anywhere, also not as wrong options.
- **With 11 and 12** (59 levels): every table goes up to 12 times, the square numbers go up to 12 × 12, and the 11 and 12 tables are introduced along the way: 11 right after the 9s (its pattern is easy), 12 right after the 6s (double the 6s). The review and mastery units include them. The two courses keep separate medals.

1. **The 2 table:** choice T2 intro; true/false T2 intro (12 questions); type T2 intro; match T2 intro (2 rounds)
2. **The 10 and 5 tables:** choice T10 intro; type T10 intro; choice T5 intro; type T5 intro; balloons T2, 5, 10 (3 balloons per wave, rise 9 s, [5, 10, 15])
3. **The 1 table and a review:** true/false T1, 10 intro (12 questions); find the question T2, 5, 10 practice; type T1, 2, 5, 10 review
4. **Square numbers:** choice intro; match intro; type practice
5. **The 4 table: double the 2s:** choice T4 intro; type T4 intro; missing T2, 4 practice; balloons T2, 4, 5, 10 (rise 8 s, [6, 12, 18])
6. **The 3 table:** choice T3 intro; true/false T3 intro (12); type T3 intro; match T3, 4 practice
7. **The 9 table: 10 times minus once:** choice T9 intro; find the question T9 practice; type T9 intro; missing T3, 9 practice
8. **The 11 table: the digit doubles** (with 11 and 12 only): choice T11 intro; true/false T11 intro (12); type T11 intro; match T10, 11 practice
9. **Review: 1–5, 9 and 10** (plus 11 when included): type review (20 questions, 6 s limit); balloons (rise 7 s, [8, 15, 22]); in a row 10 (6 s limit; [60, 35, 20] s total)
10. **The 6 table: double the 3s:** choice T6 intro; type T6 intro; match T3, 6 practice
11. **The 12 table: double the 6s** (with 11 and 12 only): choice T12 intro; type T12 intro; missing T6, 12 practice
12. **The 8 table: double the 4s:** choice T8 intro; true/false T4, 8 practice; type T8 intro
13. **The 7 table:** choice T7 intro; type T7 intro; find the question T6, 7, 8 practice; missing T6, 7, 8 practice
14. **The tricky ones: 6–9 times 6–9:** match practice; choice review (5 s limit); type review (5 s limit); balloons (rise 6 s, [8, 16, 24])
15. **Mastery: 1–10** (1–12 with 11 and 12): true/false master (3 s limit); choice master (4 s limit); missing master (6 s limit); match master (4 rounds); balloons (rise 5 s, [10, 18, 26]); type master; in a row 20 (4 s limit; [80, 50, 30] s total); type final (with 11 and 12, gold needs ≤ 1.2 s per answer instead of 1.1 s)

## Free play

### Tables

- Default: all multiplication tables from 1 to 10.
- With the 11-and-12 setting on, the 11 and 12 tables are added (selected when the setting is turned on).
- The player can customise the game by toggling specific tables (chips 1–10, plus 11 and 12 when the setting is on). At least one table must be selected; otherwise a warning is shown and the game modes are disabled.
- Questions are drawn as described under Questions, with factors 1–10, or 1–12 when the 11-and-12 setting is on.

### Game modes

All gameplays from the levels are available as one flat list of modes, each with its own high score list. Time race, Time race deluxe and Exercise use the Type-the-answer gameplay.

1. **Time race:** answer 10 questions correctly in a row, as fast as possible.
2. **Time race deluxe:** answer 20 questions correctly in a row, as fast as possible.
   - Both time races: each question has a maximum of **8 seconds** to answer, shown as a thin bar that shrinks under the answer. When it runs out it counts as a wrong answer.
   - Both time races: a progress bar shows how much is left to finish the set ("4 of 10 in a row"). Each wrong answer resets the progress back to 0 of 10 (or 20).
   - The score is the total time from start to finish.
3. **Exercise:** 20 questions with no time limit. Wrong answers are allowed and logged; the result screen lists them. The high score is ranked first by number of correct answers, then by speed.
4. **Multiple choice**, 5. **True or false**, 6. **Find the question**, 7. **Missing number:** like Exercise (20 questions, no time limit, mistakes logged and listed, ranked by correct answers, then speed), but with that gameplay.
8. **Match the pairs:** 3 rounds of 5 pairs. Ranked by fewest mistakes, then speed.
9. **Balloon pop:** waves of 4 balloons that rise through the field in 7 s at the start; goes on until a right balloon gets away. Ranked by most points, then fewest mistakes (wrong pops plus the escaped balloon).

### Result screen and high scores

- Shows the mode and its score (time for the time races; correct count and time for the 20-question modes; time and mistakes for Match the pairs; points and mistakes for Balloon pop), "New high score!" when it is the best entry, or "Place N on the high score list" for places 2–5.
- Buttons: Play again, Menu.
- The high score list of the mode (top 5 shown, top 10 stored), each entry with its score and the tables it was played with ("tables 1–10", "tables 2, 5, 7"). The new entry is highlighted.
- The free play tab shows each mode's best score on the mode button.
