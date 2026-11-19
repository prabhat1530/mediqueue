export class NotificationRepository {
  constructor(db) {
    this.db = db;
  }

  /** Records a notification. Returns false if this exact one was already sent. */
  record({ tokenId, type, channel, message, createdAt }) {
    const { changes } = this.db.run(
      `INSERT OR IGNORE INTO notifications (token_id, type, channel, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      tokenId, type, channel, message, createdAt,
    );
    return changes === 1;
  }

  findByToken(tokenId) {
    return this.db.all('SELECT * FROM notifications WHERE token_id = ? ORDER BY id', tokenId);
  }

  findRecent(limit = 20) {
    return this.db.all(
      `SELECT n.*, p.name AS patient_name FROM notifications n
       JOIN tokens t ON t.id = n.token_id
       JOIN patients p ON p.id = t.patient_id
       ORDER BY n.id DESC LIMIT ?`,
      limit,
    );
  }
}
