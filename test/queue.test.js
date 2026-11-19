import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './helpers.js';
import { buildContainer } from '../src/container.js';
import { ConflictError, NotFoundError } from '../src/domain/errors.js';

test('full consultation: call → start → complete saves history', () => {
  const { queueService, patientService, doctor, patients } = setup();
  const token = queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });
  assert.equal(token.token_no, 1);

  assert.equal(queueService.callNext(doctor.id).status, 'CALLED');
  assert.equal(queueService.start(token.id).status, 'IN_CONSULTATION');
  queueService.complete(token.id, { notes: 'Fever', prescription: 'Paracetamol 500mg' });

  const history = patientService.history(patients.young.id);
  assert.equal(history.consultations.length, 1);
  assert.equal(history.consultations[0].prescription, 'Paracetamol 500mg');
  assert.equal(queueService.getQueue(doctor.id).current.length, 0);
});

test('cannot call the next patient while one is with the doctor', () => {
  const { queueService, doctor, patients } = setup();
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young2.id });
  queueService.callNext(doctor.id);
  assert.throws(() => queueService.callNext(doctor.id), ConflictError);
});

test('no-show frees the doctor for the next patient', () => {
  const { queueService, doctor, patients } = setup();
  const a = queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young2.id });
  queueService.callNext(doctor.id);
  queueService.noShow(a.id);
  const b = queueService.callNext(doctor.id);
  assert.equal(b.patient_name, 'Asha');
  queueService.noShow(b.id);
  assert.throws(() => queueService.callNext(doctor.id), NotFoundError); // nobody left
});

test('an appointment can only be checked in once', () => {
  const { queueService, doctorService, appointmentService, doctor, patients } = setup();
  const { available } = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '10:00', to: '10:15' });
  const appt = appointmentService.book({ slotId: available[0].id, patientId: patients.young.id });
  queueService.checkIn(appt.id);
  assert.throws(() => queueService.checkIn(appt.id), ConflictError);
});

test('notifications: TURN_NEAR and CALLED are each sent once', () => {
  const { queueService, doctor, patients, notifier } = setup();
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young2.id });
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.senior.id });
  queueService.callNext(doctor.id); // the senior is called first

  const forKamla = notifier.sent.filter((n) => n.patient === 'Kamla').map((n) => n.message);
  assert.equal(forKamla.filter((m) => m.includes('in line')).length, 1);
  assert.equal(forKamla.filter((m) => m.includes('please go to')).length, 1);
});

test('a token never lost after a crash: a new process sees the same queue', () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), 'mq-')), 'recover.db');
  const before = setup({ dbFile });
  before.queueService.issueWalkIn({ doctorId: before.doctor.id, patientId: before.patients.young.id });
  before.queueService.issueWalkIn({ doctorId: before.doctor.id, patientId: before.patients.senior.id });
  before.queueService.callNext(before.doctor.id);
  const snapshot = before.queueService.getQueue(before.doctor.id);

  // "Restart": a brand-new container on the same file, nothing shared in memory
  const after = buildContainer({ dbFile, clock: before.clock, notifiers: [] });
  assert.deepEqual(after.services.queueService.getQueue(before.doctor.id), snapshot);
});
