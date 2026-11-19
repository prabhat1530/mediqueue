import { Router } from 'express';

export class AppointmentController {
  constructor(appointmentService, queueService) {
    this.appointments = appointmentService;
    this.queue = queueService;
  }

  router() {
    const r = Router();
    r.post('/appointments', (req, res) => res.status(201).json(this.appointments.book(req.body)));
    r.get('/appointments/today', (req, res) => res.json(this.appointments.listToday()));
    r.get('/appointments/:id', (req, res) => res.json(this.appointments.get(Number(req.params.id))));
    r.post('/appointments/:id/check-in', (req, res) =>
      res.status(201).json(this.queue.checkIn(Number(req.params.id))));
    return r;
  }
}
