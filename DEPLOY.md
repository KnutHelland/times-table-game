# Running the game on an Android phone

## Options

| Option | Works? | Home screen icon | Offline | Notes |
|---|---|---|---|---|
| OneDrive share link | No | No | No | OneDrive does not render HTML pages from a link; it offers a download or shows the code. The separate `.js`/`.css` files would not load either. |
| Copy the folder to the phone and open `index.html` | Barely | No | Yes | Android Chrome opens local files through `content://` links, where scripts in other files and saved progress are unreliable, and "Add to home screen" is not offered for local files. |
| **GitHub Pages** | **Yes** | **Yes, as an installed app** | **Yes** | Free static hosting at `https://<user>.github.io/<repo>/`. No own domain or packaging needed. The repository must be public on a free GitHub plan. |
| Other static hosts (Netlify Drop, Cloudflare Pages) | Yes | Yes | Yes | Same result as GitHub Pages, but another account to manage. |

GitHub Pages is the right fit: it serves the files over HTTPS, which is what Android needs to install the game as an app (PWA) with its own icon, full-screen window and offline play.

## Offline and install support

- `manifest.webmanifest` gives the app its name, icon (`icons/`), colors and full-screen ("standalone") display.
- `sw.js` is a service worker that caches all game files on the first visit. After that the game starts from the cache, also without network.
- Progress (medals, high scores, settings, per player) is stored in the browser on the phone. It survives updates, but uninstalling the app or clearing Chrome's site data deletes it.

## Updating the installed app

Nothing needs to be reinstalled. Commit and `git push`; GitHub Pages publishes the new version within a minute or two. The installed app checks for a new version every time it is started or brought back to the foreground (while online). When it finds one, a **"New version – tap to update"** bar appears at the top of the menu; tap it to switch to the new version. The bar never shows in the middle of a game. To check right away, switch to another app and back.

When adding, renaming or removing a file, update `FILES` in `sw.js` and bump its `CACHE` version (see CLAUDE.md); a changed `sw.js` also shows the update bar.

## Publish with GitHub Pages

1. On github.com, create a new **public** repository, for example `times-table-game`, without a README.
2. Push this folder to it:
   ```
   git remote add origin https://github.com/<user>/times-table-game.git
   git push -u origin master
   ```
3. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `master`, folder `/ (root)`, Save.
4. After a minute or two the game is live at `https://<user>.github.io/times-table-game/`.
5. Later changes: commit and `git push`; Pages updates by itself.

## Install on the phone

1. Open the Pages address in Chrome on the phone.
2. Tap **⋮ → Add to home screen → Install** (Chrome may also offer "Install app" by itself).
3. Open it once while online; after that it also works offline.
