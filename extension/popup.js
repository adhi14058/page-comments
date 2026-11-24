// The popup. Opening it starts the tool on this tab (a second click on the icon leaves the tool alone: "Close the tool"
// removes it), asks once per site for the permission that brings pins back after a reload, and lists every page with
// comments, grouped by site. The list is the index content.js keeps.
const api = globalThis.browser ?? chrome;
const $ = (id) => document.getElementById(id);
const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const say = (text) => Object.assign($('why'), { textContent: text, hidden: false });

const [tab] = await api.tabs.query({ active: true, currentWindow: true });
const url = tab?.url || '';
const web = /^https?:/.test(url);
const origin = web ? new URL(url).origin : null;
const site = web ? origin + '/*' : null;

$('version').textContent = 'v' + api.runtime.getManifest().version;
const command = (await api.commands.getAll()).find((c) => c.name === 'start');
$('key').textContent = command?.shortcut || '';
$('key').title = 'Starts or closes the tool on this page';
$('key').hidden = !command?.shortcut;

if (!web) say('page-comments works on web pages (addresses starting with http or https).');
else {
  // While this port is open the page ignores its next click: the click that closes the popup also lands on the page.
  api.runtime.connect({ name: 'popup:' + tab.id });
  // Opening the popup lets us run on this tab; the background starts the tool unless it already runs.
  api.runtime.sendMessage({ type: 'open', tabId: tab.id })
    .then((r) => (r?.error ? Promise.reject(new Error(r.error)) : ($('here').hidden = false)))
    .catch((err) => say('Could not start here: ' + err.message));
}
$('close').onclick = () => api.runtime.sendMessage({ type: 'close', tabId: tab.id }).then(() => close(), () => close());

// "Not now" is remembered per site, so the question never comes back there; allowing can still be done from the
// browser's own extension menu.
const { declined = {} } = await api.storage.local.get('declined');
$('keep').hidden = !web || declined[origin] || (await api.permissions.contains({ origins: [site] }));
$('allow').onclick = () => {
  // The browser asks only straight from this click, so the request comes before anything is awaited. Firefox closes
  // the popup while it shows its question; the tool already runs either way.
  api.permissions.request({ origins: [site] }).then((ok) => { if (ok) $('keep').hidden = true; }, () => {});
};
$('later').onclick = async () => {
  declined[origin] = true;
  await api.storage.local.set({ declined });
  $('keep').hidden = true;
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
      onclick: () => (page === here ? close() : api.tabs.create({ url: page }).then(() => close())),
    }, el('span', {}, el('b', { textContent: p.title }), el('small', { textContent: page === here ? `This page · ${p.count} comment${p.count === 1 ? '' : 's'}` : `${new URL(page).pathname} · ${ago(p.at)}` })),
    el('span', { className: 'cnt', textContent: p.count }))),
  ]) : [el('p', { className: 'empty', textContent: f ? 'No commented page matches.' : 'Pages you comment on show up here.' })]));
};
$('search').oninput = (e) => draw(e.target.value);
draw();
