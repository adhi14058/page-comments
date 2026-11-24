// The release: builds the bookmarklet from core.js + bookmark.js, the website in site/ (see site.js: the install page
// with both bookmarks and a shell command that writes server.js, plus client.js and version.svg, which every bookmark
// loads), bookmarklet.txt and the extension, then commits and pushes them; the server at https://page-comments.heyadhi.com/
// pulls main. `node bookmarklet/build.js --site` writes only site/ and publishes nothing.
// Re-run after every change to core.js, bookmark.js, server.js or site-src/. Bookmarks load the new client.js on their own, except
// on sites that block outside scripts, where they run the copy they were dragged with.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { stripComments, highlight } = require('./highlight.js');
const { nextVersions } = require('./version.js');
const { sitePages, writeSite } = require('./site.js');

// Where bookmarks load client.js from; the website serves it (also SITE in core.js). Bookmarks made on the old share
// address keep working: that address serves the same client.js and version.svg.
const SITE_URL = 'https://page-comments.heyadhi.com/';
const ROOT = path.join(__dirname, '..'); // the repository: release.json, CHANGELOG.md and the built files live there

// esbuild is fetched by npx, nothing to install.

// The bookmark's code: core.js (the tool, shared with the extension) bundled with bookmark.js (its way of taking pictures,
// saving files and finding updates) into one function call. updates: where the copy looks for a newer release and
// sends its Help line ('site': the website; 'github': bookmarklet.txt, for networks that reach only
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
// Releases: release.json keeps the last published versions and hashes of their code; version.js says how they move
// (`node bookmarklet/build.js minor` / `major` bump the bookmark's). The extension's hash covers its own files and
// icons; the core is in the bookmark's code, so a core change moves both.
const RELEASE = path.join(ROOT, 'release.json');
const last = JSON.parse(fs.readFileSync(RELEASE, 'utf8'));
const hash = crypto.createHash('sha256').update(raw).update(rawGithub).digest('hex');
const extSum = crypto.createHash('sha256');
for (const dir of ['extension', 'core/icons']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.(js|html|css|png)$/.test(f)).sort()) {
    extSum.update(f).update(fs.readFileSync(path.join(ROOT, dir, f)));
  }
}
const extHash = extSum.digest('hex');
// site/ serves client.js to every bookmark, so --site takes only released code, and shows the released numbers.
const siteOnly = process.argv[2] === '--site';
if (siteOnly && hash !== last.hash) throw new Error(`the bookmark's code changed since ${last.version}: release it, or site/ would serve code nobody released`);
const { version, extVersion } = siteOnly ? { version: last.version, extVersion: last.extension?.version ?? last.version }
  : nextVersions({ last, hash, extHash, bump: process.argv[2] });
// Every published version has its release note in CHANGELOG.md (Adhi: "for every release, just keep a release note").
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
for (const [v, was] of [[version, last.version], [extVersion, last.extension?.version ?? last.version]]) {
  if (v !== was && !changelog.includes(`## ${v} `)) throw new Error(`add a "## ${v} — <date>" entry to CHANGELOG.md before publishing`);
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

// The shortcut list is the tool's own (KEYS in core.js); site.js checks the page lists the same keys, so the page cannot
// drift from the card the tool shows.
const keysSrc = fs.readFileSync(path.join(ROOT, 'core', 'core.js'), 'utf8').match(/const KEYS = (\[[\s\S]*?\]\]);/)?.[1];
if (!keysSrc) throw new Error('the KEYS list in core.js was not found');
const keys = new Function('ALT_SHIFT', `return ${keysSrc}`)('Alt+Shift+');

const siteFiles = sitePages({ version, extVersion, bookmark, bookmarkFixed, siteUrl: SITE_URL, serverHtml: installHtml, keys, changelog, clientJs: remoteJs, versionSvg });
if (siteOnly) {
  writeSite(siteFiles);
  console.log(`wrote site/ for bookmark ${version}, extension ${extVersion}; nothing published`);
  return; // a CommonJS module may return: the rest releases
}

// A release is a commit: the server that serves site/ pulls main, so the push below is what publishes it. The
// extension is built first, from the same core with the same version, so the two never drift apart; if it fails,
// nothing has been written yet.
console.log(`extension ${extVersion} built in ${require('../extension/build.js')(extVersion)}`);
// For people whose network reaches only github.com: the fixed bookmark as one line to paste into a new bookmark's
// address, the build that checks for updates and links its Help line to GitHub. Every release commits and pushes it
// (Adhi, 2026-11-24) with the version.svg that bookmark checks and release.json (the README's version badge), so the
// GitHub copy never falls behind. The website (site/) goes in the same commit: it is built here, not on the server
// that serves it.
fs.writeFileSync(path.join(ROOT, 'bookmarklet.txt'), toBookmark(clientGithub) + '\n');
fs.writeFileSync(path.join(__dirname, 'version.svg'), versionSvg);
writeSite(siteFiles);
fs.writeFileSync(RELEASE, JSON.stringify({ version, hash, extension: { version: extVersion, hash: extHash } }, null, 2) + '\n');
const files = ['bookmarklet.txt', 'bookmarklet/version.svg', 'release.json', 'site'];
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
git('add', ...files);
if (git('diff', '--cached', '--name-only', '--', ...files).trim()) {
  git('commit', '-m', `Release ${version}: bookmarklet.txt and the website for the repository`, '--', ...files);
  git('push');
  console.log(`released ${version} (bookmark ${(Buffer.byteLength(bookmark) / 1024).toFixed(1)} KB): pushed ${files.join(', ')}`);
}
