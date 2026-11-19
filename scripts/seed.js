// Demo data for today. Run with the server STOPPED: npm run reset && npm run seed
import { buildContainer } from '../src/container.js';
import { localDate } from '../src/infra/Clock.js';

const { services } = buildContainer({ dbFile: process.env.DB_FILE, notifiers: [] });
const { doctorService, patientService, appointmentService, queueService } = services;
const today = localDate(new Date());

const mehta = doctorService.create({ name: 'Dr. Anita Mehta', specialization: 'General Medicine', avgConsultMins: 10 });
const rao = doctorService.create({ name: 'Dr. Vikram Rao', specialization: 'Orthopedics', avgConsultMins: 15 });
const mehtaSlots = doctorService.generateSlots(mehta.id, { date: today, from: '09:00', to: '17:00' }).available;
doctorService.generateSlots(rao.id, { date: today, from: '09:00', to: '17:00' });

const p = (name, phone, age) => patientService.register({ name, phone, age });
const ravi = p('Ravi Kumar', '9810000001', 34);
const asha = p('Asha Verma', '9810000002', 28);
const kamla = p('Kamla Devi', '9810000003', 71);
const arjun = p('Arjun Singh', '9810000004', 45);
const neha = p('Neha Gupta', '9810000005', 22);
p('Suresh Iyer', '9810000006', 66);

// Ravi and Neha booked earlier; Ravi has arrived and checked in.
const raviAppt = appointmentService.book({ slotId: mehtaSlots[0].id, patientId: ravi.id });
appointmentService.book({ slotId: mehtaSlots[1].id, patientId: neha.id });
queueService.checkIn(raviAppt.id);

queueService.issueWalkIn({ doctorId: mehta.id, patientId: asha.id });                    // walk-in
queueService.issueWalkIn({ doctorId: mehta.id, patientId: kamla.id });                   // senior (age 71)
queueService.issueWalkIn({ doctorId: mehta.id, patientId: arjun.id, isEmergency: true }); // emergency

console.log('Seeded: 2 doctors, 6 patients, 2 appointments, 4 tokens in Dr. Mehta\'s queue.');
console.log(queueService.getQueue(mehta.id).waiting.map((t) => `  #${t.token_no} ${t.patient_name} [${t.category}] score ${t.score}`).join('\n'));
