const ACTIVE = `('WAITING', 'CALLED', 'IN_CONSULTATION')`;

export class TokenRepository {
  constructor(db) {
    this.db = db;
  }

  /** Must run inside a transaction so two receptionists can't get the same number. */
  nextTokenNo(doctorId, queueDate) {
    return this.db.get(
      'SELECT COALESCE(MAX(token_no), 0) + 1 AS n FROM tokens WHERE doctor_id = ? AND queue_date = ?',
      doctorId, queueDate,
    ).n;
  }

  create({ doctorId, patientId, appointmentId, tokenNo, category, queueDate, createdAt }) {
    const { lastInsertRowid } = this.db.run(
      `INSERT INTO tokens (doctor_id, patient_id, appointment_id, token_no, category, queue_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      doctorId, patientId, appointmentId, tokenNo, category, queueDate, createdAt,
    );
    return this.findById(lastInsertRowid);
  }

  findById(id) {
    return this.db.get(
      `SELECT t.*, p.name AS patient_name FROM tokens t
       JOIN patients p ON p.id = t.patient_id WHERE t.id = ?`,
      id,
    );
  }

  findByAppointment(appointmentId) {
    return this.db.get('SELECT * FROM tokens WHERE appointment_id = ?', appointmentId);
  }

  /** Today's tokens that are still in play, oldest first. */
  findActive(doctorId, queueDate) {
    return this.db.all(
      `SELECT t.*, p.name AS patient_name FROM tokens t
       JOIN patients p ON p.id = t.patient_id
       WHERE t.doctor_id = ? AND t.queue_date = ? AND t.status IN ${ACTIVE}
       ORDER BY t.created_at`,
      doctorId, queueDate,
    );
  }

  updateStatus(id, status, updatedAt) {
    this.db.run('UPDATE tokens SET status = ?, updated_at = ? WHERE id = ?', status, updatedAt, id);
    return this.findById(id);
  }
}
