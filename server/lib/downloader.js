import { createWriteStream, existsSync, statSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mergeDASH, convertAudio, ensureFfmpeg } from './ffmpeg.js';
import { getCookie } from './config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function buildHeaders(options = {}) {
  const headers = {
    'User-Agent': options.userAgent || UA,
    'Referer': options.referer || 'https://www.bilibili.com'
  };
  const cookie = options.cookie || getCookie();
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  return headers;
}

export async function downloadFile(url, outputPath, options = {}) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const headers = buildHeaders(options);
  let downloaded = 0;
  let startByte = 0;

  if (options.resume && existsSync(outputPath)) {
    const stat = statSync(outputPath);
    startByte = stat.size;
    headers['Range'] = `bytes=${startByte}-`;
    downloaded = startByte;
  }

  const fetchOptions = { headers };
  if (options.abortSignal) {
    fetchOptions.signal = options.abortSignal;
  }

  const res = await fetch(url, fetchOptions);

  if (!res.ok && res.status !== 206) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const total = startByte + parseInt(res.headers.get('content-length') || '0', 10);
  const startTime = Date.now();

  const fileStream = createWriteStream(outputPath, {
    flags: startByte > 0 ? 'a' : 'w'
  });

  const reader = res.body.getReader();
  let lastReportTime = Date.now();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (options.abortSignal?.aborted) {
        throw new Error('Download aborted');
      }

      fileStream.write(value);
      downloaded += value.length;

      const now = Date.now();
      if (options.onProgress && now - lastReportTime >= 300) {
        const elapsed = (now - startTime) / 1000;
        const speed = (downloaded - startByte) / elapsed;
        options.onProgress({
          downloaded,
          total,
          percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
          speed
        });
        lastReportTime = now;
      }
    }

    fileStream.end();
    await new Promise((resolve) => fileStream.on('finish', resolve));

    if (options.onProgress) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = (downloaded - startByte) / elapsed;
      options.onProgress({
        downloaded,
        total,
        percent: 100,
        speed
      });
    }

    return outputPath;
  } catch (err) {
    fileStream.destroy();
    throw err;
  }
}

function cleanupTmp(...paths) {
  for (const p of paths) {
    if (existsSync(p)) {
      try { unlinkSync(p); } catch {}
    }
  }
}

export async function downloadDASH(videoUrl, audioUrl, outputPath, options = {}) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const videoTmp = outputPath + '.video.tmp';
  const audioTmp = outputPath + '.audio.tmp';

  let videoTotal = 0;
  let audioTotal = 0;
  let videoDownloaded = 0;
  let audioDownloaded = 0;

  const reportProgress = () => {
    if (options.onProgress) {
      const total = videoTotal + audioTotal;
      const downloaded = videoDownloaded + audioDownloaded;
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      options.onProgress({ downloaded, total, percent, speed: 0 });
    }
  };

  try {
    await Promise.all([
      downloadFile(videoUrl, videoTmp, {
        ...options,
        onProgress: (p) => {
          videoTotal = p.total;
          videoDownloaded = p.downloaded;
          reportProgress();
        }
      }),
      downloadFile(audioUrl, audioTmp, {
        ...options,
        onProgress: (p) => {
          audioTotal = p.total;
          audioDownloaded = p.downloaded;
          reportProgress();
        }
      })
    ]);

    await mergeDASH(videoTmp, audioTmp, outputPath);

    cleanupTmp(videoTmp, audioTmp);

    return outputPath;
  } catch (err) {
    cleanupTmp(videoTmp, audioTmp);
    throw err;
  }
}

export async function downloadAudioOnly(audioUrl, outputPath, format, options = {}) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpPath = outputPath + '.audio.tmp';

  try {
    await downloadFile(audioUrl, tmpPath, {
      ...options,
      onProgress: options.onProgress
    });

    await convertAudio(tmpPath, outputPath, format);

    cleanupTmp(tmpPath);

    return outputPath;
  } catch (err) {
    cleanupTmp(tmpPath);
    throw err;
  }
}

export function getFileSize(filePath) {
  try {
    if (existsSync(filePath)) {
      return statSync(filePath).size;
    }
  } catch {}
  return 0;
}

export class TaskQueue extends EventEmitter {
  constructor(concurrency = 3) {
    super();
    this.concurrency = concurrency;
    this.tasks = new Map();
    this.running = 0;
  }

  add(task) {
    const id = randomUUID();
    const taskEntry = {
      id,
      type: task.type || 'video',
      title: task.title || 'Untitled',
      progress: { downloaded: 0, total: 0, percent: 0, speed: 0 },
      status: 'pending',
      error: null,
      createdAt: Date.now(),
      execute: task.execute,
      abortController: new AbortController()
    };

    this.tasks.set(id, taskEntry);
    this.emit('task:added', this._serialize(taskEntry));
    this._processQueue();
    return id;
  }

  pause(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'downloading') return false;

    task.abortController.abort();
    task.status = 'paused';
    this.running--;
    this.emit('task:updated', this._serialize(task));
    this._processQueue();
    return true;
  }

  resume(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    task.status = 'pending';
    task.abortController = new AbortController();
    this.emit('task:updated', this._serialize(task));
    this._processQueue();
    return true;
  }

  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'downloading') {
      task.abortController.abort();
      this.running--;
    }

    this.tasks.delete(taskId);
    this.emit('task:removed', { id: taskId });
    this._processQueue();
    return true;
  }

  getQueue() {
    return Array.from(this.tasks.values()).map(t => this._serialize(t));
  }

  _serialize(task) {
    return {
      id: task.id,
      type: task.type,
      title: task.title,
      progress: task.progress,
      status: task.status,
      error: task.error,
      createdAt: task.createdAt
    };
  }

  async _processQueue() {
    if (this.running >= this.concurrency) return;

    const pending = Array.from(this.tasks.values()).find(t => t.status === 'pending');
    if (!pending) return;

    pending.status = 'downloading';
    this.running++;
    this.emit('task:updated', this._serialize(pending));

    try {
      await ensureFfmpeg();
      await pending.execute({
        abortSignal: pending.abortController.signal,
        onProgress: (progress) => {
          pending.progress = progress;
          this.emit('task:updated', this._serialize(pending));
        }
      });

      pending.status = 'completed';
      pending.progress.percent = 100;
      this.emit('task:updated', this._serialize(pending));
    } catch (err) {
      if (pending.status !== 'paused') {
        pending.status = 'failed';
        pending.error = err.message;
        this.emit('task:updated', this._serialize(pending));
      }
    } finally {
      if (pending.status !== 'paused') {
        this.running--;
      }
      this._processQueue();
    }
  }
}

export const taskQueue = new TaskQueue(3);
