/**
 * Notification channels. Every channel has the same tiny interface: send().
 * Liskov: NotificationService treats all of them the same way.
 * Open/Closed: WhatsApp = new subclass + one line in container.js.
 */
export class Notifier {
  get channel() {
    throw new Error('Notifier.channel must be implemented');
  }

  send(patient, message) {
    throw new Error('Notifier.send() must be implemented');
  }
}

export class ConsoleNotifier extends Notifier {
  get channel() { return 'CONSOLE'; }

  send(patient, message) {
    console.log(`[NOTIFY] ${patient.name}: ${message}`);
  }
}

/**
 * Mock SMS channel. A real one would call an SMS provider's API here;
 * nothing else in the system would change.
 */
export class SmsNotifier extends Notifier {
  get channel() { return 'SMS'; }

  send(patient, message) {
    console.log(`[SMS → ${patient.phone}] ${message}`);
  }
}
