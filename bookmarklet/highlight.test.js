const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments, highlight } = require('./highlight.js');

const server = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');

test('stripping comments keeps server.js valid and drops only comments', () => {
  const code = stripComments(server);
  new Function('require', 'module', code); // throws on a syntax error
  assert.ok(!/^\s*\/\//m.test(code), 'a comment-only line is left');
  assert.ok(!/;\s*\/\/ /.test(code), 'a trailing comment is left');
  assert.ok(code.includes('http://localhost:4747'), '// inside a string was taken for a comment');
  assert.ok(code.includes('/^data:image\\/(png|webp|jpeg);base64,(.+)$/'), 'the regex was damaged');
  assert.ok(code.includes("line.replace(/#.*/, '')"), 'a regex with # was damaged');
  assert.equal(stripComments('a(); // x\n  // y\n\nb();\n'), 'a();\n\nb();\n');
});

test('highlighting changes markup only, never the code', () => {
  const code = stripComments(server);
  const text = highlight(code).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(text, code);
  assert.ok(highlight('const r = /a\\/b/.test(x) / 2;').includes('<span class="r">/a\\/b/</span>'));
});
