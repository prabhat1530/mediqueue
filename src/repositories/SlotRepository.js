export class SlotRepository {
  constructor(db) {
    this.db = db;
  }

  /** Inserts slots, skipping any that already exist. Returns how many were new. */
  createMany(doctorId, startTimes) {
    let created = 0;
    for (const startTime of startTimes) {
      created += this.db.run(
        'INSERT OR IGNORE INTO slots (doctor_id, start_time) VALUES (?, ?)',
        doctorId, startTime,
      ).changes;
    }
    return created;
  }

  findById(id) {
    return this.db.get('SELECT * FROM slots WHERE id = ?', id);
  }

  findAvailable(doctorId, date) {
    return this.db.all(
      `SELECT s.* FROM slots s
       LEFT JOIN appointments a ON a.slot_id = s.id
       WHERE s.doctor_id = ? AND s.start_time LIKE ? AND a.id IS NULL
       ORDER BY s.start_time`,
      doctorId, `${date}%`,
    );
  }
}
