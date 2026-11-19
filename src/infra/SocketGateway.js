/**
 * Pushes live queue updates to display boards over WebSockets (socket.io).
 * It is just another Observer on the EventBus: QueueService doesn't know it exists.
 *
 * Rooms: "doctor:<id>" for one doctor's board, "summary" for the admin overview.
 */
export class SocketGateway {
  constructor(io, eventBus, queueService) {
    this.io = io;
    this.eventBus = eventBus;
    this.queueService = queueService;
  }

  start() {
    this.io.on('connection', (socket) => {
      socket.on('watch:doctor', (doctorId) => {
        socket.join(`doctor:${doctorId}`);
        this.#send(socket, 'queue', () => this.queueService.getQueue(Number(doctorId)));
      });
      socket.on('watch:summary', () => {
        socket.join('summary');
        this.#send(socket, 'summary', () => this.queueService.summary());
      });
    });

    this.eventBus.subscribe('queue.changed', ({ doctorId }) => {
      this.io.to(`doctor:${doctorId}`).emit('queue', this.queueService.getQueue(doctorId));
      this.io.to('summary').emit('summary', this.queueService.summary());
    });
  }

  #send(target, event, load) {
    try {
      target.emit(event, load());
    } catch (err) {
      target.emit('board:error', err.message);
    }
  }
}
