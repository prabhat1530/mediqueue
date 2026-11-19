import { ConflictError, NotFoundError, requireFields } from '../domain/errors.js';
import { isUniqueViolation } from '../infra/Database.js';
import { localDate } from '../infra/Clock.js';

export class AppointmentService {
  constructor({ db, appointmentRepo, slotRepo, patientRepo, clock }) {
    this.db = db;
    this.appointmentRepo = appointmentRepo;
    this.slotRepo = slotRepo;
    this.patientRepo = patientRepo;
    this.clock = clock;
  }

  /**
   * Books a slot. Double-booking is prevented by the database, not by an
   * "is it free?" check in code: a check-then-insert has a race window where two
   * receptionists both see "free". The UNIQUE(slot_id) constraint has no such window.
   */
  book({ slotId, patientId } = {}) {
    requireFields({ slotId, patientId }, ['slotId', 'patientId']);
    if (!this.slotRepo.findById(slotId)) throw new NotFoundError(`Slot ${slotId} not found`);
    if (!this.patientRepo.findById(patientId)) throw new NotFoundError(`Patient ${patientId} not found`);

    try {
      return this.db.transaction(() =>
        this.appointmentRepo.create({ slotId, patientId, createdAt: this.clock.now().toISOString() }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(`Slot ${slotId} is already booked`);
      throw err;
    }
  }

  get(id) {
    const appointment = this.appointmentRepo.findById(id);
    if (!appointment) throw new NotFoundError(`Appointment ${id} not found`);
    return appointment;
  }

  listToday() {
    return this.appointmentRepo.findByDate(localDate(this.clock.now()));
  }
}
