export class AppointmentRepository {
  constructor(db) {
    this.db = db;
  }

  create({ slotId, patientId, createdAt }) {
    const { lastInsertRowid } = this.db.run(
      'INSERT INTO appointments (slot_id, patient_id, created_at) VALUES (?, ?, ?)',
      slotId, patientId, createdAt,
    );
    return this.findById(lastInsertRowid);
  }

  findById(id) {
    return this.db.get(
      `SELECT a.*, s.doctor_id, s.start_time
       FROM appointments a JOIN slots s ON s.id = a.slot_id
       WHERE a.id = ?`,
      id,
    );
  }

  findByPatient(patientId) {
    return this.db.all(
      `SELECT a.id, s.start_time, d.name AS doctor_name, d.specialization
       FROM appointments a
       JOIN slots s ON s.id = a.slot_id
       JOIN doctors d ON d.id = s.doctor_id
       WHERE a.patient_id = ?
       ORDER BY s.start_time DESC`,
      patientId,
    );
  }

  findByDate(date) {
    return this.db.all(
      `SELECT a.id, a.patient_id, p.name AS patient_name, s.doctor_id, d.name AS doctor_name,
              s.start_time, t.id AS token_id
       FROM appointments a
       JOIN slots s ON s.id = a.slot_id
       JOIN doctors d ON d.id = s.doctor_id
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN tokens t ON t.appointment_id = a.id
       WHERE s.start_time LIKE ?
       ORDER BY s.start_time`,
      `${date}%`,
    );
  }
}
