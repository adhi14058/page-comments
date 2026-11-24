// Builds the browser extension into extension/dist/chrome/ (load it with "Load unpacked" on chrome://extensions, with
// Developer mode on) and extension/dist/firefox/ (about:debugging → Load Temporary Add-on → its manifest.json). content.js is core.js (the same tool as the bookmark) bundled with extension/content.js; the other
// files are copied as they are. The version is release.json's extension version: the bookmark's, with a fourth number
// added for a release that changed only the extension (see bookmarklet/version.js).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SRC = __dirname;
const FILES = ['background.js', 'restore.js', 'offscreen.html', 'offscreen.js', 'popup.html', 'popup.css', 'popup.js'];

const manifest = (version, browser) => ({
  manifest_version: 3,
  name: 'Page Comments',
  version,
  description: 'Point at things on any web page, say what should change, and hand it to Claude Code, Slack, Jira or a teammate.',
  icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  action: { default_popup: 'popup.html', default_title: 'page-comments', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
  // activeTab: run on the tab you clicked the icon on (or pressed the shortcut on), and take sharp pictures of it.
  // Sites are asked for one at a time (optional_host_permissions), only so pins come back after a reload.
  permissions: ['activeTab', 'scripting', 'storage', 'downloads', ...(browser === 'chrome' ? ['offscreen'] : [])],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  // Chrome runs the background as a service worker; Firefox has no service workers for extensions and runs it as a page.
  background: browser === 'chrome' ? { service_worker: 'background.js' } : { scripts: ['background.js'] },
  // Not C or F: the tool uses Alt+Shift+C and Alt+Shift+F on the page, and the browser would take them first.
  commands: { start: { suggested_key: { default: 'Alt+Shift+P' }, description: 'Start or close page-comments on this page' } },
  // Firefox: a fixed ID (AMO assigns none), 153+ (content scripts can set adoptedStyleSheets from 153, Mozilla bug
  // 1928865), and the required data declaration: nothing leaves the device (share links live in the link itself,
  // Send to Claude talks to a server on this computer).
  ...(browser === 'firefox' ? { browser_specific_settings: { gecko: { id: 'page-comments@heyadhi.com', strict_min_version: '153.0', data_collection_permissions: { required: ['none'] } } } } : {}),
});

module.exports = (version) => {
  const content = execFileSync('npx', ['-y', 'esbuild@0.28.2', 'content.js', '--bundle', '--format=iife'], { cwd: __dirname, encoding: 'utf8' });
  if (!content.includes('__PAGE_COMMENTS_VERSION__')) throw new Error('core.js lost its __PAGE_COMMENTS_VERSION__ placeholder');
  for (const browser of ['chrome', 'firefox']) {
    const out = path.join(SRC, 'dist', browser);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
    fs.writeFileSync(path.join(out, 'content.js'), content.replace('__PAGE_COMMENTS_VERSION__', version));
    // The offscreen page exists only for Chrome's service worker (see background.js).
    for (const f of FILES.filter((f) => browser === 'chrome' || !f.startsWith('offscreen'))) fs.copyFileSync(path.join(SRC, f), path.join(out, f));
    for (const s of [16, 32, 48, 128]) fs.copyFileSync(path.join(__dirname, '..', 'core', 'icons', `icon-${s}.png`), path.join(out, 'icons', `icon-${s}.png`));
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest(version, browser), null, 2) + '\n');
  }
  return path.join(SRC, 'dist');
};

if (require.main === module) console.log('built', module.exports(require('../release.json').extension?.version ?? require('../release.json').version));
