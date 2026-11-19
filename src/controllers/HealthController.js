import { Router } from 'express';

/** Confirms the server runs and the database is reachable. */
export class HealthController {
  constructor(db) {
    this.db = db;
  }

  router() {
    const r = Router();
    r.get('/health', (req, res) => {
      const tables = this.db
        .all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
        .map((t) => t.name);
      res.json({ ok: true, tables });
    });
    return r;
  }
}
