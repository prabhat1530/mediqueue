import { ConflictError } from './errors.js';

/**
 * State pattern for the token lifecycle:
 *
 *   WAITING ─call→ CALLED ─start→ IN_CONSULTATION ─complete→ DONE
 *                    └──noShow→ NO_SHOW
 *
 * The base class rejects every move. Each state overrides only the moves that
 * are legal from it, so an illegal jump (e.g. WAITING → DONE) is impossible.
 */
export class TokenState {
  constructor(name) {
    this.name = name;
  }

  call()     { return this.#reject('call'); }
  start()    { return this.#reject('start'); }
  complete() { return this.#reject('complete'); }
  noShow()   { return this.#reject('mark no-show for'); }

  #reject(action) {
    throw new ConflictError(`Cannot ${action} a token that is ${this.name}`);
  }
}

class WaitingState extends TokenState {
  constructor() { super('WAITING'); }
  call() { return STATES.CALLED; }
}

class CalledState extends TokenState {
  constructor() { super('CALLED'); }
  start()  { return STATES.IN_CONSULTATION; }
  noShow() { return STATES.NO_SHOW; }
}

class InConsultationState extends TokenState {
  constructor() { super('IN_CONSULTATION'); }
  complete() { return STATES.DONE; }
}

// Terminal states: every move is rejected by the base class.
class DoneState extends TokenState {
  constructor() { super('DONE'); }
}

class NoShowState extends TokenState {
  constructor() { super('NO_SHOW'); }
}

const STATES = {
  WAITING: new WaitingState(),
  CALLED: new CalledState(),
  IN_CONSULTATION: new InConsultationState(),
  DONE: new DoneState(),
  NO_SHOW: new NoShowState(),
};

export function stateOf(status) {
  const state = STATES[status];
  if (!state) throw new Error(`Unknown token status: ${status}`);
  return state;
}
