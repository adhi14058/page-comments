import test from 'node:test';
import assert from 'node:assert';
import { fromLink } from './core.js';

const PAGE = 'https://a.com/p';
const base = { id: 'a1', comment: 'Bigger', selector: '#x' };

test('a shared comment of the right shape comes through, on this page and marked as shared', () => {
  const area = { ...base, area: { dx: 1, dy: 2, w: 30, h: 40 }, group: true, items: [{ selector: '#a', text: 't', box: { dx: 0, dy: 0, w: 5, h: 5 } }] };
  const got = fromLink(area, PAGE);
  assert.deepStrictEqual(got.items, area.items);
  assert.deepStrictEqual(got.area, area.area);
  assert.strictEqual(got.page, PAGE);
  assert.strictEqual(got.shared, true);
});

test('text fields that are not strings become empty instead of breaking the list', () => {
  const got = fromLink({ ...base, text: { a: 1 }, html: 5, selectedText: ['x'] }, PAGE);
  assert.deepStrictEqual([got.text, got.html, got.selectedText], ['', '', '']);
});

test('a link cannot inject CSS through a box, nor send an area or batch without its items', () => {
  const css = { dx: 0, dy: 0, w: '5px;background:url(https://attacker.example/x)', h: 5 };
  assert.strictEqual(fromLink({ ...base, area: { dx: 0, dy: 0, w: 1, h: 1 }, items: [{ selector: '#a', box: css }] }, PAGE), null);
  assert.strictEqual(fromLink({ ...base, area: { ...css } , items: [] }, PAGE), null);
  assert.strictEqual(fromLink({ ...base, area: { dx: 0, dy: 0, w: 1, h: 1 } }, PAGE), null);
  assert.strictEqual(fromLink({ ...base, group: true }, PAGE), null);
  const extra = fromLink({ ...base, area: { dx: 0, dy: 0, w: 1, h: 1, x: 'evil' }, items: [{ selector: '#a', box: { dx: 0, dy: 0, w: 1, h: 1, y: 'evil' }, z: 1 }] }, PAGE);
  assert.deepStrictEqual(extra.area, { dx: 0, dy: 0, w: 1, h: 1 });
  assert.deepStrictEqual(extra.items, [{ selector: '#a', text: '', box: { dx: 0, dy: 0, w: 1, h: 1 } }]);
});
