// The hero: the way switch drives the headline, the line along the top edge, the "who it is for" line, the pane,
// and the update note (shown only for ways that run a copy that can grow old). ?way=bookmark ?way=copy or ?way=extension opens another way first.
const hero = document.querySelector('.hero');
// The top bar's bookmark is the hero's: the same link, copied here instead of written into the page twice.
document.querySelector('.bnav-chip').setAttribute('href', hero.querySelector('.bmwrap .bookmark').getAttribute('href'));
// While a bookmark is dragged, the browser shows a half-size copy of the button instead of the link's code, held where
// the pointer grabbed it. The copy sits right after the button, off screen, so it keeps the button's own styles.
// A click on a bookmark here does nothing: the tool runs from the bookmarks bar, and the playground runs it in its frame.
const DRAG_SCALE = .5;
for (const b of document.querySelectorAll('.bookmark')) {
  const small = Object.assign(b.cloneNode(true), { className: b.className + ' dragimg', tabIndex: -1 });
  small.removeAttribute('href'); small.ariaHidden = 'true'; small.style.zoom = DRAG_SCALE; b.after(small);
  b.addEventListener('dragstart', (e) => e.dataTransfer.setDragImage(small, e.offsetX * DRAG_SCALE, e.offsetY * DRAG_SCALE));
  b.addEventListener('click', (e) => e.preventDefault());
}
const WAYS = {
  extension: ['Add it to your browser.', 'Its icon lands in your toolbar, up here', 'For Chrome and Firefox. The store keeps it up to date.'],
  bookmark: ['Drag this up.', 'Your bookmarks bar is right above this line', 'For any browser with a bookmarks bar. It updates itself.'],
  copy: ['Paste it as a bookmark.', 'Right-click your bookmarks bar, right above this line', "For when dragging doesn't work in your browser."],
};
const radios = [...document.querySelectorAll('.ways button')];
// The tabs of "What your browser asks" are the same three ways: they follow the hero, and picking one picks it there.
const tabs = [...document.querySelectorAll('.wtabs [role=tab]')], bmPanel = document.getElementById('asks-bm');
const show = (way) => {
  hero.dataset.way = way;
  for (const b of radios) { b.setAttribute('aria-checked', b.dataset.way === way); b.tabIndex = b.dataset.way === way ? 0 : -1; }
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.dataset.pane !== way;
  for (const el of document.querySelectorAll('[data-for]')) el.hidden = !el.dataset.for.split(' ').includes(way);
  for (const t of tabs) { t.setAttribute('aria-selected', t.dataset.way === way); t.tabIndex = t.dataset.way === way ? 0 : -1; }
  if (way !== 'extension') bmPanel.setAttribute('aria-labelledby', `asks-tab-${way}`); // Bookmark and Copy & paste share it
  const [h1, drop, who] = WAYS[way];
  hero.querySelector('.act').textContent = h1;
  hero.querySelector('.drop span').textContent = drop;
  hero.querySelector('.who').textContent = who;
};
for (const b of [...radios, ...tabs]) b.onclick = () => show(b.dataset.way);
// Arrow keys move between the ways, as in any radio group or tab list.
for (const [group, items, on] of [[document.querySelector('.ways'), radios, 'aria-checked'], [document.querySelector('.wtabs'), tabs, 'aria-selected']]) {
  group.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = (items.findIndex((b) => b.getAttribute(on) === 'true') + d + items.length) % items.length;
    show(items[i].dataset.way); items[i].focus();
  });
}
for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => show(b.dataset.go);
// The bookmarks bar shortcut and the paste key, as the visitor's keyboard says them.
if (/Mac|iPhone|iPad/.test(navigator.platform)) for (const m of document.querySelectorAll('.mod')) m.textContent = '⌘';
const asked = new URLSearchParams(location.search).get('way');
// Bookmark first until the extension's store links exist; ?way=extension previews the later default.
show(asked in WAYS ? asked : 'bookmark');

