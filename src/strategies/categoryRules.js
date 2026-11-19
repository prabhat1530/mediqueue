/**
 * Chain of Responsibility: decides a new token's category.
 * Rules are asked in order; the first one that returns a category wins.
 * A new rule (e.g. PregnancyRule) is a new class added to the list in container.js.
 *
 * ctx = { patient, doctor, isEmergency, appointmentId }
 */
export class CategoryRule {
  resolve(ctx) {
    throw new Error('CategoryRule.resolve() must be implemented');
  }
}

export class EmergencyRule extends CategoryRule {
  resolve(ctx) {
    return ctx.isEmergency ? 'EMERGENCY' : null;
  }
}

export class SeniorCitizenRule extends CategoryRule {
  constructor(minAge = 60) {
    super();
    this.minAge = minAge;
  }

  resolve(ctx) {
    return ctx.patient.age >= this.minAge ? 'SENIOR' : null;
  }
}

export class AppointmentRule extends CategoryRule {
  resolve(ctx) {
    return ctx.appointmentId ? 'APPOINTMENT' : null;
  }
}

/** Fallback: always matches, so it must be last in the chain. */
export class WalkInRule extends CategoryRule {
  resolve() {
    return 'WALKIN';
  }
}

export class CategoryResolver {
  constructor(rules, categories) {
    this.rules = rules;
    this.categories = categories;
  }

  resolve(ctx) {
    for (const rule of this.rules) {
      const category = rule.resolve(ctx);
      if (!category) continue;
      if (!this.categories.has(category)) throw new Error(`Rule returned unregistered category: ${category}`);
      return category;
    }
    throw new Error('No category rule matched. Is WalkInRule last in the chain?');
  }
}
