import { createHash } from 'node:crypto';
import { getCookie } from './config.js';
import { API_BASE, FNVAL_DASH_ALL, CODEC_MAP, AUDIO_QUALITY_DOLBY, AUDIO_QUALITY_HIRES } from './constants.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const mixinKeyEncTab = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];

let wbiKeysCache = { keys: null, expireAt: 0 };

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([412, 429, 502, 503, 504]);

async function fetchWithRetry(url, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);
      if (RETRYABLE_STATUS.has(res.status)) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(r => setTimeout(r, delay));
        lastError = new Error(`HTTP ${res.status} (retry ${attempt + 1}/${MAX_RETRIES})`);
        continue;
      }
      return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise(r => setTimeout(r, delay));
      lastError = err;
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

function getHeaders() {
  const headers = {
    'User-Agent': UA,
    'Referer': 'https://www.bilibili.com'
  };
  const cookie = getCookie();
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  return headers;
}

function getMixinKey(raw) {
  return mixinKeyEncTab.map(i => raw[i]).join('').slice(0, 32);
}

export async function getWbiKeys() {
  const now = Date.now();
  if (wbiKeysCache.keys && now < wbiKeysCache.expireAt) {
    return wbiKeysCache.keys;
  }

  try {
    const res = await fetchWithRetry(`${API_BASE}/x/web-interface/nav`, { headers: getHeaders() });
    const data = await res.json();

    if (!data?.data?.wbi_img?.img_url || !data?.data?.wbi_img?.sub_url) {
      wbiKeysCache = {
        keys: { raw: '', mixinKey: '' },
        expireAt: now + 5 * 60 * 1000
      };
      return wbiKeysCache.keys;
    }

    const { img_url, sub_url } = data.data.wbi_img;

    const imgKey = img_url.split('/').pop().split('.')[0];
    const subKey = sub_url.split('/').pop().split('.')[0];
    const raw = imgKey + subKey;

    wbiKeysCache = {
      keys: { raw, mixinKey: getMixinKey(raw) },
      expireAt: now + 30 * 60 * 1000
    };

    return wbiKeysCache.keys;
  } catch {
    wbiKeysCache = {
      keys: { raw: '', mixinKey: '' },
      expireAt: now + 5 * 60 * 1000
    };
    return wbiKeysCache.keys;
  }
}