// The visitor's browser gets the first store button. Edge, Brave and Opera take Chrome's store.
const firefox = /Firefox\//.test(navigator.userAgent);
const stores = document.querySelector('.stores'), [chrome, fox] = ['chrome', 'firefox'].map((s) => stores.querySelector(`[data-store=${s}]`));
const [first, second] = firefox ? [fox, chrome] : [chrome, fox];
stores.append(first, second);
first.className = 'store first'; second.className = 'store second';
for (const s of [chrome, fox]) s.onclick = () => { document.querySelector('.not-yet').hidden = false; };

// Bookmark way: every 5 s a ghost of the button, with a pointer on it, is dragged straight up to the top line and lands
// there as a chip, right above the button. It skips a turn while the visitor hovers or drags the real button, on phones (no bookmarks bar), and without motion.
const bm = document.querySelector('.bmwrap .bookmark'), drop = hero.querySelector('.drop'), landed = drop.querySelector('.landed');
const still = matchMedia('(prefers-reduced-motion: reduce), (hover: none) and (pointer: coarse), (max-width: 560px)');
let hover = false, dragging = false, drag = null;
bm.addEventListener('pointerenter', () => { hover = true; drag?.cancel(); });
bm.addEventListener('pointerleave', () => { hover = false; });
bm.addEventListener('dragstart', () => { dragging = true; drag?.cancel(); });
bm.addEventListener('dragend', () => { dragging = false; });
const demo = () => {
  setTimeout(demo, 5000);
  if (hero.dataset.way !== 'bookmark' || hover || dragging || still.matches || document.hidden) return;
  const ghost = Object.assign(bm.cloneNode(true), { className: 'bookmark dragghost', tabIndex: -1 });
  ghost.removeAttribute('href'); ghost.ariaHidden = 'true';
  ghost.insertAdjacentHTML('beforeend', '<svg class="gptr" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1 3.8 7.2-2.6 1.3-3.8-7.2L5 20z"/></svg>');
  bm.after(ghost);
  const b = bm.getBoundingClientRect(), d = drop.getBoundingClientRect(), w = landed.offsetWidth;
  landed.style.left = Math.max(8, Math.min(d.width - w - 8, b.left + b.width / 2 - d.left - w / 2)) + 'px';
  const t = landed.getBoundingClientRect(), m = drop.querySelector('.msg').getBoundingClientRect();
  drop.classList.toggle('cover', t.left < m.right && t.right > m.left); // the words step aside only if the chip lands on them
  const at = `translate(${t.left + t.width / 2 - b.left - b.width / 2}px, ${t.top + t.height / 2 - b.top - b.height / 2}px) scale(${t.height / b.height})`;
  drag = ghost.animate([
    { opacity: 0, transform: 'none' },
    { opacity: .95, transform: `translateY(-10px) rotate(-3deg) scale(${DRAG_SCALE})`, offset: .1 }, // lifts at the size of a real drag
    { opacity: .95, transform: at + ' rotate(-2deg)', offset: .72, easing: 'ease-out' },
    { opacity: .95, transform: at, offset: .8 },
    { opacity: 0, transform: at },
  ], { duration: 2300, easing: 'ease-in-out' });
  const land = setTimeout(() => { drop.classList.add('hit'); setTimeout(() => drop.classList.remove('hit'), 2000); }, 1840);
  drag.onfinish = () => ghost.remove();
  drag.oncancel = () => { ghost.remove(); clearTimeout(land); };
};
setTimeout(demo, 1200);

