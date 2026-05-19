import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  getLiveRoomInfo,
  getLiveStreamUrl,
  parseLiveQualityOptions,
  extractLiveStreamUrl
} from '../lib/bilibili-api.js';
import { recordLiveStream } from '../lib/ffmpeg.js';
import { getConfig } from '../lib/config.js';

const router = Router();
const activeRecordings = new Map();

router.post('/info', async (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) {
      return res.status(400).json({ code: -1, message: 'room_id is required' });
    }

    const data = await getLiveRoomInfo(room_id);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.msg || data.message });
    }

    const info = data.data;
    res.json({
      code: 0,
      data: {
        title: info.title,
        uname: info.uname || '',
        cover: info.user_cover || info.keyframe,
        live_status: info.live_status,
        room_id: info.room_id
      }
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/qualities', async (req, res) => {
  try {
    const { room_id } = req.body;
    if (!room_id) {
      return res.status(400).json({ code: -1, message: 'room_id is required' });
    }

    const roomData = await getLiveRoomInfo(room_id);
    if (roomData.code !== 0) {
      return res.status(400).json({ code: roomData.code, message: roomData.msg || roomData.message });
    }

    if (roomData.data.live_status !== 1) {
      return res.status(400).json({ code: -1, message: 'Live room is not streaming' });
    }

    const streamData = await getLiveStreamUrl(roomData.data.room_id, 10000);
    if (streamData.code !== 0) {
      return res.status(400).json({ code: streamData.code, message: streamData.message });
    }

    const qualities = parseLiveQualityOptions(streamData);

    res.json({
      code: 0,
      data: qualities
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { room_id, quality } = req.body;
    if (!room_id) {
      return res.status(400).json({ code: -1, message: 'room_id is required' });
    }

    const roomData = await getLiveRoomInfo(room_id);
    if (roomData.code !== 0) {
      return res.status(400).json({ code: roomData.code, message: roomData.msg || roomData.message });
    }

    if (roomData.data.live_status !== 1) {
      return res.status(400).json({ code: -1, message: 'Live room is not streaming' });
    }

    const targetQn = quality || 10000;
    const streamData = await getLiveStreamUrl(roomData.data.room_id, targetQn);
    if (streamData.code !== 0) {
      return res.status(400).json({ code: streamData.code, message: streamData.message });
    }

    const streamResult = extractLiveStreamUrl(streamData, targetQn);
    if (!streamResult) {
      return res.status(500).json({ code: -1, message: 'No available stream url found for requested quality' });
    }

    const config = getConfig();
    const id = randomUUID();
    const title = roomData.data.title || `live_${room_id}`;
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');

    const qualDesc = (streamData.data?.playurl_info?.playurl?.g_qn_desc || [])
      .find(q => q.qn === streamResult.qn)?.desc || String(streamResult.qn);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${safeTitle}_${timestamp}[${qualDesc}].flv`;
    const outputPath = path.resolve(config.downloadPath, fileName);

    const proc = recordLiveStream(streamResult.url, outputPath);

    const recording = {
      id,
      roomId: roomData.data.room_id,
      title,
      process: proc,
      outputPath,
      startTime: Date.now(),
      status: 'recording'
    };

    activeRecordings.set(id, recording);

    proc.on('close', () => {
      const entry = activeRecordings.get(id);
      if (entry && entry.status === 'recording') {
        entry.status = 'stopped';
      }
    });

    proc.on('error', () => {
      const entry = activeRecordings.get(id);
      if (entry) {
        entry.status = 'error';
      }
    });

    res.json({
      code: 0,
      data: { recording_id: id, status: 'recording', quality: streamResult.qn, desc: qualDesc }
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const recording = activeRecordings.get(id);

    if (!recording) {
      return res.status(404).json({ code: -1, message: 'Recording not found' });
    }

    if (recording.status !== 'recording') {
      return res.status(400).json({ code: -1, message: `Recording is already ${recording.status}` });
    }

    await new Promise((resolve) => {
      recording.process.on('close', resolve);
      recording.process.kill('SIGINT');
    });

    recording.status = 'stopped';

    let fileSize = 0;
    try {
      const fileStat = await stat(recording.outputPath);
      fileSize = fileStat.size;
    } catch {}

    const duration = Math.floor((Date.now() - recording.startTime) / 1000);

    res.json({
      code: 0,
      data: {
        status: 'stopped',
        filePath: recording.outputPath,
        duration,
        fileSize
      }
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.get('/status', (req, res) => {
  const list = [];
  for (const [id, recording] of activeRecordings) {
    const duration = Math.floor((Date.now() - recording.startTime) / 1000);
    list.push({
      id,
      room_id: recording.roomId,
      title: recording.title,
      status: recording.status,
      duration,
      filePath: recording.outputPath,
      startTime: recording.startTime
    });
  }
  res.json({ code: 0, data: list });
});

export default router;