export async function signWbiParams(params) {
  const { mixinKey } = await getWbiKeys();
  if (!mixinKey) return params;

  const wts = Math.floor(Date.now() / 1000);
  const merged = { ...params, wts };

  const sorted = Object.keys(merged)
    .sort()
    .reduce((acc, key) => {
      const val = String(merged[key]).replace(/[!'()*]/g, '');
      acc[key] = val;
      return acc;
    }, {});

  const query = new URLSearchParams(sorted).toString();
  const wRid = createHash('md5').update(query + mixinKey).digest('hex');

  return { ...sorted, w_rid: wRid };
}

export function parseVideoInput(input) {
  const trimmed = input.trim();

  const bvMatch = trimmed.match(/BV[a-zA-Z0-9]+/);
  if (bvMatch) {
    return { bvid: bvMatch[0] };
  }

  const avMatch = trimmed.match(/av(\d+)/i);
  if (avMatch) {
    return { aid: parseInt(avMatch[1], 10) };
  }

  if (trimmed.includes('b23.tv')) {
    return { shortUrl: trimmed.match(/https?:\/\/b23\.tv\/[a-zA-Z0-9]+/)?.[0] || trimmed };
  }

  return { bvid: trimmed };
}

async function resolveShortUrl(url) {
  const res = await fetchWithRetry(url, { headers: getHeaders(), redirect: 'manual' });
  const location = res.headers.get('location');
  if (location) {
    return parseVideoInput(location);
  }
  return { bvid: url };
}

export async function getVideoInfo(input) {
  let parsed = parseVideoInput(input);

  if (parsed.shortUrl) {
    parsed = await resolveShortUrl(parsed.shortUrl);
  }

  const params = parsed.bvid ? { bvid: parsed.bvid } : { aid: parsed.aid };
  const query = new URLSearchParams(params).toString();
  const res = await fetchWithRetry(`${API_BASE}/x/web-interface/view?${query}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getStreamUrl(bvid, cid, qn = 127, fnval = FNVAL_DASH_ALL) {
  const signed = await signWbiParams({ bvid, cid, qn, fnval, fourk: 1 });
  const query = new URLSearchParams(signed).toString();
  const res = await fetchWithRetry(`${API_BASE}/x/player/wbi/playurl?${query}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export function parseStreamOptions(playData) {
  const payload = playData?.data || playData?.result;
  const dash = payload?.dash;
  if (!dash) {
    const acceptQuality = payload?.accept_quality || [];
    const errorCode = payload?.error_code;
    const isPreview = payload?.is_preview;
    const hasPaid = payload?.has_paid;
    return { video: [], audio: [], acceptQuality, errorCode, isPreview, hasPaid };
  }

  const acceptQuality = payload?.accept_quality || [];

  const video = (dash.video || [])
    .filter(v => acceptQuality.length === 0 || acceptQuality.includes(v.id))
    .map(v => ({
      id: v.id,
      baseUrl: v.baseUrl,
      backupUrl: v.backupUrl,
      bandwidth: v.bandwidth,
      width: v.width,
      height: v.height,
      codecid: v.codecid,
      codec: CODEC_MAP[v.codecid] || 'Unknown',
      frameRate: v.frameRate,
      mimeType: v.mimeType
    }))
    .sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);

  const audio = [];

  if (dash.dolby?.audio?.length) {
    dash.dolby.audio.forEach(a => {
      audio.push({
        id: AUDIO_QUALITY_DOLBY,
        baseUrl: a.baseUrl,
        backupUrl: a.backupUrl,
        bandwidth: a.bandwidth,
        type: 'dolby',
        mimeType: a.mimeType
      });
    });
  }

  if (dash.flac?.audio) {
    const a = dash.flac.audio;
    audio.push({
      id: AUDIO_QUALITY_HIRES,
      baseUrl: a.baseUrl,
      backupUrl: a.backupUrl,
      bandwidth: a.bandwidth,
      type: 'hires',
      mimeType: a.mimeType
    });
  }

  (dash.audio || []).forEach(a => {
    audio.push({
      id: a.id,
      baseUrl: a.baseUrl,
      backupUrl: a.backupUrl,
      bandwidth: a.bandwidth,
      type: 'normal',
      mimeType: a.mimeType
    });
  });

  return { video, audio, acceptQuality };
}

export async function getBangumiInfo(params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetchWithRetry(`${API_BASE}/pgc/view/web/season?${query}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getBangumiStream(epId, qn = 127, fnval = FNVAL_DASH_ALL) {
  const params = new URLSearchParams({ ep_id: epId, qn, fnval, fourk: 1 }).toString();
  const res = await fetchWithRetry(`${API_BASE}/pgc/player/web/playurl?${params}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getCollectionList(mid, seriesId) {
  const params = new URLSearchParams({ mid, series_id: seriesId }).toString();
  const res = await fetchWithRetry(`${API_BASE}/x/polymer/space/seasons_series_list?${params}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getFavoriteList(mediaId, page = 1) {
  const params = new URLSearchParams({ media_id: mediaId, pn: page, ps: 20 }).toString();
  const res = await fetchWithRetry(`${API_BASE}/x/v3/fav/resource/list?${params}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getLiveRoomInfo(roomId) {
  const res = await fetchWithRetry(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export async function getLiveStreamUrl(roomId, quality = 10000) {
  const params = new URLSearchParams({
    room_id: roomId,
    qn: quality,
    protocol: '0,1',
    format: '0,1,2',
    codec: '0,1,2',
    platform: 'web'
  }).toString();
  const res = await fetchWithRetry(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?${params}`, { headers: getHeaders() });
  const data = await res.json();
  return data;
}

export function parseLiveQualityOptions(streamData) {
  const playurl = streamData?.data?.playurl_info?.playurl;
  const gQnDesc = playurl?.g_qn_desc || [];

  const qualities = gQnDesc.map(q => ({
    qn: q.qn,
    desc: q.desc,
    detailDesc: q.media_base_desc?.detail_desc?.desc || null,
    briefDesc: q.media_base_desc?.brief_desc?.desc || null,
    badge: q.media_base_desc?.brief_desc?.badge || null,
    tags: q.media_base_desc?.detail_desc?.tag || [],
    hdrType: q.hdr_type || 0
  }));

  return qualities.sort((a, b) => b.qn - a.qn);
}

export function extractLiveStreamUrl(streamData, targetQn = 10000) {
  const playurl = streamData?.data?.playurl_info?.playurl;
  if (!playurl) return null;

  for (const stream of (playurl.stream || [])) {
    for (const format of (stream.format || [])) {
      for (const codec of (format.codec || [])) {
        if (codec.current_qn === targetQn && codec.url_info?.length && codec.base_url) {
          const urlInfo = codec.url_info[0];
          return {
            url: urlInfo.host + codec.base_url + urlInfo.extra,
            codecName: codec.codec_name,
            qn: codec.current_qn,
            protocol: stream.protocol_name,
            formatName: format.format_name
          };
        }
      }
    }
  }

  const acceptQn = new Set((playurl.g_qn_desc || []).map(q => q.qn));
  for (const stream of (playurl.stream || [])) {
    for (const format of (stream.format || [])) {
      for (const codec of (format.codec || [])) {
        if ((acceptQn.size === 0 || acceptQn.has(codec.current_qn)) && codec.url_info?.length && codec.base_url) {
          const urlInfo = codec.url_info[0];
          return {
            url: urlInfo.host + codec.base_url + urlInfo.extra,
            codecName: codec.codec_name,
            qn: codec.current_qn,
            protocol: stream.protocol_name,
            formatName: format.format_name
          };
        }
      }
    }
  }

  return null;
}
