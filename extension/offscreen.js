// Chrome only: makes blob URLs for pictures to download (the service worker cannot). Each lives a minute.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type !== 'blob') return;
  const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0))], { type: 'image/png' }));
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  reply(url);
});
