import { Router } from 'express';

export class QueueController {
  constructor(queueService, notificationService, categories) {
    this.queue = queueService;
    this.notifications = notificationService;
    this.categories = categories;
  }

  router() {
    const r = Router();
    const id = (req, key = 'id') => Number(req.params[key]);

    // Walk-in / emergency token
    r.post('/tokens', (req, res) => res.status(201).json(this.queue.issueWalkIn(req.body)));

    // Lifecycle
    r.post('/tokens/:id/start', (req, res) => res.json(this.queue.start(id(req))));
    r.post('/tokens/:id/complete', (req, res) => res.json(this.queue.complete(id(req), req.body)));
    r.post('/tokens/:id/no-show', (req, res) => res.json(this.queue.noShow(id(req))));

    // Queues
    r.get('/queues', (req, res) => res.json(this.queue.summary()));
    r.get('/queues/:doctorId', (req, res) => res.json(this.queue.getQueue(id(req, 'doctorId'))));
    r.post('/queues/:doctorId/call-next', (req, res) => res.json(this.queue.callNext(id(req, 'doctorId'))));

    r.get('/categories', (req, res) => res.json(this.categories.list()));
    r.get('/notifications', (req, res) => res.json(this.notifications.recent(Number(req.query.limit) || 20)));
    return r;
  }
}
