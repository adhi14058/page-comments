const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Starts the real server (port 4747 must be free) and checks who may talk to it.
test('only pages on this machine may use the server', async (t) => {
  const taken = await new Promise((ok) => http.get({ host: '127.0.0.1', port: 4747, path: '/health' }, (r) => ok(r.resume() && true)).on('error', () => ok(false)));
  if (taken) return t.skip('port 4747 is in use (a page-comments server is already running); stop it to run this test');
  // A hosts file like a developer's: a name pointed at this machine, one pointed elsewhere, a commented-out one.
  const hosts = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'page-comments-test-')), 'hosts');
  fs.writeFileSync(hosts, '127.0.0.1 localhost\n127.0.0.1   myapp.test Dev.Example.com  # my apps\n10.0.0.5 nas.home\n# 127.0.0.1 old.test\n');
  const server = spawn('node', [path.join(__dirname, 'server.js'), os.tmpdir()], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, HOSTS_FILE: hosts } });
  t.after(() => { server.kill(); fs.rmSync(path.dirname(hosts), { recursive: true, force: true }); });
  await new Promise((ok) => server.stdout.once('data', ok));

  const get = (origin) => new Promise((ok, fail) =>
    http.get({ host: '127.0.0.1', port: 4747, path: '/health', headers: origin ? { origin } : {} }, (res) => {
      res.resume();
      ok({ status: res.statusCode, allow: res.headers['access-control-allow-origin'] });
    }).on('error', fail));

  assert.deepEqual(await get('http://localhost:3000'), { status: 200, allow: 'http://localhost:3000' });
  assert.deepEqual(await get('http://127.0.0.1'), { status: 200, allow: 'http://127.0.0.1' });
  assert.equal((await get('https://evil.com')).status, 403);
  assert.equal((await get('http://localhost.evil.com')).status, 403);
  assert.equal((await get(null)).status, 403);
  assert.equal((await get('http://app.localhost:5173')).status, 200);
  assert.equal((await get('http://myapp.test:8080')).status, 200);
  assert.equal((await get('https://dev.example.com')).status, 200);
  assert.equal((await get('http://nas.home')).status, 403);
  assert.equal((await get('http://old.test')).status, 403);
  assert.equal((await get('http://myapp.test.evil.com')).status, 403);
  assert.equal((await get('file://')).status, 403);
});
