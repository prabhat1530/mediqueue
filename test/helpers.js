import { buildContainer } from '../src/container.js';
import { Notifier } from '../src/notifications/notifiers.js';

/** A clock the test controls. Possible because services depend on "a clock", not on Date. */
export class FakeClock {
  constructor(isoLocal = '2026-10-22T10:00:00') {
    this.time = new Date(isoLocal);
  }

  now() {
    return new Date(this.time);
  }

  advance(minutes) {
    this.time = new Date(this.time.getTime() + minutes * 60000);
  }
}

/** Collects messages instead of sending them. */
export class InMemoryNotifier extends Notifier {
  sent = [];

  get channel() { return 'TEST'; }

  send(patient, message) {
    this.sent.push({ patient: patient.name, message });
  }
}

/** A fresh in-memory system with one doctor and some patients. */
export function setup({ dbFile = ':memory:' } = {}) {
  const clock = new FakeClock();
  const notifier = new InMemoryNotifier();
  const c = buildContainer({ dbFile, clock, notifiers: [notifier] });
  const { doctorService, patientService } = c.services;

  const doctor = doctorService.create({ name: 'Dr. Mehta', specialization: 'General', avgConsultMins: 10 });
  const p = (name, age) => patientService.register({ name, phone: '9000000000', age });
  const patients = {
    young: p('Ravi', 30),
    young2: p('Asha', 25),
    senior: p('Kamla', 72),
    emergency: p('Arjun', 40),
  };
  return { ...c, ...c.services, clock, notifier, doctor, patients };
}
