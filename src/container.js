import { Database } from './infra/Database.js';
import { EventBus } from './infra/EventBus.js';
import { SystemClock } from './infra/Clock.js';
import { CategoryRegistry } from './domain/CategoryRegistry.js';
import {
  CategoryResolver, EmergencyRule, SeniorCitizenRule, AppointmentRule, WalkInRule,
} from './strategies/categoryRules.js';
import { AgingPriorityStrategy, CategoryPriorityStrategy } from './strategies/priority.js';
import { ConsoleNotifier, SmsNotifier } from './notifications/notifiers.js';
import { DoctorRepository } from './repositories/DoctorRepository.js';
import { PatientRepository } from './repositories/PatientRepository.js';
import { SlotRepository } from './repositories/SlotRepository.js';
import { AppointmentRepository } from './repositories/AppointmentRepository.js';
import { TokenRepository } from './repositories/TokenRepository.js';
import { ConsultationRepository } from './repositories/ConsultationRepository.js';
import { NotificationRepository } from './repositories/NotificationRepository.js';
import { DoctorService } from './services/DoctorService.js';
import { PatientService } from './services/PatientService.js';
import { AppointmentService } from './services/AppointmentService.js';
import { QueueService } from './services/QueueService.js';
import { NotificationService } from './services/NotificationService.js';
import { HealthController } from './controllers/HealthController.js';
import { DoctorController } from './controllers/DoctorController.js';
import { PatientController } from './controllers/PatientController.js';
import { AppointmentController } from './controllers/AppointmentController.js';
import { QueueController } from './controllers/QueueController.js';

/**
 * Composition root: the ONE place where objects are created and wired together.
 * Dependency Inversion: classes receive their dependencies through the constructor
 * instead of creating them, so they can be swapped (e.g. a fake clock in tests).
 *
 * Extending the system happens HERE, without editing existing classes:
 *  - new category      → categories.register('PREGNANT', 350) + a new CategoryRule
 *  - new priority rule → wrap/replace priorityStrategy
 *  - new channel       → add `new WhatsAppNotifier()` to notifiers
 */
export function buildContainer({
  dbFile = 'mediqueue.db',
  clock = new SystemClock(),
  notifiers = [new ConsoleNotifier(), new SmsNotifier()],
  agingPointsPerMinute = 2,
} = {}) {
  const db = new Database(dbFile);
  db.migrate();
  const eventBus = new EventBus();

  // Priority configuration
  const categories = new CategoryRegistry()
    .register('EMERGENCY', 1000)
    .register('SENIOR', 300)
    .register('APPOINTMENT', 200)
    .register('WALKIN', 100);
  const categoryResolver = new CategoryResolver(
    [new EmergencyRule(), new SeniorCitizenRule(60), new AppointmentRule(), new WalkInRule()],
    categories,
  );
  const priorityStrategy = new AgingPriorityStrategy(new CategoryPriorityStrategy(categories), agingPointsPerMinute);

  // Data access
  const repos = {
    doctorRepo: new DoctorRepository(db),
    patientRepo: new PatientRepository(db),
    slotRepo: new SlotRepository(db),
    appointmentRepo: new AppointmentRepository(db),
    tokenRepo: new TokenRepository(db),
    consultationRepo: new ConsultationRepository(db),
    notificationRepo: new NotificationRepository(db),
  };

  // Business logic
  const deps = { db, clock, eventBus, ...repos };
  const doctorService = new DoctorService(deps);
  const patientService = new PatientService(deps);
  const appointmentService = new AppointmentService(deps);
  const queueService = new QueueService({ ...deps, categoryResolver, priorityStrategy });
  const notificationService = new NotificationService({ ...deps, notifiers, queueService });
  notificationService.start();

  return {
    db,
    eventBus,
    categories,
    repos,
    services: { doctorService, patientService, appointmentService, queueService, notificationService },
    controllers: [
      new HealthController(db),
      new DoctorController(doctorService),
      new PatientController(patientService),
      new AppointmentController(appointmentService, queueService),
      new QueueController(queueService, notificationService, categories),
    ],
  };
}
