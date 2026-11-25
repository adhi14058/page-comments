# page-comments releases

What changed for you in each version, newest first.

## 1.10.6 — 2026-11-25

- Share asks your name in a small box right above the Share button, instead of a strip at the bottom of the screen.
- The extension remembers your name for every site, so it asks only once. The bookmark remembers it per site, since a browser keeps each site's storage apart.
- Change your name in the ⋯ list (Your name · Change), or with Change name in the message after sharing. Shift+S still works.

## 1.10.5 — 2026-11-25

- After you reload the extension, or it updates, a click on the bookmark on a page that was already open runs the newest tool. Before, it kept bringing back the old extension's version until you reloaded the page.

## 1.10.4 — 2026-11-25

- In a batch, Space adds or removes the outlined element. After ↑ outlines a parent, Space adds that parent; before, only a click somewhere inside it did, and nothing said so. The batch bar now says it.

## 1.10.3 — 2026-11-25

- You can tell which one is running: the round button's tooltip, the ⋯ list and the key cards say "Bookmark 1.10.3" or "Extension 1.10.3". Where the extension is installed, a click on the bookmark starts the extension, and they then add "started from your bookmark".
- Area mode no longer stops the page from scrolling. On pages that scroll a panel of their own, as most web apps do, the mouse wheel did nothing while area mode was on.
- Share links stay under 7,500 characters, because Slack refused longer ones. Pictures are left out of the link sooner, and a link that is still long without them says so.

## 1.10.2 — 2026-11-25

