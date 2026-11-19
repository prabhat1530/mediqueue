import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EmergencyRule,
  SeniorCitizenRule,
  AppointmentRule,
  WalkInRule,
  CategoryResolver,
} from '../src/strategies/categoryRules.js';

const KNOWN = new Set(['EMERGENCY', 'SENIOR', 'APPOINTMENT', 'WALKIN']);

/** The production chain, in order. WalkInRule must stay last (it always matches). */
function resolver(categories = KNOWN) {
  return new CategoryResolver(
    [new EmergencyRule(), new SeniorCitizenRule(), new AppointmentRule(), new WalkInRule()],
    categories,
  );
}

test('first matching rule wins: an emergency senior with an appointment is EMERGENCY', () => {
  const ctx = { patient: { age: 72 }, isEmergency: true, appointmentId: 7 };
  assert.equal(resolver().resolve(ctx), 'EMERGENCY');
});

test('a senior with an appointment is SENIOR (senior rule precedes appointment rule)', () => {
  const ctx = { patient: { age: 65 }, appointmentId: 7 };
  assert.equal(resolver().resolve(ctx), 'SENIOR');
});

test('an appointment for a younger patient is APPOINTMENT', () => {
  const ctx = { patient: { age: 30 }, appointmentId: 7 };
  assert.equal(resolver().resolve(ctx), 'APPOINTMENT');
});

test('a plain walk-in falls through to WALKIN', () => {
  const ctx = { patient: { age: 30 } };
  assert.equal(resolver().resolve(ctx), 'WALKIN');
});

test('senior threshold is inclusive and configurable', () => {
  assert.equal(new SeniorCitizenRule().resolve({ patient: { age: 60 } }), 'SENIOR');
  assert.equal(new SeniorCitizenRule().resolve({ patient: { age: 59 } }), null);
  assert.equal(new SeniorCitizenRule(70).resolve({ patient: { age: 65 } }), null);
  assert.equal(new SeniorCitizenRule(70).resolve({ patient: { age: 70 } }), 'SENIOR');
});

test('a rule returning an unregistered category is rejected', () => {
  const r = new CategoryResolver([new EmergencyRule()], new Set(['WALKIN'])); // EMERGENCY not registered
  assert.throws(() => r.resolve({ isEmergency: true }), /unregistered category: EMERGENCY/);
});

test('a chain with no fallback and no match throws', () => {
  const r = new CategoryResolver([new SeniorCitizenRule()], KNOWN); // WalkInRule omitted
  assert.throws(() => r.resolve({ patient: { age: 30 } }), /No category rule matched/);
});
