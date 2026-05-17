import { Router } from 'express';
import { resolve } from 'node:path';
import { getConfig, updateConfig } from '../lib/config.js';
import { checkFfmpeg, downloadFfmpeg } from '../lib/ffmpeg.js';
import { taskQueue } from '../lib/downloader.js';

const BLOCKED_PREFIXES = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\ProgramData',
  '/usr',
  '/etc',
  '/bin',
  '/sbin',
  '/var',
  '/root'
];

function isPathSafe(p) {
  if (!p || typeof p !== 'string') return false;
  const normalized = resolve(p).toLowerCase();
  return !BLOCKED_PREFIXES.some(prefix => normalized.startsWith(prefix.toLowerCase()));
}

const router = Router();

router.get('/', (req, res) => {
  const config = getConfig();
  const ffmpeg = checkFfmpeg();
  res.json({ config, ffmpeg });
});

router.put('/', (req, res) => {
  const { concurrency, audioFormat, downloadPath } = req.body;
  if (downloadPath && !isPathSafe(downloadPath)) {
    return res.status(400).json({ code: -1, message: '下载路径不合法，不能使用系统目录' });
  }
  const updated = updateConfig({ concurrency, audioFormat, downloadPath });
  if (concurrency !== undefined && typeof concurrency === 'number' && concurrency >= 1 && concurrency <= 8) {
    taskQueue.concurrency = concurrency;
  }
  res.json(updated);
});

router.post('/ffmpeg/download', async (req, res) => {
  try {
    const path = await downloadFfmpeg();
    res.json({ success: true, path });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