- The comment box stays next to what it is about while you scroll, instead of staying on the screen. A new area's dashed rectangle stays on the spot you dragged over too.
- If the window gets smaller while a comment box is open (Chrome's "sharing this tab" bar, DevTools), the box comes back on screen instead of being cut off at the bottom.
- Text you are typing in a comment box is never thrown away. Before, a change from another tab of the same site, or a page that changes its own address, could close the box under you, and the next letters ran as shortcuts (F froze, A started an area).
- With the extension, typing your name for shared comments no longer runs the shortcuts.
- The Freeze button no longer closes a comment box that has text in it.

## 1.10.1 — 2026-11-25

- With the bookmark, keys work right after you allow "Share this tab?". Before, F, A, B and the other keys did nothing until you clicked the page.
- Pressing F before sharing is on now asks to share, then counts down and freezes, as the Freeze button does. You no longer press F a second time.
- While you comment, the cursor is a pointing hand over the whole page, in Freeze too, because a click picks whatever is under it. Only Area keeps the crosshair.
- The same page opened from a newsletter or an ad (with `utm_…`, `fbclid`, `gclid` and similar tracking parameters in its address) shows the same comments. Comments you already saved keep showing.
- Shared links are checked more strictly. A broken or tampered link can no longer save a comment that spoils the page's list. A link made by a newer version asks you to update.
- On right-to-left pages (Arabic, Hebrew) the bar no longer mirrors, and comments and names typed in those languages run right to left.
- AltGr+Shift+C and AltGr+Shift+F type their letters again (Windows) instead of switching modes or freezing.
- On sites that block storage, the comment box opens as usual, and Copy no longer says it failed after it worked.
- The extension no longer closes the tool it has just opened when a page reloads at the same moment.
- A bookmark you drag from now on no longer tells this website which page you used it on. Drag it again to get this.
- The website has a privacy page: what is stored, where, and what leaves your device. On the website's Try it demo, a tool you already have running picks the things inside the demo before you press Start.

## 1.10.0 — 2026-11-25

- page-comments has a new website, and it now lives at page-comments.heyadhi.com: add the tool as the extension, a bookmark or a copy to paste, see how it works, try it right on the page, see what your browser will ask, and look up every key. It also shows this changelog. The old address forwards there, and bookmarks you already have keep working.
- The round button is orange while you browse (it was black), and still blue while you comment. The comment count on it is now dark, so it shows on orange.
- Hovering the round button now says what it does: a click switches between commenting and browsing, a drag moves it, and Alt+Shift+C does the same from the keyboard.
- Close is one click: hovering the round button shows a small × on its outer side, away from the bar. The ⋯ list keeps Close too.
- When a comment box opens over the round button, the button moves to the nearest free corner, and goes back when the box closes.
- The small card of keys above the round button is compact: B batch, A area, F freeze, Esc back to browsing, and ? for all keys (Alt+Shift+C stays in the full list).
- Freeze's bar now sits at the bottom of the screen, like the Select several bar, so it stays clear of menus near the top (the things you freeze).
- You can comment on embedded frames (iframes, such as a video, a map or another page shown inside this one). Before, hovering one showed nothing and clicking it opened no comment box. When the frame's page comes from the same site (for example Storybook, or an app that shows its pages in frames), you pick, comment and pin the things inside it, and ↑ goes out to the frame. Copy names the frame. Frames from other sites are picked whole, like a picture.
- At the right edge of a page, the details card over a highlighted element (D) no longer runs off the screen.
- The card that explains a greyed-out Add screenshot now opens only from the small ? beside it, and it opens under the comment box (over it when the box is at the bottom of the screen), so it never covers what you are typing.

## 1.9.11 — 2026-11-24

- Where Add screenshot is greyed out, hovering it now opens a clear card instead of the browser's plain tooltip: why there are no pictures on this page, and the two steps to allow them in Chrome. You can select the chrome://flags address and this page's address to copy them.

## 1.9.10 — 2026-11-24

- On pages where the bookmark cannot take pictures (plain http that is not localhost), Add screenshot is greyed out, and its tooltip says why and how to allow it in Chrome. Local sites named `localhost`, `127.0.0.1` or `name.localhost` take pictures as usual.

## 1.9.9 — 2026-11-24

- Copy pictures works on pages that are not https too. The pictures paste into Google Docs and email; Slack needs an https page for pictures.

## 1.9.8 — 2026-11-24

- Comments on a frozen menu or tooltip keep the spaces between its words. A menu item read "Offline syncKeeps working" once the menu had closed; it now reads "Offline sync Keeps working".

## 1.9.7 — 2026-11-24

- Copy and Send to Claude describe where each element sits in a short form: its nearest id and the last few steps, instead of a long chain of nested elements. Pins still find their element as before.

## 1.9.6 — 2026-11-24

- Copy and Send to Claude carry less noise. Each element keeps its size, colours and font. Padding and corner radius show only when they are set. The contrast score is no longer copied; you still see it while you comment.

## 1.9.5 — 2026-11-24

- Copy now works on pages that are not https, such as internal tools, staging servers and `.test` dev sites. It used to fail there with an error.
- On those pages the bookmark now says plainly that it cannot take pictures there (the extension can), instead of showing an error.

## 1.9.4 — 2026-11-24

- Pictures pasted into a rich-text editor (Google Docs, email, Notion) are labelled with their number only, since the comment is right above them. The combined picture for Slack and the files from Save pictures keep the full "2 · comment" label.

## 1.9.3 — 2026-11-24

- Save pictures now tells you when it fails, instead of doing nothing.
- The extension (not yet in the stores): clicking its icon starts the tool and opens the popup. The popup offers Close the tool, lists every commented page, and asks once per site whether pins may come back after a reload; it remembers Not now. The click that closes the popup no longer opens a comment box.
- The extension in Firefox: Save pictures works, and pins come back after a reload on sites with a port, such as localhost:3000.

## 1.9.2 — 2026-11-24

- The bookmark from the GitHub repository checks for new versions without telling GitHub which site you use it on, the same way the install page's bookmarks do.

## 1.9.1 — 2026-11-24

- For networks that reach only github.com: the GitHub repository now has its own fixed bookmark. It learns of new versions from GitHub, and its Help opens the repository. It replaces the copy of the install page that used to live in the repository.
- No change for bookmarks from the install page.

## 1.9.0 — 2026-11-24

- Sharper pictures: thin text no longer comes out smeared or paler than on the page.
- The browser extension (not yet in the stores). It does what the bookmark does, plus lossless pictures, a toolbar popup that starts the tool and lists every commented page by site, a shortcut (Alt+Shift+P), Save pictures as separate files, and pins that come back after a reload on sites you allow. It shares comments and share links with the bookmark.
- Only one tool ever runs on a page. The bookmark hands over to the extension where the extension already runs, and starting the extension closes an open bookmark tool. Your comments stay either way.

## 1.8.2 — 2026-11-24

- New page-comments icon: a comment bubble with a cursor in it. The round button shows it while you comment (browsing keeps the plain cursor), and the install page uses it too.

## 1.8.1 — 2026-11-24

- No visible change. Behind the scenes: the tool was reorganized so the coming browser extension can share it with the bookmark.

## 1.8.0 — 2026-11-24

- Clear all moved out of ⋯ into the bar, as a bin icon left of the comments button. It still takes two clicks. After the first click it turns red and says how many comments it will clear.
- Batch: the blue bar's "Done" is now "Close without saving", or "Close" when nothing is selected.
- Batch: the comment box has ‹ › arrows that step through your selections. Each one scrolls into view with a solid outline, and the box moves beside it: below it, or above it when there is no room below. All selections stay outlined while the box is open.

## 1.7.1 — 2026-11-24

- Messages (such as "Copied a link…") are now cards like the comments list, not dark tooltips. A message closes when another popup opens (the comments list, ⋯, a comment box, the menu, the shortcuts card) or when you click anything in the bar.
- The key strip is now a small card with one key per row.

## 1.7.0 — 2026-11-24

- The bookmark updates itself: each click runs the newest version from the install page's site. On sites that block outside scripts (Gmail, GitHub, Jira…), or when loading fails or takes over 3 s, it runs the version you dragged. Bookmarks from before 1.7.0 need one last re-drag.
- A second, fixed bookmark on the install page, for workplaces that allow no outside scripts. It never loads anything and always runs the version you dragged.
- The key strip also shows ⌥⇧C (Alt+Shift+C) to switch to browsing.

## 1.6.0 — 2026-11-24

- Key strip: while you comment, a small strip above the round button (below it near the top of the screen) shows the main keys: B batch, A area, F freeze, ? all keys. It steps aside while the bar, a comment box, the menu, the comments list or a message is open.
- Batch pictures of selections far apart on the page now come out whole. A dragged area inside a page-tall section used to be cut off, and pages with smooth scrolling could be caught mid-scroll.
- The ⋯ list is a little wider and its rows wrap, so "New version: open, then re-drag the bookmark" fits.

## 1.5.3 — 2026-11-24

- Every selected box in a batch, element or dragged area, has a small × on its top-right corner that removes it from the selection. Before, you could not remove a dragged area.

## 1.5.2 — 2026-11-24

- Wider comment box: the hint and all four buttons (Delete, Copy, Cancel, Save) fit on one line. If space still runs out, the "Enter saves" hint shortens, never a button.
- Messages (such as "Copied a link…") no longer open behind the toolbar. They sit above it, in the same column as the comments list, and the toolbar's tooltips no longer cover them.

## 1.5.1 — 2026-11-24

- The comments list and the ⋯ list no longer open on top of each other: opening one closes the other.

## 1.5.0 — 2026-11-24

- New toolbar: the round button opens into a bar (modes | outputs | ⋯) toward the middle of the screen. It stays open 1.2 s after the mouse leaves. ⋯ holds Details, Keyboard shortcuts, Help, Clear all and Close.
- Save pictures saves one zip instead of one download per picture. A single picture is still a plain PNG.
- Copy button in the comment box: copies what you selected and typed, with its picture if ticked, without saving the comment.
- A dragged area's label now says "region".
- The "Add screenshot" checkbox matches the tool's look instead of the browser's.
- Share links keep the page's own `#` part (routes, anchors), so the link opens the same view. The receiver's page drops only the tool's part.
- New install page: sections by task, a side index, hand-over steps for each app, a live shortcut list and a bigger "Try it here".

## 1.4.0 — 2026-11-24

- Share link asks your name once per site (Shift+S changes it). Receivers see each writer's name and colour.

## 1.3.0 — 2026-11-24

- Save pictures (one file per picture), and Retake for share links that came without pictures.
- Batch: clicks select elements by default, and A switches to areas. In area mode the bar and pins stay clickable. Esc steps back one level.

## 1.2.0 — 2026-11-24

- Share link moved to the round button (S). It carries small pictures as long as the link stays under 30 KB.
- Opening a comment from the comments list scrolls to it and shows its selection.

## 1.1.x — 2026-11-24

- 1.1.1: comments from a share link show in purple. Sizes show in KB.
- 1.1.0: Share link (the comments travel inside the link), batch mode (B), keys shown in tooltips, and a question whether to keep or drop your selections.

## 1.0.x — 2026-11-24

- 1.0.1: a comment opened from the comments list closes when you click outside it. Copy text, for Jira and Claude desktop.
- 1.0.0: the first numbered release. A comment box with plain names and a details tab, D to turn details on and off, Shift+click selections with one picture each, Copy pictures, Send to Claude on local site names from your computer's hosts file, and a test area on the install page.
