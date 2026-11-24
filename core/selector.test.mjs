import test from 'node:test';
import assert from 'node:assert';
import { shortSelector } from './core.js';

test('a long chain keeps its nearest id and last three steps', () => {
  const github = '#repos-split-pane-content > div > div > div > div:nth-of-type(1) > div > div > div:nth-of-type(3) > div:nth-of-type(2) > div > div:nth-of-type(2) > article > markdown-accessiblity-table:nth-of-type(2)';
  assert.strictEqual(shortSelector(github), '#repos-split-pane-content > … > div:nth-of-type(2) > article > markdown-accessiblity-table:nth-of-type(2)');
});

test('the nearest id wins over an earlier one, and short chains stay whole', () => {
  assert.strictEqual(shortSelector('#page > main > section#ref > div > div:nth-of-type(1)'), 'section#ref > div > div:nth-of-type(1)');
  assert.strictEqual(shortSelector('#send'), '#send');
  assert.strictEqual(shortSelector('body > header > div:nth-of-type(2) > div:nth-of-type(1)'), 'body > header > div:nth-of-type(2) > div:nth-of-type(1)');
});

test('without an id it starts from the top', () => {
  assert.strictEqual(shortSelector('body > main > section > div > ul > li:nth-of-type(4) > a'), 'body > … > ul > li:nth-of-type(4) > a');
});
