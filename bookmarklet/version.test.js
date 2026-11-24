const test = require('node:test');
const assert = require('node:assert');
const { nextVersions } = require('./version.js');

const last = { version: '1.9.5', hash: 'b1', extension: { version: '1.9.5', hash: 'e1' } };

test('unchanged code keeps both versions', () => {
  assert.deepStrictEqual(nextVersions({ last, hash: 'b1', extHash: 'e1' }), { version: '1.9.5', extVersion: '1.9.5' });
});

test('an extension-only change gives the extension a fourth number, and the next one counts on', () => {
  const first = nextVersions({ last, hash: 'b1', extHash: 'e2' });
  assert.deepStrictEqual(first, { version: '1.9.5', extVersion: '1.9.5.1' });
  const second = nextVersions({ last: { ...last, extension: { version: '1.9.5.1', hash: 'e2' } }, hash: 'b1', extHash: 'e3' });
  assert.deepStrictEqual(second, { version: '1.9.5', extVersion: '1.9.5.2' });
});

test('a bookmark change moves both to the next three-part version', () => {
  const after = { ...last, extension: { version: '1.9.5.2', hash: 'e3' } };
  assert.deepStrictEqual(nextVersions({ last: after, hash: 'b2', extHash: 'e3' }), { version: '1.9.6', extVersion: '1.9.6' });
  assert.deepStrictEqual(nextVersions({ last: after, hash: 'b1', extHash: 'e3', bump: 'minor' }), { version: '1.10.0', extVersion: '1.10.0' });
});

test('a release.json without the extension starts it at the bookmark version', () => {
  assert.deepStrictEqual(nextVersions({ last: { version: '1.9.5', hash: 'b1' }, hash: 'b1', extHash: 'e9' }), { version: '1.9.5', extVersion: '1.9.5' });
});

test('an unknown bump is refused', () => {
  assert.throws(() => nextVersions({ last, hash: 'b1', extHash: 'e1', bump: 'huge' }), /usage/);
});
