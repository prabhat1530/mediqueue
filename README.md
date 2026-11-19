# MediQueue

Hospital appointment and live patient-queue system.
Node.js + Express + SQLite (built into Node) + socket.io.

Design, patterns, SOLID and viva prep: see **[DESIGN.md](DESIGN.md)**.

## Run

```bash
npm install
npm run reset && npm run seed   # fresh DB with demo data for today (server must be stopped)
npm start
```

- Reception console: http://localhost:3000/
- Display board: http://localhost:3000/board.html?doctor=1 (open in a second window)
- Tests: `npm test`

## API

| Method | Path | Body / query |
|---|---|---|
| GET | `/api/health` | |
| POST | `/api/doctors` | `{ name, specialization, avgConsultMins }` |
| GET | `/api/doctors` | |
| POST | `/api/doctors/:id/slots` | `{ date: "YYYY-MM-DD", from: "09:00", to: "13:00", minutes? }` |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | free slots |
| POST | `/api/patients` | `{ name, phone, age }` |
| GET | `/api/patients`, `/api/patients/:id` | |
| GET | `/api/patients/:id/history` | appointments + consultations |
| POST | `/api/appointments` | `{ slotId, patientId }` → 409 if already booked |
| GET | `/api/appointments/today` | |
| POST | `/api/appointments/:id/check-in` | creates a token |
| POST | `/api/tokens` | walk-in: `{ doctorId, patientId, isEmergency }` |
| GET | `/api/queues` | load summary for all doctors |
| GET | `/api/queues/:doctorId` | live ordered queue with wait estimates |
| POST | `/api/queues/:doctorId/call-next` | |
| POST | `/api/tokens/:id/start` · `/complete` · `/no-show` | complete: `{ notes, prescription }` |
| GET | `/api/categories`, `/api/notifications` | |

## Project layout

```
src/
  controllers/   HTTP layer
  services/      business rules
  repositories/  SQL
  domain/        Token, TokenState, CategoryRegistry, errors
  strategies/    priority strategies + category rules
  notifications/ notification channels
  infra/         Database, Clock, EventBus, SocketGateway, schema.sql
  container.js   wires everything (dependency injection)
  server.js      entry point
public/          reception UI + display board
test/            node:test suites
scripts/seed.js  demo data
```