// Browsers keep the clipboard API for secure pages (https, localhost). Elsewhere copy the way the tool does: the older
// copy command, filling the clipboard from its copy event.
const copyText = async (text) => {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const put = (e) => { e.preventDefault(); e.clipboardData.setData('text/plain', text); };
  document.addEventListener('copy', put, true);
  try {
    if (!document.execCommand('copy')) throw new Error('the browser refused to copy here');
  } finally {
    document.removeEventListener('copy', put, true);
  }
};
// Shows on a copy button whether the copy worked, then puts its label back.
const showCopied = (b, ok, done, label) => {
  b.classList.toggle('done', ok); b.lastChild.textContent = ok ? done : 'Could not copy here';
  setTimeout(() => { b.classList.remove('done'); b.lastChild.textContent = label; }, 2500);
};

// Copy & paste: the orange button copies the self-updating bookmark (anyone who can open this page can load its
// updates); the blue one copies the fixed bookmark, for workplaces that block outside scripts.
for (const b of document.querySelectorAll('.copybig')) {
  const label = b.lastChild.textContent;
  b.onclick = () => copyText(document.querySelector(b.dataset.from).getAttribute('href'))
    .then(() => showCopied(b, true, b.dataset.done || 'Copied. Now paste it.', label), () => showCopied(b, false, '', label));
}

// A copy button's tooltip opens above it, below only where above would cover the other button (the row has wrapped and
// that one sits above) or run off the top of the screen while below is clear. Esc closes it without moving the pointer or
// focus away; it comes back on the next visit.
for (const w of document.querySelectorAll('.tipwrap')) {
  const b = w.querySelector('button'), tip = w.querySelector('.tip');
  const place = () => {
    const r = b.getBoundingClientRect(), others = [...w.parentElement.querySelectorAll('button')].filter((x) => x !== b).map((x) => x.getBoundingClientRect());
    const coverAbove = others.some((o) => o.bottom <= r.top + 1), coverBelow = others.some((o) => o.top >= r.bottom - 1);
    w.classList.toggle('up', !coverAbove && (r.top >= tip.offsetHeight + 12 || coverBelow));
  };
  w.addEventListener('pointerenter', place);
  w.addEventListener('focusin', place);
  w.addEventListener('keydown', (e) => { if (e.key === 'Escape') w.classList.add('hush'); });
  for (const t of ['pointerleave', 'focusout']) w.addEventListener(t, () => w.classList.remove('hush'));
}

// Server steps. The file-writing command gets a trailing newline so it runs on paste; the start command does not,
// because its path needs editing first.
for (const b of document.querySelectorAll('.copy2')) b.onclick = () => {
  const text = document.getElementById(b.dataset.copy).textContent.trimEnd();
  copyText(b.dataset.copy === 'srv-text' ? text + '\n' : text).then(() => showCopied(b, true, 'Copied', 'Copy'), () => showCopied(b, false, '', 'Copy'));
};
const code = document.querySelector('.srv-code'), more = code.querySelector('.more'), moreText = more.textContent;
more.onclick = () => { const open = code.classList.toggle('open'); more.textContent = open ? 'Show less' : moreText; if (!open) code.scrollIntoView({ block: 'nearest' }); };

