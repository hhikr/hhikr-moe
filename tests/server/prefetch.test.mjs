// Telling a click apart from the browser fetching ahead of one.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { isNavigation, isPrefetch } = await import('../../src/server/prefetch.ts');

const h = (init) => new Headers(init);

test('prefetch requests are recognised by what the browser says they are for', () => {
  assert.equal(isPrefetch(h({ 'Sec-Purpose': 'prefetch' })), true);
  assert.equal(isPrefetch(h({ 'Sec-Purpose': 'prefetch;prerender' })), true);
  assert.equal(isPrefetch(h({ Purpose: 'prefetch' })), true);
  assert.equal(isPrefetch(h({ 'X-Moz': 'prefetch' })), true);
  assert.equal(isPrefetch(h({})), false);
  assert.equal(isPrefetch(h({ 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' })), false);
});

test('only the visitor going to an address counts as a navigation', () => {
  assert.equal(isNavigation(h({ 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' })), true);
  assert.equal(isNavigation(h({})), true, 'a browser that says nothing is let through');
  assert.equal(isNavigation(h({ 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' })), false, 'a script fetching the address');
  assert.equal(isNavigation(h({ 'Sec-Fetch-Dest': 'empty', 'Sec-Purpose': 'prefetch' })), false);
  assert.equal(isNavigation(h({ 'Sec-Fetch-Dest': 'document', 'Sec-Purpose': 'prefetch' })), false, 'a prefetch of a page is still a prefetch');
});
