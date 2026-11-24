// Builds the install page (the bookmarklet from core.js + bookmark.js, and a shell command that writes server.js) and
// publishes it over the existing page at https://page-comments.share.heyadhi.com/. No local copy is kept.
// Re-run after every change to core.js, bookmark.js, server.js or this page. Bookmarks load the new client.js on their own, except
// on sites that block outside scripts, where they run the copy they were dragged with.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { stripComments, highlight } = require('./highlight.js');

const SITE = 'page-comments';
const SITE_URL = `https://${SITE}.share.heyadhi.com/`; // also SITE in core.js
const ROOT = path.join(__dirname, '..'); // the repository: release.json, CHANGELOG.md and the built files live there
const SHARE_CLI = path.join(os.homedir(), '.local/share/heyadhi-share/heyadhi.mjs');

// esbuild is fetched by npx, nothing to install.

// The bookmark's code: core.js (the tool, shared with the extension) bundled with bookmark.js (its way of taking pictures,
// saving files and finding updates) into one function call. updates: where the copy looks for a newer release and
// sends its Help line ('site': everything on the share site; 'github': bookmarklet.txt, for networks that reach only
// github.com).
const bundle = (updates) => {
  const minifiedJs = execFileSync('npx', ['-y', 'esbuild@0.28.2', 'bookmark.js', '--bundle', '--format=iife', '--minify', `--define:PAGE_COMMENTS_UPDATES="${updates}"`],
    { cwd: __dirname, encoding: 'utf8' }).trim();
  // The UI's styles sit in one template string, which the JS minifier leaves alone; minify them as CSS too (about 8%).
  const uiCss = minifiedJs.match(/replaceSync\(`([\s\S]*?)`\)/)?.[1];
  if (!uiCss || uiCss.includes('${')) throw new Error('core.js styles not found as a plain template string');
  const cssMin = execFileSync('npx', ['-y', 'esbuild@0.28.2', '--minify', '--loader=css'], { input: uiCss, encoding: 'utf8' }).trim();
  return minifiedJs.replace(uiCss, () => cssMin.replace(/[`\\]/g, '\\$&'));
};
const raw = bundle('site'), rawGithub = bundle('github');
// Releases are major.minor.patch. release.json keeps the last published version and a hash of its code: changed code
// gets the next patch (or `node bookmarklet/build.js minor` / `major`); unchanged code keeps its version, so nobody is told to update.
const RELEASE = path.join(ROOT, 'release.json');
const last = JSON.parse(fs.readFileSync(RELEASE, 'utf8'));
const hash = crypto.createHash('sha256').update(raw).update(rawGithub).digest('hex');
const bump = process.argv[2];
if (bump && !['major', 'minor', 'patch'].includes(bump)) throw new Error('usage: node bookmarklet/build.js [major|minor|patch]');
const [major, minor, patch] = last.version.split('.').map(Number);
const version = !bump && hash === last.hash ? last.version
  : bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
// Every published version has its release note in CHANGELOG.md (Adhi: "for every release, just keep a release note").
if (version !== last.version && !fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').includes(`## ${version} `)) {
  throw new Error(`add a "## ${version} — <date>" entry to CHANGELOG.md before publishing`);
}
const client = raw.replace('__PAGE_COMMENTS_VERSION__', version);
if (client === raw) throw new Error('core.js lost its __PAGE_COMMENTS_VERSION__ placeholder');
const clientGithub = rawGithub.replace('__PAGE_COMMENTS_VERSION__', version);
// The bookmark reads the latest version from this image's size (see the version check in core.js):
// width = major * 1000 + minor + 1, height = patch + 1.
const [vMajor, vMinor, vPatch] = version.split('.').map(Number);
if (vMinor > 998) throw new Error('minor must stay below 999 to fit the version image');
const versionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vMajor * 1000 + vMinor + 1}" height="${vPatch + 1}"/>\n`;
// The server is shown as readable source inside a bash/zsh command that writes it to a file, so people can read
// what they run. A quoted heredoc keeps the shell from touching $, backticks or quotes in the code.
// Comments are stripped (the page explains the server instead) and the code is coloured at build time.
const serverCode = stripComments(fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8')).trimEnd();
if (serverCode.includes('\nPAGE_COMMENTS_SERVER\n')) throw new Error('server.js contains the heredoc end marker');
const installHtml = `<span class="b">cat</span> &gt; ~/page-comments-server.js &lt;&lt;<span class="m">'PAGE_COMMENTS_SERVER'</span>\n` +
  `${highlight(serverCode)}\n<span class="m">PAGE_COMMENTS_SERVER</span>`;

// Encode only what breaks a javascript: URL in a single-quoted href: % (decoded), line breaks and tabs (stripped),
// # (fragment), ' (ends the attribute) and & (character references). The minified code is full of " and =>, which a
// single-quoted attribute takes as they are: encoding them cost about 3,000 characters.
// `void 0` stops Chrome from replacing the page with the script's return value.
// The bookmark updates itself: each click loads the published client.js (which only defines a function, so it never
// runs twice) and runs that, the newest version. A site that blocks outside scripts (CSP or Trusted Types: Gmail,
// GitHub, Jira) fails the load, and the bookmark runs its own copy instead; so does a load that errors or takes over
// 3 s. That copy shows the green "New version" line only when it is older than the published one.
// An open tool closes at once, without loading anything.
const remoteJs = `window.__pageCommentsLatest=function(){${client}};\n`;
const loader = `(()=>{const own=()=>{${client}};if(window.__pageComments)return window.__pageComments();let done=0;` +
  `const go=(f)=>{if(!done){done=1;f()}};try{const s=document.createElement("script");` +
  `s.onload=()=>{s.remove();go(window.__pageCommentsLatest||own)};s.onerror=()=>{s.remove();go(own)};` +
  `setTimeout(()=>go(own),3000);s.src=${JSON.stringify(SITE_URL + 'client.js')};document.documentElement.append(s)}catch{go(own)}})()`;
// The fixed bookmark is the client alone, for workplaces that allow no code from outside: it never loads a script.
const toBookmark = (code) => {
  const url = 'javascript:' + (code + ';void 0').replace(/[%\r\n\t#'&]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  // What the browser runs is the percent-decoded URL: it must be the code exactly.
  if (decodeURIComponent(url.slice(11)) !== code + ';void 0') throw new Error('the bookmark does not decode back to the code');
  return url;
};
const bookmark = toBookmark(loader), bookmarkFixed = toBookmark(client);

// Icons for the drawing of the tool: the same shapes its buttons use in core.js.
const ICON = {
  comment: '<path d="M3 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-5 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke-width="1.8"/><path d="M7.4 5.2L12.16 17.44L13.86 12.51L18.79 10.81Z" fill="currentColor" stroke="none"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  clear: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  area: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  freeze: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  share: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  batch: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M17 13v8M13 17h8"/>',
  dots: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
};
// Section icons on the page that are not actions of the tool.
const PAGE_ICON = {
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  keys: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  note: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name] ?? PAGE_ICON[name]}</svg>`;
// The round button opened into its bar, in the drawing's bottom-right corner, as core.js draws it while commenting:
// modes | outputs | more. The bar shows the count on its Comments button.
const dk = (name, cls = '', extra = '') => `<span class="dk-act${cls}">${svgIcon(name)}${extra}</span>`;
const dockBar = `<div class="dk">${dk('area')}${dk('batch')}${dk('freeze')}<i class="dk-sep"></i>${dk('clear')}${dk('list', '', '<span class="dk-cnt">2</span>')}${dk('copy')}${dk('share')}${dk('send', ' dk-send')}<i class="dk-sep"></i>${dk('dots')}<span class="dk-main">${svgIcon('comment')}</span></div>`;
// Each explanation sits at a fixed height beside the drawing; an arrow runs from it into the part it describes.
const NOTES = [
  ['<b>Point.</b> The element under the mouse lights up blue, with its tag, size and background colour; press <kbd>D</kbd> to add font, spacing and contrast. Select text to comment on just those words.', 'M582 14 C 470 8, 240 24, 158 70'],
  ['<b>Comment.</b> Click it, write what should change, press <kbd>Enter</kbd>. Tick <i>Add screenshot</i> to attach a picture. The dark tab on the box opens its colours, font and selector.', 'M582 98 C 560 100, 530 112, 496 120'],
  ['<b>Pins.</b> Each comment leaves a numbered pin on the spot. Click one to edit or delete it. They come back after a reload.', 'M582 182 C 540 214, 380 226, 296 250'],
  ['<b>Send to Claude</b> <span class="opt warn">only on local pages</span> The orange button: shows on your own dev app while the server runs (see the last section). Anywhere else, use Copy.', 'M582 266 C 540 300, 440 360, 422 428'],
  ['<b>The round button.</b> Blue: commenting. Dark: browsing. Click it or press <kbd>Esc</kbd> to switch, drag it to move. Closed, its badge counts comments.', 'M582 350 C 578 382, 562 402, 538 422'],
  ['<b>The bar.</b> Hover the round button and it grows into a bar: area, several, freeze · clear all, comments (with the count), copy, share link, send · <b>⋯</b> for details, shortcuts, help and close.', 'M582 434 C 600 512, 200 512, 158 486'],
];
const notes = NOTES.map(([text], i) => `<li style="top:${i * 84}px">${text}</li>`).join('');
const arrows = NOTES.map(([, d]) => `<path class="halo" d="${d}"/><path d="${d}" marker-end="url(#head)"/><circle cx="${d.split(' ')[0].slice(1)}" cy="${d.split(' ')[1]}" r="4"/>`).join('');

// The shortcut list is the tool's own (KEYS in core.js), so the page cannot drift from the card the tool shows.
// data-k names the keys the way the page script names a keydown, so pressing one lights its row.
const keysSrc = fs.readFileSync(path.join(ROOT, 'core', 'core.js'), 'utf8').match(/const KEYS = (\[[\s\S]*?\]\]);/)?.[1];
if (!keysSrc) throw new Error('the KEYS list in core.js was not found');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const keyRows = new Function('ALT_SHIFT', `return ${keysSrc}`)('Alt+Shift+').map(([k, what]) => {
  const parts = k.split(' / ');
  return `<div class="krow" data-k="${esc(parts.map((x) => x.replace('+click', '')).join(' '))}"><span>${parts.map((x) =>
    `<kbd${x.startsWith('Alt+') ? ' class="alt"' : ''}>${esc(x)}</kbd>`).join(' / ')}</span><span>${what === 'this card' ? 'shows these shortcuts on the page' : esc(what)}</span></div>`;
}).join('');

const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>page-comments</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-5 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' fill='%23ea580c'/%3E%3Cpath d='M7.4 5.2L12.16 17.44L13.86 12.51L18.79 10.81Z' fill='%23fff'/%3E%3C/svg%3E">
<style>
  :root { --bg: #0f0f11; --card: #18181b; --line: #2a2a2e; --text: #e4e4e7; --muted: #a1a1aa; --accent: #ea580c; --blue: #2563eb; --green: #16a34a; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html { scroll-behavior: smooth; }
  * { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
  ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #52525b; }
  ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  a { color: #fdba74; }

  /* A sticky index beside the page on wide screens; a sticky row of links above it on narrower ones. */
  .wrap { display: grid; grid-template-columns: 190px minmax(0, 1040px); gap: 28px; justify-content: center; padding: 0 24px; }
  .toc { position: sticky; top: 0; align-self: start; max-height: 100vh; overflow-y: auto; padding: 64px 0 24px; }
  .toc b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #71717a; margin: 0 0 10px 10px; }
  .toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .toc li { margin: 0; }
  .toc a { display: block; padding: 6px 10px; border-radius: 8px; color: var(--muted); text-decoration: none; font-size: 14px; line-height: 1.3; border-left: 2px solid transparent; }
  .toc a:hover { color: var(--text); background: #18181b; }
  .toc a.on { color: #fff; background: #1c1c20; border-left-color: var(--accent); }
  main { min-width: 0; padding: 56px 0 80px; }
  @media (max-width: 1320px) {
    .wrap { grid-template-columns: minmax(0, 1040px); gap: 0; }
    .toc { z-index: 5; max-height: none; padding: 8px 0; overflow-x: auto; background: #0f0f11ee; backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
    .toc b { display: none; }
    .toc ol { display: flex; gap: 4px; } .toc a { white-space: nowrap; border-left: 0; border-bottom: 2px solid transparent; border-radius: 6px; }
    .toc a.on { border-bottom-color: var(--accent); }
    main { padding-top: 28px; }
  }

  h1 { font-size: 28px; margin: 0 0 4px; } h1 + p { color: var(--muted); margin: 0 0 28px; font-size: 16px; }
  h1 .logo { width: 1.1em; height: 1.1em; vertical-align: -0.18em; margin-right: 0.3em; }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin-bottom: 16px; scroll-margin-top: 64px; }
  h2 { font-size: 18px; margin: 0 0 6px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  h3 { font-size: 15px; margin: 18px 0 4px; }
  .h-ic { width: 30px; height: 30px; border-radius: 50%; background: #27272a; color: #fdba74; display: grid; place-items: center; flex: none; }
  .h-ic svg { width: 16px; height: 16px; }
  .lead { color: #d4d4d8; margin: 0 0 12px; }
  .opt.warn { color: #fca5a5; background: #ef44441f; border-color: #ef4444; }
  .opt { font-size: 12px; font-weight: 500; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 0 8px; }
  p { margin: 8px 0; } .muted { color: var(--muted); font-size: 14px; }
  kbd { font: 12px ui-monospace, monospace; background: #27272a; border: 1px solid #3f3f46; border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; white-space: nowrap; }
  ul, ol { margin: 8px 0; padding-left: 20px; } li { margin: 6px 0; }
  /* Numbered steps: a small orange number in front of each one. */
  .steps { list-style: none; padding: 0; counter-reset: s; display: grid; gap: 8px; }
  .steps > li { counter-increment: s; position: relative; padding-left: 34px; margin: 0; }
  .steps > li::before { content: counter(s); position: absolute; left: 0; top: 1px; width: 22px; height: 22px; border-radius: 50%; background: #ea580c26; color: #fdba74;
                        font: 700 12px/22px system-ui, sans-serif; text-align: center; }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 10px; list-style: none; padding: 0; margin: 14px 0 0; }
  .facts > li { margin: 0; background: #1f1f23; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; font-size: 14px; }
  .facts b { color: #fff; }
  .try { display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 600; color: #93c5fd; text-decoration: none; border: 1px solid #1e3a8a; background: #1e3a8a33; border-radius: 999px; padding: 3px 12px; }
  .try:hover { background: #1e3a8a66; }

  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 10px; font-weight: 600; text-decoration: none; border: 0; cursor: pointer; font-size: 15px; }
  .bookmark { background: var(--accent); color: #fff; cursor: grab; box-shadow: 0 6px 18px #ea580c55; transition: transform .15s, box-shadow .15s; }
  .bookmark:hover { transform: translateY(-2px) rotate(-1deg); box-shadow: 0 10px 26px #ea580c77; } .bookmark:active { cursor: grabbing; }
  /* Chrome names a dragged bookmark after the link's text, so the grip is drawn by CSS and stays out of the name. */
  .bookmark::before { content: '⠿'; opacity: .7; letter-spacing: -2px; }

  /* Install: a bookmarks bar with an empty slot, and a ghost of the button gliding up into it. */
  .drag { position: relative; width: 560px; max-width: 100%; height: 230px; margin: 18px auto 4px; overflow: hidden; }
  .bar-mock { position: absolute; left: 0; right: 0; top: 0; height: 42px; display: flex; align-items: center; gap: 10px; padding: 0 12px;
              background: #27272a; border: 1px solid #3f3f46; border-radius: 10px; color: #a1a1aa; font-size: 13px; }
  .bar-mock .bm { background: #3f3f46; color: #e4e4e7; padding: 3px 10px; border-radius: 6px; }
  .bar-mock .slot { margin-left: auto; width: 170px; height: 28px; border: 2px dashed #ea580c; border-radius: 6px; display: grid; place-items: center;
                    color: #fdba74; font-size: 12px; animation: slot 3.2s infinite; }
  @keyframes slot { 0%, 55% { background: transparent; } 70%, 90% { background: #ea580c33; } }
  .drag .arrow { position: absolute; left: 0; top: 0; width: 560px; height: 230px; pointer-events: none; }
  .drag .bookmark { position: absolute; left: 50%; top: 170px; translate: -50% -50%; }
  .ghost { position: absolute; left: 280px; top: 170px; translate: -50% -50%; padding: 8px 14px; border-radius: 10px; background: var(--accent);
           color: #fff; font-weight: 600; font-size: 14px; opacity: 0; pointer-events: none; animation: glide 3.2s infinite ease-in-out; white-space: nowrap; }
  .ghost svg { position: absolute; right: -10px; bottom: -14px; width: 20px; height: 20px; }
  @keyframes glide {
    0%, 8% { transform: translate(0, 0) scale(1); opacity: 0; }
    15% { opacity: .9; }
    65% { transform: translate(185px, -149px) scale(.8); opacity: .9; }
    80%, 100% { transform: translate(185px, -149px) scale(.8); opacity: 0; }
  }
  /* The update notice: the round button's green dot and the green help line in the ⋯ list, drawn as the tool draws them. */
  /* The fixed bookmark: a quieter button beside one line on when to pick it. */
  .alt-bm { display: flex; align-items: center; gap: 14px; margin: 14px 0; padding: 12px 16px; border: 1px solid var(--line, #3f3f46); border-radius: 12px; }
  .alt-bm p { margin: 0; font-size: 14px; }
  .bookmark.fixed { flex: none; background: #27272a; box-shadow: none; border: 1px solid #52525b; }
  .bookmark.fixed:hover { box-shadow: 0 6px 18px #0006; }
  .upd { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; background: #16a34a14; border: 1px solid #16a34a55; border-radius: 12px; padding: 12px 16px; margin-top: 14px; }
  .upd p { margin: 0; font-size: 14px; }
  .upd-main { position: relative; flex: none; border-radius: 50%; display: grid; place-items: center; color: #fff; }
  .upd-main { width: 40px; height: 40px; background: #27272a; } .upd-main svg { width: 20px; height: 20px; }
  .upd-main i { position: absolute; top: -2px; left: -2px; width: 13px; height: 13px; border-radius: 50%; border: 2px solid #fff; background: var(--green); }
  .upd-row { flex: 0 1 auto; display: flex; align-items: center; gap: 8px; background: #dcfce7; color: #15803d; border-radius: 8px; padding: 6px 10px; font: 500 13px system-ui, sans-serif; }
  .upd-row svg { width: 16px; height: 16px; }

  /* Comment on one thing: a drawing of the tool on a dark page, with each explanation beside it and an arrow into the part it describes. */
  .explain { position: relative; height: 510px; margin-top: 16px; }
  .shot { position: absolute; left: 0; top: 0; width: 560px; height: 494px; border-radius: 12px; overflow: hidden; background: #26262b; color: #e4e4e7; border: 1px solid #3f3f46; }
  .shot .chrome { height: 34px; background: #1c1c20; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-bottom: 1px solid #3f3f46; }
  .shot .chrome i { width: 10px; height: 10px; border-radius: 50%; background: #52525b; }
  .shot .chrome span { margin-left: 10px; background: #27272a; border-radius: 6px; padding: 2px 10px; font: 12px system-ui, sans-serif; color: #a1a1aa; }
  .shot h4 { position: absolute; left: 28px; top: 62px; margin: 0; font: 700 26px system-ui, sans-serif; color: #fafafa; }
  .shot .card { position: absolute; top: 232px; width: 130px; height: 80px; background: #303036; border: 1px solid #45454d; border-radius: 10px; padding: 12px; font: 14px/1.4 system-ui, sans-serif; }
  .shot .hl { position: absolute; left: 20px; top: 58px; width: 132px; height: 40px; outline: 2px solid #3b82f6; background: #3b82f622; border-radius: 4px; }
  .shot .hl > span { position: absolute; left: -2px; bottom: 100%; display: flex; align-items: center; color: #fff; font: 11px/18px ui-monospace, monospace; border-radius: 4px 4px 0 0; overflow: hidden; white-space: nowrap; }
  .shot .hl > span > * { padding: 0 6px; } .shot .hl b { background: #2563eb; }
  .shot .seg { background: #1e3a8a; } .shot .seg.c { background: #18181b; display: flex; align-items: center; }
  .shot .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; box-shadow: 0 0 0 1px #0004, 0 0 0 2px #fff8; }
  .shot .pin { position: absolute; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; background: var(--accent); color: #fff; border: 2px solid #fff;
               font: 700 10px/18px system-ui, sans-serif; text-align: center; box-shadow: 0 2px 8px #0008; }
  .shot .pop { position: absolute; left: 240px; top: 96px; width: 250px; background: #fff; color: #18181b; border-radius: 12px; padding: 10px; box-shadow: 0 12px 32px #000a;
               font: 12px/1.4 system-ui, sans-serif; }
  .shot .pop .t { color: #3f3f46; font: 600 11px system-ui, sans-serif; margin-bottom: 6px; }
  .shot .pop .ch { font: 700 9px ui-monospace, monospace; color: #2563eb; background: #2563eb14; border-radius: 3px; padding: 1px 4px; margin-right: 3px; }
  .shot .pop .ptab { position: absolute; left: 100%; top: 12px; background: #18181b; color: #a1a1aa; border-radius: 0 6px 6px 0; padding: 6px 4px 6px 5px;
                     display: grid; gap: 3px; justify-items: center; font: 9px ui-monospace, monospace; }
  .shot .pop .ptab i { width: 14px; height: 11px; border-radius: 2px; background: #26262b; box-shadow: inset 0 0 0 1px #fff3; }
  .shot .pop .ta { border: 1px solid #2563eb; box-shadow: 0 0 0 3px #2563eb33; border-radius: 8px; padding: 6px 8px; height: 46px; }
  .shot .pop .row { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
  .shot .pop .row em { flex: 1; color: #a1a1aa; font-style: normal; font-size: 10px; }
  .shot .pop .row b { border: 1px solid #d4d4d8; border-radius: 7px; padding: 3px 9px; font-size: 11px; }
  .shot .pop .row b.save { background: var(--accent); border-color: var(--accent); color: #fff; }
  .shot .dk { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 2px; padding-left: 8px; border-radius: 30px; background: #18181b;
              box-shadow: 0 10px 30px #0006, 0 0 0 1px #ffffff26; }
  .shot .dk-act { min-width: 36px; height: 36px; padding: 0 9px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; color: #e4e4e7; }
  .shot .dk-act svg { width: 16px; height: 16px; flex: none; } .shot .dk-send { background: var(--accent); color: #fff; }
  .shot .dk-cnt { background: var(--accent); color: #fff; border-radius: 999px; font: 700 10.5px/16px system-ui, sans-serif; padding: 0 6px; }
  .shot .dk-sep { width: 1px; height: 22px; background: #3f3f46; margin: 0 6px; }
  .shot .dk-main { width: 52px; height: 52px; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; }
  .shot .dk-main svg { width: 24px; height: 24px; }
  .explain .arrows { position: absolute; left: 0; top: 0; width: 600px; height: 510px; pointer-events: none; overflow: visible; }
  .arrows path { fill: none; stroke: #fbbf24; stroke-width: 2.5; stroke-linecap: round; }
  .arrows path.halo { stroke: #0f0f11; stroke-width: 6; }
  .arrows circle { fill: #fbbf24; }
  .arrows marker path { fill: #fbbf24; stroke: none; }
  .notes { position: absolute; left: 596px; right: 0; top: 0; list-style: none; margin: 0; padding: 0; }
  .notes li { position: absolute; left: 0; right: 0; margin: 0; font-size: 14px; line-height: 1.45; color: #d4d4d8; }
  .notes b { color: #fff; }
  @media (max-width: 1060px) {
    .explain { height: auto; } .explain .arrows { display: none; }
    .shot { position: relative; max-width: 100%; }
    .notes { position: static; margin-top: 16px; display: grid; gap: 10px; } .notes li { position: static; }
  }

  /* Freeze: the two ways side by side. */
  .ways { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 10px; margin: 12px 0; }
  .way { background: #1f1f23; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .way h3 { margin: 0 0 4px; } .way p { margin: 0; font-size: 14px; color: #d4d4d8; }

  /* Hand it over: one button per destination, showing its steps. */
  .dests { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
  .dests button { font: 600 14px system-ui, sans-serif; color: var(--muted); background: #1f1f23; border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
  .dests button:hover { color: var(--text); }
  .dests button[aria-pressed="true"] { color: #fff; background: #ea580c26; border-color: var(--accent); }
  .dest { background: #1f1f23; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-top: 10px; }
  .dest .steps { margin: 0; }

  /* Share: pins in each writer's colour, as the tool draws them. */
  .who { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0 4px; font-size: 14px; }
  .who span { display: inline-flex; align-items: center; gap: 6px; }
  .who i { width: 20px; height: 20px; border-radius: 50% 50% 50% 0; border: 2px solid #fff; color: #fff; font: 700 10px/16px system-ui, sans-serif; text-align: center; font-style: normal; }

  /* Keyboard shortcuts: the tool's own list; a row lights up while its key is pressed on this page. */
  .keys { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 4px 16px; margin-top: 12px; }
  .krow { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: center; padding: 6px 10px; border-radius: 8px; font-size: 14px; color: #d4d4d8; }
  .krow.lit { animation: lit 1.2s ease-out; }
  @keyframes lit { 0%, 30% { background: #ea580c33; box-shadow: inset 0 0 0 1px var(--accent); } 100% { background: transparent; } }
  .alt { white-space: nowrap; }

  /* Send to Claude: the command that writes the server, and the command that starts it. */
  details { margin: 10px 0; }
  summary { cursor: pointer; color: #fdba74; font-weight: 600; font-size: 14px; }
  .cmd { display: flex; align-items: center; gap: 8px; background: #0b0b0d; border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 10px 14px; margin: 10px 0; }
  .cmd code { flex: 1; overflow-x: auto; white-space: nowrap; font: 13px ui-monospace, monospace; color: #fdba74; }
  .cmd button, .code button { background: #27272a; color: var(--text); border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
  .cmd button:hover, .code button:hover { background: #3f3f46; }
  .code { position: relative; margin: 10px 0; }
  .code pre { margin: 0; max-height: 340px; overflow: auto; background: #0b0b0d; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px;
              font: 12.5px/1.55 ui-monospace, monospace; color: #e4e4e7; }
  .code button { position: absolute; top: 8px; right: 8px; }
  /* syntax colours: keyword, string, regex, number, function call, builtin, property, heredoc marker */
  .k { color: #c792ea; } .s { color: #c3e88d; } .r { color: #f78c6c; } .n { color: #f78c6c; }
  .f { color: #82aaff; } .b { color: #ffcb6b; } .p { color: #f0f0f0; } .m { color: #71717a; }

  /* Try it here: a light test page to try every feature on. */
  .pg { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 12px; margin-top: 12px; }
  .pg-cell { background: #f8fafc; color: #0f172a; border-radius: 10px; padding: 14px; display: grid; gap: 10px; align-content: start; scroll-margin-top: 72px; }
  .pg-cell:target { box-shadow: 0 0 0 3px var(--accent); }
  .pg-title { font: 700 14px system-ui, sans-serif; color: #0f172a; }
  .pg-label { font-size: 13px; color: #475569; } .pg-label kbd, .pg-steps kbd { background: #e2e8f0; border-color: #cbd5e1; color: #0f172a; }
  .pg-steps { margin: 0; padding-left: 18px; font-size: 13px; color: #334155; } .pg-steps li { margin: 3px 0; }
  .pg-btn { font: 600 13px system-ui, sans-serif; border: 1px solid #cbd5e1; background: #fff; color: #0f172a; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
  .pg-tipwrap, .pg-menu { position: relative; justify-self: start; }
  .pg-tip { display: none; position: absolute; left: 0; top: calc(100% + 6px); width: 220px; background: #0f172a; color: #f8fafc; font-size: 12px; border-radius: 8px; padding: 8px 10px; z-index: 2; }
  .pg-tipwrap:hover .pg-tip { display: block; }
  .pg-sub { display: none; position: absolute; left: 0; top: 100%; margin: 0; padding: 6px; list-style: none; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; min-width: 140px; z-index: 2; box-shadow: 0 8px 20px #0002; }
  .pg-sub li { margin: 0; padding: 6px 8px; border-radius: 6px; } .pg-sub li:hover { background: #e0e7ff; }
  .pg-menu:hover .pg-sub { display: block; }
  .pg-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; } .pg-list li { margin: 0; background: #e0e7ff; border-radius: 6px; padding: 5px 9px; font-size: 13px; }
  .pg-text { margin: 0; font-size: 14px; line-height: 1.6; }
  .pg-h { margin: 0; font: 700 20px system-ui, sans-serif; color: #1e1b4b; }
  .pg-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pg-card { border-radius: 8px; padding: 10px; display: grid; gap: 6px; font-size: 13px; }
  .pg-light { background: #fff; border: 1px solid #e2e8f0; } .pg-dark { background: #1e1b4b; color: #e0e7ff; }
  .pg-buy { background: #ea580c; border-color: #ea580c; color: #fff; } .pg-faint { color: #cbd5e1; } .pg-ghost { background: transparent; color: #e0e7ff; border-color: #6366f1; }
  .pg-input { font: 14px system-ui, sans-serif; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; background: #fff; color: #0f172a; }
  .pg-img, .pg-clear { border-radius: 8px; justify-self: start; }
  .pg-profile { display: flex; gap: 10px; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 13px; }
  .pg-avatar { width: 36px; height: 36px; border-radius: 50%; background: #6366f1; color: #fff; display: grid; place-items: center; font-weight: 700; }
  /* A box to paste into, to see what a rich editor (Google Docs, email) gets from Copy. */
  .pg-paste { min-height: 90px; max-height: 260px; overflow: auto; background: #fff; border: 1px dashed #94a3b8; border-radius: 8px; padding: 10px; font-size: 13px; outline: none;
              scrollbar-color: #cbd5e1 transparent; }
  .pg-paste::-webkit-scrollbar-thumb { background: #cbd5e1; }
  .pg-paste:empty::before { content: attr(data-placeholder); color: #94a3b8; }
  .pg-paste:focus { border-style: solid; border-color: #6366f1; }
  .pg-paste img { max-width: 100%; height: auto; }
</style>
<div class="wrap">
<nav class="toc" aria-label="On this page">
  <b>On this page</b>
  <ol>
    <li><a href="#install">Add the bookmark</a></li>
    <li><a href="#comment">Comment on one thing</a></li>
    <li><a href="#several">Several things at once</a></li>
    <li><a href="#freeze">Hover menus and tooltips</a></li>
    <li><a href="#handover">Hand it over</a></li>
    <li><a href="#share">Share with someone</a></li>
    <li><a href="#keys">Keyboard shortcuts</a></li>
    <li><a href="#try">Try it here</a></li>
    <li><a href="#send">Send to Claude</a></li>
    <li><a href="#limits">Good to know</a></li>
  </ol>
</nav>
<main>
  <h1><svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-5 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#ea580c"/><path d="M7.4 5.2L12.16 17.44L13.86 12.51L18.79 10.81Z" fill="#fff"/></svg>page-comments</h1>
  <p>Point at things on any web page, say what should change, and hand it to Claude Code, Slack, Jira or a teammate.</p>

  <section id="install">
    <h2><span class="h-ic">${svgIcon('bookmark')}</span>Add the bookmark</h2>
    <p class="lead">Grab the orange button and drag it up into your bookmarks bar. No bar? Show it with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> on a Mac).</p>
    <div class="drag">
      <div class="bar-mock"><span>☆</span><span class="bm">📁 Work</span><span class="bm">📁 Docs</span><span class="slot">drop it here</span></div>
      <svg class="arrow" viewBox="0 0 560 230"><path d="M300 148 C 360 120, 420 110, 455 52" fill="none" stroke="#ea580c" stroke-width="2" stroke-dasharray="6 6"/>
        <path d="M447 60 L455 50 L461 62" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="ghost">🗨️ Page comments<svg viewBox="0 0 24 24" fill="#fff" stroke="#18181b" stroke-width="1.5"><path d="M5 3l6.5 17 2.3-7.2L21 10.5z"/></svg></div>
      <a class="btn bookmark" href='${bookmark}' onclick="event.preventDefault()">🗨️ Page comments</a>
    </div>
    <p class="muted" style="text-align:center">Clicking it here does nothing; it only works from the bookmarks bar.<br>
      This is version <code>${version}</code>. This bookmark updates itself: each click runs the newest version.</p>
    <div class="alt-bm"><a class="btn bookmark fixed" href='${bookmarkFixed}' onclick="event.preventDefault()">🗨️ Page comments (fixed)</a>
      <p><b>Workplace blocks outside scripts?</b> Drag this one instead. It never loads code from the internet: it runs the version it was dragged with, until you drag a newer one.</p></div>
    <p>To use it, open any page and click the bookmark. Commenting is on straight away. After a reload, click it again: your comments come back.</p>
    <div class="upd"><span class="upd-main">${svgIcon('comment')}<i></i></span><span class="upd-row">${svgIcon('info')}New version: open, then re-drag the bookmark</span>
      <p><b>Updates.</b> The orange bookmark loads the newest version on each click. Some sites block that (Gmail, GitHub, Jira…): there it runs the copy it was dragged with, like the fixed one always does. When the copy that runs is old, the round button gets a green dot. Hover it, open <b>⋯</b> and click the green line. It opens this page: delete the old bookmark and drag the new one. Your comments are kept. Bookmarks from before version 1.7.0 do not update themselves: re-drag once.</p></div>
  </section>

  <section id="comment">
    <h2><span class="h-ic">${svgIcon('comment')}</span>Comment on one thing</h2>
    <p class="lead">Click the bookmark on your page. This is what you will see:</p>
    <div class="explain">
      <div class="shot" role="img" aria-label="The tool on a dark pricing page: a highlighted heading, a comment box, two pinned cards, and the round button opened into its bar">
        <div class="chrome"><i></i><i></i><i></i><span>localhost:3000/pricing</span></div>
        <h4>Pricing</h4>
        <div class="card" style="left:28px"><b>Starter</b><br>$9/month</div>
        <div class="card" style="left:176px"><b>Pro</b><br>$29/month</div>
        <div class="hl"><span><b>h1</b><span class="seg">132 × 40</span><span class="seg c"><span class="sw" style="background:#26262b"></span>#26262b</span></span></div>
        <span class="pin" style="left:120px;top:244px">1</span><span class="pin" style="left:268px;top:244px">2</span>
        <div class="pop"><span class="ptab"><i></i>›</span><div class="t"><b class="ch">h1</b> “Pricing”</div><div class="ta">Make this heading bigger</div>
          <div class="row"><em>Enter saves</em><b>Cancel</b><b class="save">Save</b></div></div>
        ${dockBar}
      </div>
      <svg class="arrows" viewBox="0 0 600 510" aria-hidden="true">
        <defs><marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#fbbf24" stroke="none"/></marker></defs>
        ${arrows}
      </svg>
      <ol class="notes">${notes}</ol>
    </div>
    <ul class="facts">
      <li><b>The info pill.</b> Over the blue outline: the tag, the size, an <i>Aa</i> chip in the element's real text colour on its real background, and the background colour. <kbd>D</kbd> adds font, padding, corner radius and contrast (✓ or ✗). It is one switch, remembered, shared with the comment box's tab.</li>
      <li><b>The comment box.</b> Its header names your pick in plain words: “Pro — $29”, or the words you selected. A click elsewhere closes an empty box. A half-written comment is never thrown away.</li>
      <li><b>Screenshots.</b> Tick <i>Add screenshot</i>. The first time, Chrome asks to share the tab; the tick is remembered. Each picture carries its comment's number.</li>
      <li><b>Pins stay.</b> Each page keeps its own comments, also in single-page apps. Reload, click the bookmark, and they come back with their pins.</li>
      <li><b>Right-click</b> opens the tool's own menu: comment on this, select the parent or inner element, select an area, freeze, keyboard shortcuts, copy the selector.</li>
      <li><b>The round button</b> moves where you drag it, and remembers the spot per site. Its bar opens toward the middle of the screen. Each button shows its name and key when you hover it.</li>
    </ul>
    <a class="try" href="#try-one">Try it ↓</a>
  </section>

  <section id="several">
    <h2><span class="h-ic">${svgIcon('batch')}</span>Several things at once</h2>
    <p class="lead">One comment can cover a part of the page, or a set of elements.</p>
    <h3>An area <kbd>A</kbd></h3>
    <p>Press <kbd>A</kbd> (or <i>Select an area</i>) and drag a box over the page. Good for gaps, empty space, or things side by side.</p>
    <h3>A batch <kbd>B</kbd></h3>
    <ol class="steps">
      <li>Press <kbd>B</kbd> (or <i>Select several</i>). <kbd>Shift</kbd>+click on an element starts a batch too.</li>
      <li>Click each element you want. A second click removes it. The page scrolls as you go.</li>
      <li>Need a part of the page, not an element? Press <kbd>A</kbd> and drag boxes. <kbd>A</kbd> again goes back to elements.</li>
      <li>Press <kbd>Enter</kbd> (or <i>Comment</i> on the blue bar). You write one comment for all of them, with a picture of each: 2a, 2b, 2c…</li>
    </ol>
    <p class="muted"><i>Close without saving</i> or <kbd>Esc</kbd> asks before it drops what you picked. In the comment box, <b>‹ ›</b> step through the selections.</p>
    <a class="try" href="#try-batch">Try it ↓</a>
  </section>

  <section id="freeze">
    <h2><span class="h-ic">${svgIcon('freeze')}</span>Hover menus and tooltips</h2>
    <p class="lead">Menus and tooltips vanish when the mouse moves. Freeze turns the page into a still picture, so they stay put. You click, drag over and right-click the picture just like the live page.</p>
    <div class="ways">
      <div class="way"><h3>Press <kbd>F</kbd></h3><p>Hover the thing so it opens, then press <kbd>F</kbd>.</p></div>
      <div class="way"><h3>Use the countdown</h3><p>Click <i>Freeze</i> in the bar. You get 3 seconds to open the menu with your mouse. Then it freezes.</p></div>
    </div>
    <p class="muted">The first time, Chrome asks to share the tab. That first press only starts sharing, because the prompt closes open menus. Open the menu again and freeze. <kbd>Esc</kbd> unfreezes. <kbd class="alt">Alt+Shift+F</kbd> freezes even while you browse.</p>
    <a class="try" href="#try-freeze">Try it ↓</a>
  </section>

  <section id="handover">
    <h2><span class="h-ic">${svgIcon('copy')}</span>Hand it over</h2>
    <p class="lead"><b>Copy</b> (<kbd>C</kbd>) puts every comment on this page on the clipboard: the text, the formatted version, and one stacked picture. Where are you pasting?</p>
    <div class="dests">
      <button data-to="to-claude" aria-pressed="true">Claude Code</button>
      <button data-to="to-slack" aria-pressed="false">Slack</button>
      <button data-to="to-jira" aria-pressed="false">Jira or Confluence</button>
      <button data-to="to-docs" aria-pressed="false">Google Docs or email</button>
    </div>
    <div class="dest" id="to-claude">
      <ol class="steps"><li>Press <kbd>C</kbd>.</li><li>Paste into Claude Code. <kbd>Ctrl</kbd>+<kbd>V</kbd> adds the pictures: one stacked picture, each part numbered like its comment.</li></ol>
      <p class="muted">Working on an app on your own machine? <a href="#send">Send to Claude</a> skips the paste and lets Claude edit the project.</p>
    </div>
    <div class="dest" id="to-slack" hidden>
      <ol class="steps"><li>Press <kbd>C</kbd> and paste: you get the text and one stacked picture.</li>
        <li>Want each picture on its own? Open the comments list (<kbd>L</kbd>) and click <i>Save pictures</i>. Each picture is saved as its own file, like <code>2a-make-it-bold.png</code>.</li>
        <li>Select those files in your Downloads folder and drag them into Slack together.</li></ol>
      <p class="muted">A web page can put only one picture on the clipboard. That is why Copy stacks them.</p>
    </div>
    <div class="dest" id="to-jira" hidden>
      <ol class="steps"><li>Open the comments list (<kbd>L</kbd>) and click <i>Copy text</i>. Paste.</li><li>Click <i>Copy pictures</i>. Paste again.</li></ol>
      <p class="muted">Their editor drops either the text or the pictures when one paste holds both. Two pastes keep both.</p>
    </div>
    <div class="dest" id="to-docs" hidden>
      <ol class="steps"><li>Press <kbd>C</kbd> and paste.</li></ol>
      <p class="muted">Each comment reads: the comment, the plain name of what it is about, its pictures, then one small grey line of details (size, colours, font, selector).</p>
    </div>
    <h3>The comments list <kbd>L</kbd></h3>
    <ul>
      <li>It holds every comment on this page. <i>Copy text</i>, <i>Copy pictures</i> and <i>Save pictures</i> are at its top; each comment has its own copy button.</li>
      <li>Click a comment to open it: the page scrolls to it and shows what it covers, dashed.</li>
      <li>A click outside the list closes it. <i>Clear all</i>, the bin left of the comments button, deletes this page's comments (click it twice).</li>
    </ul>
    <a class="try" href="#try-handover">Try it ↓</a>
  </section>

  <section id="share">
    <h2><span class="h-ic">${svgIcon('share')}</span>Share with someone</h2>
    <p class="lead">A share link carries your comments to another person's browser. They see them on the same page, with your name.</p>
    <ol class="steps">
      <li>Press <kbd>S</kbd> (or <i>Share link</i>). The first time, a bar asks your name. <kbd>Shift</kbd>+<kbd>S</kbd> changes it later.</li>
      <li>The link is copied. It holds this page's address and your comments, with small copies of the pictures while the link stays under 30 KB.</li>
      <li>Send it. The other person opens it and clicks their bookmark. Your comments and pins appear next to theirs, in your colour, with your name.</li>
    </ol>
    <div class="who" aria-label="Pins in each writer's colour">
      <span><i style="background:#ea580c">1</i>your own</span><span><i style="background:#0891b2">2</i>Sam</span><span><i style="background:#db2777">3</i>Adhi</span><span><i style="background:#7c3aed">4</i>a link without names</span>
    </div>
    <p class="muted">When the link had no room for the pictures, the other person gets a <i>Retake</i> bar: it takes them again on their page. A frozen picture, or one whose element is gone, cannot be retaken. Share links work for pages you both can open, not for your localhost.</p>
    <a class="try" href="#try-share">Try it ↓</a>
  </section>

  <section id="keys">
    <h2><span class="h-ic">${svgIcon('keys')}</span>Keyboard shortcuts</h2>
    <p class="lead">Single keys work while commenting (blue round button), never while you type in a field. While commenting, a small card above the round button lists the main ones (<kbd>B</kbd> batch, <kbd>A</kbd> area, <kbd>F</kbd> freeze, <kbd>Alt+Shift+C</kbd> browse, <kbd>?</kbd> all keys). Press one now: its row lights up.</p>
    <div class="keys">${keyRows}</div>
  </section>

  <section id="try">
    <h2><span class="h-ic">${svgIcon('play')}</span>Try it here</h2>
    <p class="lead">Click the bookmark on this page, then try each box. Clicks go to the tool while commenting; press <kbd>Esc</kbd> to browse when a box asks you to type or paste.</p>
    <div class="pg">
      <div class="pg-cell" id="try-one"><span class="pg-title">Comment on one thing</span>
        <span class="pg-label">Click the heading. Or select a few words, then click them. Press <kbd>D</kbd> for details.</span>
        <h3 class="pg-h">Plans for every team</h3>
        <p class="pg-text">Every plan includes unlimited projects, priority support and daily backups. Upgrade or downgrade whenever you like.</p></div>
      <div class="pg-cell" id="try-details"><span class="pg-title">Colours and contrast</span>
        <span class="pg-label">Press <kbd>D</kbd>, then hover each button. One fails contrast.</span>
        <div class="pg-cards"><div class="pg-card pg-light"><b>Pro</b><span>$29 / month</span><button class="pg-btn pg-buy">Buy</button><button class="pg-btn pg-faint">Compare</button></div>
        <div class="pg-card pg-dark"><b>Team</b><span>$79 / month</span><button class="pg-btn pg-buy">Buy</button><button class="pg-btn pg-ghost">Compare</button></div></div></div>
      <div class="pg-cell" id="try-batch"><span class="pg-title">Several things at once</span>
        <span class="pg-label">Press <kbd>B</kbd> and click the first three. Press <kbd>A</kbd> and drag a box over the last two. Press <kbd>Enter</kbd>: one comment, a picture of each.</span>
        <ol class="pg-list"><li>Starter — $9</li><li>Pro — $29</li><li>Team — $79</li><li>Business — $199</li><li>Agency — $399</li><li>Enterprise — talk to us</li></ol></div>
      <div class="pg-cell" id="try-freeze"><span class="pg-title">Freeze a tooltip</span>
        <span class="pg-label">Hover the button and press <kbd>F</kbd> (twice the first time). Then click the tooltip.</span>
        <span class="pg-tipwrap"><button class="pg-btn">Hover for help</button><span class="pg-tip">Plans renew monthly. Cancel any time.</span></span></div>
      <div class="pg-cell"><span class="pg-title">Freeze a menu</span>
        <span class="pg-label">Click <i>Freeze</i> in the bar, then hover “Products” within 3 seconds.</span>
        <div class="pg-menu"><button class="pg-btn">Products ▾</button><ul class="pg-sub"><li>Hosting</li><li>Domains</li><li>Email</li></ul></div></div>
      <div class="pg-cell" id="try-handover"><span class="pg-title">Hand it over</span>
        <span class="pg-label">Write two comments and press <kbd>C</kbd>. Press <kbd>Esc</kbd> to browse, click the box and paste: this is what Google Docs or an email gets.</span>
        <div class="pg-paste" contenteditable="true" data-placeholder="Paste here"></div>
        <button class="pg-btn pg-clear">Empty the box</button></div>
      <div class="pg-cell" id="try-share"><span class="pg-title">Share with names</span>
        <ol class="pg-steps"><li>Comment on the card below, then press <kbd>S</kbd> and type your name.</li>
          <li>Open the copied link in a private window and click the bookmark there.</li>
          <li>Your comment arrives with your name and colour. <kbd>Shift</kbd>+<kbd>S</kbd> changes the name.</li></ol>
        <div class="pg-profile"><span class="pg-avatar">JD</span><span><b>Jo Doe</b><br>Owner · joined March</span></div></div>
      <div class="pg-cell" id="try-typing"><span class="pg-title">Typing is safe</span>
        <span class="pg-label">Press <kbd>Esc</kbd> to browse, click the field and type F, A or C. Nothing happens. The image is named by its alt text.</span>
        <input class="pg-input" name="try-typing" placeholder="Type here"><img class="pg-img" alt="Team photo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='64'%3E%3Crect width='120' height='64' rx='8' fill='rgb(99,102,241)'/%3E%3Ccircle cx='40' cy='30' r='12' fill='rgb(224,231,255)'/%3E%3Ccircle cx='76' cy='30' r='12' fill='rgb(224,231,255)'/%3E%3C/svg%3E"></div>
    </div>
  </section>

  <section id="send">
    <h2><span class="h-ic">${svgIcon('send')}</span>Send to Claude <span class="opt">optional</span> <span class="opt warn">only on local pages</span></h2>
    <p class="lead">For your own app running on this machine: <b>Send to Claude</b> passes the comments and pictures to Claude Code, which edits the project's source. Everywhere else, Copy does the job.</p>
    <p>It needs a small server, Node 18+ and the <code>claude</code> CLI. Send shows only on pages served from your own machine: <code>localhost</code>, <code>*.localhost</code>, and names your hosts file (<code>/etc/hosts</code>) points at <code>127.0.0.1</code>.</p>
    <details>
      <summary>Set up the server</summary>
      <p>Paste this into your terminal (bash or zsh). It writes the server to <code>~/page-comments-server.js</code>; run it again after an update.</p>
      <div class="code"><pre><code>${installHtml}</code></pre><button data-copy>Copy</button></div>
      <p>Then start it, pointing at the project that renders the page. Claude runs in that folder and edits its source files.</p>
      <div class="cmd"><code>node ~/page-comments-server.js ~/projects/my-app</code><button data-copy>Copy</button></div>
      <p class="muted">The server refuses every other website: any site you visit can send requests to your machine, and without this check one could make Claude edit your code.</p>
    </details>
  </section>

  <section id="limits">
    <h2><span class="h-ic">${svgIcon('note')}</span>Good to know</h2>
    <ul>
      <li>A bookmark cannot run by itself after a reload. Click it again to bring back the round button and your comments.</li>
      <li>Comments are stored in the site's own storage. Clearing the site's data deletes them, and the site's scripts could read them.</li>
      <li>If the page changed and an element cannot be found again, its pin hides. The comment stays in the list and in Copy.</li>
    </ul>
  </section>
</main>
</div>
<script>
  // While dragging, show the button itself instead of Chrome's link preview, which would show the bookmark's code.
  const bookmark = document.querySelector('.bookmark');
  bookmark.addEventListener('dragstart', (e) => e.dataTransfer.setDragImage(bookmark, e.offsetX, e.offsetY));
  for (const b of document.querySelectorAll('[data-copy]')) b.onclick = async () => {
    // The file-writing command gets a trailing newline so it runs on paste; the start command does not,
    // because its project path needs editing first.
    const text = b.previousElementSibling.textContent.trimEnd();
    await navigator.clipboard.writeText(b.closest('.code') ? text + '\\n' : text);
    b.textContent = 'Copied';
    setTimeout(() => { b.textContent = 'Copy'; }, 1500);
  };

  // Hand it over: one destination's steps at a time.
  const dests = [...document.querySelectorAll('[data-to]')];
  for (const b of dests) b.onclick = () => {
    for (const x of dests) {
      x.setAttribute('aria-pressed', x === b);
      document.getElementById(x.dataset.to).hidden = x !== b;
    }
  };
  document.querySelector('.pg-clear').onclick = () => { document.querySelector('.pg-paste').replaceChildren(); };

  // Name the Alt keys the way a Mac keyboard prints them, as the tool does.
  if (/Mac|iPhone|iPad/.test(navigator.platform)) for (const k of document.querySelectorAll('.alt')) k.textContent = k.textContent.replace('Alt+Shift+', '⌥⇧');

  // Light the shortcut row of the key just pressed. Capture phase, so it sees keys the tool handles too; skipped while
  // typing, like the tool's own single keys.
  const rows = [...document.querySelectorAll('.krow')];
  const keyName = (e) => e.altKey && e.shiftKey && /^Key[FC]$/.test(e.code) ? 'Alt+Shift+' + e.code[3]
    : { Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓' }[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  addEventListener('keydown', (e) => {
    const t = e.composedPath()[0];
    if (e.ctrlKey || e.metaKey || t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || '')) return;
    const row = rows.find((r) => r.dataset.k.split(' ').includes(keyName(e)));
    if (!row) return;
    row.classList.remove('lit');
    void row.offsetWidth; // restart the animation when the same key is pressed again
    row.classList.add('lit');
  }, true);

  // The index marks the section being read: the last one whose top passed 30% of the window, or the last of all
  // at the bottom of the page (short final sections never get that high).
  const links = [...document.querySelectorAll('.toc a')], secs = links.map((a) => document.querySelector(a.hash));
  const mark = () => {
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    const cur = atEnd ? secs.at(-1) : secs.findLast((s) => s.getBoundingClientRect().top < innerHeight * 0.3) || secs[0];
    for (const a of links) a.classList.toggle('on', a.hash === '#' + cur.id);
  };
  addEventListener('scroll', mark, { passive: true });
  mark();
</script>
</html>
`;

// Every class in the markup needs a style rule, so a rule deleted by accident stops the build instead of
// publishing a broken page (it happened once: step 3 lost all its styles).
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const unstyled = [...new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' ')))]
  .filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css));
