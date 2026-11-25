# Ideas

Ideas for later, with the thinking done so far, so work can pick up without re-deciding. Nothing here is built.
What the tool does today is in [FEATURES.md](FEATURES.md). When an idea ships, move it out of this file.

**On this page**

- [Flows: a guided tour of a page or an app](#flows-a-guided-tour-of-a-page-or-an-app)
- [Comments across a whole site](#comments-across-a-whole-site)
- [Your own order of comments](#your-own-order-of-comments)
- [Step through comments with ← and →](#step-through-comments-with--and-)
- [How these fit together](#how-these-fit-together)
- [Smaller ideas and known gaps](#smaller-ideas-and-known-gaps)

## Flows: a guided tour of a page or an app

The idea (Adhi, 2026-11-25): mark a flow to show someone, like a tutorial. Click one place and comment, click another
and comment, say "click this", a pop-up opens, comment on the pop-up. Someone else then follows it step by step.

Questions to settle first:

- Who plays a flow back: a teammate, Claude, an end user of the app?
- Does the person click each step themselves, or can the tool click for them?
- How do steps survive a page change? The extension can come back after a reload by itself; the bookmark needs a click
  again after each page load.
- How is a flow shared: a link, a file, Copy for Claude?
- How do flows relate to today's comments and batches? A flow could simply be an ordered list of comments across pages
  (see below), plus "click here" steps.
- What does a first version do, and what waits?

A brief with the project's context was given to a separate Claude session to discuss this:
`~/.claude/handoffs/page-comments/2026-11-24-page-comments-extension/files/flows-roadmap-brief.md`.

## Comments across a whole site

The problem: a comment shows only on its exact page. The page is the address without the `#` part and without
tracking parameters, but with the exact path (case, trailing slash) and the rest of the query, byte for byte. Someone
reviewing 20 pages of one app gets 20 separate piles, and the list (L) only shows this page's.

- **Not this: looser matching** (for example, ignoring the query). On most apps the query names the record
  (`/orders?id=1` and `?id=2`), so a comment about one record would pin itself onto another. Worse than not showing.
- **This: a whole-site view.** Keep exact matching for pins. The comments list gets a switch, **This page / Whole
  site**: every comment of this website, grouped by page, with counts. Clicking one opens its page and shows it. Copy
  and Share can work on the whole site, each comment carrying its page (Copy already prints the page).
- Limits: the bookmark sees only the current site's comments (the site's own storage) and does not survive a page
  change, so after opening another page you click it again. The extension sees every site and can come back by itself.
- This is the "all-comments view" deferred on 2026-11-24 ("Neither for now"); the many-pages case is the reason to
  bring it back.

## Your own order of comments

Today a comment's number is its place in this page's list.

- Manual order: drag a comment up or down in the list, or small ↑ / ↓ buttons on each row. Pins, Copy and share links
  follow that order.
- Sorting: your order, newest first, or by writer.
- Picture captions get their number when you copy, so reordering never leaves an old number inside a picture.

## Step through comments with ← and →

- In commenting mode ← and → are free (↑ / ↓ pick the parent / inner element). ← / → would go to the previous / next
  comment: scroll to it, outline it, open its box, without opening the list.
- The comment box gets the same ‹ › buttons a batch already has.
- In the whole-site view, → on the last comment of a page goes on to the next page: smooth with the extension; with the
  bookmark, a click on it again after each page change.

## How these fit together

An ordered list of comments across pages, stepped through with ← / →, is the base of flows: a flow is that list, plus
"click here" steps, plus someone else playing it back. Decide the three above as the first version of flows, so they
are not built twice in two shapes. Each is useful alone too, as an everyday review tool.

## Smaller ideas and known gaps

From the pre-store audit and later sessions; each stays undone until someone picks it up.

- **Undo after Delete**: Delete (the list's ×, the box's Delete) acts at once and drops the picture. An Undo message.
- **Backup against storage wipes**: comments live only in the site's storage; sites that clear it on logout lose them.
  The extension could keep a copy in its own storage.
- **Share links through sign-in**: a link to a page behind sign-in can lose its `#` part through the sign-in
  redirects, and with it the comments. At least tell the user.
- **Slack link preview of Copy's combined picture**: deferred by Adhi ("leave it, i will come back to this later").
- **One-step Jira issue** and **Send to Claude without the local server**: deferred.
- **Bookmark nudge to the extension**: once the stores have it, the bookmark could suggest the extension (sharper
  pictures, no share prompt). Needs the store links.
- **Several pictures in one paste**: browsers and extensions can put only one picture on the clipboard. Only route
  left: the local server puts all pictures on the system clipboard as files (per operating system, only while the
  server runs, Slack's handling of several pasted files unconfirmed). Adhi chose to leave it (2026-11-25).
- **Firefox before the store**: a self-distributed, AMO-signed add-on would install for real (an unsigned one lasts only
  until Firefox restarts). Needs an AMO account.
- **Frames with a CSS transform or zoom**: picks inside them land in the wrong place.
- **Area mode in frames**: the wheel does not reach a panel that scrolls inside a frame.
- **Pins on an element with no height**: a pin is kept inside its element, so an element of zero height (all its
  children absolutely positioned) puts the pin at its top edge.
