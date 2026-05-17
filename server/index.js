import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ensureFfmpeg, checkFfmpeg } from './lib/ffmpeg.js';
import { taskQueue } from './lib/downloader.js';

import authRouter from './routes/auth.js';
import videoRouter from './routes/video.js';
import downloadRouter from './routes/download.js';
import liveRouter from './routes/live.js';
import settingsRouter from './routes/settings.js';
import historyRouter from './routes/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws', clientTracking: true });

const HEARTBEAT_INTERVAL = 30000;

function broadcastWS(type, payload) {
  const msg = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

taskQueue.on('task:added', (task) => broadcastWS('task:added', task));
taskQueue.on('task:updated', (task) => broadcastWS('task:updated', task));
taskQueue.on('task:removed', (data) => broadcastWS('task:removed', data));

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const queue = taskQueue.getQueue();
  ws.send(JSON.stringify({ type: 'queue:sync', payload: queue }));
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => { clearInterval(heartbeat); });

process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  wss.clients.forEach((ws) => ws.close());
  server.close();
});

const corsOptions = process.env.NODE_ENV === 'production'
  ? { origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'client', 'dist')));
}

app.use('/api/auth', authRouter);
app.use('/api/video', videoRouter);
app.use('/api/download', downloadRouter);
app.use('/api/live', liveRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/history', historyRouter);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const ffmpegStatus = checkFfmpeg();
  if (ffmpegStatus.installed) {
    console.log(`ffmpeg is available (${ffmpegStatus.version})`);
  } else {
    console.log('ffmpeg not found, auto-downloading...');
    ensureFfmpeg().then(ok => {
      if (ok) console.log('ffmpeg auto-downloaded successfully');
      else console.warn('ffmpeg auto-download failed, some features may not work');
    });
  }
});

export { wss };