if (unstyled.length) throw new Error('classes without a style rule: ' + unstyled.join(', '));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-comments-'));
try {
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'version.svg'), versionSvg);
  fs.writeFileSync(path.join(dir, 'client.js'), remoteJs);
  const out = JSON.parse(execFileSync('node', [SHARE_CLI, 'share', 'update', SITE, dir], { encoding: 'utf8' }));
  fs.writeFileSync(RELEASE, JSON.stringify({ version, hash }, null, 2) + '\n');
  console.log(`published ${out.url} version ${version} (bookmark ${(Buffer.byteLength(bookmark) / 1024).toFixed(1)} KB)`);
  // The extension is built from the same core with the same version, so the two never drift apart.
  console.log(`extension ${version} built in ${require('../extension/build.js')(version)}`);
  // For people whose network reaches only github.com: the fixed bookmark as one line to paste into a new bookmark's
  // address, the build that checks for updates and links its Help line to GitHub. Every release commits and pushes it
  // (Adhi, 2026-11-24) with the version.svg that bookmark checks and release.json (the README's version badge), so the
  // GitHub copy never falls behind.
  fs.writeFileSync(path.join(ROOT, 'bookmarklet.txt'), toBookmark(clientGithub) + '\n');
  fs.writeFileSync(path.join(__dirname, 'version.svg'), versionSvg);
  const files = ['bookmarklet.txt', 'bookmarklet/version.svg', 'release.json'];
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  git('add', ...files);
  if (git('diff', '--cached', '--name-only', '--', ...files).trim()) {
    git('commit', '-m', `Release ${version}: bookmarklet.txt for the repository`, '--', ...files);
    git('push');
    console.log('pushed ' + files.join(', ') + ' to GitHub');
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
