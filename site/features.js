// The features section ("What else it does"). With a mouse on a wide screen one big slot shows a feature in full and five
// small slots show the rest. Resting on a small tile (an orange bar fills along its bottom) or clicking it moves it into
// the big slot, and the big tile takes its place, animated from where each was (FLIP: measure, swap, then play each tile
// from its old box to its new one). The choice stays when the pointer leaves. On touch screens and phones the tiles
// stack and a tap opens or closes a tile in place. Drawings play when their tile comes into view and again when the
// pointer enters it.
(() => {
  const grid = document.querySelector('.feats .swap'), tiles = [...grid.children];
  const wide = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const REST = 250, SWAP = 220; // ms: the rest before a swap, and the swap's animation
  grid.style.setProperty('--rest', `${REST}ms`); // the bar fills in the same time

  // features.css animates a drawing under .anim; taking it off and back restarts the animation.
  const play = (el) => { el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim'); };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { play(e.target); io.unobserve(e.target); } }), { threshold: 0.5 });
  tiles.forEach((t) => { io.observe(t); t.addEventListener('mouseenter', () => play(t)); });

  // busy: a swap is animating. lock: the slot the pointer was in when the last swap began; nothing swaps again until the
  // pointer leaves that slot, so a small move after a swap never swaps the two tiles back. resting: the tile whose bar fills.
  let busy = false, lock = null, resting = null, timer = 0, over = null;
  const stop = () => { clearTimeout(timer); resting?.classList.remove('resting'); resting = null; };

  const mark = () => tiles.forEach((t) => t.setAttribute('aria-expanded', String(t.classList.contains('open'))));
  // On a wide screen only the tile in the big slot is open.
  const sync = () => { if (wide.matches) tiles.forEach((t) => t.classList.toggle('open', t.dataset.slot === 'big')); mark(); };

  // Moves t into the big slot and the big tile into t's slot. The markup follows (the big slot's tile first, then the
  // small ones in order), so Tab goes through the tiles in the order they show.
  const promote = (t) => {
    stop();
    const old = tiles.find((x) => x.dataset.slot === 'big');
    if (busy || t === old) return;
    lock = t.dataset.slot;
    const moving = [t, old], first = moving.map((el) => el.getBoundingClientRect());
    [t.dataset.slot, old.dataset.slot] = [old.dataset.slot, t.dataset.slot];
    const focused = document.activeElement, next = t.nextElementSibling;
    grid.prepend(t);
    if (next) next.before(old); else grid.append(old);
    // Moving an element in the markup drops its focus; give it back where it was.
    if (focused !== document.activeElement) focused.focus({ preventScroll: true });
    sync();
    play(t);
    if (still.matches) return;
    busy = true;
    t.style.zIndex = 2;
    const runs = moving.map((el, k) => {
      const f = first[k], l = el.getBoundingClientRect();
      return el.animate([{ transform: `translate(${f.left - l.left}px, ${f.top - l.top}px) scale(${f.width / l.width}, ${f.height / l.height})` }, { transform: 'none' }],
        { duration: SWAP, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    });
    Promise.all(runs.map((r) => r.finished)).then(() => { busy = false; t.style.zIndex = ''; });
  };

  const choose = (t) => {
    // A click in the locked slot lands on the tile that just left the big slot; it stays put, as for a rest.
    if (wide.matches) { if (t.dataset.slot !== lock) promote(t); return; }
    t.classList.toggle('open');
    mark();
    if (t.classList.contains('open')) play(t);
  };
  tiles.forEach((t) => {
    t.append(Object.assign(document.createElement('i'), { className: 'dwell' }));
    t.addEventListener('click', (e) => {
      // Inside an open tile, clicks belong to its contents (selecting Copy's text, scrolling it).
      if (t.classList.contains('open') && (wide.matches || e.target.closest('.ctext'))) return;
      choose(t);
    });
    t.addEventListener('keydown', (e) => {
      if (e.target !== t || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (!wide.matches) choose(t); else if (t.dataset.slot !== 'big') promote(t);
    });
  });

  // The tile in the slot under the pointer, from the layout (offsets), which neither the hover lift nor the swap
  // animation moves. Hit-testing the tiles themselves would follow both, and a tile sliding under a still pointer would
  // count as entered.
  const slotAt = (e) => {
    const g = grid.getBoundingClientRect(), x = e.clientX - g.left, y = e.clientY - g.top;
    return tiles.find((t) => x >= t.offsetLeft && x < t.offsetLeft + t.offsetWidth && y >= t.offsetTop && y < t.offsetTop + t.offsetHeight) || null;
  };
  const hover = (t) => { if (t !== over) { over?.classList.remove('over'); t?.classList.add('over'); over = t; } };
  grid.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !wide.matches || busy) return;
    const t = slotAt(e);
    hover(t);
    if (lock && t?.dataset.slot === lock) return;
    lock = null;
    if (t === resting) return;
    stop();
    if (!t || t.dataset.slot === 'big') return;
    resting = t;
    t.classList.add('resting');
    timer = setTimeout(() => promote(t), REST);
  });
  grid.addEventListener('pointerleave', () => { stop(); hover(null); lock = null; });
  // A scroll carries the tiles away from a still pointer.
  addEventListener('scroll', stop, { passive: true });

  wide.addEventListener('change', () => { stop(); sync(); });
  sync();
})();
