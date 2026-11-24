// Playground: Start runs the real tool inside the frame only: the released client.js, the same file bookmarks load. The
// frame is the same site, so this page hears the frame's pointer and copy events and reads its saved comments. One small
// pop-up at a time ("coach mark") points at the next thing to do and moves on when the tool really does it. The demo
// site has its own message box to paste into.
// The pop-ups live in this page, layered over the frame, never in the frame: there the tool would treat them as part of
// the page (hover, click and area picks would land on them), and its full-page layers would cover their buttons.
{
const stage = document.querySelector('.play-left'), frame = stage.querySelector('.app-frame');
// The frame shows the whole made-up page and never scrolls inside: 640 px at least (site.css), taller when the page
// needs more, as on narrow screens. It is measured again when the frame's width or the page's content changes size.
let fitted = false;
const fit = () => {
  const d = frame.contentDocument;
  if (!d?.querySelector('main')) return;
  frame.style.height = '';
  frame.style.height = d.documentElement.scrollHeight + 'px';
};
const fitWatch = () => {
  fit();
  if (fitted || !frame.contentDocument?.querySelector('main')) return;
  fitted = true;
  const ro = new ResizeObserver(fit);
  ro.observe(frame);
  for (const el of frame.contentDocument.querySelectorAll('main > *')) ro.observe(el);
};
frame.addEventListener('load', fitWatch);
fitWatch(); // the frame may have loaded before this script ran

// ---- What the visitor did, from what the tool really does:
//   point    the pointer over a plan while the tool runs
//   comment  a new saved comment of any kind
//   several  a new comment made with Select several (B): it has `group`
//   area     a new comment made with Select an area (A): `area` alone, or a box dragged inside a batch
//   freeze   a new comment made on the frozen picture (F): it has `frozen`
//   copy     a copy event (http) or a clipboard write (https, localhost)
const KEY = 'page-comments:v1', done = new Set();
const win = () => frame.contentWindow, fdoc = () => frame.contentDocument;
const running = () => !!win()?.__pageComments;
const page = () => win().location.href.split('#')[0];
const saved = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter((c) => c.page === page()); } catch { return []; } };
let seen = null; // the ids saved before the first Start: comments left on an earlier visit do not count
const did = (id) => { if (!done.has(id)) { done.add(id); stepDone(id); } };
const readSaved = () => {
  if (!seen) return;
  for (const c of saved()) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    did('point'); did('comment'); // a comment means something was pointed at
    if (c.group) did('several');
    if (c.area && (!c.group || c.items?.some((it) => it.box))) did('area');
    if (c.frozen) did('freeze');
  }
};
// The frame writes localStorage; this page is another window of the same site, so it gets a storage event.
addEventListener('storage', (e) => { if (e.key === KEY) readSaved(); });
// In the capture phase, so the tool's own pointer handlers cannot hide the event from us.
const overPlan = (e) => {
  if (!running()) return;
  for (const p of fdoc().querySelectorAll('.plan')) {
    const r = p.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return did('point');
  }
};
const copied = () => { if (running()) did('copy'); };
let hooked = false;
const start = () => {
  const w = win(), d = fdoc();
  if (running() || !d?.querySelector('.plan')) return; // the frame has not loaded yet
  seen ??= new Set(saved().map((c) => c.id));
  if (!hooked) {
    hooked = true;
    w.addEventListener('pointermove', overPlan, true);
    w.addEventListener('pointerdown', overPlan, true);
    d.addEventListener('copy', copied, true); // http: the tool falls back to the copy command
    // https and localhost: the tool writes through the clipboard API, which fires no copy event, so note those calls too.
    const cb = w.navigator.clipboard;
    if (cb) for (const k of ['write', 'writeText']) { const f = cb[k].bind(cb); cb[k] = (...a) => { copied(); return f(...a); }; }
    // The tool's layer joins or leaves the frame's <html> when it starts or closes (its Close, or the bookmark again).
    new MutationObserver(() => ran(running())).observe(d.documentElement, { childList: true });
  }
  // client.js only defines the tool's function, so nothing runs until it is called.
  const s = Object.assign(d.createElement('script'), { src: 'client.js' });
  s.onload = () => { s.remove(); w.__pageCommentsLatest(); w.focus(); ran(running()); };
  d.head.append(s);
};
// The tool's shadow root (open for the bookmark), so the pop-ups can keep clear of its parts.
const toolRoot = () => [...(fdoc()?.documentElement.children || [])].find((el) => el.shadowRoot)?.shadowRoot || null;

