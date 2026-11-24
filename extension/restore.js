// On sites you allowed, this runs on every page load: when the page has comments, it asks for the tool, so the pins
// come back after a reload. Pages without comments cost nothing more than this check. extension/build.js bundles it
// with the core's pageKey, so it finds a page's comments exactly as the tool does.
import { pageKey } from '../core/core.js';

try {
  const page = pageKey(location.href);
  if (JSON.parse(localStorage.getItem('page-comments:v1') || '[]').some((c) => pageKey(c.page) === page)) (globalThis.browser ?? chrome).runtime.sendMessage({ type: 'inject' });
} catch {}
