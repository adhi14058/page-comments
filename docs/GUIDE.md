# Using page-comments

The full guide. The [README](../README.md) has the short version.

## Use

1. Click the **🗨️ Page comments** bookmark on any page. Comment mode is on straight away.
2. Hovering shows each element's tag, size and background colour (also passed on to Claude); press `D` for font, padding, radius and contrast (one remembered switch, shared with the comment box's tab). Click any element, or select some text, type your comment, press `Enter`. The box names the pick in plain words ("Pro — $29", the selected words, "3 elements"); the dark tab on its edge opens the details: size, colours, font, spacing, contrast and the selector. A click elsewhere while the box is empty just closes it; a half-written comment is never thrown away. Tick **Add screenshot** to attach a picture of it: Chrome asks "Share this tab?" the first time; the tick is remembered. Screenshots survive a reload (stored in the site's IndexedDB). Every picture carries its comment's number as a caption. Copy puts the text and one combined, numbered image on the clipboard; the comments list has a copy button per comment, for apps that put all pictures after the text (Slack). Pasted into rich editors, each comment reads: comment, plain name, its pictures, then one small grey line of technical details. Jira and Confluence take text and pictures only in two pastes (their editor drops the text when a paste holds an image file and HTML with an image, and drops pictures inside HTML): the comments list's Copy text (no pictures on the clipboard) gives the text, its Copy pictures gives the pictures. Save pictures saves each picture as its own captioned PNG (`2a-make-it-bold.png`), for apps that should get separate pictures (a page can put only one picture on the clipboard) (Ctrl+V in Claude Code pastes the image); Send passes them to Claude as files. A numbered pin stays on that spot until you delete it or clear them all (the clear action, click twice). Click a pin to edit or delete it.
3. The round button shows the mode: blue is commenting, dark is browsing. Click it (or press `Esc`) to switch; open popups close when browsing starts. Its orange badge counts this page's comments. Drag it to put it anywhere; the spot is saved per site.
4. Hover the round button and it grows into a bar toward the middle of the screen: select an area, select several (batch), freeze · comments list, copy, share link, send to Claude · ⋯ for details, keyboard shortcuts, help, clear all and close. Each shows its name and key on hover. While commenting, a small card above the round button lists the main keys, one per row.
5. Copy, Send to Claude and Clear act on the comments of the current page only. Each page (URL without `#hash`) keeps its own comments, also in single-page apps.
6. Comments are saved in the site's `localStorage`, so a reload keeps them: click the bookmark again and they come back with their pins.
7. **Share link** (an action on the round button, key `S`) copies a link to this page with its comments packed (compressed) after `#page-comments=`, with small copies of the pictures (1 pixel per CSS pixel, WebP 0.7, about 1.5 KB each) while the link stays under 30 KB; past that, without pictures, and the message says so; the person opening such a link is offered Retake, which takes those pictures on their page (frozen ones and ones whose element is missing cannot be retaken). Slack takes 40,000 characters a message. Whoever opens it and clicks their bookmark gets the comments, pins and pictures, saved as theirs. Opening a comment from the list scrolls to it and shows what it covers, dashed. The first share on a site asks your name in a small bar (remembered; `Shift+S` changes it); each comment carries its writer's name, and passed-on comments keep theirs. Comments that came in through a link show their writer's name (chip in the comment box, list line, pin tooltip, "(from Name)" in Copy) and colour (pin, number, a mild row background), one colour per name from a fixed list without blue or orange; links without names stay purple. Only useful for pages both people can open (not your localhost). A link's data is checked before use: comments of the wrong shape and anything but real colours are dropped.
8. More ways to point, while commenting:
   - **Right-click** opens the tool's own menu: comment on this, select parent ↑, select inner ↓, select an area, freeze, keyboard shortcuts, copy selector.
   - **Batch** (`B`, the Select several action, or the right-click menu; `Shift`+click starts one too): every click adds or removes an element; press `A` to drag area boxes instead (`A` again: back to elements). On the frozen picture a drag always adds an area. `Enter` (or Comment on the blue bar) opens one comment for all of them, anchored on their nearest common ancestor, with one picture of each pick (2a, 2b, ...). Close without saving or `Esc` asks "Drop the N selected?" first. In the comment box, ‹ › step through the selections: each comes into view, outlined solid, with the box beside it.
   - **Freeze** (`F`, `Alt+Shift+F` / `⌥⇧F`, or the arc's "Freeze: 3 s to open a menu first", which gives you 3 seconds to open the page's menu with the mouse) records the page as a still picture, so hover menus and tooltips stay put; click, drag or right-click on it as on the live page. The first press only starts tab sharing (its prompt would close open menus); press again to freeze. `Esc` unfreezes.
   - **Keys:** `↑`/`↓` parent or inner element, `Enter` comment on it, `A` area, `C` copy, `L` list, `S` share link, `B` batch, `D` details on/off, `?` all shortcuts, `Esc` backs out one step, `Alt+Shift+C` (`⌥⇧C` on a Mac) switches commenting/browsing. A click outside the comments list closes it. Single keys are ignored while you type in a field.

Without the bookmark: paste the published https://page-comments.share.heyadhi.com/client.js into the DevTools console, then run `window.__pageCommentsLatest()`.

## Two bookmarks

The install page offers two bookmarks. The orange one updates itself: each click loads the published `client.js` (which only defines `window.__pageCommentsLatest`, so it never runs on its own) and runs it. When the site blocks that (CSP or Trusted Types, as on Gmail, GitHub and Jira), the load fails or takes over 3 s, it runs the copy it was built with. The fixed one is that copy alone and never loads code, for workplaces that allow no outside scripts. Either way, a copy older than the published version shows the green update dot.

## Without the share site

Some networks block https://page-comments.share.heyadhi.com/ but reach github.com. For them the repository carries the fixed bookmark as one line, [`bookmarklet.txt`](../bookmarklet.txt), updated by every release: open it on GitHub, click **Copy raw file**, then create a new bookmark (right-click the bookmarks bar → Add page…) and paste it as the address (URL). Name it Page comments. This copy checks the repository for newer versions, and its Help line opens the repository.

## Send to Claude

The send action appears only while the server answers `GET /health` for that page (checked when you hover the round button, at most every 10 s, and only on local pages (see Limits); every failed check shows in the browser console, so it never checks more often).

```sh
node server/server.js ~/projects/my-app        # or ~/page-comments-server.js, written by the install page's command
```

It runs `claude -p … --permission-mode acceptEdits` in that folder and prints the output. One batch at a time.

## Limits

- Claude edits **source files**, so Send only makes sense for pages whose code is in the project folder.
- Only pages served from this machine may send: `localhost`, `*.localhost`, loopback addresses, and names the hosts file points at `127.0.0.1` / `::1`. The bookmark offers Send on those and on the local-only endings `.test`, `.local`, `.internal`, `.home.arpa`; on a hosts-file name that looks like a public domain it does not show Send (use Copy). Any website can send requests to your machine, which is why the server checks.
- A bookmark can't run by itself after a reload: click it again to bring the round button and comments back.
- Comments are stored in the site's own `localStorage`, so the site's scripts could read them. Clearing site data deletes them.
- After a reload, elements are found again by their CSS selector. If the page changed and the selector no longer matches, the pin hides; the comment stays in the list and in Copy.
