import { Router } from 'express';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getRecords, deleteRecord, clearRecords } from '../lib/database.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const data = getRecords(page, limit);
    res.json({ code: 0, data });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/open', (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ code: -1, message: 'path is required' });
    }

    const target = resolve(filePath);
    if (!existsSync(target)) {
      const dir = dirname(target);
      if (!existsSync(dir)) {
        return res.status(404).json({ code: -1, message: 'File or directory not found' });
      }
      exec(`explorer "${dir}"`);
    } else {
      exec(`explorer /select,"${target}"`);
    }

    res.json({ code: 0, message: 'Opened' });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = deleteRecord(id);
    if (success) {
      res.json({ code: 0, message: 'Record deleted' });
    } else {
      res.status(404).json({ code: -1, message: 'Record not found' });
    }
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.delete('/', (req, res) => {
  try {
    clearRecords();
    res.json({ code: 0, message: 'All records cleared' });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

export default router;
