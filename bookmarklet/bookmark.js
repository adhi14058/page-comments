// The bookmark's side of page-comments: pictures through Chrome's tab capture, several pictures saved as one zip, and
// a check for newer versions (a bookmark keeps the copy it was dragged with on sites that block outside scripts).
// build.js bundles this file with core.js into the bookmark. The extension has its own file with the same shape.
import { startPageComments } from '../core/core.js';

// Chrome asks "Share this tab?" the first time a picture is needed; the capture then stays on until the tool closes,
// so later pictures need no prompt.
let capture = null;
const startCapture = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true });
  const video = Object.assign(document.createElement('video'), { srcObject: stream, muted: true });
  await video.play();
  stream.getVideoTracks()[0].addEventListener('ended', () => { capture = null; });
  capture = { stream, video };
};
// The captured picture runs behind the screen, so after hiding the tool, wait for a frame captured after that
// moment; a frame merely shown after it can still be an older picture with the tool in it. If Chrome gives no
// capture time, wait 250 ms instead. Give up waiting after a second.
const frameAfter = (video, since) => new Promise((ok) => {
  const done = setTimeout(ok, 1000);
  const check = (now, meta) => {
    const fresh = meta.captureTime ? meta.captureTime > since : now > since + 250;
    if (fresh) { clearTimeout(done); ok(); } else video.requestVideoFrameCallback(check);
  };
  video.requestVideoFrameCallback(check);
});

// Several pictures go in one ZIP, so they are one download (no "allow several downloads" question, one save window at
// most). It stores the files as they are: PNGs are compressed already.
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = (bytes) => { let c = ~0; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
const zip = (files) => {
  const now = new Date(), utf8 = new TextEncoder(), parts = [], central = [];
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let offset = 0;
  for (const f of files) {
    const name = utf8.encode(f.name), crc = crc32(f.bytes), size = f.bytes.length;
    const local = new DataView(new ArrayBuffer(30)), dir = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, name.length, 2]]
      .forEach(([at, v, n]) => (n === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, name.length, 2], [42, offset, 4]]
      .forEach(([at, v, n]) => (n === 4 ? dir.setUint32(at, v, true) : dir.setUint16(at, v, true)));
    parts.push(new Uint8Array(local.buffer), name, f.bytes);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + size;
  }
  const end = new DataView(new ArrayBuffer(22)), dirSize = central.reduce((sum, p) => sum + p.length, 0);
  [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, dirSize, 4], [16, offset, 4]]
    .forEach(([at, v, n]) => (n === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true)));
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
};
const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// The extension, when it runs on this page, marks it (data-page-comments-extension) and takes over: one tool per page,
// with its sharper pictures. Where it does not run (it needs a click on its icon or the site's permission), the
// bookmark cannot see it and runs itself. An open extension tool is closed the same way (run twice = close).
if (document.documentElement.dataset.pageCommentsExtension) document.dispatchEvent(new CustomEvent('page-comments:start'));
else startPageComments({
  name: 'bookmark',
  checkVersion: PAGE_COMMENTS_UPDATES, // 'site' or 'github': build.js makes one bookmark of each (esbuild --define)
  capture: {
    ready: () => !!capture,
    start: startCapture,
    grab: async () => {
      const { video } = capture;
      await frameAfter(video, performance.now());
      return { source: video, k: video.videoWidth / innerWidth };
    },
    stop: () => {
      capture?.stream.getTracks().forEach((t) => t.stop());
      capture = null;
    },
  },
  saveFiles: (files, zipName) => {
    if (files.length === 1) {
      download(new Blob([files[0].bytes], { type: 'image/png' }), files[0].name);
      return `Saved ${files[0].name} to your Downloads folder.`;
    }
    download(zip(files), zipName);
    return `Saved ${files.length} pictures in one zip: open it, then drag the pictures into Slack together.`;
  },
});
