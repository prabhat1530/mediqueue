/**
 * Observer pattern / in-process Pub-Sub.
 * Publishers (QueueService) announce what happened; subscribers (notifications,
 * display boards) react. Publishers never know who is listening.
 */
export class EventBus {
  #handlers = new Map();

  subscribe(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, []);
    this.#handlers.get(event).push(handler);
  }

  publish(event, payload) {
    for (const handler of this.#handlers.get(event) ?? []) {
      // One failing subscriber must not break the others or the caller.
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${event}" failed:`, err.message);
      }
    }
  }
}
