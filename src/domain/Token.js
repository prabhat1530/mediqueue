import { stateOf } from './TokenState.js';

/**
 * A patient's token in a doctor's queue. It delegates every status change to its
 * current State object, which decides whether the move is allowed.
 */
export class Token {
  constructor(row) {
    Object.assign(this, row);
  }

  get state() {
    return stateOf(this.status);
  }

  call()     { return this.#moveTo(this.state.call()); }
  start()    { return this.#moveTo(this.state.start()); }
  complete() { return this.#moveTo(this.state.complete()); }
  noShow()   { return this.#moveTo(this.state.noShow()); }

  #moveTo(state) {
    this.status = state.name;
    return this;
  }
}
