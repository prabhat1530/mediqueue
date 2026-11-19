import { Token } from '../domain/Token.js';
import { ConflictError, NotFoundError, ValidationError, requireFields } from '../domain/errors.js';
import { isUniqueViolation } from '../infra/Database.js';
import { localDate } from '../infra/Clock.js';

/**
 * The live per-doctor queue: issuing tokens, ordering them, moving them through
 * their lifecycle and estimating waits.
 *
 * Crash recovery: the queue is never held only in memory. It is recomputed from
 * the database on every read, so after a restart it is exactly as it was.
 */
export class QueueService {
  constructor({
    db, tokenRepo, doctorRepo, patientRepo, appointmentRepo, consultationRepo,
    categoryResolver, priorityStrategy, eventBus, clock,
  }) {
    this.db = db;
    this.tokenRepo = tokenRepo;
    this.doctorRepo = doctorRepo;
    this.patientRepo = patientRepo;
    this.appointmentRepo = appointmentRepo;
    this.consultationRepo = consultationRepo;
    this.categoryResolver = categoryResolver;
    this.priorityStrategy = priorityStrategy;
    this.eventBus = eventBus;
    this.clock = clock;
  }

  // ---------- Issuing tokens ----------

  issueWalkIn({ doctorId, patientId, isEmergency = false } = {}) {
    requireFields({ doctorId, patientId }, ['doctorId', 'patientId']);
    return this.#issue({
      doctor: this.#requireDoctor(doctorId),
      patient: this.#requirePatient(patientId),
      isEmergency: Boolean(isEmergency),
      appointmentId: null,
    });
  }

  checkIn(appointmentId) {
    const appointment = this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new NotFoundError(`Appointment ${appointmentId} not found`);
    if (appointment.start_time.slice(0, 10) !== this.#today()) {
      throw new ValidationError('Appointment is not for today');
    }
    return this.#issue({
      doctor: this.#requireDoctor(appointment.doctor_id),
      patient: this.#requirePatient(appointment.patient_id),
      isEmergency: false,
      appointmentId: appointment.id,
    });
  }

  #issue(ctx) {
    const category = this.categoryResolver.resolve(ctx);
    let token;
    try {
      // Reading the next number and inserting happen in one transaction,
      // so two receptionists can never get the same token number.
      token = this.db.transaction(() => {
        const queueDate = this.#today();
        return this.tokenRepo.create({
          doctorId: ctx.doctor.id,
          patientId: ctx.patient.id,
          appointmentId: ctx.appointmentId,
          tokenNo: this.tokenRepo.nextTokenNo(ctx.doctor.id, queueDate),
          category,
          queueDate,
          createdAt: this.clock.now().toISOString(),
        });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('Appointment is already checked in');
      throw err;
    }
    this.#changed(token.doctor_id);
    return token;
  }

  // ---------- Reading the queue ----------

  getQueue(doctorId) {
    const doctor = this.#requireDoctor(doctorId);
    const active = this.tokenRepo.findActive(doctor.id, this.#today());
    const current = active.filter((t) => t.status !== 'WAITING');
    const waiting = this.#order(active.filter((t) => t.status === 'WAITING'));
    const busy = current.length > 0 ? 1 : 0;

    return {
      doctor,
      current,
      waiting: waiting.map((t, i) => ({
        ...t,
        position: i + 1,
        estimatedWaitMins: (i + busy) * doctor.avg_consult_mins,
      })),
    };
  }

  /** Queue load per doctor, for the admin dashboard. */
  summary() {
    return this.doctorRepo.findAll().map((doctor) => {
      const { current, waiting } = this.getQueue(doctor.id);
      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        nowServing: current[0]?.token_no ?? null,
        waiting: waiting.length,
        estimatedClearMins: (waiting.length + (current.length ? 1 : 0)) * doctor.avg_consult_mins,
      };
    });
  }

  /** Highest score first; equal scores fall back to arrival order (FIFO). */
  #order(tokens) {
    const now = this.clock.now();
    return tokens
      .map((t) => ({ token: t, score: this.priorityStrategy.score(t, now) }))
      .sort((a, b) => b.score - a.score || a.token.created_at.localeCompare(b.token.created_at))
      .map(({ token, score }) => ({ ...token, score: Math.round(score) }));
  }

  // ---------- Lifecycle ----------

  callNext(doctorId) {
    const doctor = this.#requireDoctor(doctorId);
    const token = this.db.transaction(() => {
      const active = this.tokenRepo.findActive(doctor.id, this.#today());
      if (active.some((t) => t.status !== 'WAITING')) {
        throw new ConflictError('Finish the current patient (or mark no-show) before calling the next');
      }
      const [next] = this.#order(active);
      if (!next) throw new NotFoundError('No patients waiting');
      return this.#apply(next.id, 'call');
    });
    this.eventBus.publish('token.called', token);
    this.#changed(doctor.id);
    return token;
  }

  start(tokenId) {
    return this.#transition(tokenId, 'start');
  }

  noShow(tokenId) {
    return this.#transition(tokenId, 'noShow');
  }

  complete(tokenId, { notes = null, prescription = null } = {}) {
    return this.#transition(tokenId, 'complete', (token) =>
      this.consultationRepo.create({ tokenId: token.id, notes, prescription, createdAt: this.clock.now().toISOString() }),
    );
  }

  /** Status change + any extra write happen atomically, then listeners are told. */
  #transition(tokenId, action, afterSave) {
    const token = this.db.transaction(() => {
      const saved = this.#apply(tokenId, action);
      afterSave?.(saved);
      return saved;
    });
    this.#changed(token.doctor_id);
    return token;
  }

  #apply(tokenId, action) {
    const row = this.tokenRepo.findById(tokenId);
    if (!row) throw new NotFoundError(`Token ${tokenId} not found`);
    const token = new Token(row);
    token[action](); // the State object throws if this move is illegal
    return this.tokenRepo.updateStatus(token.id, token.status, this.clock.now().toISOString());
  }

  // ---------- Helpers ----------

  #changed(doctorId) {
    this.eventBus.publish('queue.changed', { doctorId });
  }

  #today() {
    return localDate(this.clock.now());
  }

  #requireDoctor(id) {
    const doctor = this.doctorRepo.findById(id);
    if (!doctor) throw new NotFoundError(`Doctor ${id} not found`);
    return doctor;
  }

  #requirePatient(id) {
    const patient = this.patientRepo.findById(id);
    if (!patient) throw new NotFoundError(`Patient ${id} not found`);
    return patient;
  }
}
