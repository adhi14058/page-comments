// The popup: "Comment on this page" (asking, the first time on a site, for the permission that brings pins back after a
// reload), then every page with comments, grouped by site. The list is the index content.js keeps.
const api = globalThis.browser ?? chrome;
const $ = (id) => document.getElementById(id);
const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

const [tab] = await api.tabs.query({ active: true, currentWindow: true });
const url = tab?.url || '';
const web = /^https?:/.test(url);
const site = web ? new URL(url).origin + '/*' : null;
const allowed = site ? await api.permissions.contains({ origins: [site] }) : false;

$('version').textContent = 'v' + api.runtime.getManifest().version;
const command = (await api.commands.getAll()).find((c) => c.name === 'start');
$('key').textContent = command?.shortcut || '';
$('key').hidden = !command?.shortcut;
$('why').textContent = !web ? 'page-comments works on web pages (addresses starting with http or https).'
  : allowed ? 'Pins come back after a reload on this site.'
  : 'The first time on a site, your browser asks to let page-comments read and change it. That is only so your pins come back after a reload; say no and everything else still works.';
$('start').disabled = !web;
$('start').onclick = () => {
  // The browser asks only straight from this click, so the question comes first, before anything is awaited. The tool
  // starts at once either way (opening this popup lets us run on this tab); the background does it, because Firefox
  // closes the popup when it shows its question.
  if (!allowed) api.permissions.request({ origins: [site] }).catch(() => {});
  api.runtime.sendMessage({ type: 'start', tabId: tab.id }).then((r) => (r?.error ? Promise.reject(new Error(r.error)) : close()))
    .catch((err) => { $('why').textContent = 'Could not start here: ' + err.message; });
};

const ago = (t) => {
  const d = Math.round((Date.now() - t) / 86400000);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'last week' : `${Math.round(d / 7)} weeks ago`;
};
const { index = {} } = await api.storage.local.get('index');
const here = url.split('#')[0];
const draw = (filter = '') => {
  const f = filter.trim().toLowerCase();
  const pages = Object.entries(index).filter(([page, p]) => !f || page.toLowerCase().includes(f) || p.title.toLowerCase().includes(f));
  const bySite = new Map();
  for (const [page, p] of pages.sort((a, b) => b[1].at - a[1].at)) {
    const host = new URL(page).host;
    if (!bySite.has(host)) bySite.set(host, []);
    bySite.get(host).push([page, p]);
  }
  $('list').replaceChildren(...(bySite.size ? [...bySite].flatMap(([host, list]) => [
    el('div', { className: 'site' }, el('span', { textContent: host }), el('span', { textContent: `${list.length} page${list.length === 1 ? '' : 's'}` })),
    ...list.map(([page, p]) => el('button', {
      className: 'pg' + (page === here ? ' here' : ''), title: page,
      onclick: () => (page === here ? $('start').click() : api.tabs.create({ url: page }).then(() => close())),
    }, el('span', {}, el('b', { textContent: p.title }), el('small', { textContent: page === here ? `This page · ${p.count} comment${p.count === 1 ? '' : 's'}` : `${new URL(page).pathname} · ${ago(p.at)}` })),
    el('span', { className: 'cnt', textContent: p.count }))),
  ]) : [el('p', { className: 'empty', textContent: f ? 'No commented page matches.' : 'Pages you comment on show up here.' })]));
};
$('search').oninput = (e) => draw(e.target.value);
draw();
