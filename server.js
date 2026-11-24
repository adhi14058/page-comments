// Receives page comments (and screenshots) from the bookmarklet and runs Claude Code on them in your project.
// Usage: node server.js /path/to/your/project   (needs Node 18+ and the claude CLI on PATH)
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROMPT = 'Below are comments a user left on elements of a web page. Find the code in this project behind each element (from its selector, text and HTML) and make the change asked for.\n\n';
// Any website open in the browser can reach localhost, so only pages served from this machine may start Claude:
// localhost, *.localhost, loopback addresses, and names the hosts file points at a loopback address (read on every
// request, so a new entry works without a restart). Never DNS: any site can make its own name resolve to 127.0.0.1.
const HOSTS = process.env.HOSTS_FILE || (process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts') : '/etc/hosts');
const hostsNames = () => {
  try {
    return fs.readFileSync(HOSTS, 'utf8').split('\n').flatMap((line) => {
      const [ip, ...names] = line.replace(/#.*/, '').trim().split(/\s+/);
      return /^(127\.\d+\.\d+\.\d+|::1)$/.test(ip) ? names.map((n) => n.toLowerCase()) : [];
    });
  } catch {
    return [];
  }
};
const isLocal = (origin) => {
  let url;
  try { url = new URL(origin); } catch { return false; }
  const host = url.hostname;
  return /^https?:$/.test(url.protocol) && url.origin === origin &&
    (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(host) || hostsNames().includes(host));
};
// A Claude started from inside another Claude session must not inherit its CLAUDE* settings.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')));
let busy = false;

process.chdir(process.argv[2] || '.');
createServer((req, res) => {
  const origin = req.headers.origin;
  const reply = (code, msg) => res.writeHead(code, isLocal(origin) ? { 'Access-Control-Allow-Origin': origin } : {}).end(msg);
  if (!isLocal(origin)) return reply(403, 'origin not allowed');
  if (req.url === '/health') return reply(200, 'ok');
  if (req.method !== 'POST' || req.url !== '/comments') return reply(404, 'not found');
  if (busy) return reply(409, 'Claude is still working on the last batch');
  let body = '';
  req.on('data', (chunk) => (body += chunk).length > 30e6 && req.destroy());
  req.on('end', () => {
    let text, images;
    try {
      ({ text, images = [] } = JSON.parse(body));
    } catch {
      return reply(400, 'update the bookmark: this server expects its newer format');
    }
    if (typeof text !== 'string' || !Array.isArray(images)) return reply(400, 'bad request');
    busy = true;
    // Screenshots (data: URLs) go to a temporary folder Claude may read. File names are ours, never the page's,
    // and the extension follows the picture's type, which is how Claude tells the format.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-comments-'));
    // images[i] is comment i+1's picture, or a list of them (one per selected element: screenshot-2a, -2b, ...).
    images.forEach((pics, i) => [].concat(pics || []).forEach((url, k, all) => {
      const [, type, data] = /^data:image\/(png|webp|jpeg);base64,(.+)$/.exec(String(url)) || [];
      const tag = all.length < 2 ? '' : k < 26 ? String.fromCharCode(97 + k) : '-' + (k + 1);
      if (data) fs.writeFileSync(path.join(dir, `screenshot-${i + 1}${tag}.${type === 'jpeg' ? 'jpg' : type}`), Buffer.from(data, 'base64'));
    }));
    const note = images.some(Boolean) ? `\n\nThe screenshots are in ${dir}: screenshot-N (or Na, Nb, ... when a comment has several) belongs to comment N. Look at them.` : '';
    // 'close' also fires when claude cannot start, after 'error'.
    spawn('claude', ['-p', PROMPT + text + note, '--permission-mode', 'acceptEdits', '--add-dir', dir], { env, stdio: ['ignore', 'inherit', 'inherit'] })
      .on('error', (err) => console.error('could not start claude:', err.message))
      .on('close', () => {
        busy = false;
        fs.rmSync(dir, { recursive: true, force: true });
      });
    reply(202, 'sent');
  });
}).listen(4747, '127.0.0.1', () => console.log('page-comments on http://localhost:4747, project:', process.cwd()));
