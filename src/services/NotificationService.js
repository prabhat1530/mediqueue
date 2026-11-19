/**
 * Observer: listens to queue events and alerts patients on every channel.
 *  - TURN_NEAR: when a patient reaches the top `notifyWhenWithin` places
 *  - CALLED:    when the doctor calls their token
 * Each alert is logged in the DB first, so it goes out at most once per channel.
 */
export class NotificationService {
  constructor({ eventBus, notifiers, notificationRepo, queueService, patientRepo, doctorRepo, clock, notifyWhenWithin = 2 }) {
    this.eventBus = eventBus;
    this.notifiers = notifiers;
    this.notificationRepo = notificationRepo;
    this.queueService = queueService;
    this.patientRepo = patientRepo;
    this.doctorRepo = doctorRepo;
    this.clock = clock;
    this.notifyWhenWithin = notifyWhenWithin;
  }

  start() {
    this.eventBus.subscribe('token.called', (token) => this.#onCalled(token));
    this.eventBus.subscribe('queue.changed', ({ doctorId }) => this.#onQueueChanged(doctorId));
  }

  recent(limit) {
    return this.notificationRepo.findRecent(limit);
  }

  #onCalled(token) {
    const doctor = this.doctorRepo.findById(token.doctor_id);
    this.#notify(token, 'CALLED', `Token ${token.token_no}: please go to ${doctor.name}'s room now.`);
  }

  #onQueueChanged(doctorId) {
    const { waiting } = this.queueService.getQueue(doctorId);
    for (const t of waiting.slice(0, this.notifyWhenWithin)) {
      this.#notify(t, 'TURN_NEAR', `Token ${t.token_no}: you are #${t.position} in line, about ${t.estimatedWaitMins} min to go.`);
    }
  }

  #notify(token, type, message) {
    const patient = this.patientRepo.findById(token.patient_id);
    for (const notifier of this.notifiers) {
      const isNew = this.notificationRepo.record({
        tokenId: token.id, type, channel: notifier.channel, message, createdAt: this.clock.now().toISOString(),
      });
      if (isNew) this.#deliver(notifier, patient, message);
    }
  }

  /** A broken channel (sync throw or async rejection) is logged, never crashes the queue. */
  #deliver(notifier, patient, message) {
    const fail = (err) => console.error(`[${notifier.channel}] delivery failed:`, err.message);
    try {
      Promise.resolve(notifier.send(patient, message)).catch(fail);
    } catch (err) {
      fail(err);
    }
  }
}
