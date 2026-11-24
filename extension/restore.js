// On sites you allowed, this runs on every page load: when the page has comments, it asks for the tool, so the pins
// come back after a reload. Pages without comments cost nothing more than this check.
try {
  const page = location.href.split('#')[0];
  if (JSON.parse(localStorage.getItem('page-comments:v1') || '[]').some((c) => c.page === page)) (globalThis.browser ?? chrome).runtime.sendMessage({ type: 'inject' });
} catch {}
