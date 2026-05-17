import { useState, useEffect, useMemo } from 'react'
import useDownloadStore from '../stores/useDownloadStore'

const QN_LABELS = {
  127: '8K', 126: '杜比视界', 125: 'HDR真彩', 120: '4K',
  116: '1080P60', 112: '1080P+', 80: '1080P', 74: '720P60',
  64: '720P', 32: '480P', 16: '360P'
}

const AUDIO_ID_LABELS = {
  30251: 'Hi-Res 无损', 30250: '杜比全景声',
  30280: '192kbps', 30232: '128kbps', 30216: '64kbps'
}

const AUDIO_FORMAT_OPTIONS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC' },
  { value: 'm4a', label: 'M4A' }
]

const FALLBACK_QUALITIES = [
  { value: '127', label: '8K' }, { value: '120', label: '4K' },
  { value: '116', label: '1080P60' }, { value: '80', label: '1080P' },
  { value: '64', label: '720P' }, { value: '32', label: '480P' }
]

const FALLBACK_CODECS = [
  { value: 'av1', label: 'AV1' }, { value: 'hevc', label: 'HEVC' }, { value: 'avc', label: 'AVC' }
]

const FALLBACK_AUDIO = [
  { value: '30251', label: 'Hi-Res 无损' }, { value: '30250', label: '杜比全景声' },
  { value: '30280', label: '192K' }, { value: '30232', label: '128K' }
]

const HIGH_QUALITY_THRESHOLD = 80

