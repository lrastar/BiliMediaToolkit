import { Router } from 'express';
import { taskQueue } from '../lib/downloader.js';

const router = Router();

router.get('/queue', (req, res) => {
  const queue = taskQueue.getQueue();
  res.json({ code: 0, data: queue });
});

router.post('/:id/pause', (req, res) => {
  const { id } = req.params;
  const success = taskQueue.pause(id);
  if (success) {
    res.json({ code: 0, message: 'Task paused' });
  } else {
    res.status(400).json({ code: -1, message: 'Cannot pause task' });
  }
});

router.post('/:id/resume', (req, res) => {
  const { id } = req.params;
  const success = taskQueue.resume(id);
  if (success) {
    res.json({ code: 0, message: 'Task resumed' });
  } else {
    res.status(400).json({ code: -1, message: 'Cannot resume task' });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const success = taskQueue.cancel(id);
  if (success) {
    res.json({ code: 0, message: 'Task cancelled' });
  } else {
    res.status(404).json({ code: -1, message: 'Task not found' });
  }
});

export default router;
