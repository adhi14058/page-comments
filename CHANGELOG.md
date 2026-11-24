# page-comments releases

What went out in each published version, newest first. `node bookmarklet/build.js` refuses to publish a new version without its entry here.

## 1.9.3 — 2026-11-24

- Save pictures now says so when it fails, instead of doing nothing.
- The extension (not yet in the stores): clicking its icon starts the tool and opens the popup, which offers Close the tool, asks once per site whether pins may come back after a reload (Not now is remembered), and lists every commented page. The click that closes the popup no longer opens a comment box. In Firefox, Save pictures works, and pins come back after a reload on sites with a port (like localhost:3000).

## 1.9.2 — 2026-11-24

- The GitHub copy of the bookmark (`bookmarklet.txt`) checks for new versions with a small picture from the repository, the same way the install page's bookmarks do, so GitHub is not told which site you use it on.

## 1.9.1 — 2026-11-24

- For networks that reach only github.com: `bookmarklet.txt` in the repository is now its own build of the fixed bookmark. It learns of new versions from the repository (not the share site), and its Help line opens the repository. The install page copy in the repository (`docs/index.html`) is gone; `bookmarklet.txt` replaces it.
- No change for bookmarks from the install page.

## 1.9.0 — 2026-11-24

- Sharper pictures: a picture used to be cut out of the screen capture at fractional pixel positions, which smeared thin text and paled its colour. It is now cut at whole pixels.
- The browser extension (not yet in the stores): built from the same core, with lossless pictures, the toolbar popup (start the tool, every commented page grouped by site), a shortcut (Alt+Shift+P), pictures saved as separate files, and pins that come back after a reload on sites you allow. Comments and share links are shared with the bookmark.
- The bookmark hands over to the extension on pages where the extension already runs, so there is only ever one tool on a page; starting the extension closes an open bookmark tool. Comments are kept either way.

## 1.8.2 — 2026-11-24

- New page-comments icon: a comment bubble with a cursor in it. The round button shows it while commenting (browsing keeps the plain cursor), and the install page uses it too.

## 1.8.1 — 2026-11-24

- No visible change. The tool is now one shared core plus a small bookmark part (how pictures are taken, how several pictures are saved, how updates are found), so the coming browser extension can use the same core.

## 1.8.0 — 2026-11-24

- Clear all moved out of ⋯ into the bar, as a bin icon left of the comments button. It still takes two clicks; armed, it turns red and says how many it will clear.
- Batch: the blue bar's "Done" is now "Close without saving" ("Close" when nothing is selected).
- Batch: the comment box has ‹ › arrows that step through the selections. Each comes into view outlined solid, and the box moves beside it (above it when it does not fit below). The selections stay outlined while the box is open.

## 1.7.1 — 2026-11-24

- Messages (such as "Copied a link…") are cards like the comments list instead of dark tooltips. A message closes when another popup opens (the comments list, ⋯, a comment box, the menu, the shortcuts card) or when you click anything in the bar.
- The key strip is now a small card with one key per row.

## 1.7.0 — 2026-11-24

- The bookmark updates itself: each click loads the newest version from the install page's site and runs it. On sites that block outside scripts (Gmail, GitHub, Jira…), or when loading fails or takes over 3 s, it runs the copy it was dragged with. Bookmarks from before 1.7.0 need one last re-drag.
- A second, fixed bookmark on the install page, for workplaces that allow no outside scripts: it never loads code and runs the version it was dragged with.
- The key strip also shows ⌥⇧C (Alt+Shift+C) to switch to browsing.

## 1.6.0 — 2026-11-24

- Key strip: while commenting, a small strip above the round button (below it near the top of the screen) shows the main keys: B batch, A area, F freeze, ? all keys. It steps aside while the bar, a comment box, the menu, the comments list or a message is open.
- Batch screenshots of picks far apart on the page: each picture now scrolls its exact rectangle into view first. A dragged area whose anchor is a page-tall container used to come out cut off, and pages with smooth scrolling could still be moving when the picture was taken.
- The ⋯ list is a little wider and its rows wrap: "New version: open, then re-drag the bookmark" no longer runs out of the list.

## 1.5.3 — 2026-11-24

- Every selected box in a batch (an element or a dragged area) has a small × on its top-right corner that removes it from the selection. Dragged areas could not be removed before.

## 1.5.2 — 2026-11-24

- Wider comment box (380 px): the hint and all four buttons (Delete, Copy, Cancel, Save) fit on one line. If space still runs out, the "Enter saves" hint shortens, never a button.
- Messages (such as "Copied a link…") no longer open behind the toolbar: they sit above it, in the same column as the comments list, and the toolbar's tooltips no longer cover either one.

## 1.5.1 — 2026-11-24

- The comments list and the ⋯ list no longer open on top of each other: opening one closes the other.

## 1.5.0 — 2026-11-24

- New toolbar: the round button opens into a bar (modes | outputs | ⋯) toward the middle of the screen, and stays open 1.2 s after the mouse leaves. ⋯ holds Details, Keyboard shortcuts, Help, Clear all and Close.
- Save pictures saves one zip instead of a download per picture (one picture is still a plain PNG).
- Copy button in the comment box: copies what you selected and typed, with its picture if ticked, without saving.
- A dragged area's chip says "region" (area is an HTML tag).
- Our own "Add screenshot" checkbox instead of the browser's.
- Share links keep the page's own `#` (routes, anchors): the link is `#<page's>&page-comments=…`, and the receiver removes only the tool's part.
- Install page rewritten: task sections, side index, hand-over steps per app, a live shortcut list, a bigger "Try it here".

## 1.4.0 — 2026-11-24

- Share link asks your name once per site (Shift+S changes it); receivers see each writer's name and colour.

## 1.3.0 — 2026-11-24

- Save pictures (one file per picture), Retake for links that came without pictures.
- Batch: element clicks by default, A for areas; the bar and pins stay clickable in area mode; Esc steps back one level.

## 1.2.0 — 2026-11-24

- Share link moved to the round button (S) and carries small pictures while the link stays under 30 KB.
- Opening a comment from the list scrolls to it and shows its selection.

## 1.1.x — 2026-11-24

- 1.1.1: comments from a shared link shown in purple; sizes reported in KB.
- 1.1.0: Share link (comments in the link), batch mode (B), keys in tooltips, keep-or-drop question for selections.

## 1.0.x — 2026-11-24

- 1.0.1: comment opened from the list closes on an outside click; Copy text for Jira and Claude desktop.
- 1.0.0: first numbered release: comment box with plain names and a details tab, D switch, Shift+click selections with one picture each, Copy pictures, hosts-file names on the server, install page test area.
