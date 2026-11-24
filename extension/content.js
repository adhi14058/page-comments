// The extension's side of page-comments, run inside a tab when you click the icon (which opens the popup), press the
// shortcut, or (on sites you allowed) when a page that has comments loads. extension/build.js bundles it with
// core.js into dist/<browser>/content.js. It runs in the extension's own isolated copy of the page's scripts: the page
// cannot see or call it, but it shares the page's DOM, localStorage and IndexedDB, so comments made with the bookmark
// show up here and the other way round.
import { startPageComments } from '../core/core.js';

const api = globalThis.browser ?? chrome;
const html = document.documentElement;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Chrome allows two captureVisibleTab calls a second; a batch takes one picture per pick.
let lastShot = 0;
const grab = async () => {
  await new Promise(requestAnimationFrame); // the core waited one frame after hiding the tool; one more to be safe
  const wait = lastShot + 550 - Date.now();
  if (wait > 0) await sleep(wait);
  lastShot = Date.now();
  const reply = await api.runtime.sendMessage({ type: 'capture' });
  // Without a fresh click on the icon or the shortcut (after a reload in Firefox, after leaving the site in Chrome),
  // the browser refuses: say what to do instead of failing silently.
  if (!reply?.dataUrl) throw new Error('click the page-comments icon (or press its shortcut) to take sharp pictures here');
  const bytes = Uint8Array.from(atob(reply.dataUrl.slice(reply.dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const source = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  return { source, k: source.width / innerWidth };
};

// Messages carry text, so pictures travel as base64.
const toBase64 = (bytes) => {
  // The bytes come from a picture the page's canvas made; in Firefox, reading them across into our world throws, so
  // copy them into our own array first.
  bytes = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// The list of all commented pages, shown in the popup. Pages without comments drop out.
const remember = async ({ page, title, count }) => {
  const { index = {} } = await api.storage.local.get('index');
  if (count) index[page] = { title: title || page, count, at: Date.now() };
  else delete index[page];
  await api.storage.local.set({ index });
};

// The background sets this flag when it brings the tool back after a reload: then it starts in browsing mode, showing
// the pins without taking over clicks.
const start = () => {
  const restoring = globalThis.__pageCommentsRestore;
  delete globalThis.__pageCommentsRestore;
  // One tool per page: an open bookmark tool closes first; the comments stay, as both use the same storage.
  if (html.dataset.pageComments === 'bookmark') document.dispatchEvent(new CustomEvent('page-comments:close'));
  startPageComments({
    name: 'extension',
    shadowMode: 'closed', // our buttons can take pictures and save files: page scripts must not be able to press them
    checkVersion: false, // the store updates the extension
    startBrowsing: !!restoring,
    pictureType: 'image/png', // captureVisibleTab is lossless; WebP would make thin coloured text pale again
    capture: { ready: () => true, start: async () => {}, grab, stop: () => {} },
    saveFiles: async (files) => {
      const reply = await api.runtime.sendMessage({ type: 'save', files: files.map((f) => ({ name: f.name, data: toBase64(f.bytes) })) });
      if (reply?.error) return `Could not save the pictures (${reply.error}).`;
      return files.length === 1 ? `Saved ${files[0].name} to your Downloads folder.` : `Saved ${files.length} pictures to your Downloads folder.`;
    },
    onComments: (info) => remember(info).catch(() => {}),
  });
};

// The first run on a page marks it, so the bookmark can hand over to us (see bookmarklet/bookmark.js); every later run only
// switches the tool on or off (the core closes itself when started twice).
if (!globalThis.__pageCommentsExtension) {
  globalThis.__pageCommentsExtension = true;
  html.dataset.pageCommentsExtension = '1';
  document.addEventListener('page-comments:start', start);
  // A click on the page while the popup shows closes the popup and also lands on the page (measured in Chrome), where
  // it would open a comment box: skip that one click. Registered before the core's listeners on window, so it runs
  // first. The background says when the popup opens and closes; a short grace covers its close message arriving
  // before the click does.
  let armed = false, skipUntil = 0;
  api.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'popup') return;
    if (msg.open) armed = true;
    else setTimeout(() => { armed = false; }, 300);
  });
  const skip = (e) => {
    if (e.type === 'pointerdown' && armed) { armed = false; skipUntil = Date.now() + 1000; }
    if (Date.now() > skipUntil) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.type === 'click') skipUntil = 0;
  };
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) addEventListener(type, skip, true);
}
start();
