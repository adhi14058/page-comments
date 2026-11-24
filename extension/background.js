// The extension's background: takes the pictures, saves files, starts the tool from the shortcut, and keeps pins coming
// back after reloads on the sites you allowed.
const api = globalThis.browser ?? chrome;

// restoring: brought back after a reload, so the tool starts in browsing mode (see content.js).
const inject = async (tabId, restoring = false) => {
  if (restoring) await api.scripting.executeScript({ target: { tabId }, func: () => { globalThis.__pageCommentsRestore = true; } });
  await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
};

// The shortcut switches the tool on and off: content.js run on a page that has the tool open closes it.
api.commands.onCommand.addListener((command, tab) => {
  if (command === 'start' && tab?.id) inject(tab.id).catch(() => {});
});

// Whether the tool is open on the tab. The core sets __pageComments in our isolated world while it runs, and this
// function runs in that same world.
const running = async (tabId) => {
  const [r] = await api.scripting.executeScript({ target: { tabId }, func: () => !!globalThis.__pageComments });
  return !!r?.result;
};
const popups = new Set(); // tabs whose popup is showing
const tellPopup = (tabId) => api.tabs.sendMessage(tabId, { type: 'popup', open: popups.has(tabId) }).catch(() => {});

// The popup holds a port open while it shows. A click on the page closes the popup and also lands on the page, so
// the page skips that one click; closing the popup any other way ends the skip.
api.runtime.onConnect.addListener((port) => {
  const tabId = Number(port.name.match(/^popup:(\d+)$/)?.[1]);
  if (!tabId) return;
  popups.add(tabId);
  port.onDisconnect.addListener(() => { popups.delete(tabId); tellPopup(tabId); });
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
  // The popup opened: start the tool unless it already runs (running content.js again would close it).
  if (msg.type === 'open') {
    running(msg.tabId).then((on) => on || inject(msg.tabId)).then(() => tellPopup(msg.tabId))
      .then(() => reply({}), (err) => reply({ error: err.message }));
    return true;
  }
  if (msg.type === 'close') {
    api.scripting.executeScript({ target: { tabId: msg.tabId }, func: () => globalThis.__pageComments?.() })
      .then(() => reply({}), (err) => reply({ error: err.message }));
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
