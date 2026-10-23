# Times table learning game

- `SPEC.md` is the complete specification of the game. It must always describe the game as it is: update it in the same commit as every change to behaviour, rules, UI, texts or level design, including the user's requests and the decisions made along the way.
- Write it so it can be used on its own as a prompt to generate a very similar game: concrete rules and numbers, not a changelog and not a description of the code.
- Plain HTML/CSS/JS with classic scripts and no build step; `index.html` must keep working when opened straight from disk.
- Files: `i18n.js` (all texts, EN and NO), `core.js` (storage and players, formatting, sound, question deck), `levels.js` (units, levels, medal goals), `games.js` (the gameplay runners), `profiles.js` (the player screens), `app.js` (screens, level map, free play). `avatars/` holds the Twemoji player pictures (license in `avatars/LICENSE.md`); the list is in `AVATARS` in both `core.js` and `sw.js`.
- Offline/PWA: `sw.js` lists every file the game needs in `FILES`. When adding, renaming or removing a file, update that list and bump the `CACHE` version. `DEPLOY.md` describes publishing (GitHub Pages) and installing on Android.
- When testing over http on localhost, the service worker caches the files and serves the cached copy first. Unregister it and clear its caches after a test (`navigator.serviceWorker.getRegistrations()` / `caches.keys()`), or later test runs will see stale files.
- Testing in Chrome: when the window is in the background, Chrome throttles `requestAnimationFrame` to a few frames per second, so timed games barely move. For scripted tests, replace it on the page with `cb => setTimeout(() => cb(performance.now()), 16)`.
