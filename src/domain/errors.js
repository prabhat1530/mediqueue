/**
 * Business errors carry their HTTP status, so one error handler can turn any of
 * them into the right response. Services stay unaware of HTTP details.
 */
export class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

export class NotFoundError extends AppError {
  constructor(message) { super(message, 404); }
}

export class ConflictError extends AppError {
  constructor(message) { super(message, 409); }
}

export function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj?.[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length) throw new ValidationError(`Missing field(s): ${missing.join(', ')}`);
}
