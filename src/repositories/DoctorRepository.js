/** Repository pattern: all SQL for doctors lives here and nowhere else. */
export class DoctorRepository {
  constructor(db) {
    this.db = db;
  }

  create({ name, specialization, avgConsultMins }) {
    const { lastInsertRowid } = this.db.run(
      'INSERT INTO doctors (name, specialization, avg_consult_mins) VALUES (?, ?, ?)',
      name, specialization, avgConsultMins,
    );
    return this.findById(lastInsertRowid);
  }

  findById(id) {
    return this.db.get('SELECT * FROM doctors WHERE id = ?', id);
  }

  findAll() {
    return this.db.all('SELECT * FROM doctors ORDER BY id');
  }
}
