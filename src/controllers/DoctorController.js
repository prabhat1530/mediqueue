import { Router } from 'express';

/** Controllers only translate HTTP ↔ service calls. No business rules here. */
export class DoctorController {
  constructor(doctorService) {
    this.doctors = doctorService;
  }

  router() {
    const r = Router();
    r.post('/doctors', (req, res) => res.status(201).json(this.doctors.create(req.body)));
    r.get('/doctors', (req, res) => res.json(this.doctors.list()));
    r.post('/doctors/:id/slots', (req, res) =>
      res.status(201).json(this.doctors.generateSlots(Number(req.params.id), req.body)));
    r.get('/doctors/:id/slots', (req, res) =>
      res.json(this.doctors.availableSlots(Number(req.params.id), req.query.date)));
    return r;
  }
}
