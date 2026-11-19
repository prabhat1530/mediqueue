export class ConsultationRepository {
  constructor(db) {
    this.db = db;
  }

  create({ tokenId, notes, prescription, createdAt }) {
    this.db.run(
      'INSERT INTO consultations (token_id, notes, prescription, created_at) VALUES (?, ?, ?, ?)',
      tokenId, notes, prescription, createdAt,
    );
  }

  findByPatient(patientId) {
    return this.db.all(
      `SELECT c.id, c.notes, c.prescription, c.created_at,
              t.token_no, t.category, d.name AS doctor_name, d.specialization
       FROM consultations c
       JOIN tokens t ON t.id = c.token_id
       JOIN doctors d ON d.id = t.doctor_id
       WHERE t.patient_id = ?
       ORDER BY c.created_at DESC`,
      patientId,
    );
  }
}
