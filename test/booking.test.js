import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

test('the same slot cannot be booked twice', () => {
  const { appointmentService, doctorService, doctor, patients } = setup();
  const { available } = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '10:00', to: '10:30' });

  appointmentService.book({ slotId: available[0].id, patientId: patients.young.id });
  assert.throws(
    () => appointmentService.book({ slotId: available[0].id, patientId: patients.young2.id }),
    ConflictError,
  );
  // The other slot is still free
  assert.ok(appointmentService.book({ slotId: available[1].id, patientId: patients.young2.id }));
});

test('two receptionists (two DB connections) racing for one slot: exactly one wins', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dbFile = join(mkdtempSync(join(tmpdir(), 'mq-')), 'race.db');

  const deskA = setup({ dbFile });
  const { buildContainer } = await import('../src/container.js');
  const deskB = buildContainer({ dbFile, notifiers: [] }); // a second connection to the same DB file
  const { available } = deskA.doctorService.generateSlots(deskA.doctor.id, { date: '2026-10-22', from: '10:00', to: '10:15' });
  const slotId = available[0].id;

  const results = [
    () => deskA.appointmentService.book({ slotId, patientId: deskA.patients.young.id }),
    () => deskB.services.appointmentService.book({ slotId, patientId: deskA.patients.young2.id }),
  ].map((attempt) => {
    try { attempt(); return 'booked'; } catch (e) { return e instanceof ConflictError ? 'conflict' : e.message; }
  });

  assert.deepEqual(results.sort(), ['booked', 'conflict']);
});

test('slot generation is idempotent', () => {
  const { doctorService, doctor } = setup();
  const first = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '09:00', to: '10:00' });
  const again = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '09:00', to: '10:00' });
  assert.equal(first.created, 6);
  assert.equal(again.created, 0);
});
