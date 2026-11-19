import { AppError } from '../domain/errors.js';

/** Turns any thrown error into a JSON response. Controllers never write try/catch. */
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
