import { NotFoundError, ValidationError, requireFields } from '../domain/errors.js';

export class PatientService {
  constructor({ patientRepo, appointmentRepo, consultationRepo }) {
    this.patientRepo = patientRepo;
    this.appointmentRepo = appointmentRepo;
    this.consultationRepo = consultationRepo;
  }

  register({ name, phone, age } = {}) {
    requireFields({ name, phone, age }, ['name', 'phone', 'age']);
    const years = Number(age);
    if (!Number.isInteger(years) || years < 0 || years > 130) throw new ValidationError('age must be 0-130');
    return this.patientRepo.create({ name, phone: String(phone), age: years });
  }

  list() {
    return this.patientRepo.findAll();
  }

  get(id) {
    const patient = this.patientRepo.findById(id);
    if (!patient) throw new NotFoundError(`Patient ${id} not found`);
    return patient;
  }

  /** Full medical history: past appointments plus consultation notes and prescriptions. */
  history(id) {
    const patient = this.get(id);
    return {
      patient,
      appointments: this.appointmentRepo.findByPatient(patient.id),
      consultations: this.consultationRepo.findByPatient(patient.id),
    };
  }
}
