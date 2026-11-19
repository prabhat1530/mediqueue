import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

test('order is Emergency > Senior > Appointment > Walk-in, whatever the arrival order', () => {
  const { queueService, doctorService, appointmentService, doctor, patients, clock } = setup();
  const { available } = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '10:00', to: '11:00' });

  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });                 // WALKIN
  const appt = appointmentService.book({ slotId: available[0].id, patientId: patients.young2.id });
  queueService.checkIn(appt.id);                                                                    // APPOINTMENT
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.senior.id });                // SENIOR (age 72)
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.emergency.id, isEmergency: true });

  const order = queueService.getQueue(doctor.id).waiting.map((t) => t.category);
  assert.deepEqual(order, ['EMERGENCY', 'SENIOR', 'APPOINTMENT', 'WALKIN']);
});

test('aging: a walk-in who has waited long enough overtakes a newer appointment', () => {
  const { queueService, doctorService, appointmentService, doctor, patients, clock } = setup();
  const { available } = doctorService.generateSlots(doctor.id, { date: '2026-10-22', from: '10:00', to: '11:00' });

  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id }); // 100 points
  clock.advance(60); // walk-in now has 100 + 60*2 = 220
  const appt = appointmentService.book({ slotId: available[0].id, patientId: patients.young2.id });
  queueService.checkIn(appt.id); // fresh appointment: 200

  const [first] = queueService.getQueue(doctor.id).waiting;
  assert.equal(first.category, 'WALKIN');
});

test('wait estimate = people ahead × avg consult time', () => {
  const { queueService, doctor, patients } = setup();
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young.id });
  queueService.issueWalkIn({ doctorId: doctor.id, patientId: patients.young2.id });
  assert.deepEqual(queueService.getQueue(doctor.id).waiting.map((t) => t.estimatedWaitMins), [0, 10]);

  queueService.callNext(doctor.id); // someone is now with the doctor
  assert.deepEqual(queueService.getQueue(doctor.id).waiting.map((t) => t.estimatedWaitMins), [10]);
});
