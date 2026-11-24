// The extension's background: takes the pictures, saves files, starts the tool from the shortcut, and keeps pins coming
// back after reloads on the sites you allowed.
const api = globalThis.browser ?? chrome;

// restoring: brought back after a reload, so the tool starts in browsing mode (see content.js).
const inject = async (tabId, restoring = false) => {
  if (restoring) await api.scripting.executeScript({ target: { tabId }, func: () => { globalThis.__pageCommentsRestore = true; } });
  await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
};

api.commands.onCommand.addListener((command, tab) => {
  if (command === 'start' && tab?.id) inject(tab.id).catch(() => {});
});

const bytesOf = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
// A file to download needs a URL. Firefox's background page can make a blob URL; Chrome's service worker cannot, so a
// hidden offscreen page makes it there (a data: URL would do, but Chrome drops URLs over 2 MB between processes).
const blobUrl = async (base64) => {
  if (typeof URL.createObjectURL === 'function') return URL.createObjectURL(new Blob([bytesOf(base64)], { type: 'image/png' }));
  if (!(await api.offscreen.hasDocument())) {
    await api.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Turn saved pictures into files to download' });
  }
  return api.runtime.sendMessage({ type: 'blob', data: base64 });
};
const save = async (files) => {
  for (const f of files) await api.downloads.download({ url: await blobUrl(f.data), filename: f.name, conflictAction: 'uniquify' });
};

api.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'capture') {
    api.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }).then((dataUrl) => reply({ dataUrl }), (err) => reply({ error: err.message }));
    return true;
  }
  if (msg.type === 'save') {
    save(msg.files).then(() => reply({}), (err) => reply({ error: err.message }));
    return true;
  }
  if (msg.type === 'inject' && sender.tab?.id) inject(sender.tab.id, true).catch(() => {});
  if (msg.type === 'start') {
    inject(msg.tabId).then(() => reply({}), (err) => reply({ error: err.message }));
    return true;
  }
});

// Pins come back after a reload only on sites you allowed (the popup asks the first time). restore.js runs there on
// every page load and asks for the tool when the page has comments.
const syncRestore = async () => {
  const { origins = [] } = await api.permissions.getAll();
  const sites = origins.filter((o) => /^https?:/.test(o));
  await api.scripting.unregisterContentScripts({ ids: ['restore'] }).catch(() => {});
  if (sites.length) await api.scripting.registerContentScripts([{ id: 'restore', matches: sites, js: ['restore.js'], runAt: 'document_idle' }]);
};
api.permissions.onAdded.addListener(syncRestore);
api.permissions.onRemoved.addListener(syncRestore);
api.runtime.onInstalled.addListener(syncRestore); // Firefox clears registered scripts on update
