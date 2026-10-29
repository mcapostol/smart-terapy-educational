import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONSENT_KEY,
  CONSENT_MAX_AGE,
  ESTIMATE_KEY,
  REMEMBER_KEY,
  clearCalculatorPreferences,
  hasRememberedChoice,
  readConsent,
  setRememberedChoice,
} from '../public/preferences.js';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const removed = [];

  return {
    removed,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      removed.push(key);
      values.delete(key);
    },
  };
}

test('defaults to no consent and no remembered choice', () => {
  const storage = fakeStorage();

  assert.equal(readConsent(storage, 1_000), null);
  assert.equal(hasRememberedChoice(storage), false);
  assert.equal(readConsent(null), null);
  assert.equal(hasRememberedChoice(null), false);
});

test('strictly rejects malformed, incompatible, expired, and future consent records', () => {
  const now = 2_000_000_000_000;
  const invalidValues = [
    '{broken json',
    'null',
    '[]',
    JSON.stringify({ version: 2, functional: true, updatedAt: now - 1 }),
    JSON.stringify({ version: 1, functional: 'true', updatedAt: now - 1 }),
    JSON.stringify({ version: 1, functional: true, updatedAt: 'yesterday' }),
    JSON.stringify({ version: 1, functional: true, updatedAt: now + 1 }),
    JSON.stringify({ version: 1, functional: true, updatedAt: now - CONSENT_MAX_AGE }),
    JSON.stringify({ version: 1, functional: true, updatedAt: now - CONSENT_MAX_AGE - 1 }),
  ];

  for (const stored of invalidValues) {
    const storage = fakeStorage({ [CONSENT_KEY]: stored });
    assert.equal(readConsent(storage, now), null, stored);
  }

  const stillValid = {
    version: 1,
    functional: false,
    updatedAt: now - CONSENT_MAX_AGE + 1,
  };
  assert.deepEqual(
    readConsent(fakeStorage({ [CONSENT_KEY]: JSON.stringify(stillValid) }), now),
    stillValid,
  );
});

test('explicit acceptance persists consent and enables the remembered choice', () => {
  const storage = fakeStorage();
  const originalNow = Date.now;
  Date.now = () => 1_900_000_000_000;

  try {
    assert.equal(setRememberedChoice(storage, true), true);
    assert.equal(storage.getItem(REMEMBER_KEY), 'yes');
    assert.deepEqual(JSON.parse(storage.getItem(CONSENT_KEY)), {
      version: 1,
      functional: true,
      updatedAt: 1_900_000_000_000,
    });
    assert.equal(hasRememberedChoice(storage), true);
  } finally {
    Date.now = originalNow;
  }
});

test('rejection clears only optional calculator data and keeps a false consent record', () => {
  const storage = fakeStorage({
    [ESTIMATE_KEY]: '{"participants":12}',
    [REMEMBER_KEY]: 'yes',
    [CONSENT_KEY]: '{"old":true}',
    unrelated: 'keep me',
  });
  const originalNow = Date.now;
  Date.now = () => 1_900_000_000_000;

  try {
    assert.equal(setRememberedChoice(storage, false), true);
    assert.equal(storage.getItem(ESTIMATE_KEY), null);
    assert.equal(storage.getItem(REMEMBER_KEY), null);
    assert.equal(storage.getItem('unrelated'), 'keep me');
    assert.deepEqual(storage.removed, [ESTIMATE_KEY, REMEMBER_KEY]);
    assert.deepEqual(JSON.parse(storage.getItem(CONSENT_KEY)), {
      version: 1,
      functional: false,
      updatedAt: 1_900_000_000_000,
    });
    assert.equal(hasRememberedChoice(storage), false);
  } finally {
    Date.now = originalNow;
  }
});

test('blocked storage fails safely without throwing', () => {
  const blockedStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };

  assert.equal(readConsent(blockedStorage), null);
  assert.equal(hasRememberedChoice(blockedStorage), false);
  assert.equal(clearCalculatorPreferences(blockedStorage), false);
  assert.equal(setRememberedChoice(blockedStorage, true), false);
  assert.equal(setRememberedChoice(null, true), false);
});