// ---- The pop-up.
const coach = stage.querySelector('.coach'), arrow = coach.querySelector('.coach-arrow');
const pill = coach.querySelector('.coach-pill'), title = coach.querySelector('.coach-t'), text = coach.querySelector('.coach-x');
const back = coach.querySelector('.coach-back'), skip = coach.querySelector('.coach-skip');
const startCard = stage.querySelector('.coach-start'), startBtn = startCard.querySelector('button'), live = stage.querySelector('.coach-live');
const doneCard = stage.querySelector('.coach-done');
const inFrame = (sel) => () => fdoc().querySelector(sel)?.getBoundingClientRect();
// Features and the menu it opens on hover; while the menu is shut, the room it will take, so the pop-up does not sit there.
const menuRect = () => {
  const d = fdoc(), a = d.querySelector('.menu a').getBoundingClientRect(), ul = d.querySelector('.menu ul').getBoundingClientRect();
  const b = ul.height ? ul : { left: a.left - 12, right: a.left + 160, bottom: a.bottom + 120 };
  return { left: Math.min(a.left, b.left), top: a.top, right: Math.max(a.right, b.right), bottom: b.bottom };
};
// After an area comment the tool keeps selecting areas, and its area layer then covers the page, so the menu could not
// open on hover. The first F only asks to share the tab, unless an earlier picture already did.
const STEPS = [
  { id: 'point', title: 'Point', at: inFrame('.plan.pro'), text: 'Hover the <b>Pro</b> plan. It lights up blue, with its size and colours.' },
  { id: 'comment', title: 'Comment', at: inFrame('.plan.pro'), text: 'Click the <b>Pro</b> plan, type a comment, press <kbd>Enter</kbd>.' },
  { id: 'several', title: 'Select several', at: inFrame('.plans'), text: 'Press <kbd>B</kbd> and click two plans. Press <kbd>Enter</kbd>, type one comment for both, press <kbd>Enter</kbd>.' },
  { id: 'area', title: 'Select an area', at: inFrame('.plan:last-child'), text: 'Press <kbd>A</kbd> and drag a box over the <b>Team</b> price. Type a comment, press <kbd>Enter</kbd>.' },
  { id: 'freeze', title: 'Freeze', at: menuRect, text: () => (win().isSecureContext
    ? 'Still selecting areas? Press <kbd>A</kbd> to stop. Hover <b>Features</b> to open its menu, press <kbd>F</kbd>, then click a menu item and comment. If the browser asks to share, allow it, open the menu again and press <kbd>F</kbd>.'
    : 'Freeze takes a picture of the page, and this test address (plain http) cannot. On the real site: hover <b>Features</b>, press <kbd>F</kbd>, comment on the menu. Skip it here.') },
  { id: 'copy', title: 'Copy', at: () => toolRoot()?.querySelector('.bar')?.getBoundingClientRect(), text: 'Press <kbd>C</kbd>. Every comment goes to the clipboard, ready to paste into Claude Code, Slack or Jira.' },
];
let cur = 0, side = null;

