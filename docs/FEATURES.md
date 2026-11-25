# Every feature of page-comments

This file lists everything the tool does that a user can notice, one line each, kept current with the code (1.10.10).
Each line says where the feature lives in the code and where a user can read about it: [README], [GUIDE], [site] (the install page, `site-src/index.html`) or [not in docs].
A change that adds, changes or removes a feature updates this file in the same commit.

Code places are given as `file · identifier`, never as line numbers. `core.js` is `core/core.js`, the tool shared by the bookmark and the extension.

**On this page**

- [Getting it and updates](#getting-it-and-updates)
- [Commenting modes](#commenting-modes)
- [Picking](#picking)
- [Frames](#frames)
- [Freeze](#freeze)
- [Comment box](#comment-box)
- [Pictures](#pictures)
- [Copy](#copy)
- [Share links](#share-links)
- [Send to Claude and the server](#send-to-claude-and-the-server)
- [Storage and pages](#storage-and-pages)
- [Round button, bar, messages and keys](#round-button-bar-messages-and-keys)
- [Extension only](#extension-only)
- [Bookmark only](#bookmark-only)
- [Robustness](#robustness)
- [Known limits](#known-limits)

## Getting it and updates

- There are three ways to run the same tool: the bookmark, the bookmark copied from GitHub, and the browser extension. All three share comments and share links. `bookmarklet/build.js · bookmark, bookmarkFixed, clientGithub` [README] [GUIDE] [site]
- The orange bookmark updates itself: each click loads the published `client.js` from the website and runs that. `bookmarklet/build.js · loader` [README] [GUIDE] [site]
- Where a site blocks outside scripts (CSP or Trusted Types: Gmail, GitHub, Jira), or the load fails or takes over 3 seconds, the orange bookmark runs the copy it was dragged with. `bookmarklet/build.js · loader` [GUIDE] [site]
- The fixed bookmark never loads code from the internet, for workplaces that block outside scripts. It updates only when a newer one is dragged. `bookmarklet/build.js · bookmarkFixed` [GUIDE] [site]
- The GitHub copy (`bookmarklet.txt`) is the fixed bookmark for networks that reach only github.com. It looks for new versions on GitHub, and its Help line opens the repository. `bookmarklet/build.js · clientGithub`; `core.js · fromGithub, infoLink` [README] [GUIDE] [site]
- The published `client.js` only defines `window.__pageCommentsLatest`, so it never runs on its own. Pasted into DevTools and called, it starts or closes the tool. `bookmarklet/build.js · remoteJs` [GUIDE]
- The bookmark loads `client.js` without a referrer, so the website never learns which page the bookmark was clicked on. `bookmarklet/build.js · loader` [not in docs] (privacy page only)
- Clicking the bookmark while the tool is open closes it at once, without loading anything. `bookmarklet/build.js · loader`; `core.js · startPageComments` [GUIDE]
- A bookmark looks for a newer release by loading a tiny `version.svg` image, without a referrer; its width and height encode the version. A site whose CSP blocks the image skips the check silently. `core.js · startPageComments (version check)` [not in docs] (privacy page only)
- When a newer release is out, the round button shows a green dot, the Help line in the ⋯ list turns green and says what to do (re-drag the bookmark, or copy the new `bookmarklet.txt`), and a message says so once. `core.js · updateDot, infoLink` [GUIDE] [site] (the message: [not in docs])
- The extension does not check for versions; the store updates it. The Chrome build loaded by hand does not update itself: download again, unzip over the same folder, press ↻. `extension/content.js · start (checkVersion: false)`; `bookmarklet/build.js · zipChrome` [README] [GUIDE] [site]
- The Chrome extension can be downloaded from the install page and loaded with Developer mode → Load unpacked. It also works in Edge, Brave and Opera. `bookmarklet/build.js · zipChrome` [README] [GUIDE] [site]
- A Firefox build of the extension exists (Firefox 153 or later); the Chrome build needs Chrome 116 or later. `extension/build.js · manifest` [site] (names Firefox; README and GUIDE name only Chrome-family browsers)

## Commenting modes

- The tool opens in commenting mode: a click on the page picks what to comment on, and the page's own links and buttons do not react. `core.js · setCommenting, onClick` [README] [GUIDE] [site]
- Browsing mode lets the page work as usual while the pins stay. `core.js · setCommenting` [GUIDE] [site]
- A click on the round button, or Alt+Shift+C (⌥⇧C on a Mac), switches between commenting and browsing from either mode. `core.js · main.onpointerdown, onKey` [README] [GUIDE] [site]
- Switching to browsing closes everything of the tool's that is open: the comment box, the list, the menu, area mode, a batch, a freeze. `core.js · setCommenting` [GUIDE]
- Esc backs out one step at a time: the name box, the name row, the shortcuts card, the menu, the comment box, the drop question, area mode, the batch, the freeze, and last commenting itself. `core.js · onKey` [README] [GUIDE] [site]
- While commenting, the cursor is the pointing hand over the whole page, since any click picks what it is on. `core.js · embedRule` [not in docs]

## Picking

- Hovering an element outlines it and shows a pill with its tag, size, and background colour. `core.js · showHighlight, inspect` [README] [GUIDE] [site]
- The pill also shows an "Aa" chip in the element's real text colour on its real background. `core.js · aa, showHighlight` [not in docs]
- The pill and the details card move below the element near the top of the screen, and stay inside the screen at the right edge. `core.js · showHighlight` [not in docs]
- D switches the details on and off: background, text colour, font (size, weight, family), padding, corner radius and contrast. The switch is remembered per site and shared with the comment box's tab. `core.js · setDetails, DETAILS_KEY, details` [README] [GUIDE] [site]
- Contrast is a WCAG check with ✓ or ✗: 4.5:1, or 3:1 for large text (24 px, or 18.66 px bold). `core.js · contrast, inspect` [not in docs] (the GUIDE says only "contrast")
- A transparent element's background is taken from the nearest parent that has one (white if none), and inside a frame from the page around it. `core.js · backgroundOf` [not in docs]
- Click an element to comment on it. `core.js · onClick` [README] [GUIDE] [site]
- Select text to comment on that text; the box opens when the mouse is let go. `core.js · onClick` [README] [GUIDE]
- A selection that spans several elements is anchored on the smallest element that holds all of it. `core.js · onClick` [not in docs]
- ↑ outlines the parent and ↓ goes back to the inner element; Enter comments on the outlined one. `core.js · moveKb, commentOnHighlighted` [README] [GUIDE] [site]
- After ↑, a click anywhere inside the outlined parent comments on the parent, not on the element under the mouse. `core.js · onClick (kbTarget)` [not in docs] (the GUIDE says it for batches only)
- Right-click opens the tool's own menu: Comment on this, Select parent, Select inner, Select an area, Select several, Freeze, Keyboard shortcuts, Copy selector. `core.js · renderMenu, onContext` [GUIDE]
- The menu's header shows the tag and size, and Select parent / Select inner name the element they go to. While it is open, ↑, ↓ and Enter work its items. `core.js · renderMenu, onKey` [GUIDE] (keys listed beside the items; working them inside the menu is not said)
- The menu closes when the page scrolls, and a click away from it only closes it. `core.js · onScrollMenu, onClick` [not in docs]
- A or Select an area turns on area mode: drag a rectangle instead of clicking an element. `core.js · setArea, areaLayer.onpointerdown` [README] [GUIDE] [site]
- Area mode stays on for the next area until A, the button or Esc turns it off. `core.js · setArea, onKey` [not in docs]
- An area finds the elements at least 60% inside it (the outermost ones, up to 12), anchors on their nearest common parent, and Copy lists them. `core.js · insideArea, toText` [not in docs]
- In area mode the mouse wheel scrolls the panel under the pointer, so web apps with their own scroll areas still scroll. `core.js · scrollsBy, areaLayer wheel listener` [not in docs]
- In area mode a drag shorter than 8 px counts as a click; in a batch it picks the element under it. `core.js · areaLayer.onpointerdown` [not in docs]
- B or Select several starts a batch: every click adds or removes an element, and one comment covers all of them. `core.js · setBatch, togglePick` [README] [GUIDE] [site]
- Shift+click starts a batch with that element. `core.js · onClick, togglePick` [GUIDE] [site]
- In a batch, Space adds or removes the outlined element, so ↑ then Space adds a parent a click would miss. `core.js · onKey` [GUIDE] [site]
- In a batch, A switches to dragging area boxes, and A again back to elements. `core.js · setArea, areaLayer.onpointerdown` [GUIDE]
- A blue bar at the bottom of a batch shows the count and how the next pick is made, with Comment and Close. `core.js · drawPicked, pickBar` [GUIDE]
- Each selected box has its own × to take it out of the batch, since a dragged area cannot be clicked off. `core.js · drawPicked` [not in docs]
- Enter or Comment opens one comment for the whole batch, anchored on the picks' nearest common ancestor. `core.js · openPicked` [GUIDE]
- A batch of one element becomes a plain element comment. `core.js · openPicked` [not in docs]
- A batch's pin goes on its first pick, and its box opens under that pick, not at the corner of the space around all picks. `core.js · openPicked (pin), edit` [not in docs]
- Leaving a batch with picks in it (Esc, Close without saving, B) asks "Drop the N selected?" first. `core.js · leaveBatch, askDrop` [GUIDE]
- Selectors are short: they stop at the nearest id and add `nth-of-type` only where siblings share a tag. `core.js · selectorOf` [not in docs]
- Copy shows a selector from the nearest id with only its last three steps; the tool keeps the full one to find the element again. `core.js · shortSelector` [not in docs]

## Frames

- Inside a frame whose page has the same origin (Storybook, apps that show pages in frames), elements are picked, commented and pinned as on the page itself. `core.js · linkFrame, LINKED` [GUIDE] [site]
- Nested same-origin frames work too, one frame inside another. `core.js · linkFrame, offsetOf` [not in docs]
- ↑ from a frame's `<body>` goes out to its iframe. `core.js · up` [GUIDE]
- A frame from another origin, a sandboxed frame, an `embed` or an `object` is picked whole, like a picture. `core.js · embedRule, targetOf` [GUIDE]
- Select an area and Freeze also pick a frame whole. `core.js · insideArea, record` [GUIDE]
- A frame that loads a new page is linked again; one that now shows another origin is picked whole again. `core.js · onFrameLoad, linkFrame` [not in docs]
- A frame that runs its own copy of the tool is left to that copy. `core.js · ownTool` [not in docs]
- A pin inside a frame hides while its spot is scrolled out of the frame's box. `core.js · inFrames, place` [not in docs]
- Copy names a framed element as "inside the frame …" and gives the frame's page address. `core.js · named` [GUIDE] (the page address is not mentioned)
- A batch can mix picks from the page and from its frames; the anchor is found across frames. `core.js · openPicked, holds` [not in docs]

## Freeze

- Freeze shows a still picture of the screen over the page, so hover menus and tooltips stay put; click, drag and right-click it like the live page. `core.js · freeze, freezeLayer` [README] [GUIDE] [site]
- F or Alt+Shift+F (⌥⇧F) freezes at once; Alt+Shift+F works in either mode. `core.js · onKey, freeze` [README] [GUIDE] [site]
- The bar's Freeze counts down 3 seconds so a page menu can be opened first. `core.js · freezeLater` [GUIDE]
- During the countdown the tool switches to browsing, so the page's own right-click menu and hovers work. `core.js · freezeLater` [not in docs] (the GUIDE implies it)
- With the bookmark, the first freeze asks to share the tab, then counts down, since the prompt closes an open menu. `core.js · freeze, freezeLater` [GUIDE] [site]
- Esc or Unfreeze on the blue bar at the bottom ends the freeze. Picks made on the picture go with it. `core.js · unfreeze` [GUIDE]
- Freezing records up to 4,000 elements on screen with their position, selector and look; comments on the picture use that record, even when the real element is gone. `core.js · record` [not in docs]
- An element covered at its centre (by a menu, say) is picked only where nothing else fits. `core.js · frozenAt, record` [not in docs]
- On the frozen picture, Shift+click and batches work, and a drag in a batch always adds an area. `core.js · freezeLayer.onpointerdown` [GUIDE]
- Pictures of comments on a frozen picture are cut from that picture. `core.js · takePictures` [GUIDE] (as "frozen pictures cannot be retaken")
- ‹ › stepping is off on a frozen picture, which cannot scroll. `core.js · openPop` [not in docs]

## Comment box

- The heading names the pick in plain words: the element's text or label, the selected words, "3 elements selected", or "2 elements" for an area. `core.js · pickOf` [GUIDE]
- The dark tab on the box's edge opens the details card: size, colours, font, padding, radius, contrast, the full selector and **copy selector**. `core.js · sideTab, side, copySelBtn` [GUIDE]
- The details card flips to the left near the right edge of the screen, and lifts to fit near the bottom. `core.js · placePop, placeSide` [not in docs]
- Enter saves; Shift+Enter starts a new line. `core.js · textarea.onkeydown` [README] [GUIDE] [site]
- Enter does not save while an input method is still composing (Chinese, Japanese, Korean). `core.js · textarea.onkeydown (isComposing)` [not in docs]
- Save stays greyed out while the box is empty. `core.js · textarea.oninput` [not in docs]
- Comments in Arabic or Hebrew run right to left in the box. `core.js · textarea (dir: auto)` [not in docs]
- Typing in the box never reaches the page's own shortcuts (Gmail, GitHub). `core.js · textarea key listeners` [not in docs]
- Copy in the box copies the comment as it is now, without saving it. `core.js · boxCopyBtn` [GUIDE]
- That Copy includes a picture when Add screenshot is ticked, and writes "(no comment yet)" when nothing is typed. `core.js · boxCopyBtn` [not in docs] (the button's tooltip says so)
- A click elsewhere closes an empty box; a box with unsaved text keeps it and takes the focus back. `core.js · onClick, unsaved` [GUIDE]
- Unsaved text also survives a freeze, an area drag, a right-click, another tab's change and an address change in a single-page app. `core.js · unsaved, freeze, areaLayer.onpointerdown, openMenu, onStorage, urlTimer` [not in docs] (the GUIDE says only that a half-written comment is never thrown away)
- While a box is open, a press on the page selects no text, so a selection is never lost to a click that only closes the box. `core.js · onDown` [not in docs]
- The box moves with its element when the page scrolls. `core.js · placePop, followPop` [not in docs]
- When the window gets smaller (Chrome's sharing bar, DevTools), the box comes back on screen. `core.js · refitPop` [not in docs]
- A new pick stays outlined, dashed, while its box is open. `core.js · openPop, drawShown` [not in docs]
- Selected text stays marked in orange while its box is open, and is found and marked again when a saved comment opens. `core.js · markText, findText` [not in docs]
- Click a pin, or a row in the comments list, to open the comment, edit it or delete it. `core.js · edit, remove` [GUIDE]
- Opening a saved comment scrolls what it covers to the middle of the screen (unless it is in full view) and outlines it dashed. `core.js · edit, drawShown` [GUIDE] (written under Share link only)
- A batch's box has ‹ › to step through its picks: each comes into view, outlined solid, with the box beside it. `core.js · goPick` [GUIDE]
- A comment whose element is gone opens in the middle of the screen, marked "not on the page now", without the screenshot tick. `core.js · edit, openPop` [not in docs]
- A shared comment's box shows "by Name" in the writer's colour. `core.js · openPop (byEl)` [GUIDE]
- Delete in the box deletes the comment and its pictures. `core.js · remove, dropShot` [GUIDE]

## Pictures

- Tick Add screenshot in the box to attach a picture of what the comment is on. `core.js · shotBox, save, takePictures` [README] [GUIDE] [site]
- The tick is remembered per site for new element comments. `core.js · SHOT_KEY` [GUIDE]
- A new area comment or a new comment on a frozen picture starts ticked, whatever was remembered. `core.js · openPop` [not in docs]
- Editing with the tick on takes a fresh picture; unticking deletes the picture; editing a comment whose element is gone keeps its picture as it was. `core.js · save` [not in docs]
- A picture shows an element with 24 px around it, and an area or each batch pick with 8 px around it. `core.js · shotRect` [not in docs]
- An element off screen is scrolled into view for its picture (at once, even on smooth-scroll pages), and the scroll goes back after. `core.js · showRect, scrollBack, takePictures` [not in docs]
- The tool, any text selection and the focus outline are kept out of every picture. `core.js · shoot` [not in docs]
- A batch gets one picture per pick, tagged 2a, 2b, …; past 26 the tags go on as 2-27. `core.js · takePictures, tagOf` [GUIDE]
- The bookmark stores pictures as WebP (small); the extension as PNG (lossless). `core.js · crop (pictureType)`; `extension/content.js · start` [GUIDE]
- Pictures are copied pixel for pixel up to 2 image pixels per CSS pixel; denser screens are scaled down to that. `core.js · crop` [not in docs]
- Pictures survive a reload: they are kept in the site's IndexedDB. `core.js · db, putShot` [GUIDE]
- If the site's data is cleared, a comment whose picture is gone loses its picture mark. `core.js · pageShots` [not in docs]
- Every picture carries a dark band with "2 · comment"; pasted into a rich-text editor it carries the number only. `core.js · captioned` [GUIDE]
- The comments list marks a comment that has a picture with 📷. `core.js · render` [not in docs]
- A failed picture says why in a message ("sharing this tab was not allowed", "it is not on the screen"); the comment is still saved. `core.js · save, crop` [not in docs]

## Copy

- Copy (C, or the bar) copies all of this page's comments in three forms at once; each app takes the one it prefers. `core.js · copyComments, copyItems, writeClipboard` [README] [GUIDE] [site]
- The plain-text form, which terminals and Claude Code read: a `Page:` line, then per comment `## N. comment`, the selector, the selected text, the element's text (up to 200 characters), its HTML (up to 400), its size, background, text colour, font, and padding and radius when set, and which picture belongs to it. `core.js · toText, looks, commentFrom` [not in docs] (the GUIDE says only that the details go to Claude)
- An area or batch in the plain text lists its elements with their text. `core.js · toText` [not in docs]
- A comment made on a frozen picture says "Commented on a frozen moment: the element may only show on hover or in a menu". `core.js · toText` [not in docs]
- The rich-text form (Docs, email, Notion): per comment the text, the plain name of the pick, its pictures, then one small grey line of technical details. `core.js · toHtml` [GUIDE]
- The picture form: all pictures stacked into one numbered picture, for places that take only an image; Claude Code's Ctrl+V pastes it with the text. `core.js · contactSheet` [GUIDE]
- Comments from a share link carry "(from Name)" in Copy. `core.js · toText, toHtml` [GUIDE]
- Copy's result shows in the button's own label, for example "Copied 3 + screenshots". `core.js · flash, copyBtn` [not in docs]
- The copy button on a row of the comments list copies that one comment with its pictures (for Slack); it shows ✓ or ! after. `core.js · render` [GUIDE] (the ✓ / ! is not mentioned)
- Copy text, at the top of the comments list, copies the text with no pictures (Jira and Confluence, first paste). `core.js · textBtn` [GUIDE]
- Copy pictures copies the pictures only, as one combined picture (Jira and Confluence, second paste). `core.js · picsBtn` [GUIDE]
- The first Copy with pictures on a site shows a tip about the two pastes for Jira and Confluence, once per site. `core.js · copyBtn.onclick (jira-tip)` [GUIDE]
- Save pictures saves each picture as its own captioned PNG, named like `2a-make-it-bold.png`. `core.js · filesBtn, slug` [GUIDE]
- Copy selector, in the right-click menu and the details card, copies the full selector. `core.js · renderMenu, copySelBtn` [GUIDE]
- On a plain-http page (no clipboard API there), Copy falls back to the older copy command: text and rich text with pictures inside, no separate picture file, so Slack gets no picture. `core.js · writeClipboard` [GUIDE]
- On a plain-http page, Copy pictures copies the combined picture inside rich text: it pastes into Google Docs and email, not into Slack or Jira. The bookmark takes no pictures on such a page, so there this applies only to pictures that came in a share link. `core.js · writeClipboard, picsBtn` [GUIDE]

## Share links

- Share link (S) copies a link to this page with its comments packed inside, after `#page-comments=`. `core.js · share, pack` [README] [GUIDE] [site]
- Whoever opens the link and starts the tool (bookmark or extension) gets the comments, pins and pictures, saved as their own. `core.js · importShared` [README] [GUIDE] [site]
- A link is checked before use: comments of the wrong shape are dropped, and so is any colour that is not a colour. `core.js · fromLink` [GUIDE]
- The link carries small copies of the pictures while it stays under 7,500 characters; past that it leaves them out. `core.js · share, smallPic, LINK_MAX` [GUIDE]
- The message after sharing gives the comment count, the link's size in KB and your name, with a Change name button; it warns when even without pictures the link is long ("send it by email or as a file"). `core.js · share` [GUIDE] (the size and the long-link warning are not mentioned)
- On a page on your own machine the message adds that only you can open the link. `core.js · share (pageIsLocal)` [GUIDE]
- Whoever opens a link that came without pictures is offered Retake, which takes them on their page; frozen ones and ones whose element is missing are skipped. `core.js · retakeBtn, drawRetake` [GUIDE]
- A link keeps the page's own hash (a route like `#/settings`): the tool adds `&page-comments=…` after it, and on opening puts the page's hash back without a new history entry. `core.js · splitHash, importShared, share` [not in docs]
- Opening the same link again adds nothing ("already here"); a link opened while the tool runs is read at once. `core.js · importShared (hashchange)` [not in docs]
- A cut-short link, or a link from a newer version of the tool, gets a message that says so. `core.js · importShared` [not in docs]
- The first share asks your name in a small box right above Share; Enter or its button saves it and shares. `core.js · askName` [GUIDE] [site]
- Change your name with Shift+S, the ⋯ list's "Your name" row, or Change name in the message. `core.js · askName, drawMe` [GUIDE] [site]
- The bookmark keeps the name per site; the extension keeps it for every site. `core.js · NAME_KEY, setName`; `extension/content.js · loadName, saveName` [GUIDE]
- The extension's name passes to the bookmark on each site it runs on, and a name given earlier on one site becomes the extension's name for all. `core.js · platform.loadName handling` [not in docs]
- Names are cut to 40 characters. `core.js · askName, fromLink` [not in docs]
- Passed-on comments keep their writer's name. `core.js · share (plain)` [GUIDE]
- Each writer gets one colour from a fixed list without blue or orange, on the pin, the number and the row; links without names are purple. `core.js · colourOf, WHO` [GUIDE]

## Send to Claude and the server

- Send to Claude passes this page's comments and pictures to Claude Code, which edits the project's source. `core.js · sendBtn`; `server/server.js` [README] [GUIDE] [site]
- Send shows only on local pages (localhost, loopback addresses, and names ending in `.localhost`, `.test`, `.local`, `.internal`, `.home.arpa`) while the server answers `/health`. `core.js · pageIsLocal, checkServer` [GUIDE]
- The tool asks the server only when the round button is hovered, at most every 10 seconds, since every failed check shows in the console. `core.js · openArc, checkServer` [GUIDE]
- A failed send says "Server not reachable: use Copy" and checks again 3 seconds later; a page whose CSP blocks the request looks the same. `core.js · sendBtn.onclick` [not in docs]
- The server is saved with one shell command from the install page and started in the project folder; it needs Node 18+ and the `claude` command. `bookmarklet/build.js · installHtml` [GUIDE] [site]
- The server accepts requests only from pages on this machine: localhost, `*.localhost`, loopback addresses, and names the hosts file points at a loopback address. `server/server.js · isLocal, hostsNames` [GUIDE] [site]
- The hosts file is read on every request, so a new entry works without a restart; `HOSTS_FILE` points it at another file. `server/server.js · hostsNames, HOSTS` [not in docs]
- The server listens on port 4747, on 127.0.0.1 only. `server/server.js` [not in docs] (privacy page only)
- It runs `claude -p … --permission-mode acceptEdits` in the project folder and prints Claude's output in its terminal. `server/server.js` [GUIDE]
- One batch at a time: a second send while Claude works gets "Claude is still working on the last batch". `server/server.js · busy` [GUIDE]
- Pictures go to a temporary folder as `screenshot-N` (or `Na`, `Nb`), which Claude may read; the folder is deleted when Claude is done. `server/server.js` [GUIDE] (the file names are not mentioned)
- A request may be at most 30 MB. `server/server.js` [not in docs]
- A Claude started by the server does not inherit the `CLAUDE*` settings of a Claude session it was started from. `server/server.js · env` [not in docs]

## Storage and pages

- Comments live in the site's own `localStorage`, so a reload keeps them; nothing leaves the browser unless you copy, share or send. `core.js · persist, load, KEY` [README] [GUIDE] [site]
- The bookmark and the extension use the same storage, so they see the same comments. `extension/content.js` [README] [GUIDE]
- Clearing the site's data deletes the comments and pictures; the site's own scripts could read them. `core.js · KEY, db` [GUIDE] [site]
- Every action works on this page's comments only. `core.js · here` [GUIDE]
- A page is its address without the `#` part and without tracking parameters (`utm_…`, `fbclid`, `gclid` and many more); any other part of the query counts. `core.js · pageKey, TRACKING` [GUIDE]
- Comments saved under an older address of the page (one with tracking parameters) still show on the clean page. `core.js · pageKey, here` [not in docs]
- Single-page apps keep a list per address: the tool checks the address every 0.3 seconds, but not while a box holds unsaved text, which is saved to the page it was written on. `core.js · urlTimer` [GUIDE] (the unsaved-text rule is not mentioned)
- Two tabs of the same site stay in step: a change in one shows in the other without overwriting it. `core.js · onStorage` [not in docs]
- After a reload, elements are found again by their selector; a pin whose element is gone hides, and the comment stays in the list and in Copy. `core.js · elOf, find, place` [GUIDE] [site]
- Opening the tool on a page with comments says "Restored N comment(s) on this page." `core.js · startPageComments` [not in docs]
- When the site's storage is full or blocked, the tool says once that a reload will lose the comments. `core.js · persist` [not in docs]
- Clear all, in the bar, deletes all of this page's comments and pictures: two clicks within 3 seconds, red and showing the count when armed. `core.js · clearBtn.onclick` [GUIDE]

## Round button, bar, messages and keys

- The round button is blue with the comment icon while commenting and orange with the pointer icon while browsing; area and batch modes show their own icons. `core.js · setCommenting, setArea, setBatch` [GUIDE] [site]
- A dark badge on it shows how many comments this page has. `core.js · render (badge)` [GUIDE]
- Drag it anywhere; its spot is saved per site. It stays at least 66 px from the edges and on screen after a resize. `core.js · main.onpointerdown, POS_KEY, centre` [GUIDE] [site]
- Hovering it shows what a click and a drag do, and Alt+Shift+C. `core.js · mainTip` [GUIDE]
- When an open comment box would cover it, it moves to the nearest free corner and goes back when the box closes. `core.js · dodgeBox` [GUIDE]
- Hovering it grows it into a bar toward the middle of the screen: Select an area, Select several, Freeze, Clear all, Comments, Copy, Share link, Send to Claude, and ⋯. `core.js · openArc, layoutBar, items` [README] [GUIDE]
- Each action's tooltip shows its name and its key. `core.js · action, ACT_KEYS` [GUIDE]
- The bar folds away 1.2 seconds after the mouse leaves, so a slip does not close it. `core.js · closeArc` [not in docs]
- Keyboard focus (Tab) opens the bar, and Enter or Space on the round button switches modes. `core.js · openArc (focusin), main.onkeydown` [not in docs]
- The ⋯ list holds Details, Keyboard shortcuts, Your name, the Help line, and Close. `core.js · moreList` [GUIDE]
- While the bar is open, a small × beside the round button closes the tool in one click. `core.js · quickClose` [GUIDE] [site]
- The comments list (L) shows each comment with its number, text, writer and the plain name of the pick; it and the ⋯ list open in the same spot, one at a time. `core.js · render, toggleList` [GUIDE] [site]
- While commenting with nothing else open, a small card by the round button shows B, A, F, Esc and ?. `core.js · keyStrip, syncOpen` [GUIDE]
- ? shows the full shortcuts card. `core.js · keysCard, KEYS` [README] [GUIDE] [site]
- The tool says which one is running (Bookmark or Extension, its version, and "started from your bookmark" when the bookmark started the extension) in the round button's tooltip, the ⋯ list, the key card and the shortcuts card. `core.js · who, TOOL, VIA` [not in docs]
- Messages close by themselves after a few seconds, stay while the pointer is on them (4 seconds more after it leaves), and close with their ×. `core.js · toast, hideToast` [not in docs]
- An older message closes when another popup of the tool opens or the bar is clicked. `core.js · syncOpen` [not in docs]
- The comments list and messages sit above the bar (below it near the top of the screen) and move clear of the round button's tooltip. `core.js · placeDock, clearTip` [not in docs]
- Single keys work only while commenting, never while typing in a field, and never with Ctrl, Cmd or Alt held. `core.js · onKey` [GUIDE] (the modifier rule is not mentioned)
- On a Mac the keys are named the way the keyboard prints them (⌥⇧). `core.js · ALT_SHIFT` [GUIDE]
- Alt+Shift+C and Alt+Shift+F read the physical key, so they work with Option on a Mac, and never fire with Ctrl (AltGr on Windows types letters such as Ć). `core.js · onKey` [not in docs]
- Close in the ⋯ list, the small ×, or running the tool again closes it; comments stay. `core.js · destroy` [GUIDE] [site]

## Extension only

- Clicking the icon starts the tool on the tab and opens the popup; a second click leaves the tool alone. `extension/popup.js`; `extension/background.js · start` [GUIDE] (the second click is not mentioned)
- Alt+Shift+P starts or closes the tool. It is not C or F, which the tool uses on the page. `extension/build.js · manifest (commands)`; `extension/background.js · commands.onCommand` [GUIDE]
- The popup shows the version, the shortcut key, "On this page" and Close the tool. `extension/popup.js`, `extension/popup.html` [GUIDE] [site]
- On a page that is not a web page the popup says the tool works only on http and https pages. `extension/popup.js · say` [not in docs]
- Allow in the popup brings pins back by themselves after a reload on that site, in browsing mode; the browser confirms for that one site. `extension/popup.js · allow`; `extension/background.js · syncRestore`; `extension/restore.js` [GUIDE] [site]
- Allow covers every port of the host (localhost:3000 and localhost:5173 alike). `extension/popup.js · site` [not in docs]
- Not now is remembered per site, so the question never comes back there. `extension/popup.js · declined` [GUIDE] [site]
- Pages without comments on an allowed site cost only a quick check on load. `extension/restore.js` [not in docs]
- The popup lists every page with comments, grouped by site, newest first, with a search over addresses and titles. `extension/popup.js · draw` [GUIDE] [site]
- Each listed page shows how long ago it was commented (today, yesterday, N days ago) or "This page · N comments"; a click opens it in a new tab. `extension/popup.js · draw, ago` [not in docs]
- The extension takes pictures without asking, lossless, of the tab it was started on. `extension/content.js · grab`; `extension/background.js` [README] [GUIDE] [site]
- After a reload or leaving the site, sharp pictures need one click on the icon or the shortcut; a picture taken without it says so. `extension/content.js · grab` [GUIDE]
- It waits about half a second between pictures (the browser allows two a second), so a big batch takes a moment. `extension/content.js · grab (lastShot)` [not in docs]
- Save pictures saves every picture as its own file in Downloads, never overwriting a file of the same name. `extension/background.js · save` [GUIDE] (no-overwrite is not mentioned)
- The click that closes the popup does not open a comment box on the page. `extension/content.js · skip` [GUIDE]
- One tool per page: starting the extension closes an open bookmark tool, and the comments stay. `extension/content.js · start` [GUIDE]
- Where the extension runs, a click on the bookmark starts the extension instead. `bookmarklet/bookmark.js`; `extension/content.js · onBookmark` [GUIDE]
- After the extension is reloaded or updated, pages already open hand back to the bookmark until they reload. `extension/content.js · alive, onBookmark` [not in docs]
- Page scripts cannot press the extension's buttons: its interface sits in a closed shadow root. `extension/content.js · start (shadowMode)` [not in docs]
- The extension makes no internet requests. `extension/content.js · start (checkVersion: false)` [not in docs] (privacy page only)
- Chrome lists "Manage your downloads" when it is added, for Save pictures. `extension/build.js · manifest (permissions)` [site]

## Bookmark only

- Chrome asks "Share this tab?" the first time a picture or freeze is needed; sharing stays on until the tool closes. `bookmarklet/bookmark.js · startCapture` [GUIDE] [site]
- After a reload, the next picture asks again. `bookmarklet/bookmark.js · startCapture` [site]
- Stopping the sharing from Chrome's bar makes the next picture ask again. `bookmarklet/bookmark.js · startCapture (ended)` [not in docs]
- Firefox and Safari cannot share one tab, so they ask which window or screen to share. `bookmarklet/bookmark.js · startCapture` [site]
- After the share prompt the keyboard focus comes back to the page, so keys work without another click. `bookmarklet/bookmark.js · startCapture (CaptureController)` [not in docs]
- A picture waits for a frame captured after the tool was hidden, so the tool never shows in it. `bookmarklet/bookmark.js · frameAfter` [not in docs]
- On a plain-http page that is not localhost, Add screenshot is greyed out, and its ? opens a card saying why and how to allow it in Chrome (`chrome://flags/#unsafely-treat-insecure-origin-as-secure`, `name.localhost`, or the extension). `core.js · canShoot, shotTip`; `bookmarklet/bookmark.js · capture.available` [GUIDE]
- Save pictures saves one picture as a PNG, and several as one zip (`page-comments-<site>-<N>-pictures.zip`), so they are one download. `bookmarklet/bookmark.js · saveFiles, zip`; `core.js · filesBtn` [GUIDE] (the zip's name is not mentioned)
- A bookmark cannot run by itself after a reload: click it again and the comments come back. `bookmarklet/build.js · loader` [GUIDE] [site]

## Robustness

- The tool works on pages with Trusted Types or a strict CSP (Gmail): it builds its interface without `innerHTML` and without inline `<style>`. `core.js · startPageComments (h, sheet, embedSheet)` [not in docs]
- The page's styles (dark mode, fonts, colours) never reach the tool's interface, and an RTL page does not mirror the bar. `core.js · sheet (:host)` [not in docs]
- Pins sit on the exact spot clicked and follow their element through scrolling and layout changes; a pin hides while its element is not rendered. `core.js · place, schedulePlace` [README] [GUIDE] (following scrolling is not said)
- A site whose storage is blocked (cookies off, a sandboxed page) still runs the tool; only remembering fails. `core.js · openPop, setDetails, POS_KEY (try/catch)` [not in docs]
- Comments saved by older versions without an id get one when loaded. `core.js · load` [not in docs]
- Copies of the tool that never update (old bookmarks) keep reading the pictures database. `core.js · db` [not in docs]
- Text of an element that is no longer shown (a menu that closed after a freeze) is joined with spaces, not run together. `core.js · textOf` [not in docs]

## Known limits

- A frame with a CSS transform or zoom puts picks inside it in the wrong place. `core.js · offsetOf (shortcut)` [not in docs]
- In area mode, the wheel does not reach scroll panels inside frames. `core.js · scrollsBy (shortcut)` [not in docs]
- Select an area and Freeze see a frame only as one element. `core.js · insideArea, record` [GUIDE]
- A comment's element is found again by selector only; if the page changed, the pin hides. `core.js · find` [GUIDE] [site]
- A page can put only one picture on the clipboard, so several separate pictures need Save pictures. `core.js · filesBtn` [GUIDE]
- Jira and Confluence take text and pictures only in two pastes. `core.js · textBtn, picsBtn` [GUIDE]
- Slack refuses links much longer than about 8,000 characters, which is why share links drop pictures past 7,500. `core.js · LINK_MAX` [GUIDE]
- Share links help only for pages both people can open; a page on your own machine is not one. `core.js · share` [GUIDE]
- Send to Claude works only on pages on your own machine, and only for code in the server's project folder. `core.js · pageIsLocal`; `server/server.js · isLocal` [README] [GUIDE] [site]
- The bookmark takes no pictures on plain-http pages that are not localhost; browsers keep screen capture and the clipboard API for secure pages. `bookmarklet/bookmark.js · capture.available`; `core.js · writeClipboard` [GUIDE]
