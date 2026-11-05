import { test } from 'node:test';
import assert from 'node:assert/strict';
import robots from './robots.ts';

// /library must stay crawlable: a page blocked by robots.txt is never fetched, so its noindex is never read and a
// publicly shared link can still be listed as a bare URL. The page's own noindex keeps it out of search results.
test('robots leaves library crawlable so its noindex is read', () => {
  const rules = [robots().rules].flat();
  const disallow = rules.flatMap((r) => [r?.disallow ?? []].flat());
  assert.ok(!disallow.some((d) => d.startsWith('/library')), JSON.stringify(disallow));
  assert.ok(disallow.includes('/admin'));
});
