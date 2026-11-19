# MediQueue: Design Document

Use this in the viva: every requirement → the concept that solves it → the file that proves it.

---

## 1. Architecture: Layered (N-tier)

```
 Browser (Reception UI, Display Board)
      │  HTTP (REST)                 ▲ WebSocket push
      ▼                              │
 ┌──────────────┐            ┌───────────────┐
 │ Controllers  │            │ SocketGateway │◄──┐
 └──────┬───────┘            └───────────────┘   │
        ▼                                         │ subscribes
 ┌──────────────┐  publishes  ┌──────────┐        │
 │  Services    │────────────►│ EventBus │────────┤
 └──────┬───────┘             └──────────┘        │
        │ uses                                    │
        │  ├─ PriorityStrategy  (Strategy)  ┌─────────────────────┐
        │  ├─ CategoryResolver  (Chain)     │ NotificationService │──► Notifiers
        │  └─ Token/TokenState  (State)     └─────────────────────┘    (Console, SMS…)
        ▼
 ┌──────────────┐
 │ Repositories │  SQL only
 └──────┬───────┘
        ▼
 ┌──────────────┐
 │ SQLite (WAL) │  single source of truth
 └──────────────┘
```

| Layer | Folder | Job | Must NOT |
|---|---|---|---|
| Controller | `src/controllers` | HTTP in → service call → JSON out | contain business rules |
| Service | `src/services` | business rules, transactions, events | know about HTTP or SQL |
| Repository | `src/repositories` | SQL queries | contain business rules |
| Domain | `src/domain` | Token, states, categories, errors | depend on anything outside |
| Infra | `src/infra` | DB, clock, event bus, sockets | contain business rules |

Everything is created and wired in **one place**: `src/container.js` (Composition Root).

---

## 2. Requirement → Concept → Code

| Requirement | Concept | Pattern / principle | Where |
|---|---|---|---|
| Doctor schedules, slot booking | Slot = (doctor, time) with a UNIQUE key | Repository | `DoctorService.generateSlots`, `SlotRepository` |
| **No double-booking** with many receptionists | Concurrency control by DB constraint, not by "check then insert" (which has a race window) | — | `schema.sql` → `UNIQUE(slot_id)`; `AppointmentService.book` turns the violation into 409 |
| Unique token numbers under concurrency | Serialized writes: `BEGIN IMMEDIATE` transaction | — | `Database.transaction`, `QueueService.#issue` |
| Priority: Emergency > Senior > Appointment > Walk-in | Priority ordering by score | **Strategy** | `strategies/priority.js` → `CategoryPriorityStrategy` |
| Lower priority never waits forever | **Aging** (starvation prevention) | **Decorator** over a Strategy | `AgingPriorityStrategy` |
| Decide a patient's category | Ordered rules, first match wins | **Chain of Responsibility** | `strategies/categoryRules.js` |
| Token lifecycle Waiting → Called → In Consultation → Done / No-Show | Finite state machine | **State** | `domain/TokenState.js`, `domain/Token.js` |
| Wait-time estimate | (people ahead + 1 if doctor busy) × avg consult mins | — | `QueueService.getQueue` |
| Notify as turn approaches | Event-driven, Pub/Sub | **Observer** | `infra/EventBus.js`, `services/NotificationService.js` |
| No duplicate notifications | Idempotency via UNIQUE(token, type, channel) | — | `notifications` table, `NotificationRepository.record` |
| Real-time display boards | WebSocket push, rooms per doctor | Observer | `infra/SocketGateway.js`, `public/board.html` |
| Admin sees queue load | Aggregated read model | — | `QueueService.summary`, `GET /api/queues` |
| Consistent & recoverable after failure | ACID transactions, WAL durability, **DB is the single source of truth** (no queue state only in memory) | — | `Database.js`, `QueueService` header comment; proved by test "a token never lost after a crash" |
| Consultation & prescription history | Persistent history | Repository | `ConsultationRepository`, `GET /api/patients/:id/history` |
| Add rules / categories / channels **without changing existing code** | Extensibility | **Open/Closed**, Registry, DI | `container.js` (see §4) |
| Testability | Inject time instead of `new Date()` | **Dependency Inversion** | `infra/Clock.js`, `test/helpers.js` → `FakeClock` |

---

## 3. SOLID: with the exact proof in this code

