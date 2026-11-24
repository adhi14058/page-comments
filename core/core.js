// The page-comments tool itself, shared by the bookmark (bookmark.js) and the extension: everything except how pictures
// are taken, how several pictures are saved and how updates are found. Those come in `platform`:
//   capture.ready()  -> true when a picture can be taken without asking first
//   capture.start()  -> asks for what pictures need (the bookmark: Chrome's "Share this tab?")
//   capture.grab()   -> { source, k }: a picture of the visible tab (k image pixels per CSS pixel); called with the tool hidden
//   capture.stop()   -> ends capturing when the tool closes
//   capture.available -> false where pictures are impossible (the Add screenshot tick turns off and explains why)
//   saveFiles(files, zipName) -> message for the user; files: [{ name, bytes }] (PNG)
//   checkVersion     -> where this copy looks for the latest version.svg and sends its Help line: 'site' (the share
//                       site), 'github' (the repository, for bookmarklet.txt: some networks reach only github.com) or false
//                       (the store updates the extension)
//   name             -> 'bookmark' | 'extension': written on the page (data-page-comments) while the tool is open, so the
//                       other kind can see it; either asks the other to close with the 'page-comments:close' event
//   shadowMode       -> 'closed' keeps page scripts from pressing our buttons (the extension's buttons can take pictures)
//   onComments(info) -> optional; told { page, title, count } whenever this page's comments change
//   startBrowsing    -> true: start in browsing mode (the extension bringing pins back after a reload)
//   pictureType      -> how pictures are stored: 'image/webp' (default, small) or 'image/png' (lossless: WebP halves the
//                       colour detail, which turns thin coloured text pale; worth it only when the capture is lossless)
// Comment mode starts on: click any element or select text, write a comment, Enter saves. Copy or send the batch to Claude.
// A selector as Copy shows it: from the nearest id (or the start), with only its last steps, so a reader is not handed
// a chain of fifteen divs; the element's text and HTML identify it better. The tool keeps the full one to find the
// element again after a reload.
// An element inside a same-origin frame has the frame's selector, ' >>> ', then its selector in the frame's page (one
// ' >>> ' per frame when nested). No CSS selector holds ' >>> ', so a copy of the tool that does not know frames
// finds nothing for such a comment, rather than a wrong element of the top page.
export const FRAME_SEP = ' >>> ';
export const shortSelector = (selector, keep = 3) => String(selector).split(FRAME_SEP).map((one) => {
  const parts = one.split(' > ');
  const tail = parts.slice(Math.max(0, parts.findLastIndex((p) => /^[\w-]*#/.test(p))));
  return tail.length <= keep + 1 ? tail.join(' > ') : `${tail[0]} > … > ${tail.slice(-keep).join(' > ')}`;
}).join(FRAME_SEP);

export const startPageComments = (platform) => {
  const SERVER = 'http://localhost:4747';
  const SITE = 'https://page-comments.share.heyadhi.com/';
  const GITHUB = 'https://github.com/adhi14058/page-comments';
  const fromGithub = platform.checkVersion === 'github';
  // build.js replaces this with the release's id (6 hex digits); a copy pasted from source has none.
  const VERSION = '__PAGE_COMMENTS_VERSION__';
  // Running it a second time removes the tool.
  if (window.__pageComments) return window.__pageComments();

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const root = host.attachShadow({ mode: platform.shadowMode || 'open' });
  // Built with DOM calls and a constructed stylesheet, never innerHTML or <style>: pages with
  // Trusted Types (Gmail) block innerHTML, and a strict CSP style-src blocks inline <style>.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    /* Stop the page's inherited styles (dark color-scheme, text color, fonts) from reaching our UI. */
    :host { all: initial; color-scheme: light; }
    * { box-sizing: border-box; margin: 0; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
    [hidden] { display: none !important; }
    .hl { position: fixed; pointer-events: none; outline: 2px solid #2563eb; outline-offset: -1px; background: #2563eb1a; border-radius: 2px; }
    /* The info pill over the outline: tag, size, an "Aa" chip in the real text colour on the real background, and the
       background code. With details on (D, or the comment box's tab) a card adds the rest. Both flip below the element near the top of the screen. */
    .pill, .more { position: absolute; left: -2px; background: #18181b; color: #e4e4e7; box-shadow: 0 6px 18px #0004; white-space: nowrap;
                   font: 11px/1 ui-monospace, monospace; }
    .pill { bottom: calc(100% + 4px); display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; border-radius: 8px; }
    .pill .t { background: #2563eb; color: #fff; padding: 3px 6px; border-radius: 5px; font-weight: 700; }
    .aa { display: inline-grid; place-items: center; width: 22px; height: 18px; border-radius: 4px; font: 700 11px system-ui, sans-serif; box-shadow: inset 0 0 0 1px #0002; }
    .pill .dim { color: #a1a1aa; }
    .pill kbd { font: 10px ui-monospace, monospace; color: #71717a; border: 1px solid #3f3f46; border-radius: 3px; padding: 1px 3px; }
    .more { bottom: calc(100% + 34px); border-radius: 8px; padding: 8px 10px; line-height: 1.7; display: none; }
    .hl.details .more { display: block; }
    .more .k { color: #a1a1aa; display: inline-block; width: 72px; }
    .hl.below .pill { bottom: auto; top: calc(100% + 4px); }
    .hl.below .more { bottom: auto; top: calc(100% + 34px); }
    .ok { color: #4ade80; } .bad { color: #f87171; }
    /* The pin's pointed bottom-left corner sits on the spot that was clicked. */
    .pin { position: fixed; pointer-events: auto; width: 24px; height: 24px; margin: -24px 0 0 0; padding: 0; cursor: pointer;
           border: 2px solid #fff; border-radius: 50% 50% 50% 0; background: #ea580c; color: #fff; font-weight: 700; font-size: 11px;
           box-shadow: 0 2px 8px #0006; }
    .pin:hover { background: #c2410c; transform: scale(1.1); }
    /* The round button sits at the widget's centre; the action buttons fan out around it on hover. */
    /* The toolbar is a pill dock: on hover the round button grows into a bar (modes | outputs | ⋯), toward the middle of
       the screen (.left: it opens to the right). The ⋯ opens a list of the rarer actions with names and keys. */
    .widget { position: fixed; width: 0; height: 0; }
    .quick-close { position: absolute; top: -11px; left: 34px; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; display: grid;
                   place-items: center; background: #18181b; color: #e4e4e7; cursor: pointer; pointer-events: auto; box-shadow: 0 2px 8px #0005, 0 0 0 1px #ffffff26;
                   opacity: 0; visibility: hidden; transition: opacity .15s, visibility .15s, background .15s; }
    .quick-close svg { width: 10px; height: 10px; }
    .quick-close:hover { background: #dc2626; color: #fff; }
    .widget.left .quick-close { left: auto; right: 34px; }
    .widget.open .quick-close, .quick-close:focus-visible { opacity: 1; visibility: visible; }
    .bar { position: absolute; top: -26px; right: -26px; display: flex; align-items: center; border-radius: 30px; pointer-events: auto;
            transition: background .2s, box-shadow .2s, padding .2s; }
    .widget.left .bar { right: auto; left: -26px; flex-direction: row-reverse; }
    .items { display: flex; align-items: center; gap: 2px; max-width: 0; opacity: 0; overflow: hidden; pointer-events: none;
             transition: max-width .35s cubic-bezier(.2, .8, .2, 1), opacity .2s; }
    .widget.open .bar { background: #18181b; box-shadow: 0 10px 30px #0006, 0 0 0 1px #ffffff26; padding-left: 8px; }
    .widget.open.left .bar { padding-left: 0; padding-right: 8px; }
    .widget.open .items { max-width: 680px; opacity: 1; pointer-events: auto; animation: unclip 0s .35s forwards; }
    @keyframes unclip { to { overflow: visible; } } /* tooltips may leave the bar once it has finished growing */
    .main { position: relative; flex: none; width: 52px; height: 52px; border-radius: 50%; border: 0; padding: 0; cursor: pointer;
            display: grid; place-items: center; color: #fff; background: #ea580c; pointer-events: auto; touch-action: none;
            box-shadow: 0 8px 24px #ea580c66, 0 0 0 3px #ffffff44; transition: background .25s, transform .2s, box-shadow .2s; }
    .main:hover { transform: scale(1.06); }
    .main.on { background: #2563eb; box-shadow: 0 8px 24px #2563eb66, 0 0 0 3px #ffffff44; }
    .widget.open .main { box-shadow: none; }
    .main.dragging { cursor: grabbing; transform: scale(1.08); }
    /* The round button's own tooltip: what a click and a drag do. It hugs the screen edge the widget sits on. */
    .main .label { left: auto; right: 0; translate: none; }
    .widget.left .main .label { left: 0; right: auto; }
    .widget.top .main .label { bottom: auto; top: calc(100% + 10px); }
    .main:hover .label, .main:focus-visible .label { opacity: 1; }
    .main.dragging .label { opacity: 0; }
    .main svg { width: 24px; height: 24px; }
    .badge { position: absolute; top: -4px; right: -4px; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 11px; border: 2px solid #fff;
             background: #18181b; color: #fff; font: 700 11px/18px system-ui, sans-serif; text-align: center; }
    .widget.open .badge { display: none; } /* the open bar shows the count on its Comments button */
    .dot { position: absolute; top: -2px; left: -2px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; background: #16a34a; }
    .act { position: relative; flex: none; min-width: 36px; height: 36px; border-radius: 10px; border: 0; padding: 0 9px; cursor: pointer;
           display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; color: #e4e4e7; text-decoration: none;
           font: 600 12px system-ui, sans-serif; transition: background .15s; }
    .act svg { width: 16px; height: 16px; flex: none; }
    .act:hover:not(:disabled) { background: #3f3f46; color: #fff; }
    .act:disabled { color: #71717a; cursor: not-allowed; }
    .act.active { background: #2563eb; color: #fff; } .act.active:hover { background: #1d4ed8; }
    .act .ontxt { display: none; } .act.active .ontxt { display: inline; }
    .act.send { background: #ea580c; color: #fff; } .act.send:hover:not(:disabled) { background: #c2410c; }
    .act .cnt { background: #ea580c; color: #fff; border-radius: 999px; font: 700 10.5px/16px system-ui, sans-serif; padding: 0 6px; }
    .act.dots.on { background: #3f3f46; color: #fff; }
    .sep { width: 1px; height: 22px; background: #3f3f46; margin: 0 6px; flex: none; }
    /* Tooltips: above the bar, or below it near the top of the screen. */
    .label { position: absolute; left: 50%; bottom: calc(100% + 10px); translate: -50% 0; white-space: nowrap; background: #18181b; color: #fafafa;
             font: 600 11px/1 system-ui, sans-serif; padding: 6px 8px; border-radius: 6px; box-shadow: 0 4px 12px #0004, 0 0 0 1px #ffffff1f;
             opacity: 0; pointer-events: none; transition: opacity .15s; }
    .widget.top .items .label { bottom: auto; top: calc(100% + 10px); }
    .act:hover .label, .act:focus-visible .label, .act.flash .label { opacity: 1; }
    .label kbd { margin-left: 7px; font: 600 10px ui-monospace, monospace; color: #a1a1aa; border: 1px solid #3f3f46; border-radius: 3px; padding: 1px 4px; }
    .act.flash .label kbd { display: none; }
    /* The ⋯ list: white rows with icon, name and key. */
    .more-list { position: absolute; right: -26px; bottom: 38px; width: 272px; background: #fff; border-radius: 12px; padding: 6px; pointer-events: auto;
                 box-shadow: 0 12px 32px #0006, 0 0 0 1px #0000001a; display: none; }
    .widget.left .more-list { right: auto; left: -26px; }
    .widget.top .more-list { bottom: auto; top: 38px; }
    .widget.open.listopen .more-list { display: block; }
    .grp { font: 700 10px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #a1a1aa; padding: 8px 8px 2px; }
    .more-list .act { width: 100%; height: auto; justify-content: flex-start; gap: 10px; padding: 7px 8px; border-radius: 8px; color: #18181b; font: 500 13px system-ui, sans-serif; }
    .more-list .act svg { color: #52525b; }
    .more-list .act:hover:not(:disabled) { background: #f4f4f5; color: #18181b; }
    .more-list .label { position: static; translate: none; flex: 1; display: flex; justify-content: space-between; background: none; color: inherit; font: inherit;
                        padding: 0; box-shadow: none; opacity: 1; white-space: normal; gap: 8px; text-align: left; line-height: 1.35; }
    .more-list .label kbd { flex: none; align-self: flex-start; }
    /* While commenting, the main keys sit in a small card above the round button (below it near the top), one per row,
       so people learn them. It never takes clicks, and it steps aside for anything else of ours that opens near it. */
    .keystrip { position: absolute; right: -26px; bottom: 36px; display: grid; grid-template-columns: auto auto; gap: 5px 10px; align-items: center;
                white-space: nowrap; pointer-events: none; background: #fff; color: #3f3f46; border-radius: 12px; padding: 10px 12px;
                font: 500 12px system-ui, sans-serif; box-shadow: 0 10px 30px #0005; }
    .widget.left .keystrip { right: auto; left: -26px; }
    .widget.top .keystrip { bottom: auto; top: 36px; }
    .keystrip span { display: contents; }
    .keystrip kbd { justify-self: start; font: 600 10.5px/1 ui-monospace, monospace; color: #18181b; background: #f4f4f5; border: 1px solid #d4d4d8;
                    border-bottom-width: 2px; border-radius: 4px; padding: 3px 5px; }
    .keystrip .all { color: #71717a; }
    .more-list .label kbd { color: #71717a; border-color: #d4d4d8; background: #fafafa; }
    /* Clear all sits in the bar; armed (one more click clears) it turns red and keeps its label showing. */
    .act.clear:hover:not(:disabled) { background: #7f1d1d; } .act.clear.armed, .act.clear.armed:hover:not(:disabled) { background: #dc2626; color: #fff; } .act.clear.armed .label { opacity: 1; }
    .more-list .act.info.new { background: #dcfce7; color: #15803d; } .more-list .act.info.new svg { color: #15803d; }
    /* The comments list and messages share one column above the bar (below it near the top of the screen). */
    .dock { position: fixed; width: max-content; display: flex; flex-direction: column; gap: 8px; }
    .card, .toast { pointer-events: auto; box-shadow: 0 10px 30px #0005; }
    .toast { max-width: 340px; font-size: 13px; line-height: 1.45; } /* a message is a card, like the comments list */
    .card { background: #fff; color: #18181b; border-radius: 12px; padding: 12px; }
    .panel { width: 340px; max-height: 50vh; overflow: auto; padding: 6px; scrollbar-width: thin; scrollbar-color: #d4d4d8 transparent; }
    .panel::-webkit-scrollbar { width: 8px; } .panel::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px 6px; color: #71717a; font-size: 12px; }
    .panel ol { list-style: none; padding: 0; }
    .row-acts { display: flex; align-items: center; gap: 2px; }
    .one { border: 0; background: none; color: #a1a1aa; cursor: pointer; padding: 2px 4px; display: grid; place-items: center; font: 600 12px system-ui, sans-serif; }
    .one svg { width: 14px; height: 14px; } .one:hover { color: #2563eb; }
    .panel li { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: start; padding: 8px 6px; border-radius: 8px; cursor: pointer; }
    .panel li:hover { background: #f4f4f5; }
    /* Comments that came in through a shared link are purple: pins, numbers and a mild row background. */
    /* Comments from a shared link take their writer's colour (--who): pin, number, a mild row background, the box's chip. */
    .panel li.shared { background: color-mix(in srgb, var(--who) 9%, #fff); } .panel li.shared:hover { background: color-mix(in srgb, var(--who) 16%, #fff); }
    .shared .num, .pin.shared { background: var(--who); } .pin.shared:hover { filter: brightness(.88); }
    .by { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--who); background: color-mix(in srgb, var(--who) 12%, #fff); border-radius: 999px; padding: 1px 8px 1px 6px; }
    .by::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--who); }
    .name-bar input { border: 0; border-radius: 999px; padding: 4px 10px; width: 150px; font: 13px system-ui, sans-serif; color: #18181b; outline: none; }
    .num { width: 20px; height: 20px; border-radius: 50%; background: #ea580c; color: #fff; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px; }
    .txt { min-width: 0; } .txt small { display: block; color: #71717a; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .del { border: 0; background: none; color: #a1a1aa; cursor: pointer; font-size: 12px; padding: 0 4px; }
    .del { font-size: 16px; line-height: 20px; }
    .del:hover { color: #dc2626; }
    .empty { padding: 10px 6px; color: #71717a; }
    /* Wide enough for the hint and all four buttons (Delete, Copy, Cancel, Save) on one line; narrower only on a small screen. */
    .pop { position: fixed; width: min(380px, calc(100vw - 16px)); }
    /* The box names the pick in plain words; the technical details sit in a dark card beside it, behind a tab. */
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; min-width: 0; }
    /* A batch comment's box steps through its selections: ‹ 2/3 ›. */
    .nav { flex: none; display: inline-flex; align-items: center; gap: 2px; }
    .nav button { width: 22px; height: 22px; padding: 0; border: 1px solid #d4d4d8; border-radius: 6px; background: #fff; color: #18181b; cursor: pointer;
                  font: 600 14px/1 system-ui, sans-serif; display: grid; place-items: center; }
    .nav button:hover { background: #f4f4f5; }
    .nav span { min-width: 30px; text-align: center; font: 600 11px ui-monospace, monospace; color: #71717a; }
    .picked.cur { outline-style: solid; outline-width: 3px; background: #2563eb24; }
    .chip { flex: none; font: 700 10px ui-monospace, monospace; color: #2563eb; background: #2563eb14; border-radius: 4px; padding: 2px 5px; }
    .what { flex: 1; min-width: 0; font-weight: 600; color: #3f3f46; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .side-tab { position: absolute; left: 100%; top: 14px; display: grid; gap: 4px; justify-items: center; border: 0; cursor: pointer; padding: 8px 6px 8px 7px;
                background: #18181b; color: #a1a1aa; border-radius: 0 8px 8px 0; box-shadow: 0 8px 20px #0004; font: 11px ui-monospace, monospace; }
    .side-tab:hover { background: #27272a; color: #e4e4e7; }
    .side { display: none; position: absolute; left: calc(100% + 8px); top: 0; width: 250px; background: #18181b; color: #e4e4e7; border-radius: 10px;
            padding: 8px 12px 10px; box-shadow: 0 12px 32px #0006; font: 11px/1.75 ui-monospace, monospace; }
    .pop.details .side { display: block; } .pop.details .side-tab { display: none; }
    .pop.flip .side-tab { left: auto; right: 100%; border-radius: 8px 0 0 8px; } .pop.flip .side { left: auto; right: calc(100% + 8px); }
    .side .k { color: #a1a1aa; display: inline-block; width: 78px; }
    .side-head { display: flex; justify-content: space-between; width: 100%; border: 0; background: none; color: #a1a1aa; cursor: pointer; padding: 0; font: inherit; }
    .side-head:hover { color: #e4e4e7; }
    .side .sep { border-top: 1px solid #3f3f46; margin: 6px 0; }
    .side .selector { color: #d4d4d8; word-break: break-all; line-height: 1.4; }
    .copy-sel { border: 0; background: none; color: #93c5fd; cursor: pointer; padding: 0; margin-top: 4px; font: inherit; }
    .copy-sel:hover { text-decoration: underline; }
    .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 8px; vertical-align: -1px; box-shadow: 0 0 0 1px #0004, 0 0 0 2px #fff8; }
    textarea { width: 100%; min-height: 72px; border: 1px solid #d4d4d8; border-radius: 8px; padding: 8px; resize: vertical;
               background: #fff; color: #18181b; outline: none; }
    textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #2563eb33; }
    textarea::placeholder { color: #a1a1aa; }
    .row { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
    .hint { flex: 1; min-width: 0; color: #a1a1aa; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row button.b { flex: none; white-space: nowrap; } /* when space runs out the hint gives way, never a button */
    button.b { border: 1px solid #d4d4d8; background: #fff; color: #18181b; font-weight: 600; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
    button.b:hover { background: #f4f4f5; }
    button.b.primary { background: #ea580c; color: #fff; border-color: #ea580c; }
    button.b.primary:hover { background: #c2410c; border-color: #c2410c; }
    button.b.danger { color: #dc2626; }
    /* Shift+click selections, and the keyboard shortcuts card. */
    .picked { position: fixed; pointer-events: none; outline: 2px dashed #2563eb; outline-offset: 1px; background: #2563eb12; border-radius: 2px; }
    /* Each selected box has its own remove button: a dragged area cannot be clicked off like an element. */
    .picked .x { position: absolute; top: -11px; right: -11px; width: 20px; height: 20px; padding: 0; border: 2px solid #fff; border-radius: 50%;
                 background: #2563eb; color: #fff; display: grid; place-items: center; cursor: pointer; pointer-events: auto; box-shadow: 0 2px 6px #0005; }
    .picked .x:hover { background: #dc2626; }
    .picked .x svg { width: 10px; height: 10px; stroke-width: 3; }
    .keys { position: fixed; left: 50%; bottom: 24px; translate: -50% 0; pointer-events: auto; background: #18181b; color: #e4e4e7; border-radius: 12px;
            padding: 12px 16px; box-shadow: 0 12px 32px #0006; display: grid; grid-template-columns: auto auto; gap: 4px 18px; font-size: 12px; }
    .keys b { grid-column: 1 / -1; font-size: 13px; margin-bottom: 4px; }
    .keys kbd { font: 11px ui-monospace, monospace; background: #27272a; border: 1px solid #3f3f46; border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; color: #fff; }
    /* Our right-click menu. */
    .menu { position: fixed; pointer-events: auto; min-width: 230px; background: #18181b; color: #e4e4e7; border-radius: 10px; padding: 6px; box-shadow: 0 12px 32px #0006; }
    .mh { display: flex; align-items: center; gap: 8px; padding: 4px 6px 8px; font: 11px ui-monospace, monospace; color: #a1a1aa; }
    .mh .t { background: #2563eb; color: #fff; padding: 3px 6px; border-radius: 5px; font-weight: 700; }
    .mi { display: flex; justify-content: space-between; gap: 16px; width: 100%; border: 0; background: none; color: #e4e4e7; padding: 7px 8px; border-radius: 6px; cursor: pointer; text-align: left; }
    .mi:hover { background: #2563eb; color: #fff; }
    .mk { color: #71717a; font: 11px ui-monospace, monospace; } .mi:hover .mk { color: #dbeafe; }
    .menu hr { border: 0; border-top: 1px solid #3f3f46; margin: 4px 2px; }
    /* Freeze: the picture of the screen at the moment of freezing, shown over the page. */
    .freeze-layer { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
    .freeze-layer canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .freeze-bar { position: absolute; left: 50%; top: 10px; translate: -50% 0; display: flex; gap: 10px; align-items: center; background: #0284c7; color: #fff;
                  padding: 6px 6px 6px 14px; border-radius: 999px; font-weight: 600; box-shadow: 0 6px 18px #0005; cursor: default; white-space: nowrap; }
    .freeze-bar button { border: 0; background: #fff; color: #0369a1; font-weight: 700; border-radius: 999px; padding: 4px 12px; cursor: pointer; }
    .pick-bar { position: fixed; top: auto; bottom: 18px; pointer-events: auto; background: #2563eb; } .pick-bar button { color: #1d4ed8; }
    .pick-bar button:disabled { opacity: .5; cursor: default; }
    .act.freeze.active { background: #0284c7; color: #fff; }
    /* Area mode: a crosshair layer over the page, and the dashed box being dragged (kept while its comment is open). */
    .area-layer { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
    .area-box { position: fixed; pointer-events: none; border: 2px dashed #2563eb; background: #2563eb14; border-radius: 2px; }
    .act.area.active { background: #2563eb; color: #fff; }
    .snap { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: #3f3f46; font-size: 12px; cursor: pointer; user-select: none; }
    /* Our own checkbox: the native one looks different on every site and system. */
    .snap input { appearance: none; margin: 0; flex: none; width: 16px; height: 16px; border: 1.5px solid #a1a1aa; border-radius: 5px; background: #fff;
                  display: grid; place-content: center; cursor: pointer; transition: background .15s, border-color .15s; }
    .snap input::before { content: ''; width: 10px; height: 10px; background: #fff; transform: scale(0); transition: transform .12s;
                          clip-path: polygon(14% 44%, 0 62%, 42% 100%, 100% 18%, 84% 4%, 40% 66%); }
    .snap:hover input { border-color: #2563eb; }
    .snap input:checked { background: #2563eb; border-color: #2563eb; }
    .snap input:checked::before { transform: scale(1); }
    .snap input:focus-visible { outline: 2px solid #2563eb66; outline-offset: 2px; }
    .snap { width: fit-content; } /* only the tick and its words, so the row around it stays free to hover */
    .snap.off { cursor: default; } .snap.off > input, .snap.off > span:not(.shot-q) { opacity: .55; } .snap.off input { cursor: not-allowed; }
    .shot-q { width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; cursor: help; flex: none; outline: none;
              background: #e4e4e7; color: #3f3f46; font: 700 10px/1 system-ui, sans-serif; }
    .shot-q:hover, .shot-q:focus-visible { background: #18181b; color: #fff; }
    /* Why Add screenshot is off: a dark card under the comment box (over it when the box is at the bottom of the screen),
       so it never covers the text. It opens from the ? only, and stays a moment after the pointer leaves, so the pointer
       can reach it to select the chrome://flags address. */
    .shot-tip { position: absolute; left: 0; top: calc(100% + 8px); width: 100%; box-sizing: border-box; background: #18181b;
                color: #e4e4e7; font: 400 12px/1.5 system-ui, sans-serif; padding: 10px 12px; border-radius: 10px; user-select: text;
                box-shadow: 0 8px 24px #0005; opacity: 0; visibility: hidden; transition: opacity .15s .3s, visibility 0s .45s; }
    .shot-tip::before { content: ''; position: absolute; left: 0; right: 0; bottom: 100%; height: 8px; } /* bridges the gap */
    .pop.tip-up .shot-tip { top: auto; bottom: calc(100% + 8px); } .pop.tip-up .shot-tip::before { bottom: auto; top: 100%; }
    .pop:has(.shot-q:hover, .shot-q:focus-visible, .shot-tip:hover) .shot-tip { opacity: 1; visibility: visible; transition-delay: 0s; }
    .shot-tip b { display: block; color: #fff; font-weight: 600; margin-bottom: 2px; }
    .shot-tip p { margin: 6px 0 0; } .shot-tip ol { margin: 4px 0 0; padding-left: 18px; }
    .shot-tip code { font: 11px ui-monospace, monospace; color: #fff; background: #3f3f46; border-radius: 4px; padding: 1px 4px; overflow-wrap: anywhere; }
    button.b:disabled, button.b:disabled:hover { background: #f4f4f5; color: #a1a1aa; border-color: #f4f4f5; cursor: not-allowed; }
  `);
  root.adoptedStyleSheets = [sheet];

  const h = (tag, props, ...kids) => {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...kids);
    return el;
  };
  const btn = (textContent, className = '', title = '') => h('button', { textContent, className, title });

  const pill = h('div', { className: 'pill' }), more = h('div', { className: 'more' });
  const hl = h('div', { className: 'hl', hidden: true }, pill, more);
  const pins = h('div');
  const kindEl = h('span', { className: 'chip' }), nameEl = h('span', { className: 'what' }), byEl = h('span', { className: 'by', hidden: true });
  const navPrev = btn('‹', '', 'Previous selection'), navNext = btn('›', '', 'Next selection'), navPos = h('span');
  const navEl = h('span', { className: 'nav', hidden: true }, navPrev, navPos, navNext);
  const sideTab = h('button', { className: 'side-tab', title: 'Details: colours, font, spacing, selector (D)' });
  const sideHead = h('button', { className: 'side-head' }, h('span', { textContent: 'details' }), h('span', { textContent: '‹' }));
  const sideBody = h('div'), selectorEl = h('div', { className: 'selector' }), copySelBtn = btn('copy selector', 'copy-sel');
  const side = h('div', { className: 'side' }, sideHead, sideBody, h('div', { className: 'sep' }), selectorEl, copySelBtn);
  const textarea = h('textarea', { placeholder: 'What should change here?' });
  const deleteBtn = btn('Delete', 'b danger'), cancelBtn = btn('Cancel', 'b'), saveBtn = btn('Save', 'b primary');
  const boxCopyBtn = btn('Copy', 'b', 'Copy this comment as it is now, with a picture if Add screenshot is ticked, without saving it');
  const shotBox = h('input', { type: 'checkbox' });
  const shotLabel = h('label', { className: 'snap' }, shotBox, h('span', { textContent: 'Add screenshot' }));
  // Where the platform cannot take pictures (the bookmark on a plain-http page that is not localhost: browsers keep
  // screen capture for secure pages), the tick is off and says why, and how to allow it.
  const canShoot = platform.capture.available !== false;
  let shotTip = null;
  if (!canShoot) {
    shotBox.disabled = true;
    shotLabel.classList.add('off');
    const code = (t) => h('code', { textContent: t });
    shotTip = h('div', { className: 'shot-tip', id: 'shot-tip', role: 'tooltip' },
      h('b', { textContent: 'No pictures on this page' }),
      'It is plain http, and browsers allow screen capture only on https or localhost pages.',
      h('p', { textContent: 'To allow it in Chrome:' }),
      h('ol', {}, h('li', {}, 'Open ', code('chrome://flags/#unsafely-treat-insecure-origin-as-secure')),
        h('li', {}, 'Add ', code(location.origin), ', choose Enabled and relaunch.')),
      h('p', { textContent: 'Or open your site as localhost or name.localhost, or use the page-comments extension.' }));
    // A span, not a button: a button inside the label would be a second control for it.
    const q = h('span', { className: 'shot-q', textContent: '?', tabIndex: 0, ariaLabel: 'Why no pictures?' });
    q.setAttribute('aria-describedby', 'shot-tip');
    shotLabel.append(q);
    shotBox.setAttribute('aria-describedby', 'shot-tip');
    shotBox.ariaLabel = 'Add screenshot'; // else its name takes in the ? too
    // Under the box when it fits on the screen, else over it.
    const aim = () => pop.classList.toggle('tip-up', pop.getBoundingClientRect().bottom + shotTip.offsetHeight + 16 > innerHeight);
    q.addEventListener('pointerenter', aim);
    q.addEventListener('focus', aim);
  }
  const pop = h('div', { className: 'card pop', hidden: true }, h('div', { className: 'head' }, kindEl, nameEl, byEl, navEl), textarea, shotLabel,
    h('div', { className: 'row' }, h('span', { className: 'hint', textContent: 'Enter saves' }), deleteBtn, boxCopyBtn, cancelBtn, saveBtn), sideTab, side, shotTip ?? '');
  const toastEl = h('div', { className: 'card toast', hidden: true });
  const list = h('ol');
  // Jira and Confluence take text and pictures only in two pastes (tested): these copy one or the other.
  const textBtn = h('button', { className: 'one', textContent: 'Copy text', title: 'Only the text, no pictures: for Jira and Confluence' });
  const picsBtn = h('button', { className: 'one', textContent: 'Copy pictures', title: 'Only the pictures: paste them after the text' });
  const filesBtn = h('button', { className: 'one', textContent: 'Save pictures', title: 'Each picture as its own file, to drag into Slack together' });
  const panel = h('div', { className: 'card panel', hidden: true }, h('div', { className: 'panel-head' }, h('span', { textContent: 'Comments' }),
    h('span', { className: 'row-acts' }, textBtn, picsBtn, filesBtn)), list);
  // Icons, built with DOM calls like the rest (no innerHTML).
  const svg = (tag, attrs, ...kids) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.append(...kids);
    return el;
  };
  const ICONS = {
    // The page-comments icon (icons/icon.svg) as an outline: a comment bubble with a cursor in it.
    comment: [['path', { d: 'M3 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-5 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'stroke-width': 1.8 }], ['path', { d: 'M7.4 5.2L12.16 17.44L13.86 12.51L18.79 10.81Z', fill: 'currentColor', stroke: 'none' }]],
    browse: [['path', { d: 'M5 3l6.5 17 2.3-7.2L21 10.5z' }]],
    list: [['path', { d: 'M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01' }]],
    copy: [['rect', { x: 9, y: 9, width: 12, height: 12, rx: 2 }], ['path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }]],
    send: [['path', { d: 'M22 2L11 13M22 2l-7 20-4-9-9-4z' }]],
    clear: [['path', { d: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14' }]],
    info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6M12 7.5v.5' }]],
    close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    dots: [['circle', { cx: 5, cy: 12, r: 1.5, fill: 'currentColor' }], ['circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }], ['circle', { cx: 19, cy: 12, r: 1.5, fill: 'currentColor' }]],
    details: [['path', { d: 'M4 7h16M4 12h10M4 17h7' }]],
    shortcuts: [['rect', { x: 2, y: 6, width: 20, height: 12, rx: 2 }], ['path', { d: 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10' }]],
    area: [['path', { d: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4' }], ['rect', { x: 9, y: 9, width: 6, height: 6, rx: 1 }]],
    share: [['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]],
    batch: [['rect', { x: 3, y: 3, width: 8, height: 8, rx: 1.5 }], ['rect', { x: 13, y: 3, width: 8, height: 8, rx: 1.5 }], ['rect', { x: 3, y: 13, width: 8, height: 8, rx: 1.5 }], ['path', { d: 'M17 13v8M13 17h8' }]],
    freeze: [['path', { d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2' }]],
  };
  const icon = (name) => svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    ...ICONS[name].map(([tag, attrs]) => svg(tag, attrs)));

  const badge = h('span', { className: 'badge', hidden: true });
  const updateDot = h('span', { className: 'dot', hidden: true });
  const mainTip = h('span', { className: 'label' });
  const main = h('button', { className: 'main' }, icon('comment'), badge, updateDot, mainTip);
  // One action in the bar (or the ⋯ list): its button (or link) carries an icon and a label.
  // The keyboard key of an action shows in its tooltip, after the name (which flash() and others change).
  const ACT_KEYS = { area: 'A', batch: 'B', freeze: 'F', list: 'L', copy: 'C', share: 'S', details: 'D', shortcuts: '?' };
  const action = (name, label, tag = 'button', props = {}) => {
    const labelEl = h('span', { textContent: label });
    const el = h(tag, { className: 'act ' + name, ariaLabel: label + (ACT_KEYS[name] ? ` (${ACT_KEYS[name]})` : ''), ...props }, icon(name),
      h('span', { className: 'label' }, labelEl, ...(ACT_KEYS[name] ? [h('kbd', { textContent: ACT_KEYS[name] })] : [])));
    el.labelEl = labelEl;
    el.baseLabel = label;
    return el;
  };
  // Alt is Option (⌥) on a Mac: name the keys the way the keyboard prints them.
  const ALT_SHIFT = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥⇧' : 'Alt+Shift+';
  const FREEZE_LABEL = 'Freeze: 3 s to open a menu first';
  const listBtn = action('list', 'Comments'), copyBtn = action('copy', 'Copy'), sendBtn = action('send', 'Send to Claude', 'button', { hidden: true });
  const clearBtn = action('clear', 'Clear all'), closeBtn = action('close', 'Close'), areaBtn = action('area', 'Select an area'), freezeBtn = action('freeze', FREEZE_LABEL);
  const batchBtn = action('batch', 'Select several'), shareBtn = action('share', 'Share link');
  const infoLink = action('info', (fromGithub ? 'Help & install on GitHub · v' : 'Help & install page · v') + VERSION, 'a', { href: fromGithub ? GITHUB + '#-three-ways-to-use-it' : SITE, target: '_blank', rel: 'noopener noreferrer' });
  const detailsAct = action('details', 'Details: colours, font, spacing'), keysAct = action('shortcuts', 'Keyboard shortcuts'), moreBtn = action('dots', 'More');
  // A mode that is on shows its name; the comments action shows the count.
  areaBtn.append(h('span', { className: 'ontxt', textContent: 'Area' }));
  batchBtn.append(h('span', { className: 'ontxt', textContent: 'Batch' }));
  freezeBtn.append(h('span', { className: 'ontxt', textContent: 'Frozen' }));
  const listCnt = h('span', { className: 'cnt', hidden: true });
  listBtn.append(listCnt);
  const sep = () => h('i', { className: 'sep' });
  const moreList = h('div', { className: 'more-list' }, h('div', { className: 'grp', textContent: 'More' }), detailsAct, keysAct, infoLink,
    closeBtn);
  const items = h('div', { className: 'items' }, areaBtn, batchBtn, freezeBtn, sep(), clearBtn, listBtn, copyBtn, shareBtn, sendBtn, sep(), moreBtn);
  const keyStrip = h('div', { className: 'keystrip', hidden: true },
    ...[['B', 'batch'], ['A', 'area'], ['F', 'freeze'], [ALT_SHIFT + 'C', 'browse'], ['?', 'all keys']].map(([k, what]) => h('span', { className: k === '?' ? 'all' : '' }, h('kbd', { textContent: k }), what)));
  // Close in one click: a small × on the round button's outer side, away from the bar, while the bar is open.
  const quickClose = h('button', { className: 'quick-close', ariaLabel: 'Close page-comments' }, svg('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' }, svg('path', { d: 'M2 2l8 8M10 2l-8 8' })));
  const widget = h('div', { className: 'widget' }, moreList, keyStrip, quickClose, h('div', { className: 'bar' }, items, main));
  const dock = h('div', { className: 'dock' }, panel, toastEl);
  const areaLayer = h('div', { className: 'area-layer', hidden: true });
  const areaBox = h('div', { className: 'area-box', hidden: true });
  const menu = h('div', { className: 'menu', hidden: true });
  const unfreezeBtn = h('button', { textContent: 'Unfreeze' });
  const freezeLayer = h('div', { className: 'freeze-layer', hidden: true },
    h('div', { className: 'freeze-bar' }, 'Frozen: click or drag to comment, right-click for options, Esc to unfreeze', unfreezeBtn));
  const pickedBoxes = h('div'), shownBoxes = h('div');
  const pickCount = h('span'), pickComment = h('button', { textContent: 'Comment' }), pickClear = h('button', { textContent: 'Clear' });
  const pickBar = h('div', { className: 'freeze-bar pick-bar', hidden: true }, pickCount, pickComment, pickClear);
  const KEYS = [['↑ / ↓', 'parent / inner element'], ['Enter', 'comment on the highlighted element'], ['B', 'batch: click to select several (A: drag areas), then comment'],
    ['Shift+click', 'start a batch with this element'], ['A', 'select an area'], ['F', 'freeze or unfreeze'], ['D', 'details on / off: colours, font, spacing'], ['C', 'copy all comments'], ['S', 'share link (Shift+S: change your name)'], ['L', 'comments list'],
    ['Esc', 'back out'], [ALT_SHIFT + 'F', 'freeze, in any mode'], [ALT_SHIFT + 'C', 'commenting / browsing, in any mode'], ['?', 'this card']];
  const keysCard = h('div', { className: 'keys', hidden: true }, h('b', { textContent: 'Keyboard shortcuts (while commenting)' }),
    ...KEYS.flatMap(([k, what]) => [h('span', {}, ...k.split(' / ').flatMap((x, i) => [i ? ' / ' : '', h('kbd', { textContent: x })])), h('span', { textContent: what })]));
  // The key strip shows only while commenting with nothing else of ours open: one check, run whenever anything of ours
  // shows, hides or changes state, so no single place that opens something has to remember the strip.
  // Two rules about what is open, checked whenever anything of ours shows, hides or changes state, so no single place
  // that opens something has to remember them:
  // - a message that was already showing closes when another popup opens (it is about what was on screen before);
  // - the key strip shows only while commenting with nothing else of ours open.
  let openBefore = [], toastBefore = false;
  const syncOpen = () => {
    const open = [!panel.hidden, !pop.hidden, !menu.hidden, !keysCard.hidden, widget.classList.contains('listopen')];
    if (toastBefore && open.some((on, i) => on && !openBefore[i])) toastEl.hidden = true;
    openBefore = open;
    toastBefore = !toastEl.hidden;
    const hide = !(main.classList.contains('on') && pop.hidden && menu.hidden && panel.hidden && toastEl.hidden && !widget.classList.contains('open'));
    if (keyStrip.hidden !== hide) keyStrip.hidden = hide; // an unchanged write would still wake the observer, forever
  };
  new MutationObserver(syncOpen).observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  // Any click in the bar also closes an older message; capture phase, so a message the clicked action shows stays.
  widget.addEventListener('click', () => { toastEl.hidden = true; }, true);
  root.append(freezeLayer, hl, shownBoxes, areaLayer, areaBox, pickedBoxes, pins, pickBar, pop, dock, menu, keysCard, widget);
  document.documentElement.appendChild(host);

  // Every comment remembers its page; the toolbar, list, pins, Copy, Send and Clear only see the current page's.
  // The page is the URL without its #hash, so in-page anchor links do not hide the comments.
  const pageOf = () => location.href.split('#')[0];
  const here = () => comments.filter((c) => c.page === pageOf());

  // Comments are saved in the site's localStorage so a reload keeps them; elements are found again by selector.
  const KEY = 'page-comments:v1';
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // Comments saved before screenshots existed have no id; give them one.
  const load = () => {
    try {
      return (JSON.parse(localStorage.getItem(KEY)) || []).map((c) => ({ id: newId(), ...c }));
    } catch {
      return [];
    }
  };
  let comments = load(), saveFailed = false;
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(comments, (k, v) => (k === 'el' ? undefined : v)));
      saveFailed = false;
    } catch (err) {
      // Say it once, so the user knows a reload would lose these comments.
      if (!saveFailed) toast('Could not save comments in this site (' + err.message + '). A reload will lose them.');
      saveFailed = true;
    }
  };
  // The page inside the frames a selector names before its last ' >>> ' (the top page when none); throws when one of
  // them is gone or of another origin now.
  const docIn = (frames) => frames.reduce((doc, s) => doc.querySelector(s).contentDocument, document);
  const find = (selector) => {
    try {
      const frames = selector.split(FRAME_SEP), own = frames.pop();
      return docIn(frames).querySelector(own);
    } catch {
      return null;
    }
  };
  // The iframe a frame's page sits in; null for the top page.
  const frameOf = (doc) => (doc !== document && doc.defaultView?.frameElement) || null;
  // Where a frame's page starts in the top page's coordinates: each frame's box, plus its border and padding.
  // shortcut: a CSS transform or zoom on an iframe is not counted; count it when a page that has one needs it.
  const offsetOf = (doc) => {
    let x = 0, y = 0;
    for (let f; (f = frameOf(doc)); doc = f.ownerDocument) {
      const r = f.getBoundingClientRect(), cs = getComputedStyle(f);
      x += r.left + f.clientLeft + parseFloat(cs.paddingLeft);
      y += r.top + f.clientTop + parseFloat(cs.paddingTop);
    }
    return { x, y };
  };
  // An element's box in the top page's coordinates, where the tool draws (inside a frame, its own box counts from the frame).
  const rectOf = (el) => {
    const r = el.getBoundingClientRect(), o = offsetOf(el.ownerDocument);
    return new DOMRect(r.x + o.x, r.y + o.y, r.width, r.height);
  };
  // A pointer event's spot in the top page's coordinates.
  const pointOf = (e) => { const o = offsetOf(e.target.ownerDocument || e.target); return { x: e.clientX + o.x, y: e.clientY + o.y }; };
  // The element's parent: from a frame's <body> out to its iframe; null past the top page's <body>.
  const up = (el) => { const p = el.parentElement; return p && p !== p.ownerDocument.documentElement ? p : frameOf(el.ownerDocument); };
  const holds = (a, el) => { for (; el; el = up(el)) if (el === a) return true; return false; };
  // An element of a frame's earlier page still counts as connected (to that page): it must also still be shown.
  const elOf = (c) => (c.el?.isConnected && c.el.ownerDocument.defaultView ? c.el : (c.el = find(c.selector)));

  // Screenshots are opt-in per comment; platform.capture takes them (see the top of this file).
  const SHOT_KEY = 'page-comments:shot'; // the Add screenshot tick, remembered per site
  // What a screenshot shows: an element plus a margin (24 px, 8 px for each of several picked elements), or a dragged area plus 8 px.
  const shotRect = (el, area, m = 24) => {
    const r = rectOf(el);
    if (area) return { left: r.left + area.dx - 8, top: r.top + area.dy - 8, right: r.left + area.dx + area.w + 8, bottom: r.top + area.dy + area.h + 8 };
    return { left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m };
  };
  // Scrolls until the rectangle a picture shows is on screen: centred, or from its top when taller than the screen.
  // The element first, for scroll boxes inside the page; then the rectangle itself, since an area's anchor element can
  // be a page-tall container that already counts as in view while the area is not. Instant, so a page with
  // scroll-behavior: smooth is not still moving when the picture is taken.
  const showRect = (el, rect) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const r = rect(), by = (lo, hi, size) => (lo >= 0 && hi <= size ? 0 : hi - lo > size ? lo : lo - (size - (hi - lo)) / 2);
    const dx = by(r.left, r.right, innerWidth), dy = by(r.top, r.bottom, innerHeight);
    if (dx || dy) scrollBy({ left: dx, top: dy, behavior: 'instant' });
  };
  const scrollBack = (x, y) => scrollTo({ left: x, top: y, behavior: 'instant' });
  // Cuts rectangle r (CSS px, on screen) out of a picture of the screen (k image pixels per CSS pixel).
  const crop = async (source, k, r) => {
    const out = Math.min(k, 2), x = Math.max(0, r.left), y = Math.max(0, r.top);
    const w = Math.min(innerWidth, r.right) - x, ht = Math.min(innerHeight, r.bottom) - y;
    if (w <= 0 || ht <= 0) throw new Error('it is not on the screen');
    // Whole source pixels: a crop that starts between two pixels is resampled, which smears thin text and pales its
    // colour. Up to 2 image pixels per CSS pixel the picture is copied pixel for pixel; above that it is scaled down.
    const sx = Math.round(x * k), sy = Math.round(y * k), sw = Math.round(w * k), sh = Math.round(ht * k), scale = out / k;
    const canvas = h('canvas', { width: Math.round(sw * scale), height: Math.round(sh * scale) });
    canvas.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, platform.pictureType || 'image/webp', 0.9));
    return { blob, width: Math.round(w) };
  };
  // Hides the tool, waits until the captured picture no longer shows it, and crops to the rectangle (in CSS px).
  // At most 2 image pixels per CSS pixel; stored as platform.pictureType (WebP by default: a fraction of a PNG's size).
  const shoot = async (rect) => {
    if (!platform.capture.ready()) await platform.capture.start();
    // Only the page belongs in the picture: not the tool, not a text-selection highlight, not a focus outline.
    host.style.visibility = 'hidden';
    for (const doc of [document, ...linked.keys()]) doc.getSelection()?.removeAllRanges();
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== host) document.activeElement.blur();
    try {
      await new Promise(requestAnimationFrame); // the hidden tool reaches the screen
      const { source, k } = await platform.capture.grab();
      return await crop(source, k, rect());
    } finally {
      host.style.visibility = '';
    }
  };
  // Pictures are too big for localStorage, so they live in the site's IndexedDB, keyed by comment id: one picture as a
  // Blob, or several (one per Shift+clicked element) as a list of { blob, width }.
  const db = new Promise((ok, fail) => {
    const req = indexedDB.open('page-comments', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shots');
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
  db.catch(() => {}); // reported when a screenshot is saved, not here
  const shots = async (mode, run) => {
    const store = (await db).transaction('shots', mode).objectStore('shots');
    return new Promise((ok, fail) => { const req = run(store); req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); });
  };
  const putShot = (id, blob) => shots('readwrite', (st) => st.put(blob, id));
  const dropShot = (id) => shots('readwrite', (st) => st.delete(id)).catch(() => {});
  // This page's screenshots as a Map from comment to its list of { blob, width }; a comment whose pictures have gone
  // (site data cleared) loses its mark.
  const pageShots = async () => {
    const found = new Map();
    for (const c of here()) {
      if (!c.shot) continue;
      const v = await shots('readonly', (st) => st.get(c.id)).catch(() => null);
      if (v) found.set(c, Array.isArray(v) ? v : [{ blob: v, width: c.shotWidth }]);
      else c.shot = false;
    }
    return found;
  };
  // Several pictures of one comment are told apart by a letter: 2a, 2b, 2c.
  const tagOf = (pics, k) => (pics.length < 2 ? '' : k < 26 ? String.fromCharCode(97 + k) : '-' + (k + 1));
  // Comments with their number on this page; `only` narrows to some of them and keeps their numbers.
  const numbered = (only) => here().map((c, i) => ({ c, n: i + 1 })).filter((x) => !only || only.includes(x.c));
  // Browsers give the clipboard API only to secure pages (https, localhost). On a plain-http page (an internal tool, a
  // staging server, a .test dev site) it is missing, so copy through the older copy command there: it carries text and
  // HTML (pictures ride inside the HTML), but no picture file: Slack, which wants the file, gets nothing to paste.
  const writeClipboard = async ({ text, html, png }) => {
    if (navigator.clipboard) {
      if (!html && !png) return navigator.clipboard.writeText(text);
      const parts = {};
      if (text != null) parts['text/plain'] = new Blob([text], { type: 'text/plain' });
      if (html) parts['text/html'] = new Blob([html], { type: 'text/html' });
      if (png) parts['image/png'] = png;
      return navigator.clipboard.write([new ClipboardItem(parts)]);
    }
    // A picture alone rides as HTML, which rich editors (Docs, email) paste as a picture.
    if (text == null) [text, html] = ['', `<img src="${await dataUrl(png)}" alt="">`];
    const put = (e) => {
      e.preventDefault();
      e.clipboardData.setData('text/plain', text);
      if (html) e.clipboardData.setData('text/html', html);
    };
    document.addEventListener('copy', put, true);
    try {
      if (!document.execCommand('copy')) throw new Error('the browser refused to copy here');
    } finally {
      document.removeEventListener('copy', put, true);
    }
  };
  const dataUrl = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  // A screenshot with a dark band on top saying "2 · <comment>", so a picture still says which comment it belongs to
  // wherever it ends up (Slack, for one, shows all pictures after the text). numberOnly: just "2", for a rich-text paste,
  // where the comment's text sits right above its picture. Returned as a canvas.
  const captioned = async ({ c, n }, { blob, width: cssWidth }, tag = '', numberOnly = false) => {
    const pic = await createImageBitmap(blob), k = cssWidth ? pic.width / cssWidth : 1, band = Math.round(28 * k);
    const width = Math.max(pic.width, Math.round(240 * k));
    const canvas = h('canvas', { width, height: band + pic.height });
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, width, canvas.height);
    g.fillStyle = '#18181b';
    g.fillRect(0, 0, width, band);
    g.fillStyle = '#ffffff';
    g.font = `600 ${Math.round(13 * k)}px system-ui, sans-serif`;
    let label = numberOnly ? `${n}${tag}` : `${n}${tag} · ${c.comment}`;
    while (label.length > 4 && g.measureText(label).width > width - 20 * k) label = label.slice(0, -2) + '…';
    g.fillText(label, 10 * k, band * 0.68);
    g.drawImage(pic, 0, band);
    return canvas;
  };
  // PNG is the one picture type every editor accepts, and the only one Chrome lets a page put on the clipboard.
  const png = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  // All the captioned screenshots stacked into one image: the clipboard holds a single picture.
  const contactSheet = async (items, found) => {
    const parts = await Promise.all(items.flatMap((x) => (found.get(x.c) || []).map((p, k, all) => captioned(x, p, tagOf(all, k)))));
    const canvas = h('canvas', { width: Math.max(...parts.map((p) => p.width)), height: parts.reduce((sum, p) => sum + p.height + 8, 0) });
    const g = canvas.getContext('2d');
    let top = 0;
    for (const p of parts) { g.drawImage(p, 0, top); top += p.height + 8; }
    return png(canvas);
  };
  let commenting = false, draft = null, toastTimer = 0, frame = 0, clearTimer = 0, page = pageOf();
  let dodge = null; // where the round button waits while an open comment box would cover it (see dodgeBox)

  // Short CSS path: stops at the nearest id, nth-of-type only where siblings share a tag.
  const selectorOf = (el) => {
    const parts = [], doc = el.ownerDocument, frame = frameOf(doc);
    for (; el && el.nodeType === 1 && el !== doc.documentElement; el = el.parentElement) {
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      let part = el.tagName.toLowerCase();
      const same = el.parentElement ? [...el.parentElement.children].filter((c) => c.tagName === el.tagName) : [];
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
      parts.unshift(part);
    }
    return (frame ? selectorOf(frame) + FRAME_SEP : '') + parts.join(' > ');
  };
  // The words an element shows. innerText follows the layout, but for an element that is not rendered right now (a menu
  // that closed after a freeze) it falls back to textContent, which runs block children together ("Offline syncKeeps
  // working"); join its text pieces with spaces instead.
  const textOf = (el) => {
    if (el.getClientRects().length) return el.innerText;
    const words = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const t = walk.currentNode.data.trim();
      if (t && !/^(SCRIPT|STYLE|TEMPLATE)$/.test(walk.currentNode.parentNode.nodeName)) words.push(t);
    }
    return words.join(' ');
  };
  const clip = (s, n) => (s = (s || '').replace(/\s+/g, ' ').trim()).length > n ? s.slice(0, n) + '…' : s;
  // What a person would call the pick: a count, the selected words, or the element's own text or label.
  // Readers of the box, the list and pasted tickets get this; the selector stays for Claude.
  const pickOf = (d) => {
    if (d.group) return { kind: 'group', name: `${d.items.length} elements selected` };
    if (d.area) return { kind: 'region', name: `${d.items.length} element${d.items.length === 1 ? '' : 's'}` };
    if (d.selectedText) return { kind: 'text', name: `“${clip(d.selectedText, 60)}”` };
    const el = d.el, kind = el ? el.tagName.toLowerCase() : ((d.html || '').match(/^<([\w-]+)/) || [, 'element'])[1];
    const label = clip(el ? textOf(el) || ['aria-label', 'alt', 'title', 'placeholder'].map((a) => el.getAttribute(a)).find(Boolean) : d.text, 60);
    return { kind, name: label ? `“${label}”` : kind };
  };
  // SVG elements have a non-string className.
  const labelOf = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');

  // What the tool tells about an element, shown while pointing and passed on to Claude: size, background and text
  // colour, font, padding, corner radius, and text contrast. A transparent element shows what is behind it, so the
  // background comes from the nearest ancestor that has one (white if none).
  const hex = (rgb) => '#' + (rgb.match(/[\d.]+/g) || []).map((v, i) => (i < 3 ? +v : Math.round(v * 255)).toString(16).padStart(2, '0'))
    .join('').replace(/^(.{6})ff$/, '$1');
  // `seen` (optional) caches answers per element, for inspecting many elements at once (Freeze). A frame's page without a
  // background of its own shows the page around the frame, so the walk goes on out through the iframe.
  const backgroundOf = (el, seen) => {
    const walked = [], done = (v) => { walked.forEach((w) => seen?.set(w, v)); return v; };
    for (let e = el; e && e.nodeType === 1; e = e.parentElement || frameOf(e.ownerDocument)) {
      if (seen?.has(e)) return done(seen.get(e));
      walked.push(e);
      const c = getComputedStyle(e).backgroundColor;
      if (c !== 'transparent' && !/,\s*0\)$/.test(c)) return done(hex(c));
    }
    return done('#ffffff');
  };
  // WCAG contrast of two colours (their alpha is ignored).
  const luminance = (h6) => [1, 3, 5].map((i) => parseInt(h6.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // "10" when all sides match, "10 12" for top/bottom and left/right, else all four.
  const sides = (v) => (v.every((x) => x === v[0]) ? v[0] : v[0] === v[2] && v[1] === v[3] ? `${v[0]} ${v[1]}` : v.join(' '));
  const inspect = (el, seen) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), px = (v) => String(Math.round(parseFloat(v) || 0));
    const background = backgroundOf(el, seen), color = hex(cs.color), size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
    const ratio = contrast(color, background), large = size >= 24 || (size >= 18.66 && weight >= 700);
    return {
      label: labelOf(el), size: `${Math.round(r.width)}×${Math.round(r.height)}`, background, color,
      font: `${px(cs.fontSize)}px ${weight} ${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()}`,
      padding: sides([cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px)),
      radius: sides([cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px)),
      contrast: `${ratio.toFixed(1)} ${ratio >= (large ? 3 : 4.5) ? '✓' : '✗'}`,
    };
  };
  const aa = (i) => h('span', { className: 'aa', textContent: 'Aa', style: `background:${i.background};color:${i.color}` });
  const swatch = (c) => h('span', { className: 'sw', style: `background:${c}` });
  const detail = (k, ...v) => h('div', {}, h('span', { className: 'k', textContent: k }), ...v);
  const details = (i) => [detail('background', swatch(i.background), i.background), detail('text', swatch(i.color), i.color), detail('font', i.font),
    detail('padding', i.padding), detail('radius', i.radius), detail('contrast', h('span', { className: i.contrast.endsWith('✓') ? 'ok' : 'bad', textContent: i.contrast }))];
  // The outline, pill and (with details on) details card for an element at rectangle r.
  let hlLast = null; // the highlight's last element box and facts, to lay it out again when the details switch
  const showHighlight = (r, i) => {
    hlLast = [r, i];
    Object.assign(hl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    pill.replaceChildren(h('span', { className: 't', textContent: i.label }), i.size.replace('×', ' × '), aa(i), h('span', { className: 'dim', textContent: i.background }), h('kbd', { textContent: 'D' }));
    more.replaceChildren(...details(i));
    hl.classList.toggle('below', r.top < (detailsOn ? 170 : 34));
    hl.hidden = false;
    // Keep the pill and the details on screen at the right edge, each by its own width (the details are often wider).
    for (const el of [pill, more]) el.style.left = Math.min(-2, innerWidth - 8 - r.left - el.offsetWidth) + 'px';
  };

  // What Copy says about an element's look: what a reader (a person, or Claude Code) needs to find and change it.
  // Padding and radius only when set. No contrast: the colours are there, and the tool shows it while commenting.
  const looks = (i, labelled) => [['Size', `${i.size} px`], ['Background', i.background], ['Text', i.color], ['Font', i.font],
    ...[['Padding', i.padding], ['Radius', i.radius]].filter(([, v]) => v && v !== '0')]
    .map(([k, v]) => (labelled ? `${k}: ${v}` : k === 'Size' ? v : `${k.toLowerCase()} ${v}`)).join(' · ');
  // How Copy names an element: its selector in backticks and, inside a frame, the frame (outermost first) and the frame's
  // page address while it is on the page, so a reader knows which page's code to look in.
  const named = (selector) => {
    const frames = selector.split(FRAME_SEP), own = `\`${shortSelector(frames.pop())}\``;
    if (!frames.length) return own;
    let url = '';
    try { url = docIn(frames).URL; } catch {}
    return `${own} inside the frame ${frames.map((f) => `\`${shortSelector(f)}\``).join(' › ')}${/^(https?|file):/.test(url) ? ` (its page: ${url})` : ''}`;
  };
  const toText = (items = numbered()) => {
    const body = items.map(({ c, n }) => [
      `## ${n}. ${c.comment}${c.by ? ` (from ${c.by})` : ''}`,
      ...(c.area
        ? [c.group ? `- ${c.items.length} elements selected together, inside ${named(c.selector)}:` : `- Area over ${named(c.selector)}, covering ${c.items.length} element(s):`,
          ...c.items.map((it) => `  - ${named(it.selector)}: "${it.text}"`)]
        : [`- Element: ${named(c.selector)}`, c.selectedText && `- Selected text: "${c.selectedText}"`, `- Element text: "${c.text}"`, `- HTML: \`${c.html}\``]),
      c.info ? `- ${looks(c.info, true)}`
        : c.size && `- Size: ${c.size} px · Background: ${c.background}`,
      c.frozen && '- Commented on a frozen moment: the element may only show on hover or in a menu',
      c.shot && (c.shotCount > 1 ? `- Screenshots: pictures ${n}a to ${n}${tagOf({ length: c.shotCount }, c.shotCount - 1)}, one per selected element, in the order above` : `- Screenshot: picture ${n}`),
    ].filter(Boolean).join('\n')).join('\n\n');
    return `Page: ${pageOf()}\n\n${body}`;
  };

  // The same comments as HTML, each followed by its own screenshot: what rich editors (Jira, Docs, Notion) paste.
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toHtml = async (items, found) => {
    const pics = new Map(await Promise.all(items.filter((x) => found.get(x.c)).map(async (x) => [x.c,
      await Promise.all(found.get(x.c).map(async (p, k, all) => ({ url: await dataUrl(await png(await captioned(x, p, tagOf(all, k), true))), width: p.width })))])));
    const parts = items.map(({ c, n }) => {
      // People reading the ticket see the comment, what it is about and the picture; the technical details trail in
      // one small grey line for whoever builds it (text/plain, which Claude Code reads, keeps them in full).
      const details = [
        c.area ? `${c.group ? 'selected together inside' : 'area over'} ${shortSelector(c.selector)}: ${c.items.map((it) => shortSelector(it.selector)).join(', ')}` : shortSelector(c.selector),
        c.info ? looks(c.info, false)
          : c.size && `${c.size} px · background ${c.background}`,
      ].filter(Boolean).join(' · ');
      const img = (pics.get(c) || []).map((p) => `<p><img src="${p.url}" alt="Screenshot of comment ${n}"${p.width ? ` width="${Math.max(p.width, 240)}"` : ''}></p>`).join('');
      return `<h3>${n}. ${esc(c.comment)}${c.by ? ` <small>(from ${esc(c.by)})</small>` : ''}</h3><p>${esc(pickOf({ ...c, el: elOf(c) }).name)}</p>${img}<p style="color:#71717a;font-size:11px"><small>${esc(details)}</small></p>`;
    });
    return `<p>Page: <a href="${esc(pageOf())}">${esc(pageOf())}</a></p>${parts.join('')}`;
  };

  const toast = (s, ms = 5000) => {
    toastEl.textContent = s;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  };

  // Each pin stays on the spot that was clicked, kept as an offset inside its element so it follows
  // scrolling and layout changes. A pin hides while its element is gone or not rendered.
  // A pin inside a frame also hides while its spot is scrolled out of the frame's box (of each frame, when nested).
  const inFrames = (doc, x, y) => {
    for (let f; (f = frameOf(doc)); doc = f.ownerDocument) {
      const r = rectOf(f);
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    }
    return true;
  };
  const place = () => here().forEach((c, i) => {
    const pin = pins.children[i], el = elOf(c), r = el ? rectOf(el) : { width: 0 };
    const x = r.left + Math.min(c.dx, r.width), y = r.top + Math.min(c.dy, r.height);
    pin.hidden = !r.width || !inFrames(el.ownerDocument, x, y);
    pin.style.left = x + 'px';
    pin.style.top = y + 'px';
  });
  const schedulePlace = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { place(); drawPicked(); drawShown(); }); };

  const render = () => {
    persist();
    const mine = here();
    badge.hidden = !mine.length;
    badge.textContent = mine.length;
    listBtn.labelEl.textContent = 'Comments (' + mine.length + ')';
    listCnt.textContent = mine.length;
    listCnt.hidden = !mine.length;
    platform.onComments?.({ page: pageOf(), title: document.title, count: mine.length });
    copyBtn.disabled = sendBtn.disabled = clearBtn.disabled = !mine.length;
    list.replaceChildren(...(mine.length
      ? mine.map((c, i) => h('li', { className: c.shared ? 'shared' : '', style: `--who:${colourOf(c.by)}`, title: c.shared ? 'From ' + (c.by || 'a shared link') : '', onclick: () => edit(c) },
          h('span', { className: 'num', textContent: i + 1 }),
          h('span', { className: 'txt' }, c.comment, h('small', { textContent: (c.shot ? '📷 ' : '') + (c.by ? c.by + ' · ' : '') + pickOf({ ...c, el: elOf(c) }).name })),
          h('span', { className: 'row-acts' },
            h('button', { className: 'one', title: 'Copy this comment (and its screenshot)', onclick: async (e) => {
              e.stopPropagation();
              const b = e.currentTarget;
              try { await copyComments([c]); b.textContent = '✓'; } catch { b.textContent = '!'; }
              setTimeout(() => { b.replaceChildren(icon('copy')); }, 1500);
            } }, icon('copy')),
            h('button', { className: 'del', textContent: '×', title: 'Delete', onclick: (e) => { e.stopPropagation(); remove(c); } }))))
      : [h('p', { className: 'empty', textContent: 'No comments on this page yet. Click anything while commenting (blue button) is on.' })]));
    pins.replaceChildren(...mine.map((c, i) => h('button', { className: c.shared ? 'pin shared' : 'pin', style: `--who:${colourOf(c.by)}`, textContent: i + 1,
      title: (c.shared ? `From ${c.by || 'a shared link'}: ` : '') + c.comment, onclick: () => edit(c) })));
    place();
  };

  // An iframe (or embed) is a page of its own: the pointer over it never reaches this page's listeners. A frame whose
  // page has this page's origin is linked (see linkFrame): the tool listens inside it as it does here, so its elements
  // are picked one by one. Every other one (another origin, a sandbox, a frame running its own copy of the tool) lets
  // the pointer through to this page while commenting (a stylesheet object, which page CSP rules do not block), and the
  // embed under the pointer becomes the target, to be picked whole like a picture.
  const EMBEDS = 'iframe, frame, embed, object', FRAMES = 'iframe, frame', LINKED = 'data-page-comments-frame';
  const embedRule = `iframe:not([${LINKED}]), frame:not([${LINKED}]), embed, object { pointer-events: none !important; }`;
  const embedSheet = new CSSStyleSheet();
  embedSheet.replaceSync(embedRule);
  const sheets = new Map([[document, embedSheet]]); // a stylesheet object serves one page: each linked frame has its own
  const passEmbeds = (on) => {
    for (const [doc, sheet] of sheets) {
      const rest = doc.adoptedStyleSheets.filter((x) => x !== sheet);
      doc.adoptedStyleSheets = on ? [...rest, sheet] : rest;
    }
  };
  const targetOf = (e) => [...(e.target.querySelectorAll?.(EMBEDS) ?? [])].reverse().find((f) => {
    const r = f.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
  }) || e.target;
  const setCommenting = (on) => {
    commenting = on;
    passEmbeds(on);
    main.classList.toggle('on', on);
    main.firstChild.replaceWith(icon(on ? 'comment' : 'browse'));
    main.ariaLabel = on ? 'Commenting. Click to switch to browsing.' : 'Browsing. Click to switch to commenting.';
    mainTip.replaceChildren((on ? 'Click to browse the page' : 'Click to comment') + ' · drag to move', h('kbd', { textContent: ALT_SHIFT + 'C' }));
    hl.hidden = true;
    // Browsing means using the page, so nothing of ours may stay open over it.
    if (!on) { closePop(); panel.hidden = true; setArea(false); closeMenu(); unfreeze(); picked = []; setBatch(false); kbTarget = null; }
  };
  // Area mode: drag a rectangle instead of clicking an element. It stays on until switched off or Esc.
  let areaMode = false;
  const setArea = (on) => {
    areaMode = on;
    syncLayer();
    areaBtn.classList.toggle('active', on);
    areaBtn.baseLabel = areaBtn.labelEl.textContent = on ? 'Stop selecting areas' : 'Select an area';
    if (on && !commenting) setCommenting(true);
    main.firstChild.replaceWith(icon(on ? 'area' : batchOn ? 'batch' : commenting ? 'comment' : 'browse'));
    drawPicked(); // the bar says which way the next pick is made
  };

  const openPop = (d, x, y) => {
    draft = { ...d, x, y };
    const el = d.el || (d.comment && elOf(d.comment));
    const pick = pickOf({ ...(d.comment || d), el });
    kindEl.textContent = pick.kind;
    nameEl.textContent = nameEl.title = pick.name + (el ? '' : ' · not on the page now');
    const by = d.comment && d.comment.shared && d.comment.by;
    byEl.hidden = !by;
    byEl.textContent = by ? 'by ' + by : '';
    byEl.style.setProperty('--who', colourOf(d.comment && d.comment.by));
    const info = el && !d.area && (d.frozen ? d.frozen.info : inspect(el)), bg = el && (d.frozen ? d.frozen.info.background : backgroundOf(el));
    sideTab.replaceChildren(info ? aa(info) : bg ? swatch(bg) : '', '›');
    sideBody.replaceChildren(...(info ? [detail('size', info.size.replace('×', ' × ')), ...details(info)]
      : bg ? [detail('size', `${d.area.w} × ${d.area.h}`), detail('background', swatch(bg), bg)] : [detail('element', 'not on the page now')]));
    selectorEl.textContent = d.selector;
    textarea.value = d.comment ? d.comment.comment : '';
    saveBtn.disabled = !textarea.value.trim();
    deleteBtn.hidden = !d.comment;
    // An existing comment shows whether it has a screenshot; a new area or frozen comment starts ticked (a picture
    // is why you make one); any other new comment starts as the box was last left.
    shotBox.checked = canShoot && (d.comment ? !!d.comment.shot : d.area || d.frozen ? true : localStorage.getItem(SHOT_KEY) === '1');
    shotLabel.hidden = !d.el; // nothing to photograph when the element is gone
    // A batch keeps its selections outlined while its box is open; ‹ › step through them (not on a frozen picture,
    // which cannot scroll).
    const many = d.group || (d.comment && d.comment.group) ? d.items || d.comment.items : null;
    if (many && !frozen) { shown = many; shownCur = -1; }
    navEl.hidden = !many || many.length < 2 || !!frozen;
    navPos.textContent = many ? `–/${many.length}` : '';
    hl.hidden = true;
    pop.hidden = false;
    placePop(x, y);
    drawShown();
    textarea.focus();
  };
  const placePop = (x, y) => {
    pop.style.left = Math.max(8, Math.min(x + 12, innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(y + 12, innerHeight - pop.offsetHeight - 8)) + 'px';
    pop.classList.toggle('flip', pop.getBoundingClientRect().right + 266 > innerWidth); // the details card goes left near the right edge
    placeSide();
    dodgeBox();
  };
  // Brings the next (or previous) selection of the batch into view, marks it, and moves the box beside it.
  const goPick = (step) => {
    const n = shown.length;
    if (n < 2) return;
    shownCur = shownCur < 0 ? (step > 0 ? 0 : n - 1) : (shownCur + step + n) % n;
    navPos.textContent = `${shownCur + 1}/${n}`;
    const it = shown[shownCur], el = find(it.selector);
    if (el) {
      const rect = () => {
        const r = rectOf(el);
        return it.box ? { left: r.left + it.box.dx, top: r.top + it.box.dy, right: r.left + it.box.dx + it.box.w, bottom: r.top + it.box.dy + it.box.h } : r;
      };
      showRect(el, rect);
      // Below the selection, or above it when the page ends too soon to fit the box below.
      const r = rect(), fits = r.bottom + 20 + pop.offsetHeight <= innerHeight;
      placePop(r.left, fits ? r.bottom : r.top - pop.offsetHeight - 24);
    }
    drawShown();
    textarea.focus();
  };
  navPrev.onclick = () => goPick(-1);
  navNext.onclick = () => goPick(1);
  // Unsaved text: the box differs from what it opened with. A saved comment opened from the list is not unsaved.
  const unsaved = () => !!draft && textarea.value.trim() !== (draft.comment ? draft.comment.comment : '');
  const closePop = () => {
    pop.hidden = true; draft = null; areaBox.hidden = true; shown = []; shownCur = -1; drawShown();
    if (dodge) { dodge = null; placeWidget(); } // back to where the user left it
  };

  // A saved comment, opened again, shows what it covers dashed (its element, its area, or each pick of a batch),
  // following the page as it scrolls until the box closes.
  let shown = [], shownCur = -1; // shownCur: the selection ‹ › went to last, drawn solid
  const drawShown = () => shownBoxes.replaceChildren(...shown.flatMap((it, i) => {
    const el = find(it.selector);
    if (!el) return [];
    const r = rectOf(el), b = it.box ? { left: r.left + it.box.dx, top: r.top + it.box.dy, width: it.box.w, height: it.box.h } : r;
    return [h('div', { className: 'picked' + (i === shownCur ? ' cur' : ''), style: `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px` })];
  }));
  const edit = (c) => {
    const el = elOf(c);
    // An element that is gone since the reload: open the comment in the middle of the screen instead.
    if (!el) return openPop({ selector: c.selector + ' (not found on the page now)', selectedText: c.selectedText, comment: c }, innerWidth / 2 - 150, innerHeight / 3);
    // Bring what it covers to the middle of the screen, unless it is already in full view.
    el.scrollIntoView({ block: 'nearest' });
    let r = rectOf(el);
    const top = r.top + (c.area ? c.area.dy : 0), height = c.area ? c.area.h : r.height;
    if (top < 0 || top + height > innerHeight) scrollBy({ top: top + Math.min(height, innerHeight) / 2 - innerHeight / 2, behavior: 'instant' });
    r = rectOf(el);
    shown = c.group ? c.items : [{ selector: c.selector, box: c.area }];
    if (c.area) openPop({ el, selector: c.selector, area: c.area, items: c.items, comment: c }, r.left + c.area.dx, r.top + c.area.dy + c.area.h);
    else openPop({ el, selector: c.selector, selectedText: c.selectedText, comment: c }, r.left + c.dx, r.top + c.dy);
    drawShown();
  };
  const remove = (c) => {
    if (c.shot) dropShot(c.id);
    comments = comments.filter((x) => x !== c);
    closePop();
    render();
  };
  // A comment's pictures: cut from the frozen picture (`rec`, the element may be gone from the page by now), or shot
  // live, each element brought into view first and the scroll put back after. A batch gets one picture per pick.
  const takePictures = async (c, { el, picks, rec, area }) => {
    const pad = (r, m) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m });
    if (c.group) {
      // One picture per selected element, nothing between them. Live elements may be scrolled apart: bring each
      // into view for its picture, then put the scroll back.
      const list = picks || c.items.map((it) => ({ el: find(it.selector), box: it.box })).filter((t) => t.el), pics = [];
      if (rec && frozen) for (const t of list) pics.push(await crop(frozen.canvas, frozen.k, pad(pickRect(t), 8)));
      else {
        const sx = scrollX, sy = scrollY;
        try {
          for (const t of list) {
            const rect = () => shotRect(t.el, t.box, 8);
            showRect(t.el, rect);
            pics.push(await shoot(rect));
          }
        } finally { scrollBack(sx, sy); }
      }
      await putShot(c.id, pics);
      c.shotCount = pics.length;
    } else {
      const { blob, width } = rec && frozen
        ? await crop(frozen.canvas, frozen.k, area
          ? pad({ left: rec.rect.left + area.dx, top: rec.rect.top + area.dy, right: rec.rect.left + area.dx + area.w, bottom: rec.rect.top + area.dy + area.h }, 8)
          : pad(rec.rect, 24))
        : await (async () => { // brought into view first: a retaken picture's element may be off screen
          const sx = scrollX, sy = scrollY;
          const rect = () => shotRect(el, c.area);
          showRect(el, rect);
          try { return await shoot(rect); } finally { scrollBack(sx, sy); }
        })();
      await putShot(c.id, blob);
      c.shotWidth = width;
    }
    c.shot = true;
  };
  // A new comment from the open box: an area (or batch) or an element, from its live or frozen state. Not saved here.
  const commentFrom = (d, comment) => {
    const { el, selectedText, x, y, area, items, frozen: rec, group } = d;
    if (area) {
      return {
        id: newId(), comment, el, page: pageOf(), dx: area.dx, dy: area.dy, area, items, selector: d.selector, ...(group ? { group } : {}),
        size: `${area.w}×${area.h}`, background: rec ? rec.info.background : backgroundOf(el), ...(rec ? { frozen: true } : {}),
      };
    }
    const r = rec ? rec.rect : rectOf(el);
    return {
      id: newId(), comment, selectedText, el, page: pageOf(), dx: Math.max(0, x - r.left), dy: Math.max(0, y - r.top),
      selector: d.selector, text: clip(textOf(el), 200), html: clip(el.outerHTML, 400), info: rec ? rec.info : inspect(el), ...(rec ? { frozen: true } : {}),
    };
  };
  const save = async () => {
    const comment = textarea.value.trim();
    if (!comment) return;
    const { el, comment: editing, area, frozen: rec, picks } = draft, wantShot = shotBox.checked;
    let c = editing;
    if (c) c.comment = comment;
    else comments.push((c = commentFrom(draft, comment)));
    closePop();
    render();
    if (!el) return; // an edit of a comment whose element is gone keeps its screenshot as it was
    if (!wantShot) {
      if (c.shot) { c.shot = false; dropShot(c.id); render(); }
      return;
    }
    // Ticked: take a fresh screenshot (on an edit too). Nothing awaits before this, so Chrome still
    // counts the Save click as the user's go-ahead for its "Share this tab?" prompt.
    try {
      await takePictures(c, { el, picks, rec, area });
    } catch (err) {
      toast('No screenshot: ' + (err.name === 'NotAllowedError' ? 'sharing this tab was not allowed.' : err.message));
    }
    render();
  };

  const ours = (e) => e.composedPath().includes(host);

  // Capture phase so the page's own handlers (links, buttons) never see comment-mode clicks.
  const onMove = (e) => {
    schedulePlace();
    if (frozen || menuState) return; // the frozen picture and the menu draw their own highlight
    if (!commenting || draft || ours(e)) return void (hl.hidden = true);
    if (kbTarget && holds(kbTarget.el, e.target)) return;
    kbTarget = null;
    kbStack = [];
    hovered = targetOf(e);
    showHighlight(rectOf(hovered), inspect(hovered));
  };
  const onClick = (e) => {
    if (ours(e)) return;
    // A click away from the open comments list, or from a comment box without unsaved text, only closes them (both at
    // once) and brings the highlight back; while browsing, the page still gets its click.
    if (!panel.hidden || (draft && !unsaved())) {
      panel.hidden = true;
      if (!unsaved()) closePop();
      if (commenting) { e.preventDefault(); e.stopPropagation(); onMove(e); }
      return;
    }
    if (!commenting) return;
    e.preventDefault();
    e.stopPropagation();
    if (menuState) return closeMenu(); // a click away from the menu only closes it
    if (draft) return textarea.focus(); // never throw away unsaved text
    const { x, y } = pointOf(e);
    if (e.shiftKey || batchOn) return togglePick(kbTarget && holds(kbTarget.el, e.target) ? kbTarget : liveTarget(targetOf(e)), x, y);
    if (kbTarget && holds(kbTarget.el, e.target)) return openPop({ el: kbTarget.el, selector: kbTarget.selector }, x, y);
    const sel = e.target.ownerDocument.getSelection(); // a frame's page has its own selection
    const text = sel.toString().trim();
    // The smallest element that holds the whole selection, which may span several elements.
    const common = text && sel.getRangeAt(0).commonAncestorContainer;
    const el = text ? (common.nodeType === 1 ? common : common.parentElement) : targetOf(e);
    openPop({ el, selector: selectorOf(el), selectedText: text }, x, y);
  };
  // Details (colours, font, spacing, selector) are one remembered switch: D, or the comment box's tab.
  // A press-once switch, not a held key: holding a key while moving the mouse is awkward, and Alt is Option on a Mac.
  const DETAILS_KEY = 'page-comments:details';
  let detailsOn = false;
  try { detailsOn = localStorage.getItem(DETAILS_KEY) === '1'; } catch {}
  // The card is taller than the box near the bottom of the screen: lift it until it fits.
  const placeSide = () => {
    side.style.top = '';
    if (!detailsOn || pop.hidden) return;
    const r = side.getBoundingClientRect(), p = pop.getBoundingClientRect();
    side.style.top = Math.max(8 - p.top, Math.min(0, innerHeight - 8 - r.bottom)) + 'px';
  };
  const setDetails = (on) => {
    detailsOn = on;
    pop.classList.toggle('details', on);
    hl.classList.toggle('details', on);
    if (!hl.hidden && hlLast) showHighlight(...hlLast); // the details change its height and width
    placeSide();
    try { localStorage.setItem(DETAILS_KEY, on ? '1' : '0'); } catch {}
  };
  setDetails(detailsOn);
  sideTab.onclick = () => { setDetails(true); textarea.focus(); };
  sideHead.onclick = () => { setDetails(false); textarea.focus(); };
  copySelBtn.onclick = async () => {
    try { await writeClipboard({ text: draft.selector }); toast('Copied ' + draft.selector, 2000); } catch (err) { toast('Could not copy (' + err.message + ')'); }
    textarea.focus();
  };
  const editable = (t) => t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''));
  const onKey = (e) => {
    // Alt+Shift+F freezes (or unfreezes) and Alt+Shift+C switches commenting/browsing, in either mode.
    // e.code, because on a Mac Option changes e.key.
    if (e.altKey && e.shiftKey && (e.code === 'KeyF' || e.code === 'KeyC')) {
      e.preventDefault();
      e.stopPropagation();
      return void (e.code === 'KeyF' ? (frozen ? unfreeze() : freeze()) : setCommenting(!commenting));
    }
    // Single keys only while commenting, and never while typing (in our comment box or in the page's fields).
    // The real target, not e.target: focus stays on our buttons after a click, and the shadow root retargets them to host.
    // Enter on one of our focused buttons must still press that button.
    if (e.key !== 'Escape') {
      const t = e.composedPath()[0];
      if (!commenting || draft || editable(t) || (e.key === 'Enter' && ours(e)) || e.ctrlKey || e.metaKey || e.altKey) return;
      // With our menu open, ↑ / ↓ / Enter work its items.
      const item = (start) => [...menu.querySelectorAll('.mi')].find((b) => b.textContent.startsWith(start));
      const run = menuState ? { arrowup: () => item('Select parent')?.click(), arrowdown: () => item('Select inner')?.click(), enter: () => item('Comment on this')?.click() }[e.key.toLowerCase()] : {
        arrowup: () => moveKb(true), arrowdown: () => moveKb(false), enter: () => (batchOn ? openPicked() : commentOnHighlighted()),
        a: () => !frozen && setArea(!areaMode), b: () => (batchOn ? leaveBatch() : setBatch(true)), f: () => (frozen ? unfreeze() : freeze()), d: () => setDetails(!detailsOn),
        c: async () => toast(await copyComments().catch((err) => 'Could not copy (' + err.message + ')'), 2500), s: () => (e.shiftKey ? askName() : shareBtn.click()),
        l: toggleList, '?': () => { keysCard.hidden = !keysCard.hidden; },
      }[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      e.stopPropagation();
      return void run();
    }
    if (!nameBar.hidden) nameBar.hidden = true;
    else if (!keysCard.hidden) keysCard.hidden = true;
    else if (menuState) closeMenu();
    else if (draft) closePop();
    else if (confirming) { confirming = false; drawPicked(); }
    else if (areaMode) setArea(false);
    else if (batchOn) leaveBatch();
    else if (frozen) unfreeze();
    else if (commenting) setCommenting(false);
  };
  // ---- Shift+click adds an element to a selection (live or frozen) that stays after Shift is let go, so you can scroll
  // between picks. Enter or the bar's Comment opens one comment for all of them, anchored on their nearest common
  // ancestor, with one picture per element. Esc, Clear or a plain click drops the selection.
  // ---- Batch mode: every click adds (or removes) an element; with area mode on (A) every drag adds an area box (`box`:
  // its offset and size inside its anchor element `el`). Comment writes one comment for all of them. Leaving with something selected asks
  // first (`confirming`). Picks made on the frozen picture are `fixed` to their recorded rectangle.
  let picked = [], pickAt = { x: 0, y: 0 }, confirming = false, batchOn = false;
  const syncLayer = () => { areaLayer.hidden = !(areaMode && !frozen); };
  const setBatch = (on) => {
    batchOn = on;
    if (areaMode) setArea(false); // a batch starts, and ends, picking elements
    if (on) { if (!commenting) setCommenting(true); closePop(); }
    batchBtn.classList.toggle('active', on);
    main.firstChild.replaceWith(icon(on ? 'batch' : areaMode ? 'area' : commenting ? 'comment' : 'browse'));
    syncLayer();
    drawPicked();
  };
  const leaveBatch = () => (picked.length ? askDrop() : setBatch(false));
  const pickRect = (t) => {
    if (t.fixed) return t.rect;
    const r = rectOf(t.el);
    if (!t.box) return r;
    const left = r.left + t.box.dx, top = r.top + t.box.dy;
    return { left, top, width: t.box.w, height: t.box.h, right: left + t.box.w, bottom: top + t.box.h };
  };
  const drawPicked = () => {
    pickedBoxes.replaceChildren(...picked.map((t) => {
      const r = pickRect(t);
      const x = h('button', { className: 'x', title: 'Remove from the selection', ariaLabel: 'Remove from the selection' }, icon('close'));
      x.onclick = () => { picked.splice(picked.indexOf(t), 1); confirming = false; drawPicked(); };
      return h('div', { className: 'picked', style: `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px` }, x);
    }));
    if (!picked.length) confirming = false;
    pickBar.hidden = !batchOn;
    pickCount.textContent = confirming ? `Drop the ${picked.length} selected?`
      : `Batch · ${picked.length} selected · ${areaMode ? 'drag to add an area (A: back to elements)' : 'click to add or remove (A: areas)'}`;
    pickComment.textContent = confirming ? 'Keep' : 'Comment';
    pickComment.disabled = !confirming && !picked.length;
    pickClear.textContent = confirming ? 'Drop' : picked.length ? 'Close without saving' : 'Close';
  };
  const askDrop = () => { confirming = true; drawPicked(); };
  const togglePick = (t, x, y) => {
    if (!batchOn) setBatch(true); // Shift+click starts a batch
    const i = t.box ? -1 : picked.findIndex((p) => !p.box && p.el === t.el);
    if (i >= 0) picked.splice(i, 1);
    else picked.push(t);
    pickAt = { x, y };
    confirming = false;
    drawPicked();
  };
  const openPicked = () => {
    const list = picked;
    if (!list.length) return;
    picked = [];
    setBatch(false);
    const one = list[0];
    if (list.length === 1 && !one.box) return openPop({ el: one.el, selector: one.selector, ...(frozen ? { frozen: one } : {}) }, pickAt.x, pickAt.y);
    if (list.length === 1) return openPop({ el: one.el, selector: one.selector, ...(frozen ? { frozen: one.entry } : {}), area: one.box, items: one.items }, pickAt.x, pickAt.y);
    let a = list[0].el;
    for (const t of list) while (a && !holds(a, t.el)) a = up(a); // across frames: picks may be in several pages
    if (frozen) while (a && !frozen.byEl.has(a)) a = a.parentElement;
    const anchor = frozen ? (a ? frozen.byEl.get(a) : frozen.entries[0]) : liveTarget(a || document.body);
    const rects = list.map(pickRect), ar = frozen ? anchor.rect : rectOf(anchor.el);
    const u = { left: Math.min(...rects.map((r) => r.left)), top: Math.min(...rects.map((r) => r.top)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) };
    openPop({
      el: anchor.el, selector: anchor.selector, ...(frozen ? { frozen: anchor } : {}), group: true,
      area: { dx: Math.round(u.left - ar.left), dy: Math.round(u.top - ar.top), w: Math.round(u.right - u.left), h: Math.round(u.bottom - u.top) },
      items: list.map((t) => (t.box
        ? { selector: t.selector, box: t.box, text: clip(`area ${t.box.w}×${t.box.h} over: ${t.items.map((it) => it.text).join(' | ')}`, 160) }
        : { selector: t.selector, text: clip(textOf(t.el), 80) })),
      picks: list,
    }, u.left, u.bottom);
  };
  pickComment.onclick = () => (confirming ? ((confirming = false), drawPicked()) : openPicked());
  pickClear.onclick = () => (confirming ? ((picked = []), setBatch(false)) : leaveBatch());
  batchBtn.onclick = () => (batchOn ? leaveBatch() : setBatch(true));
  // In a batch the layer over the page takes the clicks; still light up what a click would pick.
  areaLayer.addEventListener('pointermove', (e) => {
    if (!batchOn || areaLayer.onpointerup) return; // while dragging, the box shows instead
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x !== host && !host.contains(x));
    if (!el || (kbTarget && kbTarget.el.contains(el))) return;
    kbTarget = null;
    kbStack = [];
    hovered = el;
    showHighlight(el.getBoundingClientRect(), inspect(el));
  });
  // Shift+click would otherwise extend the page's text selection.
  const onDown = (e) => { if (commenting && e.shiftKey && !ours(e)) e.preventDefault(); };

  // ↑ / ↓ move the highlight to the parent / back to the inner element; Enter (or a click inside it) comments on it.
  let hovered = null, kbTarget = null, kbStack = [];
  const currentTarget = () => kbTarget || (frozen ? hoveredEntry : hovered && hovered.isConnected ? liveTarget(hovered) : null);
  const moveKb = (up) => {
    const t = currentTarget();
    if (!t) return;
    const next = up ? parentTarget(t) : kbStack.pop();
    if (!next) return;
    if (up) kbStack.push(t);
    kbTarget = next;
    showHighlight(frozen ? next.rect : rectOf(next.el), next.info);
  };
  const commentOnHighlighted = () => {
    const t = currentTarget();
    if (!t) return;
    const r = frozen ? t.rect : rectOf(t.el);
    openPop({ el: t.el, selector: t.selector, ...(frozen ? { frozen: t } : {}) }, r.left, r.bottom);
  };

  // ---- Area mode: drag on the layer, then find the elements the rectangle covers.
  const showAreaBox = (r) => {
    Object.assign(areaBox.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    areaBox.hidden = false;
  };
  // Elements at least 60% inside the area, without those inside another such element, anchored on their nearest
  // common ancestor: Claude can look that up like a clicked element, and the list names the parts.
  const insideArea = (r) => {
    const found = [];
    for (const el of document.body.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const ix = Math.min(b.right, r.right) - Math.max(b.left, r.left), iy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
      if (ix > 0 && iy > 0 && ix * iy >= 0.6 * b.width * b.height) found.push(el);
    }
    const tops = found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
    let anchor = tops[0] || document.elementsFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2).find((e) => e !== host && !host.contains(e));
    for (const el of tops) while (anchor && !anchor.contains(el)) anchor = anchor.parentElement;
    return { anchor: anchor || document.body, tops };
  };
  areaLayer.onpointerdown = (e) => {
    e.preventDefault();
    if (unsaved()) return textarea.focus(); // never throw away unsaved text
    closePop();
    const sx = e.clientX, sy = e.clientY;
    const rectTo = (m) => ({ left: Math.min(sx, m.clientX), top: Math.min(sy, m.clientY), width: Math.abs(m.clientX - sx), height: Math.abs(m.clientY - sy) });
    areaLayer.setPointerCapture(e.pointerId);
    areaLayer.onpointermove = (m) => showAreaBox(rectTo(m));
    areaLayer.onpointerup = (m) => {
      areaLayer.onpointermove = areaLayer.onpointerup = null;
      const r = rectTo(m);
      if (r.width < 8 || r.height < 8) { // a click, not a drag: in a batch it picks the element under it
        areaBox.hidden = true;
        const el = batchOn && document.elementsFromPoint(sx, sy).find((x) => x !== host && !host.contains(x));
        if (el) togglePick(kbTarget && kbTarget.el.contains(el) ? kbTarget : liveTarget(el), sx, sy);
        return;
      }
      const right = r.left + r.width, bottom = r.top + r.height;
      const { anchor, tops } = insideArea({ left: r.left, top: r.top, right, bottom });
      const a = anchor.getBoundingClientRect();
      const box = { dx: Math.round(r.left - a.left), dy: Math.round(r.top - a.top), w: Math.round(r.width), h: Math.round(r.height) };
      const items = tops.slice(0, 12).map((el) => ({ selector: selectorOf(el), text: clip(textOf(el), 80) }));
      if (batchOn) { areaBox.hidden = true; return togglePick({ el: anchor, selector: selectorOf(anchor), box, items }, r.left, bottom); }
      openPop({ el: anchor, selector: selectorOf(anchor), area: box, items }, r.left, bottom);
    };
  };
  // ---- What a comment is about: a live element, or one recorded at the moment of freezing. Both look the same:
  // { el, rect, info, selector }; a recorded one keeps its data after the real element has gone.
  const liveTarget = (el) => ({ el, rect: rectOf(el), info: inspect(el), selector: selectorOf(el) });
  const overlap60 = (b, r) => {
    const ix = Math.min(b.right, r.right) - Math.max(b.left, r.left), iy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
    return ix > 0 && iy > 0 && ix * iy >= 0.6 * b.width * b.height;
  };

  // ---- Freeze: for menus and tooltips that vanish as soon as you move. At that moment the tool records every element
  // on screen (position, selector, size, colours) and grabs a picture of the screen, then shows the picture over the
  // page. Clicking or dragging on it comments on the recorded elements, and screenshots are cut from the picture.
  let frozen = null; // { canvas, k, entries, byEl }
  const record = () => {
    const entries = [], byEl = new Map(), seen = new Map();
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      // Covered at its centre (by a menu, say): only picked where nothing else fits.
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2)));
      const entry = { el, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        selector: selectorOf(el), info: inspect(el, seen), covered: !(top && (top === el || el.contains(top))) };
      entries.push(entry);
      byEl.set(el, entry);
      if (entries.length >= 4000) break;
    }
    return { entries, byEl };
  };
  // The smallest uncovered recorded element under a point (a covered one only if nothing else is there).
  const frozenAt = (x, y) => {
    let best = null;
    for (const en of frozen.entries) {
      const r = en.rect;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (!best || (best.covered && !en.covered) || (best.covered === en.covered && r.width * r.height <= best.rect.width * best.rect.height)) best = en;
    }
    return best;
  };
  const freeze = async () => {
    if (frozen) return;
    closeMenu();
    if (unsaved()) return textarea.focus();
    closePop();
    if (!platform.capture.ready()) {
      // Chrome's "Share this tab?" prompt would close an open menu, so the first freeze only starts sharing.
      try { await platform.capture.start(); } catch (err) { return toast('Freeze needs screen sharing: ' + (err.name === 'NotAllowedError' ? 'it was not allowed.' : err.message)); }
      return toast('Screen sharing is on. Open the menu or tooltip again, then freeze.');
    }
    host.style.visibility = 'hidden'; // out of the recording and of the picture
    try {
      const { entries, byEl } = record();
      await new Promise(requestAnimationFrame);
      const { source, k } = await platform.capture.grab();
      const canvas = h('canvas', { width: source.videoWidth || source.width, height: source.videoHeight || source.height });
      canvas.getContext('2d').drawImage(source, 0, 0);
      frozen = { canvas, k, entries, byEl };
    } catch (err) {
      return toast('Could not freeze: ' + err.message);
    } finally {
      host.style.visibility = '';
    }
    freezeLayer.replaceChildren(frozen.canvas, freezeLayer.lastChild);
    freezeLayer.hidden = false;
    syncLayer();
    freezeBtn.classList.add('active');
    freezeBtn.baseLabel = freezeBtn.labelEl.textContent = 'Unfreeze';
    if (!commenting) setCommenting(true);
  };
  const unfreeze = () => {
    if (!frozen) return;
    picked = picked.filter((t) => !t.fixed); // picks on the frozen picture go with it
    kbTarget = hoveredEntry = null;
    kbStack = [];
    frozen = null;
    drawPicked();
    freezeLayer.hidden = true;
    syncLayer();
    freezeBtn.classList.remove('active');
    freezeBtn.baseLabel = freezeBtn.labelEl.textContent = FREEZE_LABEL;
    closeMenu();
    if (!unsaved()) closePop();
    hl.hidden = true;
  };
  unfreezeBtn.onclick = (e) => { e.stopPropagation(); unfreeze(); };
  // The countdown switches to browsing, so the page's own right-click menu and hovers work until the freeze.
  let countdown = 0;
  freezeBtn.onclick = async () => {
    if (frozen) return unfreeze();
    if (countdown) return;
    if (!platform.capture.ready()) {
      try { await platform.capture.start(); } catch (err) { return toast('Freeze needs screen sharing: ' + (err.name === 'NotAllowedError' ? 'it was not allowed.' : err.message)); }
    }
    setCommenting(false);
    let left = 3;
    toast(`Freezing in ${left}… open the menu or hover the tooltip now`, 1100);
    countdown = setInterval(() => {
      if (--left > 0) return toast(`Freezing in ${left}…`, 1100);
      clearInterval(countdown);
      countdown = 0;
      freeze();
    }, 1000);
  };
  // The frozen picture: hover shows recorded elements, a click comments on one, a drag on an area, right-click opens the menu.
  let hoveredEntry = null;
  freezeLayer.onpointermove = (e) => {
    if (draft || menuState || e.target !== freezeLayer.firstChild) return;
    const en = frozenAt(e.clientX, e.clientY);
    if (kbTarget && en && kbTarget.el.contains(en.el)) return;
    kbTarget = null;
    kbStack = [];
    hoveredEntry = en;
    if (en) showHighlight(en.rect, en.info);
    else hl.hidden = true;
  };
  freezeLayer.onpointerdown = (e) => {
    if (e.button !== 0 || e.target !== freezeLayer.firstChild) return;
    e.preventDefault();
    if (menuState) return closeMenu();
    // As on the live page: a click away from the comments list or a box without unsaved text only closes them.
    if (unsaved()) return textarea.focus();
    if (!panel.hidden || draft) { panel.hidden = true; closePop(); return freezeLayer.onpointermove(e); }
    const sx = e.clientX, sy = e.clientY;
    const rectTo = (m) => ({ left: Math.min(sx, m.clientX), top: Math.min(sy, m.clientY), width: Math.abs(m.clientX - sx), height: Math.abs(m.clientY - sy) });
    freezeLayer.setPointerCapture(e.pointerId);
    freezeLayer.onpointerup = (m) => {
      freezeLayer.onpointerup = null;
      const r = rectTo(m);
      if (r.width < 8 || r.height < 8) {
        areaBox.hidden = true;
        const at = frozenAt(sx, sy), en = kbTarget && at && kbTarget.el.contains(at.el) ? kbTarget : at;
        if (batchOn || m.shiftKey) return en && togglePick({ ...en, fixed: true }, sx, sy);
        if (en) openPop({ el: en.el, selector: en.selector, frozen: en }, sx, sy);
        return;
      }
      const box = { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
      const found = frozen.entries.filter((en) => !en.covered && overlap60(en.rect, box));
      const tops = found.filter((en) => !found.some((o) => o !== en && o.el.contains(en.el)));
      let anchorEl = tops[0]?.el || frozenAt((box.left + box.right) / 2, (box.top + box.bottom) / 2)?.el;
      for (const t of tops) while (anchorEl && !anchorEl.contains(t.el)) anchorEl = anchorEl.parentElement;
      while (anchorEl && !frozen.byEl.has(anchorEl)) anchorEl = anchorEl.parentElement;
      const anchor = anchorEl ? frozen.byEl.get(anchorEl) : frozen.entries[0];
      const area = { dx: Math.round(r.left - anchor.rect.left), dy: Math.round(r.top - anchor.rect.top), w: Math.round(r.width), h: Math.round(r.height) };
      const items = tops.slice(0, 12).map((en) => ({ selector: en.selector, text: clip(textOf(en.el), 80) }));
      if (batchOn || m.shiftKey) {
        areaBox.hidden = true;
        return togglePick({ el: anchor.el, selector: anchor.selector, entry: anchor, fixed: true, rect: { ...box, width: r.width, height: r.height }, box: area, items }, r.left, box.bottom);
      }
      openPop({ el: anchor.el, selector: anchor.selector, frozen: anchor, area, items }, r.left, box.bottom);
    };
    const onDrag = (m) => showAreaBox(rectTo(m));
    freezeLayer.addEventListener('pointermove', onDrag);
    freezeLayer.addEventListener('pointerup', () => freezeLayer.removeEventListener('pointermove', onDrag), { once: true });
  };
  freezeLayer.oncontextmenu = (e) => {
    e.preventDefault();
    const en = frozenAt(e.clientX, e.clientY);
    if (en) openMenu(en, e.clientX, e.clientY);
  };

  // ---- Our right-click menu (in commenting mode, and on a frozen picture): comment, pick the parent or inner element
  // instead of the one directly under the mouse, select an area, freeze, copy the selector.
  let menuState = null; // { target, stack, x, y }
  const parentTarget = (t) => {
    if (frozen) {
      for (let e = t.el.parentElement; e; e = e.parentElement) if (frozen.byEl.has(e)) return frozen.byEl.get(e);
      return null;
    }
    const p = up(t.el);
    return p ? liveTarget(p) : null;
  };
  const menuItem = (label, hint, run) => h('button', { className: 'mi', onclick: (e) => { e.stopPropagation(); run(); } },
    h('span', { textContent: label }), h('span', { className: 'mk', textContent: hint }));
  const renderMenu = () => {
    const { target: t, stack, x, y } = menuState, up = parentTarget(t);
    showHighlight(t.rect, t.info);
    menu.replaceChildren(...[
      h('div', { className: 'mh' }, h('span', { className: 't', textContent: t.info.label }), t.info.size.replace('×', ' × ')),
      menuItem('Comment on this', 'Enter', () => { closeMenu(); openPop({ el: t.el, selector: t.selector, ...(frozen ? { frozen: t } : {}) }, x, y); }),
      up && menuItem('Select parent', '↑ ' + up.info.label, () => { menuState = { ...menuState, target: up, stack: [...stack, t] }; renderMenu(); }),
      stack.length && menuItem('Select inner', '↓ ' + stack.at(-1).info.label, () => { menuState = { ...menuState, target: stack.at(-1), stack: stack.slice(0, -1) }; renderMenu(); }),
      h('hr'),
      !frozen && menuItem('Select an area', 'A', () => { closeMenu(); setArea(true); }),
      menuItem('Select several (batch)', 'B', () => { closeMenu(); setBatch(true); }),
      menuItem(frozen ? 'Unfreeze' : 'Freeze the page', 'F', () => { closeMenu(); frozen ? unfreeze() : freeze(); }),
      menuItem('Keyboard shortcuts', '?', () => { closeMenu(); keysCard.hidden = false; }),
      menuItem('Copy selector', '', async () => {
        closeMenu();
        try { await writeClipboard({ text: t.selector }); toast('Copied ' + t.selector, 2000); } catch (err) { toast('Could not copy (' + err.message + ')'); }
      }),
    ].filter(Boolean));
    menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
  };
  const openMenu = (target, x, y) => {
    if (unsaved()) return textarea.focus();
    closePop();
    menuState = { target, stack: [], x, y };
    menu.hidden = false;
    renderMenu();
  };
  const closeMenu = () => {
    if (!menuState) return;
    menuState = null;
    menu.hidden = true;
    hl.hidden = true;
  };
  const onContext = (e) => {
    if (!commenting || frozen || ours(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = pointOf(e);
    openMenu(liveTarget(e.target), x, y);
  };
  addEventListener('contextmenu', onContext, true);
  addEventListener('mousedown', onDown, true);
  addEventListener('mousemove', onMove, true);
  addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);
  addEventListener('scroll', schedulePlace, true);
  const onScrollMenu = (e) => { if (!ours(e)) closeMenu(); };
  addEventListener('scroll', onScrollMenu, true);
  addEventListener('resize', schedulePlace);
  // Linking a same-origin frame: our listeners on its window, its own embed stylesheet (for frames inside it), and a mark
  // on its iframe that lets the pointer in. Done for every frame now and again whenever one loads (a new page in a frame
  // is a new document); a frame that now shows a page of another origin loses its mark and is picked whole again.
  const linked = new Map(); // a linked frame's page -> what undoes the linking
  const ownTool = (doc) => doc.documentElement?.dataset.pageComments !== undefined;
  const FRAME_EVENTS = [['mousemove', onMove], ['click', onClick], ['mousedown', onDown], ['contextmenu', onContext], ['keydown', onKey],
    ['scroll', schedulePlace], ['scroll', onScrollMenu], ['resize', schedulePlace]];
  const onFrameLoad = (e) => { if (e.target.matches?.(FRAMES)) { linkFrame(e.target); schedulePlace(); } }; // its pins can show now
  const linkFrame = (f) => {
    for (const [doc, undo] of linked) if (!doc.defaultView) undo(); // pages gone from their frames
    const doc = f.contentDocument;
    if (!doc?.documentElement || ownTool(doc)) return f.removeAttribute(LINKED);
    f.setAttribute(LINKED, '');
    if (linked.has(doc)) return;
    const win = doc.defaultView, sheet = new win.CSSStyleSheet();
    sheet.replaceSync(embedRule);
    // A copy of the tool started inside the frame later takes over its page; ours then keeps out of its way.
    const handlers = FRAME_EVENTS.map(([type, fn]) => [type, (e) => ownTool(doc) || fn(e)]);
    for (const [type, fn] of handlers) win.addEventListener(type, fn, true);
    doc.addEventListener('load', onFrameLoad, true); // a load event never reaches the window
    sheets.set(doc, sheet);
    linked.set(doc, () => {
      // `win` follows the frame to its next page. A frame's first, blank page hands its window on to the next page of
      // the same origin, listeners and all: remove them. Any other new page has a new window, ours went with the old
      // one, and one of another origin refuses the call.
      try { for (const [type, fn] of handlers) win.removeEventListener(type, fn, true); } catch {}
      doc.removeEventListener('load', onFrameLoad, true);
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((x) => x !== sheet);
      sheets.delete(doc);
      linked.delete(doc);
    });
    passEmbeds(commenting);
    doc.querySelectorAll(FRAMES).forEach(linkFrame);
  };
  document.addEventListener('load', onFrameLoad, true);
  document.querySelectorAll(FRAMES).forEach(linkFrame);

  // The round button can be dragged anywhere; its centre is saved per site. The default is the bottom-right corner.
  const POS_KEY = 'page-comments:pos';
  let pos = null;
  try {
    pos = JSON.parse(localStorage.getItem(POS_KEY));
  } catch {}
  if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) pos = null;
  // 66 px from the edges leaves room for a tight arc even in a corner.
  const centre = () => {
    if (dodge) return dodge;
    const x = pos ? pos.x : innerWidth - 66, y = pos ? pos.y : innerHeight - 66;
    return { x: Math.max(66, Math.min(innerWidth - 66, x)), y: Math.max(66, Math.min(innerHeight - 66, y)) };
  };

  // The bar opens toward the middle of the screen; tooltips and the ⋯ list go below it near the top.
  const layoutBar = () => {
    const { x, y } = centre();
    widget.classList.toggle('left', x < innerWidth / 2);
    widget.classList.toggle('top', y < innerHeight / 2);
  };
  // The comments list and messages go above the bar (below it near the top), lined up with the round button's outer edge,
  // with room for the bar's tooltips so they never cover them (64 = half the round button + a tooltip + a gap).
  const placeDock = () => {
    const { x, y } = centre(), d = dock.getBoundingClientRect();
    const onRight = x > innerWidth / 2, onTop = y < innerHeight / 2;
    dock.style.flexDirection = onTop ? 'column-reverse' : 'column';
    dock.style.alignItems = onRight ? 'flex-end' : 'flex-start';
    const left = onRight ? x + 26 - d.width : x - 26, top = onTop ? y + 64 : y - 64 - d.height;
    dock.style.left = Math.max(8, Math.min(innerWidth - d.width - 8, left)) + 'px';
    dock.style.top = Math.max(8, Math.min(innerHeight - d.height - 8, top)) + 'px';
  };
  const placeWidget = () => {
    const { x, y } = centre();
    widget.style.left = x + 'px';
    widget.style.top = y + 'px';
    layoutBar();
    placeDock();
  };
  // An open comment box that would cover the round button sends the button to the nearest screen corner the box leaves
  // free; closing the box brings it back (closePop).
  const dodgeBox = () => {
    const p = pop.getBoundingClientRect(), m = 26 + 12; // the button's radius and a gap
    const hits = (c) => c.x + m > p.left && c.x - m < p.right && c.y + m > p.top && c.y - m < p.bottom;
    const was = dodge;
    dodge = null;
    const home = centre();
    if (!hits(home)) { if (was) placeWidget(); return; }
    const corners = [[innerWidth - 66, innerHeight - 66], [66, innerHeight - 66], [innerWidth - 66, 66], [66, 66]].map(([x, y]) => ({ x, y }));
    dodge = corners.filter((c) => !hits(c)).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0] || null;
    placeWidget();
  };
  const dockObserver = new ResizeObserver(placeDock);
  dockObserver.observe(dock);
  addEventListener('resize', placeWidget);

  // Hover (or keyboard focus) opens the arc; leaving closes it after a moment, so the mouse can cross the gap.
  let closeTimer = 0;
  const openArc = () => {
    clearTimeout(closeTimer);
    if (!widget.classList.contains('open')) {
      layoutBar();
      if (pageIsLocal && Date.now() - lastCheck > 10000) checkServer();
    }
    widget.classList.add('open');
  };
  // Leaving the bar closes it after 1.2 s, so a slip of the mouse does not fold it away.
  const closeArc = () => { clearTimeout(closeTimer); closeTimer = setTimeout(() => { widget.classList.remove('open', 'listopen'); moreBtn.classList.remove('on'); }, 1200); };
  // The comments list and the ⋯ list open in the same spot: opening one closes the other.
  const closeMore = () => { widget.classList.remove('listopen'); moreBtn.classList.remove('on'); };
  moreBtn.onclick = () => { const on = widget.classList.toggle('listopen'); moreBtn.classList.toggle('on', on); if (on) panel.hidden = true; };
  const toggleList = () => { panel.hidden = !panel.hidden; if (!panel.hidden) closeMore(); };
  detailsAct.onclick = () => { setDetails(!detailsOn); closeMore(); };
  keysAct.onclick = () => { keysCard.hidden = !keysCard.hidden; closeMore(); };
  main.addEventListener('mouseenter', openArc);
  widget.addEventListener('mouseover', openArc);
  widget.addEventListener('mouseleave', closeArc);
  widget.addEventListener('focusin', openArc);
  widget.addEventListener('focusout', closeArc);

  // The round button: a click switches mode, a drag of more than 4 px moves it.
  main.onpointerdown = (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, start = centre();
    dodge = null; // a drag puts it where the user wants, even out of a dodge
    let moved = false;
    main.setPointerCapture(e.pointerId);
    main.onpointermove = (m) => {
      if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return;
      moved = true;
      main.classList.add('dragging');
      widget.classList.remove('open');
      pos = { x: start.x + m.clientX - sx, y: start.y + m.clientY - sy };
      placeWidget();
    };
    main.onpointerup = main.onpointercancel = () => {
      main.onpointermove = main.onpointerup = main.onpointercancel = null;
      main.classList.remove('dragging');
      // The button's colour and icon show the new mode; no message needed.
      if (!moved) return setCommenting(!commenting);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(centre()));
      } catch {}
      openArc();
    };
  };
  // Keyboard users: Enter or Space on the round button switches mode.
  main.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCommenting(!commenting); }
  };

  // Another tab of the same site changed the comments: take its copy so neither tab overwrites the other.
  const onStorage = (e) => {
    if (e.key !== KEY) return;
    comments = load();
    closePop();
    render();
  };
  addEventListener('storage', onStorage);
  // Single-page apps change the URL without reloading; nothing fires for pushState, so check the URL.
  const urlTimer = setInterval(() => {
    if (pageOf() === page) return;
    page = pageOf();
    closePop();
    render();
  }, 300);

  textarea.oninput = () => { saveBtn.disabled = !textarea.value.trim(); };
  shotBox.onchange = () => {
    if (draft && !draft.comment && !draft.area && !draft.frozen) try { localStorage.setItem(SHOT_KEY, shotBox.checked ? '1' : '0'); } catch {}
  };
  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); }
  };
  // Keep typing inside the comment box from triggering the page's keyboard shortcuts (Gmail, GitHub...).
  for (const type of ['keydown', 'keyup', 'keypress']) textarea.addEventListener(type, (e) => e.stopPropagation());

  listBtn.onclick = toggleList;
  areaBtn.onclick = () => setArea(!areaMode);
  // The result of an action shows in that action's own label, right where the user clicked
  // (the arc is open then, and a message beside the round button would cover it).
  const flash = (act, text, ms = 2500) => {
    clearTimeout(act.flashTimer);
    act.labelEl.textContent = text;
    act.classList.add('flash');
    layoutBar();
    act.flashTimer = setTimeout(() => {
      act.labelEl.textContent = act.baseLabel;
      act.classList.remove('flash');
      layoutBar();
    }, ms);
  };
  // Clearing wipes every comment on the page, so it takes a second click within 3 seconds.
  const disarmClear = () => { clearTimeout(clearTimer); clearBtn.classList.remove('armed'); clearBtn.labelEl.textContent = 'Clear all'; layoutBar(); };
  clearBtn.onclick = () => {
    if (!clearBtn.classList.contains('armed')) {
      clearBtn.classList.add('armed');
      clearBtn.labelEl.textContent = 'Click again to clear ' + here().length;
      layoutBar();
      clearTimer = setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    for (const c of here()) if (c.shot) dropShot(c.id);
    comments = comments.filter((c) => c.page !== pageOf());
    closePop();
    render();
    flash(clearBtn, 'Cleared');
  };
  saveBtn.onclick = save;
  cancelBtn.onclick = closePop;
  deleteBtn.onclick = () => remove(draft.comment);
  // Copy straight from the box: what is selected plus what is typed, as Copy would put it, without saving a comment.
  boxCopyBtn.onclick = async () => {
    const d = draft, text = textarea.value.trim();
    if (!d) return;
    const el = d.el || (d.comment && elOf(d.comment));
    const c = d.comment ? { ...d.comment, comment: text || d.comment.comment } : commentFrom({ ...d, el }, text || '(no comment yet)');
    const found = new Map();
    try {
      if (shotBox.checked && el) {
        const tmp = { ...c, id: 'copy-' + newId() };
        await takePictures(tmp, { el, picks: d.picks, rec: d.frozen, area: d.area });
        const v = await shots('readonly', (st) => st.get(tmp.id));
        dropShot(tmp.id);
        Object.assign(c, { shot: true, shotCount: tmp.shotCount, shotWidth: tmp.shotWidth });
        found.set(c, Array.isArray(v) ? v : [{ blob: v, width: tmp.shotWidth }]);
      }
      await copyItems([{ c, n: 1 }], found);
      toast(`Copied this comment${found.size ? ' with its picture' : ''}, not saved.`, 2500);
    } catch (err) {
      toast('Could not copy (' + (err.name === 'NotAllowedError' ? 'sharing this tab was not allowed' : err.message) + ')');
    }
    textarea.focus();
  };
  // Copy puts the comments on the clipboard in three forms, and each app takes the one it prefers:
  //   text/plain  terminals and Claude Code (its Ctrl+V then picks up the image below)
  //   text/html   rich editors (Jira, Confluence, Docs, Notion): each comment with its own screenshot right below it
  //   image/png   all screenshots stacked into one numbered picture, for places that only take an image
  // Each picture is captioned with its comment's number and text. `only` copies some comments (the list's per-comment
  // copy button): pasting them one by one keeps each comment next to its picture, even in Slack. Returns a message.
  const copyComments = async (only, textOnly) => copyItems(numbered(only), textOnly ? new Map() : await pageShots());
  const copyItems = async (items, found) => {
    const text = toText(items);
    const html = await toHtml(items, found);
    const withPics = items.filter((x) => found.get(x.c));
    await writeClipboard({ text, html, png: withPics.length && navigator.clipboard ? await contactSheet(withPics, found) : null });
    return `Copied ${items.length}${withPics.length ? ' + screenshots' : ''}`;
  };
  // Atlassian's editor (Jira, Confluence) takes a paste that holds an image file and HTML with an <img> for one copied
  // picture and drops all the text, and it never keeps pictures from pasted HTML: there, text and pictures need two
  // pastes, with nothing picture-like on the clipboard for the text.
  textBtn.onclick = async () => {
    try { toast(await copyComments(null, true) + ': paste it, then Copy pictures for the second paste.', 3000); } catch (err) { toast('Could not copy (' + err.message + ')'); }
  };
  // ---- Share link: this page's comments, compressed into the link's #page-comments=… part, with small copies of the
  // pictures while the link stays under 30 KB (Slack takes 40,000 characters a message); past that, without pictures.
  const SHARE_KEY = 'page-comments=', LINK_MAX = 30000;
  const SHARED = ['id', 'comment', 'selector', 'selectedText', 'dx', 'dy', 'area', 'items', 'group', 'text', 'html', 'info', 'size', 'background', 'frozen', 'by'];
  // Each writer's name gets its own colour (the same name always the same one); orange stays yours, purple is a link
  // without names. The names come from links: only ever shown as text, and the colour comes from this fixed list.
  // No blues: the tool's own highlight is blue. No orange: that is yours.
  const WHO = ['#7c3aed', '#0891b2', '#16a34a', '#db2777', '#475569', '#0d9488', '#c026d3', '#65a30d', '#be123c', '#854d0e'];
  const colourOf = (name) => {
    if (!name) return WHO[0];
    let n = 0;
    for (const ch of name.toLowerCase()) n = (n * 31 + ch.codePointAt(0)) >>> 0;
    return WHO[n % WHO.length];
  };
  // A picture for a link: 1 image pixel per CSS pixel and lower WebP quality, about half the size; stays sharp enough.
  const smallPic = async ({ blob, width }) => {
    const bmp = await createImageBitmap(blob), k = width ? Math.min(1, width / bmp.width) : 1;
    const canvas = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return { url: await dataUrl(await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.7))), width: canvas.width };
  };
  const PIC_URL = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
  const blobOf = (url) => { const [head, b64] = url.split(','); return new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type: head.slice(5, -7) }); };
  const bytesOf = async (stream) => new Uint8Array(await new Response(stream).arrayBuffer());
  const pack = async (data) => {
    let bin = '';
    for (const b of await bytesOf(new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('deflate-raw')))) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unpack = async (str) => {
    const bytes = Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(await bytesOf(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')))));
  };
  // A link is someone else's data: keep only comments of the right shape, and only real colours (they end up in styles).
  const colour = (v) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|transparent)$/i.test(v);
  const fromLink = (c) => {
    if (!c || typeof c.comment !== 'string' || typeof c.selector !== 'string' || typeof c.id !== 'string') return null;
    const out = Object.fromEntries(SHARED.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));
    out.dx = +out.dx || 0;
    out.dy = +out.dy || 0;
    if (out.info && !(colour(out.info.background) && colour(out.info.color))) delete out.info;
    if (out.background !== undefined && !colour(out.background)) delete out.background;
    if (out.area && !['dx', 'dy', 'w', 'h'].every((k) => Number.isFinite(out.area[k]))) return null;
    if (typeof out.by === 'string' && out.by.trim()) out.by = out.by.trim().slice(0, 40);
    else delete out.by;
    if (out.items && !(Array.isArray(out.items) && out.items.every((it) => it && typeof it.selector === 'string'))) return null;
    const pics = Array.isArray(c.pics) ? c.pics.filter((p) => p && typeof p.url === 'string' && PIC_URL.test(p.url) && Number.isFinite(p.width)) : [];
    return { ...out, page: pageOf(), shared: true, pics, hadPic: c.hadPic === true };
  };
  // A link too long for its pictures leaves them out: offer to take them again here, on this page. Frozen ones (a menu
  // or tooltip at one moment) and ones whose element is not on this page cannot be retaken.
  let missingPics = [];
  const retakeText = h('span'), retakeBtn = h('button', { textContent: 'Retake' }), skipBtn = h('button', { textContent: 'Skip' });
  const retakeBar = h('div', { className: 'freeze-bar pick-bar', hidden: true }, retakeText, retakeBtn, skipBtn);
  root.append(retakeBar);
  const drawRetake = () => {
    retakeBar.hidden = !missingPics.length;
    retakeText.textContent = `${missingPics.length} shared comment(s) came without their pictures · take them on this page?`;
  };
  skipBtn.onclick = () => { missingPics = []; drawRetake(); };
  retakeBtn.onclick = async () => {
    const list = missingPics;
    missingPics = [];
    drawRetake();
    let done = 0, skipped = 0;
    for (const c of list) {
      const el = elOf(c);
      if (!el || c.frozen) { skipped++; continue; }
      try {
        await takePictures(c, { el });
        done++;
      } catch (err) {
        if (err.name === 'NotAllowedError') { toast('No pictures: sharing this tab was not allowed.'); break; }
        skipped++;
      }
    }
    render();
    toast(`Took ${done} picture(s) on this page` + (skipped ? `; ${skipped} could not be taken (frozen, or not on this page).` : '.'), 6000);
  };
  // Our part of the address is `page-comments=…` at the end of the hash, after the page's own hash (a route like
  // #/settings, an anchor) and an `&` when there is one, so the two can be told apart and the page's part kept.
  const splitHash = () => {
    const hash = location.hash.slice(1), at = hash.indexOf(SHARE_KEY);
    return at < 0 ? { own: hash, ours: '' } : { own: hash.slice(0, at).replace(/&$/, ''), ours: hash.slice(at + SHARE_KEY.length) };
  };
  const importShared = async () => {
    const { own, ours } = splitHash();
    if (!ours) return;
    try {
      const have = new Set(comments.map((c) => c.id));
      const fresh = (await unpack(ours)).map(fromLink).filter((c) => c && !have.has(c.id));
      for (const c of fresh) {
        const pics = c.pics;
        if (c.hadPic && !pics.length) missingPics.push(c);
        delete c.pics;
        delete c.hadPic;
        if (!pics.length) continue;
        try {
          if (pics.length > 1) { await putShot(c.id, pics.map((p) => ({ blob: blobOf(p.url), width: p.width }))); c.shotCount = pics.length; }
          else { await putShot(c.id, blobOf(pics[0].url)); c.shotWidth = pics[0].width; }
          c.shot = true;
        } catch {} // the comment still comes, without its picture
      }
      comments.push(...fresh);
      render();
      toast(fresh.length ? `Opened ${fresh.length} shared comment(s) on this page.` : 'The shared comments are already here.');
      drawRetake();
    } catch {
      toast('Could not read the comments in this link: it may have been cut short.');
    }
    // Drop only our part. The page's own hash goes back with location.replace, which tells a router that reads the hash
    // (hashchange) and adds no history entry; with no own hash, the address just loses its #.
    if (own) location.replace('#' + own);
    else history.replaceState(history.state, '', location.href.split('#')[0]);
  };
  // Your name goes with the comments you share (received ones keep their writer's). Asked once per site, in a bar
  // rather than a browser dialog; Shift+S asks again.
  const NAME_KEY = 'page-comments:name';
  const myName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
  const nameInput = h('input', { placeholder: 'Your name', maxLength: 40 });
  const nameGo = h('button', { textContent: 'Share' }), nameCancel = h('button', { textContent: 'Cancel' });
  const nameBar = h('div', { className: 'freeze-bar pick-bar name-bar', hidden: true },
    h('span', { textContent: 'Your name, shown with your comments:' }), nameInput, nameGo, nameCancel);
  root.append(nameBar);
  // Typing here must not reach the page's own shortcuts (Gmail, GitHub...).
  for (const type of ['keydown', 'keyup', 'keypress']) nameInput.addEventListener(type, (e) => { e.stopPropagation(); if (type === 'keydown' && e.key === 'Enter') nameGo.click(); });
  const askName = () => { nameInput.value = myName(); nameBar.hidden = false; nameInput.focus(); };
  nameCancel.onclick = () => { nameBar.hidden = true; };
  nameGo.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    nameBar.hidden = true;
    share();
  };
  shareBtn.onclick = () => (myName() ? share() : askName());
  const share = async () => {
    try {
      const me = myName();
      const found = await pageShots(), plain = (c) => ({ ...Object.fromEntries(SHARED.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])), by: c.by || me || undefined });
      const withPics = await Promise.all(here().map(async (c) => ({ ...plain(c), ...(found.get(c) ? { pics: await Promise.all(found.get(c).map(smallPic)) } : {}) })));
      const { own } = splitHash(), start = location.href.split('#')[0] + '#' + (own ? own + '&' : '') + SHARE_KEY;
      let link = start + await pack(withPics), note = found.size ? ' with pictures' : '';
      if (link.length > LINK_MAX) {
        note = `, pictures left out (with them it would be ${(link.length / 1024).toFixed(0)} KB, too long for Slack)`;
        link = start + await pack(here().map((c) => ({ ...plain(c), ...(found.get(c) ? { hadPic: true } : {}) })));
      }
      await writeClipboard({ text: link });
      toast(`Copied a link with ${here().length} comment(s)${note}, ${(link.length / 1024).toFixed(1)} KB, as ${me} (Shift+S changes the name). Whoever opens it and clicks their bookmark sees them.`
        + (pageIsLocal ? ' This page is on your machine: only you can open it.' : ''), 7000);
    } catch (err) {
      toast('Could not copy the link (' + err.message + ')');
    }
  };
  addEventListener('hashchange', importShared);

  // Slack, Jira and Claude take several separate pictures only as files: a page can put just one picture on the
  // clipboard. Each picture becomes its own captioned PNG, named after its comment; platform.saveFiles saves them.
  const slug = (t) => clip(t, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'comment';
  filesBtn.onclick = async () => {
    try {
      const found = await pageShots(), items = numbered().filter((x) => found.get(x.c));
      if (!items.length) return toast('No pictures on this page yet: tick Add screenshot on a comment.');
      const files = [];
      for (const x of items) {
        const pics = found.get(x.c);
        for (const [k, p] of pics.entries()) {
          files.push({ name: `${x.n}${tagOf(pics, k)}-${slug(x.c.comment)}.png`, bytes: new Uint8Array(await (await png(await captioned(x, p, tagOf(pics, k)))).arrayBuffer()) });
        }
      }
      toast(await platform.saveFiles(files, `page-comments-${slug(location.hostname)}-${files.length}-pictures.zip`), 7000);
    } catch (err) {
      toast('Could not save the pictures (' + err.message + ')');
    }
  };
  picsBtn.onclick = async () => {
    try {
      const found = await pageShots(), items = numbered().filter((x) => found.get(x.c));
      if (!items.length) return toast('No pictures on this page yet: tick Add screenshot on a comment.');
      await writeClipboard({ png: await contactSheet(items, found) });
      toast('Copied the pictures: paste them as a second paste.', 3000);
    } catch (err) {
      toast('Could not copy (' + err.message + ')');
    }
  };
  copyBtn.onclick = async () => {
    try {
      flash(copyBtn, await copyComments());
      // Once per site: where the pictures went for Jira.
      if (localStorage.getItem('page-comments:jira-tip') !== '1' && (await pageShots()).size) {
        localStorage.setItem('page-comments:jira-tip', '1');
        toast('Pasting into Jira or Confluence? They take text and pictures only in two pastes: open Comments, Copy text and paste, then Copy pictures and paste.', 9000);
      }
    } catch (err) {
      flash(copyBtn, 'Could not copy (' + err.message + ')', 5000);
    }
  };
  // Send only shows while the local server answers. Every failed check shows up in the browser's console and
  // network panel (a page cannot hide that), so ask only when the answer matters: when the round button is hovered,
  // at most every 10 s, and only on pages on this machine, the only ones the server serves.
  // Local: localhost, loopback addresses, and the endings reserved for local use (never a public site), which is where
  // hosts-file names usually live. The server decides for real (it reads the hosts file); this only avoids checks elsewhere.
  const pageIsLocal = /^(localhost|127(\.\d+){3}|\[::1\])$|\.(localhost|test|local|internal|home\.arpa)$/.test(location.hostname);
  let lastCheck = 0;
  const checkServer = async () => {
    lastCheck = Date.now();
    try {
      sendBtn.hidden = !pageIsLocal || !(await fetch(SERVER + '/health', { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      sendBtn.hidden = true;
    }
    layoutBar();
  };
  sendBtn.onclick = async () => {
    flash(sendBtn, 'Sending…');
    try {
      // Screenshots travel as data: URLs (WebP, small) in a JSON body. Sent as a plain string, it stays a "simple"
      // request: the browser sends no CORS preflight, so the server needs no handler for one.
      // In comment order, null where a comment has no picture: the server names files after comment numbers.
      const found = await pageShots();
      const images = await Promise.all(here().map((c) => (found.get(c) ? Promise.all(found.get(c).map((p) => dataUrl(p.blob))) : null)));
      const res = await fetch(SERVER + '/comments', { method: 'POST', body: JSON.stringify({ text: toText(), images }) });
      flash(sendBtn, res.ok ? 'Sent: Claude is working, see the server terminal' : 'Server said: ' + (await res.text()), 5000);
    } catch {
      // The browser gives the same error for a stopped server and for a page whose CSP blocks the request.
      flash(sendBtn, 'Server not reachable: use Copy', 3000);
      setTimeout(checkServer, 3000);
    }
  };

  const destroy = () => {
    removeEventListener('mousemove', onMove, true);
    removeEventListener('click', onClick, true);
    removeEventListener('keydown', onKey, true);
    removeEventListener('contextmenu', onContext, true);
    removeEventListener('mousedown', onDown, true);
    removeEventListener('scroll', onScrollMenu, true);
    clearInterval(countdown);
    removeEventListener('scroll', schedulePlace, true);
    removeEventListener('resize', schedulePlace);
    removeEventListener('resize', placeWidget);
    dockObserver.disconnect();
    clearTimeout(closeTimer);
    removeEventListener('storage', onStorage);
    removeEventListener('hashchange', importShared);
    cancelAnimationFrame(frame);
    clearTimeout(toastTimer);
    clearTimeout(clearTimer);
    clearInterval(urlTimer);
    platform.capture.stop(); // the bookmark: ends Chrome's "sharing this tab"
    document.removeEventListener('page-comments:close', destroy);
    if (document.documentElement.dataset.pageComments === platform.name) delete document.documentElement.dataset.pageComments;
    passEmbeds(false);
    for (const doc of [document, ...linked.keys()]) for (const f of doc.querySelectorAll(`[${LINKED}]`)) f.removeAttribute(LINKED);
    for (const undo of [...linked.values()]) undo();
    document.removeEventListener('load', onFrameLoad, true);
    host.remove();
    delete window.__pageComments;
  };
  closeBtn.onclick = quickClose.onclick = destroy;
  window.__pageComments = destroy;
  // The page's own DOM is the one thing the bookmark (page scripts) and the extension (its own isolated scripts) share.
  document.documentElement.dataset.pageComments = platform.name;
  document.addEventListener('page-comments:close', destroy);

  placeWidget();
  setCommenting(!platform.startBrowsing);
  const restored = here().length;
  if (restored) toast(`Restored ${restored} comment(s) on this page.`);
  // After the greeting, so a failure to save is the message that stays on screen.
  render();
  importShared();

  // Is a newer release out? Instead of reading a file we load version.svg as an image: its size encodes the latest
  // version (width = major * 1000 + minor + 1, height = patch + 1), and any page may read an image's size. An image
  // request without a referrer tells the server nothing about the page it came from (a file read would send the
  // page's origin), and no code is fetched or run. GitHub serves the repository's copy as a real image.
  // A site whose CSP blocks the image just skips the check. An unbuilt copy (pasted from the repo) has no version.
  const [vMajor, vMinor, vPatch] = VERSION.split('.').map(Number);
  if (platform.checkVersion && /^\d+\.\d+\.\d+$/.test(VERSION)) {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth === vMajor * 1000 + vMinor + 1 && img.naturalHeight === vPatch + 1) return;
      infoLink.classList.add('new');
      infoLink.labelEl.textContent = fromGithub ? 'New version: open, then copy the new bookmarklet.txt' : 'New version: open, then re-drag the bookmark';
      updateDot.hidden = false;
      layoutBar();
      toast('A new version of page-comments is out: hover the round button, open ⋯ and click the green Help line.');
    };
    img.src = (fromGithub ? 'https://raw.githubusercontent.com/adhi14058/page-comments/main/bookmarklet/' : SITE) + 'version.svg?t=' + Date.now();
  }
};
