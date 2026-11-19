import { Router } from 'express';

export class PatientController {
  constructor(patientService) {
    this.patients = patientService;
  }

  router() {
    const r = Router();
    r.post('/patients', (req, res) => res.status(201).json(this.patients.register(req.body)));
    r.get('/patients', (req, res) => res.json(this.patients.list()));
    r.get('/patients/:id', (req, res) => res.json(this.patients.get(Number(req.params.id))));
    r.get('/patients/:id/history', (req, res) => res.json(this.patients.history(Number(req.params.id))));
    return r;
  }
}
