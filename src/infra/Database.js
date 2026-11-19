import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

/** True when SQLite rejected a write because of a UNIQUE constraint. */
export function isUniqueViolation(err) {
  return typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed');
}

/**
 * Wraps the SQLite connection.
 * SRP: this class only knows how to talk to the database, nothing about hospitals.
 * Created once in container.js and shared (a Singleton by composition, not a global).
 */
export class Database {
  constructor(filename) {
    this.conn = new DatabaseSync(filename);
    // WAL = crash-safe writes; foreign_keys = no orphan rows.
    this.conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }

  migrate() {
    const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    this.conn.exec(schema);
  }

  get(sql, ...params) { return this.conn.prepare(sql).get(...params); }
  all(sql, ...params) { return this.conn.prepare(sql).all(...params); }
  run(sql, ...params) { return this.conn.prepare(sql).run(...params); }

  /**
   * Runs fn as one atomic unit: either every write succeeds, or none do.
   * This keeps the queue consistent if something fails halfway through.
   */
  transaction(fn) {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.conn.exec('COMMIT');
      return result;
    } catch (err) {
      this.conn.exec('ROLLBACK');
      throw err;
    }
  }
}
