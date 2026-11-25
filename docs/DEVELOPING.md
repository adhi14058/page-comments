# Developing page-comments

How the repository is laid out, and how to build, release and test it.
For using the tool, see the [Guide](GUIDE.md).

**On this page**

- [📁 Folders](#-folders)
- [🔨 Build and release](#-build-and-release)
- [🧩 The extension](#the-extension)
- [🔍 For store reviewers](#for-store-reviewers)
- [🔌 Server](#-server)
- [🧪 Test](#-test)

## 📁 Folders

[FEATURES.md](FEATURES.md) lists every feature, with where it lives in the code and which doc explains it. A change that adds, changes or removes a feature updates it in the same commit.

| Folder | Holds |
|---|---|
| `core/` | `core.js`, the tool itself, shared by the bookmark and the extension; `icons/` |
| `bookmarklet/` | `bookmark.js`, the bookmark's platform part |
| | `build.js`: the release. Builds the website and the extension |
| | `highlight.js`: colours the server code on the install page |
| | `version.svg`: the GitHub copy's update check, written by every release |
| | `site.js`: writes the website into `site/`; `site.test.js` checks its changelog reading, sitemap and head links |
| | `site-images.py`: draws the website's favicons, home-screen icons and link-preview card (`site-src/img/og.png`) into `site-src/`. The PNGs are committed; run it again (`python3 bookmarklet/site-images.py`, needs Pillow) after changing the icon or the card |
| `extension/` | The extension's own files, and `build.js` (Chrome and Firefox builds into `extension/dist/`) |
| `server/` | `server.js`, the local server behind Send to Claude |
| `site-src/` | The website's source: the install page and changelog page (with `{{name}}` slots the build fills), the playground, styles, scripts and `img/` |
| `site/` | The website as served, built from `site-src/`. Never edit it: every build replaces it |
| `deploy/` | How the server puts `site/` live. See [deploy/README.md](../deploy/README.md) |
| `docs/` | The guides, and `images/` (the README's pictures) |

| Root file | Holds |
|---|---|
| `README.md`, `LICENSE` | The front page and the licence |
| `CHANGELOG.md` | One release note per published version |
| `release.json` | The bookmark's and the extension's versions, with hashes of their code. The README's version badge reads it. |
| `bookmarklet.txt` | The GitHub copy of the bookmark, written and pushed by every release |

## 🔨 Build and release

Run the build after any change to `core/core.js`, `bookmarklet/bookmark.js`, `bookmarklet/highlight.js`, `server/server.js`, `bookmarklet/build.js`, `bookmarklet/site.js` or `site-src/`:

```sh
node bookmarklet/build.js
```

Releases are `major.minor.patch`.

| Command | Version |
|---|---|
| `node bookmarklet/build.js` | The next patch when the bookmark's code changed; the same version when it did not |
| `node bookmarklet/build.js minor` | The next minor |
| `node bookmarklet/build.js major` | The next major |
| `node bookmarklet/build.js --site` | No release: writes `site/` only, to look at it. It refuses when the bookmark's code changed since the last release, because `site/` serves `client.js` to every bookmark |

`release.json` keeps the last published versions and hashes of their code. `bookmarklet/version.js` decides how they move, and `bookmarklet/version.test.js` checks it.

| What changed | Bookmark | Extension |
|---|---|---|
| The bookmark's code (`core.js` with `bookmark.js`) | Next patch: 1.9.6 | Same: 1.9.6 |
| Only the extension's own files or icons | Same: 1.9.5 | A fourth number: 1.9.5.1, then 1.9.5.2 |
| Nothing | Same | Same |

The stores refuse an upload whose version did not go up, and only numbers are allowed (no letters). The first three numbers always say which core a version carries.

**What one run does**

1. Bundles `core.js` with `bookmark.js` using esbuild (`npx` downloads it on first use).
2. Picks both versions, and stops when `CHANGELOG.md` has no `## <version> — <date>` entry for a new one (an extension-only release gets its own entry, e.g. `## 1.9.5.1`).
3. Fills the website's pages from `site-src/` with the versions, the bookmarks, the server command and the releases from `CHANGELOG.md`, and adds `client.js` and `version.svg`. The server command is `server.js` without its comments, syntax-coloured by `highlight.js`, in a quoted heredoc that writes `~/page-comments-server.js`.
4. Builds the extension. It comes before any file is written, so a failed extension build leaves the repository as it was.
5. Writes `site/`, `bookmarklet.txt`, `bookmarklet/version.svg` and `release.json`, commits them, and pushes `main`.

The server then pulls `main` within about 90 seconds and puts `site/` live at [page-comments.heyadhi.com](https://page-comments.heyadhi.com/). See [deploy/README.md](../deploy/README.md). Bookmarks made before the move still load `client.js` and `version.svg` from the old address, which serves the same files.

<details>
<summary><b>How the bookmark finds a new version</b></summary>
<br>

Each release publishes `version.svg`, an empty picture whose size encodes the version:

- width = major × 1000 + minor + 1
- height = patch + 1

The bookmark loads that picture: any page may read a picture's size across sites, without CORS.
When the size does not match its own version, the bookmark turns the Help line in **⋯** green and puts a green dot on the round button.

| Copy | Loads `version.svg` from | Help line opens |
|---|---|---|
| Orange and fixed bookmarks | The website | The install page |
| GitHub copy (`bookmarklet.txt`) | The repository (`bookmarklet/version.svg`) | The repository |
| Extension | No check: the store updates it | — |

</details>

<a id="the-extension"></a>

## 🧩 The extension

`node bookmarklet/build.js` also builds the extension, into `extension/dist/chrome/` and `extension/dist/firefox/`.
`node extension/build.js` builds it alone.

| Browser | Load it |
|---|---|
| Chrome | `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → `extension/dist/chrome/` |
| Firefox 153+ | `about:debugging` → **This Firefox** → **Load Temporary Add-on** → `extension/dist/firefox/manifest.json` |

It runs the same `core.js` as the bookmark, with its own platform part.

| Part | File | Does |
|---|---|---|
| Platform part | `content.js` | Bundled with `core.js`. Lossless pictures through `captureVisibleTab` (stored as PNG); skips the click that closes the popup, since it also lands on the page |
| Background | `background.js` | Takes the pictures, saves files, runs the shortcut <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (starts or closes the tool), and registers `restore.js` per allowed site |
| Popup | `popup.html`, `popup.js` (bundled with the core's page key) | Opens on an icon click and starts the tool; offers **Close the tool**; asks once per site whether pins may come back after a reload; lists every commented page from the extension's index |
| Pins after a reload | `restore.js` (bundled with the core's page key) | Runs on sites you allowed from the popup, and brings the tool back when the page has comments |
| Saved pictures | `offscreen.html`, `offscreen.js` | Chrome only: makes the blob URLs for pictures saved as separate files |

- Comments live in the page's own storage, so the bookmark and the extension see the same comments. Their share links open in either.
- After a reload, sharp pictures need one click on the icon or the shortcut. That is the browser's rule.

<a id="for-store-reviewers"></a>

## 🔍 For store reviewers

How to rebuild `extension/dist/` from the source, for the Chrome Web Store and addons.mozilla.org reviews.
Three files of the extension are bundles: `content.js`, `restore.js` and `popup.js`. esbuild joins each with the code it imports from `core/core.js`, without minifying. Every other file is copied as it is.

**What you need**

- Node.js 18 or newer (built with Node 22.19.0). No `npm install`: the repository has no dependencies.
- esbuild 0.28.2, which the build fetches itself through `npx -y esbuild@0.28.2` (internet access needed on the first run).
- Linux or macOS (the build calls `npx` directly, which Windows runs only as `npx.cmd`).

**Steps**

1. Unpack the source zip (or clone the repository at the release's commit) and open a terminal in its root folder.
2. Run `node extension/build.js`.
3. It writes `extension/dist/chrome/` and `extension/dist/firefox/`, with the version from `release.json`. The Firefox upload is the contents of `extension/dist/firefox/`.

The files match the uploaded add-on byte for byte. To check: `diff -r extension/dist/firefox <the unpacked .xpi>`.

| File in the add-on | Source |
|---|---|
| `content.js` | `extension/content.js` + `core/core.js` |
| `restore.js`, `popup.js` | `extension/restore.js`, `extension/popup.js` + `pageKey` from `core/core.js` |
| `background.js`, `popup.html`, `popup.css` (and `offscreen.*` for Chrome) | Copied from `extension/` |
| `icons/` | Copied from `core/icons/` |
| `manifest.json` | Written by `extension/build.js` |

The extension loads no remote code. Its only network requests go to `http://localhost:4747`, the user's own local server: when they click **Send to Claude**, and a check whether it runs on pages served from their own machine. `content.js` also holds the bookmark's update check (it loads `version.svg` from page-comments.heyadhi.com or GitHub); the extension switches it off (`checkVersion: false` in `extension/content.js`), so it never runs.

## 🔌 Server

```sh
node server/server.js ~/projects/my-app        # or ~/page-comments-server.js, written by the install page's command
```

It listens on `127.0.0.1:4747` and needs Node 18+ and the `claude` CLI.
How it is used: [Guide → Send to Claude](GUIDE.md#send-to-claude).

## 🧪 Test

```sh
node --test
```

Run it from the repository root. It runs every test.
The server test starts the real server on port 4747, and skips itself when that port is in use.
