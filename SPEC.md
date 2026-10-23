# Times table learning game – specification

This file is the complete specification of the game. It is written so that it can be given as a prompt to generate a very similar game from scratch, and it is kept up to date with every change to the code.

## Platform

- A single web page made of plain HTML, CSS and JavaScript (classic `<script>` tags, no modules, no build step, no dependencies), so it works when `index.html` is opened directly from disk.
- Works with mouse, touch and keyboard, on phone and desktop. Light and dark color scheme follow the system.
- All state (settings, high scores) is kept in `localStorage`; the game must also work when storage is unavailable.

## Languages

- English and Norwegian (bokmål), switched with EN/NO buttons in the header. The first visit picks Norwegian when the browser language is `nb`, `nn` or `no`, otherwise English. The choice is remembered.
- The multiplication sign is `×` in English and `·` (a raised dot) in Norwegian, everywhere an expression is shown. Because of that, `·` must not be used as a separator in any text.
- Decimal separator for times: `.` in English, `,` in Norwegian (`12.3 s` / `12,3 s`).

## Tables

- Default: all multiplication tables from 1 to 10.
- An "Include 11 and 12" checkbox adds the 11 and 12 tables (selected when the box is ticked, removed when it is cleared).
- The player can customise the game by toggling specific tables (chips 1–10, plus 11 and 12 when included). At least one table must be selected; otherwise a warning is shown and the game modes are disabled.
- A question is `table × factor` in random order (`a × b` or `b × a`), where the factor is 1–10, or 1–12 when 11 and 12 are included. The same question is never asked twice in a row.

## Play screen

- Very simple UI with no flashy elements that take attention away from the questions.
- Top row: Quit (also Esc) and a running clock for the whole game. Below it a progress bar with a text label.
- The question is shown large; below it the typed answer.
- The answer is typed on an on-screen numpad (7 8 9 / 4 5 6 / 1 2 3 / ⌫ 0 ⏎) or the physical keyboard (digits, Backspace, Enter), max 3 digits, and submitted with Enter.
- Right answer: a brief green flash on the question and a short rising two-tone sound.
- Wrong answer: a brief red flash, a small shake of the answer and a low tone. The correct answer is shown ("The answer is 56. Type it to continue.") and the player must type the correct answer before continuing; a wrong correction just shakes and clears the input.
- Sounds are generated with the Web Audio API (no audio files).

## Game modes

Each mode has its own high score list.

1. **Time race:** answer 10 questions correctly in a row, as fast as possible.
2. **Time race deluxe:** answer 20 questions correctly in a row, as fast as possible.
   - Both time races: each question has a maximum of **8 seconds** to answer, shown as a thin bar that shrinks under the answer. When it runs out it counts as a wrong answer ("Time is up!" plus the correct answer, which must be typed).
   - Both time races: a progress bar shows how much is left to finish the set ("4 of 10 in a row"). Each wrong answer resets the progress back to 0 of 10 (or 20).
   - The score is the total time from start to finish.
3. **Exercise:** 20 questions with no time limit. Wrong answers are allowed and logged; the result screen lists them ("7 × 8 = 56 (you answered 54)"). The high score is ranked first by number of correct answers, then by speed.

## Result screen and high scores

- Shows the mode, the time (and correct count for Exercise), "New high score!" when it is the best entry, or "Place N on the high score list" for places 2–5.
- Buttons: Play again, Menu.
- The high score list of the mode (top 5 shown, top 10 stored), each entry with its score and the tables it was played with ("tables 1–10", "tables 2, 5, 7"). The new entry is highlighted.
- The menu shows each mode's best score on the mode button.
