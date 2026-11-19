import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';
import { buildContainer } from './container.js';
import { SocketGateway } from './infra/SocketGateway.js';
import { errorHandler } from './controllers/errorHandler.js';

const container = buildContainer({ dbFile: process.env.DB_FILE });

const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
for (const controller of container.controllers) app.use('/api', controller.router());
app.use(errorHandler);

const httpServer = createServer(app);
new SocketGateway(new SocketServer(httpServer), container.eventBus, container.services.queueService).start();

// Recovery: the queue lives in the DB, so whatever was in progress before a crash is back.
for (const q of container.services.queueService.summary()) {
  if (q.waiting || q.nowServing) {
    console.log(`Recovered queue for ${q.doctorName}: serving #${q.nowServing ?? '-'}, ${q.waiting} waiting`);
  }
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`MediQueue running:`);
  console.log(`  Reception  → http://localhost:${PORT}/`);
  console.log(`  Board      → http://localhost:${PORT}/board.html?doctor=1`);
});
