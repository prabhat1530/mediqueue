export class PatientRepository {
  constructor(db) {
    this.db = db;
  }

  create({ name, phone, age }) {
    const { lastInsertRowid } = this.db.run(
      'INSERT INTO patients (name, phone, age) VALUES (?, ?, ?)',
      name, phone, age,
    );
    return this.findById(lastInsertRowid);
  }

  findById(id) {
    return this.db.get('SELECT * FROM patients WHERE id = ?', id);
  }

  findAll() {
    return this.db.all('SELECT * FROM patients ORDER BY id');
  }
}