export default function BangumiPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [bangumiInfo, setBangumiInfo] = useState(null)
  const [streamOptions, setStreamOptions] = useState(null)
  const [streamError, setStreamError] = useState(null)
  const [selectedEpisodes, setSelectedEpisodes] = useState([])
  const [quality, setQuality] = useState('80')
  const [codec, setCodec] = useState('av1')
  const [audioQuality, setAudioQuality] = useState('30280')
  const [downloadMode, setDownloadMode] = useState('video')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [authStatus, setAuthStatus] = useState(null)

  const tasks = useDownloadStore(state => state.tasks)
  const connectWS = useDownloadStore(state => state.connectWS)

  useEffect(() => {
    connectWS()
  }, [connectWS])

  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        if (data.code === 0 && data.data) {
          setAuthStatus(data.data)
        }
      })
      .catch(() => {})
  }, [])

  const availableQualities = useMemo(() => {
    if (!streamOptions?.video) return []
    const qnSet = new Set(streamOptions.video.map(v => v.id))
    return [...qnSet]
      .sort((a, b) => b - a)
      .map(qn => ({ value: String(qn), label: QN_LABELS[qn] || `${qn}P` }))
  }, [streamOptions])

  const displayQualities = availableQualities.length > 0 ? availableQualities : FALLBACK_QUALITIES

  const availableCodecs = useMemo(() => {
    if (!streamOptions?.video) return []
    const codecSet = new Set(streamOptions.video.filter(v => v.id === parseInt(quality)).map(v => v.codec))
    return [...codecSet]
      .map(c => ({ value: c.toLowerCase(), label: c }))
  }, [streamOptions, quality])

  const displayCodecs = availableCodecs.length > 0 ? availableCodecs : FALLBACK_CODECS

  const availableAudio = useMemo(() => {
    if (!streamOptions?.audio) return []
    const audioSet = new Set(streamOptions.audio.map(a => a.id))
    return [...audioSet]
      .sort((a, b) => b - a)
      .map(id => ({ value: String(id), label: AUDIO_ID_LABELS[id] || `${id}` }))
  }, [streamOptions])

  const displayAudio = availableAudio.length > 0 ? availableAudio : FALLBACK_AUDIO

  const inspectBangumi = async () => {
    if (!url.trim()) return
    setLoading(true)
    setBangumiInfo(null)
    setStreamOptions(null)
    setStreamError(null)
    setSelectedEpisodes([])
    try {
      const res = await fetch('/api/video/bangumi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        setBangumiInfo(data.data)
        const firstEp = data.data.episodes?.[0]
        if (firstEp) {
          setSelectedEpisodes([firstEp.ep_id])
          await fetchStreamOptions(firstEp.ep_id)
        }
      } else {
        setStreamError(data.message || '解析番剧信息失败')
      }
    } catch (err) {
      setBangumiInfo(null)
      setStreamError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStreamOptions = async (epId) => {
    setStreamError(null)
    try {
      const streamRes = await fetch('/api/video/bangumi/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ep_id: epId, qn: 127 })
      })
      const streamData = await streamRes.json()
      if (streamData.code === 0 && streamData.data) {
        setStreamOptions(streamData.data)
        if (streamData.data.video?.length > 0) {
          const highestQn = String(streamData.data.video[0].id)
          setQuality(highestQn)
          const codecSet = new Set(streamData.data.video.filter(v => v.id === parseInt(highestQn)).map(v => v.codec))
          const codecs = [...codecSet]
          if (codecs.length > 0) {
            const av1 = codecs.find(c => c.toLowerCase() === 'av1')
            setCodec(av1 ? 'av1' : codecs[0].toLowerCase())
          }
        }
        if (streamData.data.audio?.length > 0) {
          setAudioQuality(String(streamData.data.audio[0].id))
        }
      } else {
        setStreamError(streamData.message || '获取流信息失败，将使用默认选项（下载时会自动匹配可用画质）')
      }
    } catch (err) {
      setStreamError(err.message || '获取流信息失败，将使用默认选项（下载时会自动匹配可用画质）')
    }
  }

  const toggleEpisode = (epId) => {
    setSelectedEpisodes(prev =>
      prev.includes(epId)
        ? prev.filter(id => id !== epId)
        : [...prev, epId]
    )
    if (selectedEpisodes.length <= 1) {
      fetchStreamOptions(epId)
    }
  }

  const startDownload = async (selectedEpIds) => {
    if (!bangumiInfo || selectedEpIds.length === 0) return
    const episodes = bangumiInfo.episodes.filter(ep => selectedEpIds.includes(ep.ep_id))
    const tasks = episodes.map(ep => ({
      ep_id: ep.ep_id,
      bvid: ep.bvid,
      cid: ep.cid,
      title: ep.title,
      qn: quality,
      codec,
      audioQuality: isNaN(parseInt(audioQuality)) ? audioQuality : parseInt(audioQuality),
      mode: downloadMode,
      audioFormat
    }))

    try {
      await fetch('/api/video/bangumi/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      })
    } catch {}
  }

  const formatDuration = (sec) => {
    if (!sec) return '--:--'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec) return '0 KB/s'
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
      <div className="space-y-6">
        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-8 h-8 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm5.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-white">番剧下载</h1>
              <p className="text-xs text-gray-500 mt-0.5">BiliMediaToolkit</p>
            </div>
          </div>

          {!authStatus?.isLogin && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <span className="text-sm text-amber-400">未登录，部分画质可能无法获取</span>
              <a href="/settings" className="text-xs text-cyan-400 hover:text-cyan-300 transition">去登录 →</a>
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inspectBangumi()}
              placeholder="输入 ss 或 ep 链接，如 https://www.bilibili.com/bangumi/play/ss28747 或 ep123456"
              className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-cyan-400 transition text-sm"
            />
            <button
              onClick={inspectBangumi}
              disabled={loading}
              className="px-6 py-4 rounded-2xl bg-cyan-400 text-slate-950 font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-400/30 disabled:opacity-50 disabled:hover:scale-100 text-sm"
            >
              {loading ? '解析中...' : '解析'}
            </button>
          </div>
        </div>

        {bangumiInfo && (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl space-y-5">
            <div className="flex gap-5">
              {bangumiInfo.cover && (
                <img src={`/api/proxy/image?url=${encodeURIComponent(bangumiInfo.cover)}`} alt="" className="w-32 h-40 rounded-xl object-cover shrink-0" />
              )}
              <div className="min-w-0 space-y-1.5 flex-1">
                <h3 className="font-semibold text-white line-clamp-2">{bangumiInfo.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-3">{bangumiInfo.evaluate}</p>
              </div>
            </div>

            {bangumiInfo.episodes && bangumiInfo.episodes.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {bangumiInfo.episodes.map((ep, i) => (
                  <label key={ep.ep_id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedEpisodes.includes(ep.ep_id)}
                      onChange={() => toggleEpisode(ep.ep_id)}
                      className="rounded accent-cyan-400"
                    />
                    {ep.cover && (
                      <img src={`/api/proxy/image?url=${encodeURIComponent(ep.cover)}`} alt="" className="w-20 h-12 rounded object-cover" />
                    )}
                    <span className="text-sm text-gray-300 flex-1">{ep.title}</span>
                    {ep.badge && (
                      <span className="text-xs px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300">{ep.badge}</span>
                    )}
                    <span className="text-xs text-gray-500">{formatDuration(ep.duration)}</span>
                  </label>
                ))}
              </div>
            )}

            {streamError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{streamError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">视频画质{!streamOptions && ' (默认)'}</label>
                <select
                  value={quality}
                  onChange={e => setQuality(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {displayQualities.map(o => (
                    <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">视频编码{!streamOptions && ' (默认)'}</label>
                <select
                  value={codec}
                  onChange={e => setCodec(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {displayCodecs.map(o => (
                    <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">音频质量{!streamOptions && ' (默认)'}</label>
                <select
                  value={audioQuality}
                  onChange={e => setAudioQuality(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {displayAudio.map(o => (
                    <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">下载模式</label>
                <select
                  value={downloadMode}
                  onChange={e => setDownloadMode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  <option value="video" className="bg-gray-900">视频 + 音频</option>
                  <option value="audio-only" className="bg-gray-900">仅音频</option>
                </select>
              </div>
              {downloadMode === 'audio-only' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">音频输出格式</label>
                  <select
                    value={audioFormat}
                    onChange={e => setAudioFormat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                  >
                    {AUDIO_FORMAT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!streamOptions && !streamError && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
                流信息使用默认选项，下载时会自动匹配该番剧实际可用的最高画质
              </div>
            )}

            {parseInt(quality) > HIGH_QUALITY_THRESHOLD && !authStatus?.isLogin && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                该画质可能需要大会员，建议登录后下载
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => startDownload(selectedEpisodes)}
                disabled={selectedEpisodes.length === 0}
                className="flex-1 px-6 py-3 rounded-2xl bg-cyan-400 text-slate-950 font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-400/30 disabled:opacity-40 disabled:hover:scale-100 text-sm"
              >
                下载选中 ({selectedEpisodes.length})
              </button>
              {bangumiInfo.episodes && bangumiInfo.episodes.length > 1 && (
                <button
                  onClick={() => {
                    const allEpIds = bangumiInfo.episodes.map(ep => ep.ep_id)
                    setSelectedEpisodes(allEpIds)
                    startDownload(allEpIds)
                  }}
                  className="px-6 py-3 rounded-2xl bg-white/10 border border-white/15 text-gray-300 font-semibold hover:bg-white/20 transition text-sm"
                >
                  全部下载
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cyan-400">下载队列</h2>
          {tasks.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 text-xs font-medium">
              {tasks.filter(t => t.status === 'downloading').length} 下载中 / {tasks.length} 总计
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm text-gray-500">暂无下载任务</p>
            <p className="text-xs text-gray-600 mt-1">解析番剧后开始下载</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {tasks.map(task => (
              <div
                key={task.id}
                className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-gray-200 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`
                        px-1.5 py-0.5 rounded-md font-medium
                        ${task.status === 'downloading' ? 'bg-cyan-400/20 text-cyan-300' : ''}
                        ${task.status === 'completed' ? 'bg-green-400/20 text-green-300' : ''}
                        ${task.status === 'failed' ? 'bg-red-400/20 text-red-300' : ''}
                        ${task.status === 'paused' ? 'bg-amber-400/20 text-amber-300' : ''}
                        ${task.status === 'pending' ? 'bg-gray-400/20 text-gray-300' : ''}
                      `}>
                        {task.status === 'downloading' && '下载中'}
                        {task.status === 'completed' && '已完成'}
                        {task.status === 'failed' && '失败'}
                        {task.status === 'paused' && '已暂停'}
                        {task.status === 'pending' && '等待中'}
                      </span>
                      {task.progress?.speed > 0 && task.status === 'downloading' && (
                        <span className="text-gray-500">{formatSpeed(task.progress.speed)}</span>
                      )}
                      {task.progress?.total > 0 && (
                        <span className="text-gray-500">{formatSize(task.progress.downloaded)}/{formatSize(task.progress.total)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {task.status === 'downloading' && (
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${task.progress?.percent || 0}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