| Principle | Meaning | Proof in MediQueue |
|---|---|---|
| **S**: Single Responsibility | one class, one reason to change | `SlotRepository` only does slot SQL; `NotificationService` only notifies; `SocketGateway` only pushes to boards |
| **O**: Open/Closed | extend by adding, not editing | new channel = new `Notifier` subclass; new category = `register()` + new `CategoryRule`; new priority rule = new `PriorityStrategy` |
| **L**: Liskov Substitution | a subclass works wherever the parent is expected | `NotificationService` loops over any `Notifier` (Console, SMS, test's InMemory); `QueueService` works with any `PriorityStrategy` |
| **I**: Interface Segregation | small, focused interfaces | `Notifier` = `send()` + `channel`; `PriorityStrategy` = `score()`; `CategoryRule` = `resolve()` |
| **D**: Dependency Inversion | depend on abstractions, receive dependencies | every service gets repos/clock/eventBus via constructor; tests swap in `FakeClock` + `InMemoryNotifier` with zero code changes |

**OOP pillars:**
- *Encapsulation*: `#private` fields/methods (`EventBus.#handlers`, `QueueService.#apply`).
- *Inheritance*: `WaitingState extends TokenState`, `SmsNotifier extends Notifier`.
- *Polymorphism*: `token.call()` behaves differently depending on its current state object.
- *Abstraction*: base classes `Notifier`, `PriorityStrategy`, `CategoryRule` define the contract; they throw "must be implemented".

---

## 4. Live-coding practice (likely "implement this now" tasks)

| Faculty asks | What you change | Files touched |
|---|---|---|
| "Add WhatsApp notifications" | `class WhatsAppNotifier extends Notifier` → add to `notifiers` list | `notifiers.js`, `container.js` |
| "Add a PREGNANT category above Senior" | `categories.register('PREGNANT', 350)` + `class PregnancyRule extends CategoryRule` placed before `SeniorCitizenRule` + `isPregnant` flag in walk-in | `categoryRules.js`, `container.js`, `QueueService.issueWalkIn` |
| "Make aging faster" | `agingPointsPerMinute: 5` | `container.js` |
| "Children under 5 get priority" | `class ChildRule extends CategoryRule` + register `CHILD` | `categoryRules.js`, `container.js` |
| "Allow a no-show patient to rejoin" | add `requeue()` to `NoShowState` returning `STATES.WAITING`, add `Token.requeue()` and a route | `TokenState.js`, `Token.js`, `QueueController.js` |
| "Cancel an appointment" | `AppointmentRepository.delete` + `AppointmentService.cancel` + route | 3 files, no existing method edited |

Notice: for most of these, **no existing method body changes**. That *is* the Open/Closed principle.

---

## 5. Key decisions and trade-offs (be ready to defend)

1. **SQLite, not Postgres/Redis.** Single hospital server, zero setup, full ACID transactions. Because all SQL sits in repositories, moving to Postgres changes only `src/repositories` + `Database.js`.
2. **Queue recomputed from DB on every read** instead of an in-memory heap. Slightly more work per read, but there is nothing to lose in a crash and no cache to keep in sync. A doctor's daily queue is small (tens of rows, indexed), so it's fast enough.
3. **Constraint-based concurrency** instead of app-level locks. Locks in Node memory would not protect two server processes; the DB constraint protects every writer.
4. **Aging numbers.** Weights 1000/300/200/100, +2 points/min. A walk-in overtakes a newly arrived appointment after waiting 50 min longer. Emergency is effectively never overtaken.
5. **One patient with the doctor at a time.** `callNext` refuses while someone is CALLED/IN_CONSULTATION; receptionist must complete or mark no-show first.
6. **Notifications are at-most-once.** We record before sending; if SMS fails, it's logged, not retried. A production system would add a retry queue (outbox pattern).
7. **Events are published after commit.** Listeners (board, SMS) only ever see data that was actually saved.

---

## 6. Likely viva questions

1. *Two receptionists book the same slot at the same moment. What happens?* → Both INSERTs reach SQLite; the UNIQUE(slot_id) constraint accepts one and rejects the other, which we return as **409 Conflict**. Test: `booking.test.js` "two receptionists racing".
2. *Why not check "is slot free?" first?* → Race condition: both could read "free" before either writes. The constraint check is atomic.
3. *Server crashes mid-day. What's lost?* → Nothing committed. Every status change is a transaction in a WAL-mode DB, and the queue is rebuilt from tables. Test: "a token never lost after a crash".
4. *How do you stop walk-ins waiting forever?* → Aging decorator adds points per minute waited.
5. *Why State pattern instead of if/else on status?* → Each state lists only its legal moves; illegal jumps throw automatically; adding a state doesn't touch the others.
6. *Why Observer/EventBus?* → `QueueService` doesn't know boards or SMS exist. Adding a new listener (e.g. analytics) needs no change to `QueueService`.
7. *What is Dependency Injection here?* → `container.js` builds every object and passes dependencies into constructors. Tests pass a fake clock to "time-travel" for the aging test.
8. *How is the wait time estimated?* → (position − 1 + 1 if doctor busy) × doctor's average consultation minutes.
9. *How would you scale to many hospitals?* → Postgres instead of SQLite, Redis Pub/Sub instead of in-process EventBus so several servers share events, socket.io Redis adapter, partition by hospital id.
