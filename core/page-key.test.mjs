import test from 'node:test';
import assert from 'node:assert';
import { pageKey } from './core.js';

test('the page key drops the hash and tracking parameters, and keeps the rest of the query as it is', () => {
  assert.strictEqual(pageKey('https://a.com/p?id=42&utm_source=news&UTM_Medium=mail&fbclid=x1#top'), 'https://a.com/p?id=42');
  assert.strictEqual(pageKey('https://a.com/p?gclid=1&b=%20c&a=1'), 'https://a.com/p?b=%20c&a=1');
  assert.strictEqual(pageKey('https://a.com/p?utm_campaign=x'), 'https://a.com/p');
  assert.strictEqual(pageKey('https://a.com/p?ref=x&source=y'), 'https://a.com/p?ref=x&source=y');
  assert.strictEqual(pageKey('http://localhost:3000/#/settings'), 'http://localhost:3000/');
});

test('comments saved under an older key, tracking parameters and all, still match their page', () => {
  const saved = 'https://jira.example.com/browse/X-1?utm_source=slack&selectedIssue=X-2'; // what older copies stored
  assert.strictEqual(pageKey(saved), pageKey('https://jira.example.com/browse/X-1?selectedIssue=X-2&fbclid=9#c'));
  assert.notStrictEqual(pageKey(saved), pageKey('https://jira.example.com/browse/X-1?selectedIssue=X-3'));
});
