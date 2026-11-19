import { NotFoundError, ValidationError, requireFields } from '../domain/errors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Doctors and their schedules (slots). */
export class DoctorService {
  constructor({ db, doctorRepo, slotRepo }) {
    this.db = db;
    this.doctorRepo = doctorRepo;
    this.slotRepo = slotRepo;
  }

  create({ name, specialization, avgConsultMins = 10 } = {}) {
    requireFields({ name, specialization }, ['name', 'specialization']);
    const mins = Number(avgConsultMins);
    if (!Number.isInteger(mins) || mins <= 0) throw new ValidationError('avgConsultMins must be a positive integer');
    return this.doctorRepo.create({ name, specialization, avgConsultMins: mins });
  }

  list() {
    return this.doctorRepo.findAll();
  }

  get(id) {
    const doctor = this.doctorRepo.findById(id);
    if (!doctor) throw new NotFoundError(`Doctor ${id} not found`);
    return doctor;
  }

  /** Creates back-to-back slots between `from` and `to` on `date`. Safe to call twice. */
  generateSlots(doctorId, { date, from = '09:00', to = '13:00', minutes } = {}) {
    const doctor = this.get(doctorId);
    if (!DATE.test(date ?? '')) throw new ValidationError('date must be YYYY-MM-DD');
    if (!TIME.test(from) || !TIME.test(to)) throw new ValidationError('from/to must be HH:MM');
    const step = Number(minutes ?? doctor.avg_consult_mins);
    if (!Number.isInteger(step) || step <= 0) throw new ValidationError('minutes must be a positive integer');

    const startTimes = [];
    for (let m = toMinutes(from); m + step <= toMinutes(to); m += step) {
      startTimes.push(`${date}T${toHHMM(m)}`);
    }
    const created = this.db.transaction(() => this.slotRepo.createMany(doctor.id, startTimes));
    return { created, available: this.slotRepo.findAvailable(doctor.id, date) };
  }

  availableSlots(doctorId, date) {
    if (!DATE.test(date ?? '')) throw new ValidationError('date query param must be YYYY-MM-DD');
    return this.slotRepo.findAvailable(this.get(doctorId).id, date);
  }
}