// Story row: native scrolling with snap, plus arrows, dots, arrow keys, and the side cards: clicking the one on the
// right or left moves there. Those two are buttons named after their step, so keyboards and screen readers get them too.
const row = document.querySelector('.row'), cards = [...row.querySelectorAll('.scard')], dotsEl = document.querySelector('.dots');
const dots = cards.map((_, i) => { const b = document.createElement('button'); b.ariaLabel = 'Step ' + (i + 1); dotsEl.append(b); return b; });
const arws = [...document.querySelectorAll('.arw')];
const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
const go = (i) => row.scrollTo({ left: i * step(), behavior: 'smooth' });
// A step's title is its heading without the number and the "only on local pages" tag.
const titles = cards.map((c) => [...c.querySelector('h3').childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim());
// Only the card in view plays its clip; the rest show the clip's first frame. Each clip downloads once; a fresh blob
// address per turn makes the browser start it from its first frame instead of where it left off.
const clips = cards.map((c) => c.querySelector('img[data-clip]')), posters = clips.map((img) => img?.getAttribute('src')), gifs = new Map();
let active = -1;
const play = async (img, i) => {
  if (!gifs.has(img)) gifs.set(img, fetch(img.dataset.clip).then((r) => r.blob()));
  const blob = await gifs.get(img);
  if (active === i) img.src = URL.createObjectURL(blob);
};
const mark = () => {
  const i = Math.min(cards.length - 1, Math.round(row.scrollLeft / step()));
  if (i !== active) {
    active = i;
    clips.forEach((img, j) => {
      if (!img) return;
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      if (j === i) play(img, i); else img.src = posters[j];
    });
    cards.forEach((c, j) => {
      const side = j === i + 1 ? 'Next' : j === i - 1 ? 'Previous' : '';
      c.classList.toggle('side', !!side);
      if (side) { c.role = 'button'; c.tabIndex = 0; c.ariaLabel = `${side}: ${titles[j]}`; }
      else for (const a of ['role', 'tabindex', 'aria-label']) c.removeAttribute(a);
    });
  }
  cards.forEach((c, j) => c.classList.toggle('on', j === i)); dots.forEach((d, j) => d.classList.toggle('on', j === i));
  arws[0].disabled = i === 0; arws[1].disabled = i === cards.length - 1;
};
arws.forEach((b) => b.onclick = () => row.scrollBy({ left: step() * b.dataset.dir, behavior: 'smooth' }));
dots.forEach((d, i) => d.onclick = () => go(i));
row.addEventListener('click', (e) => { const j = cards.indexOf(e.target.closest('.scard')); if (j >= 0 && j !== active) go(j); });
row.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); row.scrollBy({ left: step() * (e.key === 'ArrowRight' ? 1 : -1), behavior: 'smooth' }); }
  const j = cards.indexOf(e.target);
  if ((e.key === 'Enter' || e.key === ' ') && j >= 0 && j !== active) {
    e.preventDefault();
    row.focus({ preventScroll: true }); // the card stops being a button once it is the active one
    go(j);
  }
});
row.addEventListener('scroll', mark, { passive: true });
mark();

// Hero clip: the poster rests. Hover or keyboard focus plays the clip from its first frame; on touch screens a tap does.
const mini = document.querySelector('.mini'), miniImg = mini.querySelector('img'), miniPoster = miniImg.getAttribute('src');
const touch = matchMedia('(hover: none)');
let miniGif = null;
const miniPlay = async (on) => {
  mini.classList.toggle('playing', on);
  if (miniImg.src.startsWith('blob:')) URL.revokeObjectURL(miniImg.src);
  if (!on) { miniImg.src = miniPoster; return; }
  miniGif ??= fetch(miniImg.dataset.clip).then((r) => r.blob());
  const blob = await miniGif;
  if (mini.classList.contains('playing') && !miniImg.src.startsWith('blob:')) miniImg.src = URL.createObjectURL(blob);
};
mini.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && miniPlay(true));
mini.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && miniPlay(false));
mini.addEventListener('focus', () => mini.matches(':focus-visible') && miniPlay(true)); // a tap also focuses: the click handles taps
mini.addEventListener('blur', () => miniPlay(false));
mini.addEventListener('click', () => touch.matches && miniPlay(!mini.classList.contains('playing')));
if (touch.matches) mini.querySelector('.mini-play').lastChild.textContent = 'Tap to play';

// A pressed key lights its row in the keyboard shortcuts card.
addEventListener('keydown', (e) => {
  const t = e.composedPath()[0];
  if (e.ctrlKey || e.metaKey || t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || '')) return;
  const name = e.altKey && e.shiftKey && /^Key[FC]$/.test(e.code) ? 'Alt+Shift+' + e.code[3] : { Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓' }[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  for (const row of document.querySelectorAll('.krow')) if (row.dataset.k.split(' ').includes(name)) { row.classList.remove('lit'); void row.offsetWidth; row.classList.add('lit'); }
}, true);