// Placement, in this stage's coordinates: the frame's rects are offset by where the frame sits.
const GAP = 14;
const box = (r, dx, dy) => ({ left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy });
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
// The tool's parts to keep clear of: its bar, comment box, cards, toasts and key strip. Not its blue outlines on the
// page (.hl, .picked): they follow the pointer, and dodging them would make the pop-up dance.
const toolRects = (dx, dy) => {
  const root = toolRoot(), out = [];
  if (!root) return out;
  const fw = frame.clientWidth * frame.clientHeight;
  const walk = (el) => {
    if (el.matches?.('.hl, .picked, style') || (el.checkVisibility && !el.checkVisibility())) return;
    const r = el.getBoundingClientRect?.(), a = r ? r.width * r.height : 0;
    if (a && a < fw * 0.4) return void out.push(box(r, dx, dy)); // a part of the tool
    for (const c of el.children) walk(c); // a container (no size) or the full-page layer: look inside
  };
  for (const c of root.children) walk(c);
  return out;
};
const place = (keep) => {
  const s = stage.getBoundingClientRect(), f = frame.getBoundingClientRect();
  const dx = f.left - s.left, dy = f.top - s.top, raw = STEPS[cur].at();
  if (!raw) return;
  const t = box(raw, dx, dy), cw = coach.offsetWidth, ch = coach.offsetHeight;
  const fr = { left: dx + 8, top: dy + 8, right: dx + f.width - 8, bottom: dy + f.height - 8 };
  const clampY = (y) => Math.max(fr.top, Math.min(y, fr.bottom - ch)), clampX = (x) => Math.max(fr.left, Math.min(x, fr.right - cw));
  const cy = (t.top + t.bottom) / 2, cx = (t.left + t.right) / 2;
  const spots = {
    left: [t.left - GAP - cw, clampY(cy - ch / 2)], right: [t.right + GAP, clampY(cy - ch / 2)],
    above: [clampX(cx - cw / 2), t.top - GAP - ch], below: [clampX(cx - cw / 2), t.bottom + GAP],
  };
  const avoid = toolRects(dx, dy);
  // The page's own parts the next steps need (the plans, the message box): keep clear of them when there is room.
  const soft = [...fdoc().querySelectorAll('.plan, .chat')].map((el) => box(el.getBoundingClientRect(), dx, dy)).filter((r) => !overlap(r, t));
  // A spot that lands on something slides on, away from the target, past it (the tool's key strip above its button,
  // the next plan); the arrow still points back at the target. Each side offers its spot as is, slid past the tool's
  // parts, and slid past the page's parts too.
  const rectAt = ([x, y]) => ({ left: x, top: y, right: x + cw, bottom: y + ch });
  const PAST = { left: (o, [, y]) => [o.left - GAP - cw, y], right: (o, [, y]) => [o.right + GAP, y], above: (o, [x]) => [x, o.top - GAP - ch], below: (o, [x]) => [x, o.bottom + GAP] };
  const slide = (k, list) => {
    let p = spots[k];
    for (let i = 0; i < 4; i++) { const o = list.find((a) => overlap(rectAt(p), a)); if (!o) break; p = PAST[k](o, p); }
    return p;
  };
  const cands = {};
  for (const k in spots) Object.assign(cands, { [k]: spots[k], [k + '+tool']: slide(k, avoid), [k + '+page']: slide(k, [...avoid, ...soft]) });
  const hard = (p) => { const r = rectAt(p); return overlap(r, t) * 4 + avoid.reduce((n, o) => n + overlap(r, o) * 4, 0) + (cw * ch - overlap(r, fr)) * 2; };
  // Nearer wins: a pop-up slid far from its target points across other things.
  const far = (p) => { const r = rectAt(p); return Math.hypot(Math.max(0, t.left - r.right, r.left - t.right), Math.max(0, t.top - r.bottom, r.top - t.bottom)); };
  const score = (p) => hard(p) + soft.reduce((n, o) => n + overlap(rectAt(p), o), 0) + far(p) * 100;
  // Stay put while the spot is still clear of the target, the tool and the frame's edge, so the pop-up does not jump
  // around while you work.
  if (!(keep && side && cands[side] && hard(cands[side]) === 0)) side = Object.keys(cands).reduce((a, b) => (score(cands[b]) < score(cands[a]) ? b : a));
  const [x, y] = cands[side];
  coach.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
  coach.dataset.side = side.split('+')[0];
  // The arrow sits on the edge facing the target, as close to its middle as the corners allow.
  const along = /^(left|right)/.test(side) ? Math.max(14, Math.min(cy - y, ch - 14)) : Math.max(14, Math.min(cx - x, cw - 14));
  arrow.style.setProperty('--at', along + 'px');
};
let queued = false;
const later = () => { if (!queued && !coach.hidden) { queued = true; requestAnimationFrame(() => { queued = false; place(true); }); } };

