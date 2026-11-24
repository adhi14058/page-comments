// The top bar and the go-up button, on the install page and the changelog. On the install page the bar stays hidden
// while the install card is on screen and slides in once it scrolls away, carrying the way picked there (index.js shows
// the matching action); its links mark the section being read. On the changelog the bar is always there, and the go-up
// button appears once the page's header scrolls away.
(() => {
  const doc = document.documentElement, nav = document.querySelector('.bnav'), up = document.querySelector('.goup');
  const gate = document.querySelector('.install') || document.querySelector('.top');
  const list = nav.querySelector('.bnav-links'), links = [...list.querySelectorAll('a')];
  const menu = nav.querySelector('.bnav-menu'), now = menu.querySelector('.bnav-now');
  // Only links to this page's own sections are marked; the changelog's links lead to the install page.
  const spied = links.filter((a) => a.getAttribute('href').startsWith('#')), secs = spied.map((a) => document.querySelector(a.hash));
  // The section being read is the one under a line that slides from the top of the screen to its bottom as the page
  // scrolls, so the last section counts once the page is scrolled to its end, however short it is.
  const current = () => {
    const max = doc.scrollHeight - innerHeight, y = scrollY + innerHeight * (max > 0 ? Math.min(1, scrollY / max) : 1);
    return secs.findLastIndex((s) => s.getBoundingClientRect().top + scrollY <= y);
  };
  let cur = null;
  const update = () => {
    doc.classList.toggle('past', gate.getBoundingClientRect().bottom < 0);
    const i = current();
    if (i === cur) return;
    cur = i;
    spied.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    now.textContent = i >= 0 ? spied[i].textContent : 'Sections';
  };
  let queued = false;
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', later);
  update();

  // Narrow screens: the links fold into a list under the Sections button.
  const close = () => { nav.classList.remove('open'); menu.ariaExpanded = 'false'; };
  menu.onclick = () => { const o = nav.classList.toggle('open'); menu.ariaExpanded = String(o); if (o) (spied[cur] || links[0]).focus(); };
  list.addEventListener('click', (e) => e.target.closest('a') && close());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); menu.focus(); } });
  addEventListener('pointerdown', (e) => { if (!nav.contains(e.target)) close(); });

  // The page-comments tool, run on this page from a bookmark, keeps its round button (with its list of keys above it) in
  // one corner: bottom right unless the visitor drags it. Its layer hangs on <html>, in an open shadow root. While the
  // button sits in the go-up button's corner, the go-up button takes the other bottom corner.
  setInterval(() => {
    let w = null;
    for (const el of doc.children) w = el.shadowRoot?.querySelector('.widget') || w;
    up.classList.toggle('swap', !!w && !w.classList.contains('top') && !w.classList.contains('left'));
  }, 500);
})();
