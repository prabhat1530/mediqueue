import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Token } from '../src/domain/Token.js';
import { ConflictError } from '../src/domain/errors.js';

test('happy path: WAITING → CALLED → IN_CONSULTATION → DONE', () => {
  const t = new Token({ status: 'WAITING' });
  assert.equal(t.call().status, 'CALLED');
  assert.equal(t.start().status, 'IN_CONSULTATION');
  assert.equal(t.complete().status, 'DONE');
});

test('CALLED → NO_SHOW is allowed', () => {
  assert.equal(new Token({ status: 'CALLED' }).noShow().status, 'NO_SHOW');
});

test('illegal jumps are rejected', () => {
  assert.throws(() => new Token({ status: 'WAITING' }).complete(), ConflictError);
  assert.throws(() => new Token({ status: 'WAITING' }).noShow(), ConflictError);
  assert.throws(() => new Token({ status: 'IN_CONSULTATION' }).call(), ConflictError);
});

test('DONE and NO_SHOW are terminal', () => {
  for (const status of ['DONE', 'NO_SHOW']) {
    for (const action of ['call', 'start', 'complete', 'noShow']) {
      assert.throws(() => new Token({ status })[action](), ConflictError, `${status}.${action}`);
    }
  }
});
