// Dark mode: the visitor's system setting, unless they picked one with the switch (remembered). Runs in <head>, so the
// page never flashes the wrong theme.
(() => {
  const root = document.documentElement, KEY = 'page-comments-theme';
  const saved = localStorage.getItem(KEY);
  root.classList.toggle('dark', saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  addEventListener('DOMContentLoaded', () => {
    const b = Object.assign(document.createElement('button'), { className: 'theme-btn', type: 'button' });
    const paint = () => {
      const dark = root.classList.contains('dark');
      b.innerHTML = dark ? SUN : MOON;
      b.ariaLabel = b.title = dark ? 'Switch to light' : 'Switch to dark';
    };
    b.onclick = () => { localStorage.setItem(KEY, root.classList.toggle('dark') ? 'dark' : 'light'); paint(); };
    paint();
    document.body.append(b);
  });
})();
