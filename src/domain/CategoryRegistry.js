import { ValidationError } from './errors.js';

/**
 * Registry of patient categories and their base priority weight.
 * Open/Closed: a new category (e.g. PREGNANT) is one register() call in
 * container.js. No existing class changes.
 */
export class CategoryRegistry {
  #weights = new Map();

  register(name, weight) {
    this.#weights.set(name, weight);
    return this;
  }

  has(name) {
    return this.#weights.has(name);
  }

  weightOf(name) {
    if (!this.has(name)) throw new ValidationError(`Unknown category: ${name}`);
    return this.#weights.get(name);
  }

  list() {
    return [...this.#weights].map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
  }
}
