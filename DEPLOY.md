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
- `sw.js` is a service worker that caches all game files on the first visit. After that the game starts from the cache, also without network. When online, it fetches fresh files in the background, so a new version shows up the next time the game is opened.
- Progress (medals, high scores, settings) is stored in the browser on the phone.

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
