import { Router } from 'express';
import { resolve } from 'node:path';
import {
  getVideoInfo,
  getStreamUrl,
  parseStreamOptions,
  getBangumiInfo,
  getBangumiStream,
  getCollectionList,
  getFavoriteList
} from '../lib/bilibili-api.js';
import { downloadDASH, downloadAudioOnly, taskQueue, getFileSize } from '../lib/downloader.js';
import { getConfig } from '../lib/config.js';
import { addRecord } from '../lib/database.js';
import { CODEC_ALIAS, AUDIO_QUALITY_MAP } from '../lib/constants.js';

const router = Router();

router.post('/inspect', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ code: -1, message: 'url is required' });
    }
    const data = await getVideoInfo(url);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.message });
    }
    res.json({ code: 0, data: data.data });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/stream-options', async (req, res) => {
  try {
    const { bvid, cid, qn } = req.body;
    if (!bvid || !cid) {
      return res.status(400).json({ code: -1, message: 'bvid and cid are required' });
    }
    const playData = await getStreamUrl(bvid, cid, qn);
    if (playData.code !== 0) {
      return res.status(400).json({ code: playData.code, message: playData.message });
    }
    const options = parseStreamOptions(playData);
    res.json({ code: 0, data: options });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/download', async (req, res) => {
  try {
    const { bvid, cid, title, videoUrl, audioUrl, quality } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).json({ code: -1, message: 'videoUrl and audioUrl are required' });
    }

    const config = getConfig();
    const safeTitle = (title || bvid || 'video').replace(/[\\/:*?"<>|]/g, '_');
    const outputPath = resolve(config.downloadPath, `${safeTitle}.mp4`);

    const taskId = taskQueue.add({
      type: 'video',
      title: safeTitle,
      execute: async ({ abortSignal, onProgress }) => {
        await downloadDASH(videoUrl, audioUrl, outputPath, {
          abortSignal,
          onProgress
        });
        addRecord({
          title: safeTitle,
          url: `https://www.bilibili.com/video/${bvid}`,
          type: 'video',
          quality: quality || '',
          format: 'mp4',
          filePath: outputPath,
          fileSize: getFileSize(outputPath),
          status: 'completed'
        });
      }
    });

    res.json({ code: 0, data: { taskId, outputPath } });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/download/batch', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ code: -1, message: 'tasks array is required' });
    }

    const config = getConfig();
    const taskIds = [];

    for (const task of tasks) {
      const safeTitle = (task.title || task.bvid || 'video').replace(/[\\/:*?"<>|]/g, '_');
      const outputPath = resolve(config.downloadPath, `${safeTitle}.mp4`);

      const taskId = taskQueue.add({
        type: 'video',
        title: safeTitle,
        execute: async ({ abortSignal, onProgress }) => {
          const streamData = await getStreamUrl(task.bvid, task.cid, task.qn || 127);
          if (streamData.code !== 0) {
            throw new Error(streamData.message || 'Failed to get stream url');
          }
          const options = parseStreamOptions(streamData);

          const targetQn = parseInt(task.qn, 10) || 127;
          const targetCodec = CODEC_ALIAS[task.codec] || task.codec;
          const targetAudioId = AUDIO_QUALITY_MAP[task.audioQuality]
            || (typeof task.audioQuality === 'number' ? task.audioQuality : null);

          let videoStream = null;
          if (targetCodec) {
            videoStream = options.video.find(v => v.codec === targetCodec && v.id === targetQn);
          }
          if (!videoStream && targetCodec) {
            videoStream = options.video.find(v => v.codec === targetCodec);
          }
          if (!videoStream) {
            videoStream = options.video.find(v => v.id === targetQn);
          }
          if (!videoStream) {
            videoStream = options.video[0];
          }

          let audioStream = null;
          if (targetAudioId) {
            audioStream = options.audio.find(a => a.id === targetAudioId);
          }
          if (!audioStream) {
            audioStream = options.audio.find(a => a.type === 'normal');
          }
          if (!audioStream) {
            audioStream = options.audio[0];
          }

          if (!videoStream || !audioStream) {
            throw new Error('No available stream found');
          }

          if (task.mode === 'audio-only') {
            const audioFormat = task.audioFormat || config.audioFormat || 'mp3';
            const audioOutputPath = resolve(config.downloadPath, `${safeTitle}.${audioFormat}`);
            await downloadAudioOnly(audioStream.baseUrl, audioOutputPath, audioFormat, {
              abortSignal,
              onProgress
            });
            addRecord({
              title: safeTitle,
              url: `https://www.bilibili.com/video/${task.bvid}`,
              type: 'audio',
              quality: '',
              format: audioFormat,
              filePath: audioOutputPath,
              fileSize: getFileSize(audioOutputPath),
              status: 'completed'
            });
          } else {
            await downloadDASH(videoStream.baseUrl, audioStream.baseUrl, outputPath, {
              abortSignal,
              onProgress
            });
            addRecord({
              title: safeTitle,
              url: `https://www.bilibili.com/video/${task.bvid}`,
              type: 'video',
              quality: task.qn ? String(task.qn) : '',
              format: 'mp4',
              filePath: outputPath,
              fileSize: getFileSize(outputPath),
              status: 'completed'
            });
          }
        }
      });

      taskIds.push(taskId);
    }

    res.json({ code: 0, data: { taskIds } });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/download/audio-only', async (req, res) => {
  try {
    const { bvid, title, audioUrl, format } = req.body;
    if (!audioUrl) {
      return res.status(400).json({ code: -1, message: 'audioUrl is required' });
    }

    const config = getConfig();
    const audioFormat = format || config.audioFormat || 'mp3';
    const safeTitle = (title || bvid || 'audio').replace(/[\\/:*?"<>|]/g, '_');
    const outputPath = resolve(config.downloadPath, `${safeTitle}.${audioFormat}`);

    const taskId = taskQueue.add({
      type: 'audio',
      title: safeTitle,
      execute: async ({ abortSignal, onProgress }) => {
        await downloadAudioOnly(audioUrl, outputPath, audioFormat, {
          abortSignal,
          onProgress
        });
        addRecord({
          title: safeTitle,
          url: `https://www.bilibili.com/video/${bvid}`,
          type: 'audio',
          quality: '',
          format: audioFormat,
          filePath: outputPath,
          fileSize: getFileSize(outputPath),
          status: 'completed'
        });
      }
    });

    res.json({ code: 0, data: { taskId, outputPath } });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/bangumi', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ code: -1, message: 'url is required' });
    }

    const params = {};
    const epMatch = url.match(/ep(\d+)/);
    const ssMatch = url.match(/ss(\d+)/);

    if (epMatch) {
      params.ep_id = epMatch[1];
    } else if (ssMatch) {
      params.season_id = ssMatch[1];
    } else {
      return res.status(400).json({ code: -1, message: 'Invalid bangumi url, expected ep or season link' });
    }

    const data = await getBangumiInfo(params);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.message });
    }

    const result = data.result;
    res.json({
      code: 0,
      data: {
        season_id: result.season_id,
        title: result.season_title || result.title,
        cover: result.cover,
        evaluate: result.evaluate,
        episodes: (result.episodes || []).map(ep => ({
          ep_id: ep.id,
          title: ep.share_copy || ep.long_title || ep.title,
          cover: ep.cover,
          badge: ep.badge,
          duration: ep.duration,
          bvid: ep.bvid,
          cid: ep.cid
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/bangumi/stream', async (req, res) => {
  try {
    const { ep_id, qn, fnval } = req.body;
    if (!ep_id) {
      return res.status(400).json({ code: -1, message: 'ep_id is required' });
    }

    const data = await getBangumiStream(ep_id, qn || 127, fnval);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.message });
    }

    const options = parseStreamOptions(data);
    res.json({ code: 0, data: options });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/collection', async (req, res) => {
  try {
    const { mid, series_id } = req.body;
    if (!mid || !series_id) {
      return res.status(400).json({ code: -1, message: 'mid and series_id are required' });
    }

    const data = await getCollectionList(mid, series_id);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.message });
    }

    res.json({ code: 0, data: data.data });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.post('/favorite', async (req, res) => {
  try {
    const { media_id, page } = req.body;
    if (!media_id) {
      return res.status(400).json({ code: -1, message: 'media_id is required' });
    }

    const data = await getFavoriteList(media_id, page || 1);
    if (data.code !== 0) {
      return res.status(400).json({ code: data.code, message: data.message });
    }

    res.json({ code: 0, data: data.data });
  } catch (err) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

export default router;
