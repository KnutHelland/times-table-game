# Times table learning game – specification

This file is the complete specification of the game. It is written so that it can be given as a prompt to generate a very similar game from scratch, and it is kept up to date with every change to the code.

## Platform

- A single web page made of plain HTML, CSS and JavaScript (classic `<script>` tags, no modules, no build step, no dependencies), so it works when `index.html` is opened directly from disk.
- Works with mouse, touch and keyboard, on phone and desktop (content column max 460 px). Mobile requirements: no horizontal scrolling at 320 px width (also not during screen transitions), every button at least 44 px tall and wide, chip grids wrap to fewer columns on narrow screens, and on short screens (height ≤ 700 px) the play screen gets more compact so the whole play area – numpad included – fits on a 320 × 568 screen without scrolling. The balloon sky's height follows the viewport height (between 240 and 520 px). Light and dark color scheme follow the system. Pull-to-refresh (and the overscroll glow) is switched off on the page (`overscroll-behavior-y: none` on the root), so the installed app feels like an app; new versions arrive through the update bar instead.
- Installable as an app (PWA) with offline play when served over HTTPS (for example GitHub Pages): a web app manifest (name "Times tables", standalone display, 192 and 512 px icons showing a white "7×8" on the blue theme color, and both theme color and background color #2f6fdf: Chrome on Android picks white system navigation buttons for the dark theme color but, depending on the version, paints the navigation bar with the theme color or the background color, so both must be the same dark blue for the buttons to stay visible; the launch splash screen is blue as a consequence) and a service worker that caches all game files on the first visit and serves them from the cache. The service worker is only registered over http(s), so opening `index.html` from disk still works.
- Install button: where the browser offers to install the game (Chrome and Edge fire `beforeinstallprompt`; other browsers and the installed app never do), a full-width outlined button "⬇ Install the game on this device" is shown at the top of the start screens (menu, "Who is playing?", Welcome), not on other screens or during a game. Tapping it opens the browser's install dialog and hides the button (the dialog can only be used once; the button comes back if the browser offers again), and it is hidden as soon as the game is installed. The browser's own install mini-bar is suppressed in favour of the button.
- Updates: when the game starts and every time it comes back to the foreground (an installed app is often resumed rather than restarted), it asks the server for every game file again (bypassing the browser's HTTP cache, so GitHub Pages' 10-minute caching does not delay it) and stores them. If the content of any file changed (compared byte by byte with the cached copy; ETag and Last-Modified are not trusted for this, because GitHub Pages puts the deploy time in them, so every push and every server copy can change them without any change to the file), or a new service worker version took over, a full-width bar "New version – tap to update" ("Ny versjon – trykk for å oppdatere") appears above the screen content; tapping it reloads the page with the new version. The bar is never shown during a game, only on the other screens. Offline, the check is silently skipped.
- All state (the player list, and each player's settings, level medals and free play high scores) is kept in `localStorage`; the game must also work when storage is unavailable.
- Animations run on `requestAnimationFrame`; time only advances while frames run, so a hidden tab pauses the balloon game instead of jumping ahead.

## Look and feel

- Very simple, calm UI with no flashy elements that take attention away from the questions.
- Right answer: a brief green flash behind the question and a short rising two-tone sound. Wrong answer: a brief red flash, a small shake and a low tone. Earning a medal (or a free play high score) plays a short four-note fanfare. All sounds are generated with the Web Audio API (no audio files).
- Screen changes use a short CSS transition (0.25 s fade plus a 24 px slide): moving forward (into settings, a level intro, a game, a result) slides the new screen in from the right; going back to the menu slides it in from the left. No transition when the system asks for reduced motion.
- Medals are shown as small filled circles in bronze, silver and gold; an empty grey ring means no medal.

## Languages

- Eight languages, in this order on the Settings screen, each shown by its own name: English, Norsk bokmål, Norsk nynorsk, Svenska, Dansk, Deutsch, Français, Español. Every text in the game (including level unit titles) exists in all of them. The game title is "Times tables", "Gangetabellen" (bokmål, Danish), "Gongetabellen" (nynorsk), "Gångertabellen", "Einmaleins", "Tables de multiplication" and "Tablas de multiplicar".
- Languages are chosen by tapping a flag: a 4-column grid of buttons, each with the country's flag (Twemoji flags, bundled; United Kingdom for English, Norway for both bokmål and nynorsk, Sweden, Denmark, Germany, France, Spain) above the language's own name, the current one highlighted. The same grid is on the Welcome screen and the Settings screen.
- The language is a setting of each player. In addition the device remembers the most recently used language (changed in Settings or on the Welcome screen, or the language of the player who was chosen last), which is used on the screens shown before a player is chosen (Welcome, "Who is playing?" at start) and given to a new player. On the very first visit it is the first of the browser's preferred languages that the game has (`nb` and `no` mean bokmål, `nn` nynorsk), otherwise English.
- The multiplication sign is `·` (a raised dot, as taught in schools there) in the Norwegian, Swedish, Danish and German texts and `×` in English, French and Spanish, everywhere an expression is shown. Because of that, `·` must not be used as a separator in any game text (use `–`).
- Decimal separator for times: `.` in English, `,` in all other languages (`12.3 s` / `12,3 s`).
- Children are addressed informally (du / tu / tú).

## Players (profiles)

Several people (for example a parent and children) can play on the same device, each as their own local player. The UI says "player" ("spiller"), not "profile".

- A player has a name (1–20 characters, unique ignoring case and surrounding spaces) and a picture. Each player has their own settings (language, selected tables, 11-and-12 setting, menu tab), level medals and free play high scores. A new player starts with the current language and otherwise default settings.
- Pictures: 16 animal faces from Twemoji 15.1.0 (drawn by people, not AI generated, CC BY 4.0, bundled with the game so they work offline): fox, cat, dog, panda, lion, unicorn, frog, owl, tiger, koala, rabbit, bear, penguin, monkey, octopus, dragon. The Settings screen credits them ("Pictures: Twemoji by Twitter and contributors, CC BY 4.0.").
- When the game is started as an installed app (display mode other than "browser"), it always starts on the "Who is playing?" screen (without a Back button, the last player highlighted), since a family often shares the device. The only exception is the reload after tapping the update bar, which goes straight back to the menu as the current player. In a browser tab the game remembers the last chosen player and starts as that player. The header shows the player's picture next to the ⚙ button (both hidden while playing and on the player screens); tapping it opens the player list.
- **First start** (no players yet): a "Welcome!" screen with, in this order: the flag grid to choose the language (the screen switches language at once; a name already typed and the chosen picture are kept); a note marked with a green bar on the left: "No data is sent or stored anywhere else: the player you add exists only on this device, in this browser."; a short text that each person gets their own player with own medals, high scores and settings; then the name field and the pictures. The player gets the chosen language. Medals, high scores and settings saved before players existed are moved into this first player.
- **Who is playing?** screen: one row per player (picture and name; the current player is highlighted) with a ✏️ (rename) and a 🗑 (delete) button beside it, and a "+ New player" button. Tapping a player switches to them and goes to the menu. A Back button is shown when a player is active.
- **New player** screen: name field, a 4-column grid of the pictures (pictures used by other players are disabled, the first free one is preselected), and a "Start playing" button that is enabled when the name is filled in and not taken (a warning shows when it is taken). Enter in the name field also creates the player. The new player becomes the current player.
- **Rename player** screen (from ✏️): shows the player's picture and "Rename <name>", a name field filled in with the current name, and a "Save" button with the same rules as for a new player (filled in, not taken by another player; keeping the own name is allowed). Enter also saves. After saving, the player list is shown; medals, high scores and settings stay with the player.
- **Hidden "Super" player:** a player whose name is "Super" (ignoring case and surrounding spaces) has every level of both courses unlocked, but starts without any medals, like any new player; nothing in the game mentions this. It is decided by the current name, so renaming the player makes it an ordinary player (levels then unlock by its medals as usual, medals it earned are kept), and renaming any player to "Super" unlocks everything for it.
- **Save codes** (backup, or moving a player to another device or browser): a save code is one player as a single string: `ttg1.` followed by base64url of UTF-8 JSON `{ format: "times-table-game/player", version: 2, exported: <ISO date>, player: { name, avatar }, settings, progress, scores }` (progress and scores as stored by the game). Version 2 stores medals by the permanent level ids; version 1 codes (position ids) are still read and converted. The format name and version make it future-proof: a newer game must still read every older version (migrating it), and a code with a higher version than the game knows is refused with "This save code is from a newer version of the game. Update the game and try again."
  - Export: the Settings screen has a "Save code" section for the current player: a short explanation, the code in a read-only monospace text box (tapping it selects all), and a "Copy" button that copies it to the clipboard and shows "Copied!".
  - Import: a "Load a save code" button below "+ New player" on "Who is playing?" and at the bottom of the Welcome screen opens a screen with a text box to paste into. Spaces and line breaks in the pasted text are ignored, and the decoded JSON is accepted too. While the text is not a valid code it says "This is not a valid save code."; for a valid code it shows the player's picture and "<name> – <n> medals". "Add as new player" adds it as a new player and switches to it: existing players are never changed; a taken name gets a number ("Anna 2", still at most 20 characters), and a picture used by another player is replaced by the first free one.
  - Everything in a code is checked before use: unknown fields are ignored, and only known languages, tables 1–12, booleans, medals 1–3 on well-formed level ids, and well-formed high scores of known game modes (at most 10 per mode) are taken over; the name is trimmed and cut to 20 characters.
- **Delete player** screen (from 🗑): shows the player's picture and "Delete <name>", warns that all medals, high scores and settings are deleted and that it cannot be undone, and has a field "Type <name> to confirm". The red "Delete for good" button is enabled only when the typed text equals the name (ignoring case and surrounding spaces). After deleting, the player list is shown (with no Back button if the current player was deleted); when no players remain, the Welcome screen is shown.

## Menu

Two tabs, remembered between visits: **Levels** (default) and **Free play**. The header has the player picture (see Players) and a ⚙ button, both hidden while playing; ⚙ opens Settings.

## Settings

A screen with a Back button and:

- **Language:** the flag grid (see Languages).
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
- `minScore`: balloons popped before losing (balloon hunt), or questions answered before losing (snake; bronze half, silver three quarters, gold all of the level's questions, rounded up). The goal reads "answer N questions before you lose".

Only the best medal per level is stored.

### Medal indicator while playing

During a level, three small medal circles (bronze, silver, gold) sit in the top row between Quit and the clock and update live:

- **Filled:** on track – the player gets this medal if they keep the current pace.
- **Hollow ring in the medal colour:** still within reach, but not at the current pace.
- **Faded grey ring:** out of reach – it can no longer be earned in this attempt.

Per goal field: accuracy is on track when the share right so far meets it, and out of reach when even all remaining questions right would not; average time per answer is on track when the average so far (including the time spent on the current question) meets it, and out of reach when it could not be met even if all remaining answers were instant; total time is on track when the time projected from the progress so far meets it, and out of reach once it has passed; mistakes are out of reach once too many have been made; balloons popped is on track once reached (otherwise within reach). A medal is out of reach if any of its fields is, and on track only if all are. Hovering a circle names the medal and its state. Free play has no indicator.

### Level result

Shows the unit and level title, the medal earned (large circle plus "Gold!" / "Silver!" / "Bronze!" or "No medal this time"), "New personal best!" when the medal improved, "The next level is unlocked." when it just became available, the stats (quiz: right on the first try, average seconds per answer, total time; match and in-a-row: total time and mistakes; balloons: score and mistakes), the three goals with a ✓ on each one reached, the list of mistakes ("7 × 8 = 56 (you answered 54)") and buttons Next level (when unlocked), Try again and Menu.

### Questions

- A level practises a set of facts: given tables times the factors 1–10 (1–12 with 11 and 12), the square numbers 1×1 to 10×10 (to 12×12 with 11 and 12), or the "tricky" facts 6–9 × 6–9.
- Facts are drawn like from a shuffled deck: every fact once before any repeats, never the same answer twice in a row, and the two factors are shown in random order.
- Plausible wrong answers come from neighbouring facts (a×(b±1), (a±1)×b), off-by-one, ±10, swapped digits and a+b.

### Gameplays

All gameplays show the progress bar and a label at the top and a running clock (balloon hunt levels show "4 of 15 balloons"). Quit (or Esc) returns to the menu.

1. **Type the answer:** the question is shown large and the answer is typed on an on-screen numpad (7 8 9 / 4 5 6 / 1 2 3 / ⌫ 0 ⏎) or the keyboard (digits, Backspace, Enter), max 3 digits, submitted with Enter.
2. **Missing number:** `4 × _ = 24` – one factor is hidden; the player types it on the numpad into the blank.
3. **Multiple choice:** four answer buttons in a 2×2 grid (keys 1–4 also work).
4. **Find the question:** a number is shown, and the player picks which of four expressions gives it (keys 1–4). The wrong expressions are neighbours with a different product.
5. **True or false:** a statement like `7 × 8 = 54` is shown (half of them true); buttons True / False (also ← / → or 1 / 2).
6. **Match the pairs:** rounds of 5 expressions in a left column and their answers shuffled in a right column (answers are unique within a round). The player connects a pair by dragging a line from one to the other, or by tapping one and then the other. A right pair stays connected with a green line; a wrong pair flashes red and counts as a mistake. The next round starts when all pairs are connected.
7. **Balloon hunt** ("Ballongjakten" in Norwegian; multiple choice with balloons): for each question a wave of balloons (4, or 3 in the first balloon level) is let go almost at the same time (within 0.4 s), one per lane in random order, from below a sky field; the question is shown at the top. One balloon has the answer, the others plausible wrong answers. Popping the right balloon counts one balloon, pops all the other balloons of the wave in a cheerful way (they swell, brighten and fade), and the next wave follows shortly after. Wrong balloons that float out at the top cost nothing. Popping a wrong balloon bursts it, counts as a mistake and makes the balloons 15 % faster (no upper limit), and the player must still pop the right one. Only mistakes speed the game up, so it ends naturally at some point – unless the player always picks the right answer, which means they are fluent. If the right balloon floats out at the top, the game is over: it shows "The answer is 8 × 9 = 72." and ends 1.5 s later. Free play goes on until a right balloon gets away. Levels work the same way, and each medal is a number of balloons to pop before losing ("pop 15 balloons before you lose"); reaching the gold count completes the level, since there is nothing more to earn. The level result shows "Balloons popped: N" and lists the mistakes.
8. **In a row:** the Type-the-answer gameplay where N answers must be right in a row; a mistake resets the count to 0. The total time decides the medal.
9. **Snake:** a 9 × 11 board (tiles as large as fit the width, but small enough that the controls stay on screen; checkerboard in the sky color and line color) with a green snake of 3 tiles that starts in the middle-bottom going up and moves one tile per step on its own (the level sets the step time; it starts 1.2 s after the game). It is steered with four arrow buttons laid out as a D-pad below the board (▲ over ▼ in the middle, about 48 px tall each; ◀ and ▶ on the sides, as tall as both together; they react on touch-down, not on release) or the arrow keys (also W A S D). A press sets the direction on screen; pressing the current direction or the opposite one (which would bite the neck) is ignored, and at most two quick presses are remembered, one used per step. The snake goes through all four walls and comes out on the opposite side. Each question is shown large above the board and is one of the level's kinds: **answer** `7 × 8` (apples show numbers), **factor** `7 × ? = 56` (apples show factors), **expression** `? = 56` (apples show expressions). For each question red round apples (3–5 per level) with white text are placed: the right one(s) and plausible wrong ones (as in Multiple choice / Find the question; wrong factors are the ones nearest to the right factor). One of the apples, chosen at random (so usually a wrong one), is placed straight ahead of the head, 4–7 tiles away, with nothing in between (unless the snake's own body is less than 5 tiles ahead); the others are at least 3 tiles (counting through the walls) from the head, not between the head and that apple, and not next to each other. On levels with "several right", an expression question shows every way to write the answer with the game's factors (up to 3, each with random order of the factors), the prompt says "Eat all N right apples!", and all of them must be eaten. Eating a right apple makes the snake one tile longer and plays the right-answer sound; when the last right apple of a question is eaten, the other apples disappear and the next question comes at once. Eating a wrong apple (listed as a mistake on the result screen) or biting its own body loses: the right apples get a green ring, the right answer (or "The snake bit itself!") is shown, and the result comes after 1.8 s. Answering all questions completes the level (gold).

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

**Find the question** levels get twice the tier's time: both the time limit per question and every "≤ s per answer" medal goal are doubled (practice: silver ≤ 10 s, gold ≤ 5 s; master: ≤ 8 / 5 / 3 s), because reading four expressions and working each out takes much longer than recalling one answer. The accuracy goals are unchanged. Mastery #11 thus has a 12 s limit.

Match levels use seconds per pair [bronze, silver, gold] and mistakes allowed: intro [20, 12, 7] s with [any, 3, 0] mistakes; practice [15, 9, 5] s with [any, 2, 0]; master [10, 6, 3.5] s with [3, 1, 0]. The time goal is seconds per pair × number of pairs.

### Level list

The order follows a common teaching order (2, 10, 5, 1, square numbers, 4, 3, 9, then 6, 8, 7 and the hardest facts last). Each table is introduced with an easy gameplay and lots of time before it has to be typed. "T" = tables; snake levels list the questions, the time per step, the apples per question and the question kinds (each faster and with more questions than the one before), and balloon levels list the seconds a balloon takes to rise through the field at the start and the balloons to pop for [bronze, silver, gold] (gold also completes the level).

There are two courses, depending on the 11-and-12 setting (see Settings), and levels are numbered consecutively within the course:

Medals are stored per level under a permanent id `<unit key>-<n>` (prefixed `12:` in the 11-and-12 course), where the unit keys are two, tenFive, one, squares, four, three, nine, eleven, review, six, twelve, eight, seven, tricky, master, and n is the number the level got when it was added (shown as "#n" below where it differs from the position). A number is never changed or reused, so levels can be added or reordered without moving medals. Earlier versions used `<game>-<position>` ids; those (stored, or in version 1 save codes) are converted once to the permanent ids, using the course as it was then (the same as now, but with only the tricky #1–4 and master #1–8 levels, in number order).

- **Without 11 and 12** (75 levels): every table goes up to 10 times, and the units marked "with 11 and 12 only" are left out. The 11 and 12 tables never appear anywhere, also not as wrong options.
- **With 11 and 12** (84 levels): every table goes up to 12 times, the square numbers go up to 12 × 12, and the 11 and 12 tables are introduced along the way: 11 right after the 9s (its pattern is easy), 12 right after the 6s (double the 6s). The review and mastery units include them. The two courses keep separate medals.

1. **The 2 table:** choice T2 intro; true/false T2 intro (12 questions); type T2 intro; match T2 intro (2 rounds)
2. **The 10 and 5 tables:** choice T10 intro; type T10 intro; choice T5 intro; type T5 intro; balloons T2, 5, 10 (3 balloons per wave, rise 9 s, [5, 10, 15])
3. **The 1 table and a review:** true/false T1, 10 intro (12 questions); find the question T2, 5, 10 practice; type T1, 2, 5, 10 review
4. **Square numbers:** choice intro; match intro; type practice; snake squares (6 questions, 700 ms per step, 3 apples, answer kind) (#4)
5. **The 4 table: double the 2s:** choice T4 intro; type T4 intro; missing T2, 4 practice; balloons T2, 4, 5, 10 (rise 8 s, [6, 12, 18]); snake T2, 4 (8, 650 ms, 3 apples, answer and factor) (#5)
6. **The 3 table:** choice T3 intro; true/false T3 intro (12); type T3 intro; match T3, 4 practice; snake T3, 4 (8, 610 ms, 3 apples, answer and factor) (#5)
7. **The 9 table: 10 times minus once:** choice T9 intro; find the question T9 practice; type T9 intro; missing T3, 9 practice; snake T3, 9 (10, 570 ms, 4 apples, all kinds) (#5)
8. **The 11 table: the digit doubles** (with 11 and 12 only): choice T11 intro; true/false T11 intro (12); type T11 intro; match T10, 11 practice; snake T10, 11 (10, 545 ms, 4 apples, all kinds) (#5)
9. **Review: 1–5, 9 and 10** (plus 11 when included): type review (20 questions, 6 s limit); balloons (rise 7 s, [8, 15, 22]); in a row 10 (6 s limit; [60, 35, 20] s total); snake (12, 520 ms, 4 apples, all kinds) (#4)
10. **The 6 table: double the 3s:** choice T6 intro; type T6 intro; match T3, 6 practice; snake T3, 6 (12, 490 ms, 4 apples, all kinds) (#4)
11. **The 12 table: double the 6s** (with 11 and 12 only): choice T12 intro; type T12 intro; missing T6, 12 practice; snake T6, 12 (12, 460 ms, 4 apples, all kinds) (#4)
12. **The 8 table: double the 4s:** choice T8 intro; true/false T4, 8 practice; type T8 intro; snake T4, 8 (12, 420 ms, 4 apples, all kinds, several right) (#4)
13. **The 7 table:** choice T7 intro; type T7 intro; find the question T6, 7, 8 practice; missing T6, 7, 8 practice; snake T6, 7, 8 (14, 380 ms, 4 apples, all kinds, several right) (#5)
14. **The tricky ones: 6–9 times 6–9** (8 levels plus a snake level: first each half of the 16 facts with plenty of time, then all of them, faster and faster): choice "6 and 7 times 6, 7, 8 and 9" intro (#5); true/false "8 and 9 times 6, 7, 8 and 9" intro, 12 questions (#6); match all practice (#1); type 6 and 7 × 6–9 practice (#7); type 8 and 9 × 6–9 practice (#8); choice all review, 5 s limit (#2); type all review, 5 s limit (#3); balloons all (rise 6 s, [8, 16, 24]) (#4); snake all (14, 370 ms, 5 apples, all kinds, several right) (#9)
15. **Mastery: 1–10** (1–12 with 11 and 12; 16 levels plus 2 snake levels, every one a little harder than the one before, all facts): true/false review, 5 s limit (#9); choice review, 6 s limit (#10); true/false master, 3 s limit (#1); find the question master, 12 s limit (doubled, see above) (#11); choice master, 4 s limit (#2); match practice, 3 rounds (#12); missing master, 6 s limit (#3); type review, 20 questions, 6 s limit (#13); balloons (rise 6 s, [8, 15, 22]) (#14); snake (16, 355 ms, 5 apples, all kinds, several right) (#17); in a row 10, 6 s limit, [60, 35, 20] s total (#15); match master, 4 rounds (#4); balloons (rise 5 s, [10, 18, 26]) (#5); type master (#6); missing master, 25 questions, 4 s limit (#16); snake (20, 340 ms, 5 apples, all kinds, several right) (#18); in a row 20, 4 s limit, [80, 50, 30] s total (#7); type final (#8; with 11 and 12, gold needs ≤ 1.2 s per answer instead of 1.1 s)

## Free play

### Tables

- Default: all multiplication tables from 1 to 10.
- With the 11-and-12 setting on, the 11 and 12 tables are added (selected when the setting is turned on).
- The player can customise the game by toggling specific tables (chips 1–10, plus 11 and 12 when the setting is on). At least one table must be selected; otherwise a warning is shown and the game modes are disabled.
- Questions are drawn as described under Questions, with factors 1–10, or 1–12 when the 11-and-12 setting is on.
- Free play weights the questions towards the difficult tables: a fact counts as easy as its easiest factor, and the deck holds each fact that many times – weight 1 for the 1 and 10 tables, 3 for 2, 5 and 11, 5 for 3, 4 and 9, and 8 for 6, 7, 8 and 12. With all tables 1–10, about 11 % of the questions involve a 1 or a 10, while each of 6, 7 and 8 appears in about 26 %. (Levels are not weighted; they already pick their facts.)

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
9. **Balloon hunt:** waves of 4 balloons that rise through the field in 7 s at the start; goes on until a right balloon gets away. Ranked by most balloons popped, then fewest mistakes (wrong pops plus the escaped balloon).
10. **Snake** (only shown once the player has come as far as the first snake level, i.e. it is unlocked): one card with a short text ("Goes on until you eat a wrong apple or bite yourself. Choose how hard:") and three buttons, **Easy** (650 ms per step, 3 apples, only `a × b = ?`), **Medium** (500 ms, 4 apples, all three question kinds) and **Difficult** (380 ms, 5 apples, all kinds, several right apples on expression questions). A button starts the game at once with the selected tables. It goes on until a wrong apple or a bite; ranked by right answers. Each difficulty has its own high score list, and each button shows its best ("Best: 7 right answers"); the result title is "Snake (Easy) – Finished!". The HUD shows "N right answers" instead of a question count.

### Result screen and high scores

- Shows the mode and its score (time for the time races; correct count and time for the 20-question modes; time and mistakes for Match the pairs; balloons popped and mistakes for Balloon hunt), "New high score!" when it is the best entry, or "Place N on the high score list" for places 2–5.
- Buttons: Play again, Menu.
- The high score list of the mode (top 5 shown, top 10 stored), each entry with its score and the tables it was played with ("tables 1–10", "tables 2, 5, 7"). The new entry is highlighted.
- The free play tab shows each mode's best score on the mode button.
