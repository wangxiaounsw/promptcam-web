import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canEnterStudio, canUseFordexa, pickViewingOrg, pullAction, pullFallback } from './scope.ts';

test('admin may view any existing org', () => {
  assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: 'b', requestedExists: true }), 'b');
});

test('admin falls back to own org when the requested org is gone', () => {
  assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: 'x', requestedExists: false }), 'a');
});

test('a member always sees their own org, whatever the request says', () => {
  assert.equal(pickViewingOrg({ isAdmin: false, ownOrgId: 'a', requested: 'b', requestedExists: true }), 'a');
});

test('no header means own org', () => {
  assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: null, requestedExists: false }), 'a');
});

test('only admins and members of an active org enter the studio', () => {
  assert.equal(canEnterStudio({ isAdmin: false, ownOrgActive: false }), false);
  assert.equal(canEnterStudio({ isAdmin: false, ownOrgActive: true }), true);
  assert.equal(canEnterStudio({ isAdmin: true, ownOrgActive: false }), true);
});

test('the fordexa script is usable when unclaimed or claimed by us', () => {
  assert.equal(canUseFordexa(null, 'a'), true);
  assert.equal(canUseFordexa('a', 'a'), true);
  assert.equal(canUseFordexa('b', 'a'), false);
});

test('an existing script sees the fordexa original only if its company holds it, or it is an unclaimed fordexa copy', async () => {
  const { scriptMayUseFordexa } = await import('./scope.ts');
  assert.equal(scriptMayUseFordexa({ claimOrgId: 'a', orgId: 'a', source: 'fordexa' }), true);
  assert.equal(scriptMayUseFordexa({ claimOrgId: 'b', orgId: 'a', source: 'fordexa' }), false);
  // 别家占着时拉来的空稿子：占用释放后也不能自动拿到原稿
  assert.equal(scriptMayUseFordexa({ claimOrgId: null, orgId: 'a', source: 'self' }), false);
  assert.equal(scriptMayUseFordexa({ claimOrgId: null, orgId: 'a', source: 'fordexa' }), true);
});

test('on the website a claimed fordexa script shows only to its company and to admins', async () => {
  const { fordexaVisible } = await import('./scope.ts');
  assert.equal(fordexaVisible({ claimOrgId: null, viewerOrgId: null, isAdmin: false }), true);
  assert.equal(fordexaVisible({ claimOrgId: 'a', viewerOrgId: 'a', isAdmin: false }), true);
  assert.equal(fordexaVisible({ claimOrgId: 'a', viewerOrgId: 'b', isAdmin: false }), false);
  // 没登录的人也看不到：免费样稿被占了，不然别家退出登录就能看
  assert.equal(fordexaVisible({ claimOrgId: 'a', viewerOrgId: null, isAdmin: false }), false);
  assert.equal(fordexaVisible({ claimOrgId: 'a', viewerOrgId: 'b', isAdmin: true }), true);
});

test('public page: already in our library opens it instead of pulling a second copy', () => {
  assert.equal(pullAction({ claim: 'ours', hasScript: true }), 'open');
  assert.equal(pullAction({ claim: 'taken', hasScript: true }), 'open');
});

test('public page: an unclaimed Fordexa script can be pulled', () => {
  assert.equal(pullAction({ claim: undefined, hasScript: false }), 'pull');
});

test('public page: our claim but the script was archived pulls the original again', () => {
  assert.equal(pullAction({ claim: 'ours', hasScript: false }), 'pull');
});

test('public page: claimed by another company offers generating with our own prompt instead', () => {
  assert.equal(pullAction({ claim: 'taken', hasScript: false }), 'generate');
});

test('public page: not signed in or not a customer still sees the button, then the apply prompt', () => {
  assert.equal(pullFallback(401), 'guest');
  assert.equal(pullFallback(403), 'guest');
});

test('public page: a server error hides the button instead of telling a customer to apply', () => {
  assert.equal(pullFallback(502), 'hidden');
  assert.equal(pullFallback(0), 'hidden');
});
