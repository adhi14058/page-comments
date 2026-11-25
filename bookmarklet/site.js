// The website, written to site/: the install page, the changelog page, the privacy page and the playground, the sitemap and robots.txt,
// plus client.js and version.svg, the two files every bookmark loads, and the Chrome extension as a zip. site-src/ is its source; site/ is only ever build
// output (a copy of site-src/ with the pages filled in), so the release can commit it as it is and a server can serve
// it as it is.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// The site's own address: canonical links, link previews, the sitemap. Bookmarks load their code from SITE_URL in
// build.js, the same host today.
const HOME = 'https://page-comments.heyadhi.com/';
const SRC = path.join(ROOT, 'site-src'), OUT = path.join(ROOT, 'site');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// CHANGELOG.md's releases, in its order (newest first): a "## <version> — <yyyy-mm-dd>" line, then "- " points, which may
// hold `code`. Any other line under a release stops the build, so the page never drops or garbles a note.
const releases = (md) => {
  const out = [];
  md.split('\n').forEach((line, i) => {
    const head = line.match(/^## (\S+) — (\d{4})-(\d\d)-(\d\d)$/);
    if (head) return out.push({ version: head[1], iso: `${head[2]}-${head[3]}-${head[4]}`, date: `${Number(head[4])} ${MONTHS[head[3] - 1]} ${head[2]}`, points: [] });
    if (line.startsWith('## ')) throw new Error(`CHANGELOG.md line ${i + 1}: a release heading reads "## <version> — <yyyy-mm-dd>"`);
    if (!out.length || !line.trim()) return;
    if (!line.startsWith('- ')) throw new Error(`CHANGELOG.md line ${i + 1}: under a release, write each point on one "- " line`);
    out.at(-1).points.push(esc(line.slice(2)).replace(/`([^`]+)`/g, '<code>$1</code>'));
  });
  const empty = out.find((r) => !r.points.length);
  if (empty) throw new Error(`CHANGELOG.md: ${empty.version} has no points`);
  return out;
};

const releaseHtml = (r, i) => `  <article class="rel" id="v${r.version}">
    <header><a class="pill" href="#v${r.version}">${r.version}</a>${i ? '' : '<span class="latest">Latest</span>'}<time datetime="${r.iso}">${r.date}</time></header>
    <ul>${r.points.map((p) => `<li>${p}</li>`).join('')}</ul>
  </article>`;

// Fills {{name}} in a page of site-src/. A name without a value stops the build instead of reaching the site.
const fill = (page, values) => page.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in values)) throw new Error(`site-src has {{${k}}}, which the build does not fill`);
  return values[k];
});

// The sitemap lists the pages people search for, dated by the newest release: the site is only rebuilt by a release.
const PAGES = ['', 'changelog.html', 'privacy.html'];
const sitemap = (rels) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${HOME}${p}</loc><lastmod>${rels[0].iso}</lastmod></url>`).join('\n')}
</urlset>
`;

// The site's generated files, by name. Built before anything is published, so a broken page stops the release.
// keys: the tool's own shortcut list (KEYS in core.js). The page groups it under headings with shorter words, so the
// build checks that both name the same keys: a key added to the tool stops the build until the page lists it.
const sitePages = ({ version, extVersion, bookmark, bookmarkFixed, siteUrl, serverHtml, keys, changelog, clientJs, versionSvg, extZip }) => {
  const index = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const pageKeys = [...index.matchAll(/class="krow[^"]*" data-k="([^"]*)"/g)].map((m) => m[1]).sort();
  const toolKeys = keys.map(([k]) => k.split(' / ').map((x) => x.replace('+click', '')).join(' ')).sort();
  if (pageKeys.join('\n') !== toolKeys.join('\n')) {
    throw new Error(`the shortcuts in site-src/index.html (${pageKeys.join(', ')}) differ from KEYS in core.js (${toolKeys.join(', ')})`);
  }
  const rels = releases(changelog);
  return {
    // siteHost: where the self-updating bookmark loads its code from, named on its copy button.
    'index.html': fill(index, { home: HOME, version, extVersion, bookmark, bookmarkFixed, siteHost: new URL(siteUrl).host, serverCode: serverHtml, serverLines: serverHtml.split('\n').length,
      extZipKB: Math.round(extZip.length / 1024) }),
    'changelog.html': fill(fs.readFileSync(path.join(SRC, 'changelog.html'), 'utf8'),
      { home: HOME, version, extVersion, releases: rels.map(releaseHtml).join('\n') }),
    'privacy.html': fill(fs.readFileSync(path.join(SRC, 'privacy.html'), 'utf8'), { home: HOME, version }),
    'sitemap.xml': sitemap(rels),
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${HOME}sitemap.xml\n`,
    'client.js': clientJs,
    'version.svg': versionSvg,
    'page-comments-chrome.zip': extZip,
  };
};

// Replaces site/ with site-src/ and the generated files, so a file deleted from site-src/ leaves site/ too.
const writeSite = (files) => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(SRC, OUT, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), text);
};

module.exports = { HOME, releases, sitemap, fill, sitePages, writeSite };
