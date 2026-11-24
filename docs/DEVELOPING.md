# Developing page-comments

## Folders

| Folder | Holds |
|---|---|
| `core/` | `core.js`, the tool itself, shared by the bookmark and the extension; `icons/` |
| `bookmarklet/` | `bookmark.js` (the bookmark's platform part), `build.js` (builds and publishes the install page, and builds the extension), `highlight.js` (colours the server code on the install page), `version.svg` (the GitHub bookmark's update check, written by every release) |
| `extension/` | the extension's own files and `build.js` (Chrome and Firefox builds into `extension/dist/`) |
| `server/` | `server.js`, the local server behind Send to Claude |
| `docs/` | the guides and `images/` (the README's pictures) |

The root keeps only `README.md`, `LICENSE`, `CHANGELOG.md`, `release.json` (the one version number of the bookmark and the extension; the GitHub bookmark reads it) and `bookmarklet.txt` (the GitHub bookmark, written and pushed by every release).

## Build and release

**https://page-comments.share.heyadhi.com/** has the bookmark to drag onto the bookmarks bar, and a bash/zsh command that writes the server to `~/page-comments-server.js` (`server.js` without its comments, syntax-coloured, in a quoted heredoc).

After any change to `core/core.js`, `bookmarklet/bookmark.js`, `server/server.js` or `bookmarklet/build.js`, run:

```sh
node bookmarklet/build.js
```

Releases are `major.minor.patch`. `release.json` keeps the last published version and a hash of its code: `node bookmarklet/build.js` gives changed code the next patch version, `node bookmarklet/build.js minor` / `node bookmarklet/build.js major` bump the others, and unchanged code keeps its version. Each release publishes `version.svg`, whose size encodes the version (width = major × 1000 + minor + 1, height = patch + 1). The bookmark loads that image (an image's size can be read across sites without CORS) and turns the ⓘ action green (with a green dot on the round button) when its own version differs. The ⓘ action always opens the install page.

It bundles `core.js` (the tool, shared with the extension) with `bookmark.js` (the bookmark's way of taking pictures, saving several pictures as one zip and checking for updates) using esbuild (`npx` downloads it on first use), strips the comments from `server.js` and colours it with the small tokenizer in `highlight.js`, builds the page and publishes it over the same link with the `heyadhi-share` CLI, together with `client.js`. No local copy is kept.

## The extension

`node bookmarklet/build.js` also builds the browser extension into `extension/dist/chrome/` (or run `node extension/build.js` alone). Load it with **Load unpacked** on `chrome://extensions` (Developer mode on). It runs the same `core.js` as the bookmark with its own platform part (`extension/content.js`): lossless pictures through `captureVisibleTab` (stored as PNG), pictures saved as separate files (Chrome makes their blob URLs in `offscreen.html`), the popup (`popup.html`: clicking the icon opens it and starts the tool; it offers Close the tool, asks once per site whether pins may come back after a reload, and lists every commented page from the extension's index; a click on the page that closes it is skipped by `content.js`, since it also lands on the page), the shortcut Alt+Shift+P (starts or closes the tool), and pins that come back after a reload on sites you allowed from the popup (`restore.js`, registered per site in `background.js`). Comments live in the page's own storage, so the bookmark and the extension see the same comments, and their share links open in either. After a reload, sharp pictures need one click on the icon or the shortcut (the browser's rule).

## Server

```sh
node server/server.js ~/projects/my-app        # or ~/page-comments-server.js, written by the install page's command
```

## Test

`node --test` from the repository root runs every test (the server test starts the real server, so port 4747 must be free)
