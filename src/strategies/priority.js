/**
 * Strategy pattern: how important is this token right now?
 * QueueService only knows "higher score goes first". Which rule produces the
 * score is swappable without touching QueueService (Open/Closed).
 */
export class PriorityStrategy {
  score(token, now) {
    throw new Error('PriorityStrategy.score() must be implemented');
  }
}

/** Score = the category's base weight (Emergency > Senior > Appointment > Walk-in). */
export class CategoryPriorityStrategy extends PriorityStrategy {
  constructor(categories) {
    super();
    this.categories = categories;
  }

  score(token) {
    return this.categories.weightOf(token.category);
  }
}

/**
 * Aging (Decorator over another strategy): adds points for every minute waited,
 * so low-priority patients rise over time and never starve.
 *
 * With weights 1000/300/200/100 and 2 points/min, a walk-in overtakes a newly
 * arrived appointment patient after waiting 50 min longer, a senior after 100 min.
 * Emergency (1000) is effectively never overtaken.
 */
export class AgingPriorityStrategy extends PriorityStrategy {
  constructor(inner, pointsPerMinute = 2) {
    super();
    this.inner = inner;
    this.pointsPerMinute = pointsPerMinute;
  }

  score(token, now) {
    const waitedMins = Math.max(0, (now - new Date(token.created_at)) / 60000);
    return this.inner.score(token, now) + waitedMins * this.pointsPerMinute;
  }
}
