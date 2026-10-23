# Times table learning game

- `SPEC.md` is the complete specification of the game. It must always describe the game as it is: update it in the same commit as every change to behaviour, rules, UI, texts or level design, including the user's requests and the decisions made along the way.
- Write it so it can be used on its own as a prompt to generate a very similar game: concrete rules and numbers, not a changelog and not a description of the code.
- Plain HTML/CSS/JS with classic scripts and no build step; `index.html` must keep working when opened straight from disk.
- Files: `i18n.js` (all texts, EN and NO), `core.js` (storage, formatting, sound, question deck), `levels.js` (units, levels, medal goals), `games.js` (the gameplay runners), `app.js` (screens, level map, free play).
- Testing in Chrome: when the window is in the background, Chrome throttles `requestAnimationFrame` to a few frames per second, so timed games barely move. For scripted tests, replace it on the page with `cb => setTimeout(() => cb(performance.now()), 16)`.
