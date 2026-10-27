import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankVoice, SHAWN_VOICE, XIAOXIA_VOICE } from './bank-voice.ts';

test('数据类口播用 Shawn 的声音', () => {
  assert.equal(bankVoice('data'), SHAWN_VOICE);
});

test('其余行业用 xiaoxia', () => {
  for (const industry of ['accounting', 'migration', 'mortgage', 'property', 'legal']) {
    assert.equal(bankVoice(industry), XIAOXIA_VOICE);
  }
});

test('没有行业也用 xiaoxia', () => {
  assert.equal(bankVoice(null), XIAOXIA_VOICE);
  assert.equal(bankVoice(undefined), XIAOXIA_VOICE);
  assert.equal(bankVoice(''), XIAOXIA_VOICE);
});
