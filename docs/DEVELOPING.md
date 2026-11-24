# Developing page-comments

How the repository is laid out, and how to build, release and test it.
For using the tool, see the [Guide](GUIDE.md).

**On this page**

- [📁 Folders](#-folders)
- [🔨 Build and release](#-build-and-release)
- [🧩 The extension](#the-extension)
- [🔌 Server](#-server)
- [🧪 Test](#-test)

## 📁 Folders

| Folder | Holds |
|---|---|
| `core/` | `core.js`, the tool itself, shared by the bookmark and the extension; `icons/` |
| `bookmarklet/` | `bookmark.js`, the bookmark's platform part |
| | `build.js`: builds and publishes the install page, and builds the extension |
| | `highlight.js`: colours the server code on the install page |
| | `version.svg`: the GitHub copy's update check, written by every release |
| `extension/` | The extension's own files, and `build.js` (Chrome and Firefox builds into `extension/dist/`) |
| `server/` | `server.js`, the local server behind Send to Claude |
| `docs/` | The guides, and `images/` (the README's pictures) |

| Root file | Holds |
|---|---|
| `README.md`, `LICENSE` | The front page and the licence |
| `CHANGELOG.md` | One release note per published version |
| `release.json` | The bookmark's and the extension's versions, with hashes of their code. The README's version badge reads it. |
| `bookmarklet.txt` | The GitHub copy of the bookmark, written and pushed by every release |

## 🔨 Build and release

Run the build after any change to `core/core.js`, `bookmarklet/bookmark.js`, `bookmarklet/highlight.js`, `server/server.js` or `bookmarklet/build.js`:

```sh
node bookmarklet/build.js
```

Releases are `major.minor.patch`.

| Command | Version |
|---|---|
| `node bookmarklet/build.js` | The next patch when the bookmark's code changed; the same version when it did not |
| `node bookmarklet/build.js minor` | The next minor |
| `node bookmarklet/build.js major` | The next major |

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
3. Builds the install page. Its server command is `server.js` without its comments, syntax-coloured by `highlight.js`, in a quoted heredoc that writes `~/page-comments-server.js`.
4. Publishes the install page, `client.js` and `version.svg` to [page-comments.share.heyadhi.com](https://page-comments.share.heyadhi.com/) with the `heyadhi-share` CLI. No local copy is kept.
5. Writes `release.json` and builds the extension.
6. Writes `bookmarklet.txt` and `bookmarklet/version.svg`, then commits and pushes them with `release.json`.

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
| Orange and fixed bookmarks | The share site | The install page |
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
| Platform part | `content.js` | Lossless pictures through `captureVisibleTab` (stored as PNG); skips the click that closes the popup, since it also lands on the page |
| Background | `background.js` | Takes the pictures, saves files, runs the shortcut <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (starts or closes the tool), and registers `restore.js` per allowed site |
| Popup | `popup.html`, `popup.js` | Opens on an icon click and starts the tool; offers **Close the tool**; asks once per site whether pins may come back after a reload; lists every commented page from the extension's index |
| Pins after a reload | `restore.js` | Runs on sites you allowed from the popup, and brings the tool back when the page has comments |
| Saved pictures | `offscreen.html`, `offscreen.js` | Chrome only: makes the blob URLs for pictures saved as separate files |

- Comments live in the page's own storage, so the bookmark and the extension see the same comments. Their share links open in either.
- After a reload, sharp pictures need one click on the icon or the shortcut. That is the browser's rule.

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