// ---- Steps.
const show = () => {
  const step = STEPS[cur];
  coach.classList.remove('ok');
  pill.textContent = `${cur + 1} of ${STEPS.length}`;
  title.textContent = step.title;
  text.innerHTML = typeof step.text === 'function' ? step.text() : step.text;
  back.disabled = cur === 0;
  skip.textContent = cur === STEPS.length - 1 ? 'Finish' : 'Skip';
  live.textContent = `Step ${cur + 1} of ${STEPS.length}: ${step.title}. ${text.textContent}`;
  coach.hidden = false;
  place(false);
};
const finish = () => {
  coach.hidden = true;
  doneCard.hidden = false;
  live.textContent = doneCard.textContent;
};
// The next step not done yet: doing a later step early counts.
const go = (i) => {
  while (i < STEPS.length && done.has(STEPS[i].id)) i++;
  if (i >= STEPS.length) return finish();
  cur = i;
  show();
};
// A short tick on the pop-up, then the next step.
const stepDone = (id) => {
  if (coach.hidden || STEPS[cur].id !== id) return;
  coach.classList.add('ok');
  title.textContent = 'Done';
  setTimeout(() => go(cur + 1), 900);
};
// The tool started, or closed: when it closes, offer to start it again, keeping the place in the tour.
const ran = (on) => {
  startCard.hidden = on;
  startBtn.lastChild.textContent = on ? 'Start the tool' : 'Start the tool again';
  if (!on) coach.hidden = true;
  else { watchTool(); if (doneCard.hidden && coach.hidden) go(cur); }
};
startBtn.onclick = start;
// Back and Skip are buttons on this page; afterwards the keys (B, A, C) belong to the demo again.
const toDemo = () => win().focus();
back.onclick = () => { cur = Math.max(0, cur - 1); show(); toDemo(); };
skip.onclick = () => { if (cur === STEPS.length - 1) finish(); else { cur++; show(); } toDemo(); };
coach.addEventListener('keydown', (e) => { if (e.key === 'Escape') toDemo(); });
doneCard.querySelector('.again').onclick = () => { doneCard.hidden = true; done.clear(); cur = 0; show(); toDemo(); };

// Place the pop-up again when the tool opens or moves something, the pointer moves in the demo, or the page scrolls or
// resizes.
const hook = () => { for (const type of ['pointermove', 'pointerup', 'keyup', 'scroll']) win().addEventListener(type, later, true); };
if (fdoc()?.readyState === 'complete' && fdoc().querySelector('.plan')) hook();
else frame.addEventListener('load', hook, { once: true });
// The tool draws in its shadow root, which an observer on the frame's document does not see.
const seenRoots = new WeakSet();
const watchTool = () => {
  const root = toolRoot();
  if (root && !seenRoots.has(root)) { seenRoots.add(root); new MutationObserver(later).observe(root, { childList: true, subtree: true, attributes: true }); }
};
addEventListener('resize', later);

// ---- Phones and touch screens get clips instead of the demo (index.css, same query). The tool's widest bar (Select
// several, 570 px, never wraps) needs the frame 586 px wide (8 px clear each side), and the frame is the window less 48 px
// of padding, 16 px of dark-mode border and up to 17 px of scrollbar: 667 px and narrower is too small. Without a
// keyboard there are no keys to press. A range, not max-width: with display scaling a window can be 667.3 px wide.
// So the frame loads only where the demo can be used; a window widened past the line loads it then.
const phone = matchMedia('(width < 668px), (hover: none) and (pointer: coarse)');
// Only the clip most in view plays; the others show their first frame. Each clip downloads once; a fresh blob address
// per turn starts it from its first frame.
const clips = [...document.querySelectorAll('.play-phone img[data-clip]')], posters = new Map(clips.map((img) => [img, img.getAttribute('src')]));
const blobs = new Map(), seenRatio = new Map();
const playClip = async (img, on) => {
  if (on === img.classList.contains('on')) return;
  img.classList.toggle('on', on);
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  if (!on) return void (img.src = posters.get(img));
  if (!blobs.has(img)) blobs.set(img, fetch(img.dataset.clip).then((r) => r.blob()));
  const blob = await blobs.get(img);
  if (img.classList.contains('on')) img.src = URL.createObjectURL(blob);
};
const pickClip = () => {
  let best = null;
  for (const [img, r] of seenRatio) if (r >= 0.5 && (!best || r > seenRatio.get(best))) best = img;
  for (const img of clips) playClip(img, img === best);
};
const io = new IntersectionObserver((entries) => { for (const e of entries) seenRatio.set(e.target, e.intersectionRatio); pickClip(); }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
const layout = () => {
  if (!phone.matches && !frame.getAttribute('src')) frame.src = frame.dataset.src;
  for (const img of clips) {
    if (phone.matches) io.observe(img);
    else { io.unobserve(img); seenRatio.delete(img); playClip(img, false); }
  }
};
phone.addEventListener('change', layout);
layout();
}
