const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HOME, releases, sitemap, fill } = require('./site.js');

test('the changelog page gets every release in order, with its date and escaped points', () => {
  const md = '# page-comments releases\n\nWhat changed.\n\n## 1.9.11 — 2026-11-24\n\n- Paste into `<input>` & more.\n- Second.\n\n## 1.1.x — 2026-01-05\n\n- Old.\n';
  assert.deepStrictEqual(releases(md), [
    { version: '1.9.11', iso: '2026-11-24', date: '24 Nov 2026', points: ['Paste into <code>&lt;input&gt;</code> &amp; more.', 'Second.'] },
    { version: '1.1.x', iso: '2026-01-05', date: '5 Jan 2026', points: ['Old.'] },
  ]);
});

test('a line the page cannot show stops the build', () => {
  assert.throws(() => releases('## 1.0.0 — 2026-11-24\n\nA paragraph.\n'), /line 3/);
  assert.throws(() => releases('## 1.0.0 (2026-11-24)\n\n- x\n'), /line 1/);
  assert.throws(() => releases('## 1.0.0 — 2026-11-24\n\n'), /no points/);
});

// The website reads the running tool from outside: nav.js finds its round button (.widget) and the corner it sits in
// (.top, .left); the playground's pop-ups point at its bar (.bar) and keep clear of every part but its outlines (.hl,
// .picked), through its open shadow root; the playground reads saved comments under the tool's storage key. Renaming
// any of these in the tool would quietly break the site.
test('the tool still has the class names and storage key the website relies on', () => {
  const core = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'core', 'core.js'), 'utf8');
  for (const sel of ['.widget', '.widget.top', '.widget.left', '.bar', '.hl', '.picked']) {
    assert.match(core, new RegExp(`^\\s*${sel.replace(/\./g, '\\.')}[\\s{,.:]`, 'm'), `core.js no longer styles ${sel}`);
  }
  assert.match(core, /attachShadow\(\{ mode: platform\.shadowMode \|\| 'open' \}\)/, 'the bookmark no longer opens its shadow root');
  assert.match(core, /const KEY = 'page-comments:v1';/);
});

test('the sitemap dates every page by the newest release', () => {
  const xml = sitemap(releases('## 1.9.11 — 2026-11-24\n\n- x\n\n## 1.9.10 — 2026-11-20\n\n- y\n'));
  assert.deepStrictEqual([...xml.matchAll(/<loc>(.*?)<\/loc><lastmod>(.*?)</g)].map((m) => [m[1], m[2]]),
    [[HOME, '2026-11-24'], [`${HOME}changelog.html`, '2026-11-24'], [`${HOME}privacy.html`, '2026-11-24']]);
});

// A link preview or an icon pointing at a missing file fails quietly: the page still works, the preview has no picture.
test('every icon, manifest and preview picture the pages name exists, and the structured data parses', () => {
  const src = path.join(__dirname, '..', 'site-src');
  for (const page of ['index.html', 'changelog.html', 'privacy.html']) {
    const html = fill(fs.readFileSync(path.join(src, page), 'utf8'), new Proxy({}, { has: () => true, get: (_, k) => (k === 'home' ? HOME : '1.0.0') }));
    const urls = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"|<meta property="og:image" content="([^"]+)"/g)].map((m) => m[1] ?? m[2]);
    assert.ok(urls.length >= 5, page);
    for (const u of urls) assert.ok(fs.existsSync(path.join(src, u.replace(HOME, ''))), `${page} names ${u}`);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
  }
  for (const icon of JSON.parse(fs.readFileSync(path.join(src, 'site.webmanifest'), 'utf8')).icons) assert.ok(fs.existsSync(path.join(src, icon.src)), icon.src);
});
