import { useState, useEffect, useCallback, useMemo } from 'react'
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

const HIGH_QUALITY_THRESHOLD = 80

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [videoInfo, setVideoInfo] = useState(null)
  const [streamOptions, setStreamOptions] = useState(null)
  const [selectedPages, setSelectedPages] = useState([])
  const [quality, setQuality] = useState('')
  const [codec, setCodec] = useState('')
  const [audioQuality, setAudioQuality] = useState('')
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

  const availableCodecs = useMemo(() => {
    if (!streamOptions?.video) return []
    const codecSet = new Set(streamOptions.video.filter(v => v.id === parseInt(quality)).map(v => v.codec))
    return [...codecSet]
      .map(c => ({ value: c.toLowerCase(), label: c }))
  }, [streamOptions, quality])

  const availableAudio = useMemo(() => {
    if (!streamOptions?.audio) return []
    const audioSet = new Set(streamOptions.audio.map(a => a.id))
    return [...audioSet]
      .sort((a, b) => b - a)
      .map(id => ({ value: String(id), label: AUDIO_ID_LABELS[id] || `${id}` }))
  }, [streamOptions])

  const inspectVideo = async () => {
    if (!url.trim()) return
    setLoading(true)
    setVideoInfo(null)
    setStreamOptions(null)
    setSelectedPages([])
    try {
      const res = await fetch('/api/video/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        setVideoInfo(data.data)
        setSelectedPages([data.data.pages?.[0]?.cid].filter(Boolean))

        const firstCid = data.data.pages?.[0]?.cid
        if (firstCid) {
          try {
            const streamRes = await fetch('/api/video/stream-options', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bvid: data.data.bvid, cid: firstCid, qn: 127 })
            })
            const streamData = await streamRes.json()
            if (streamData.code === 0 && streamData.data) {
              setStreamOptions(streamData.data)
            }
          } catch {}
        }
      } else {
        setVideoInfo(null)
      }
    } catch {
      setVideoInfo(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (availableQualities.length > 0 && !quality) {
      setQuality(availableQualities[0].value)
    }
  }, [availableQualities, quality])

  useEffect(() => {
    if (availableCodecs.length > 0) {
      const av1 = availableCodecs.find(c => c.value === 'av1')
      setCodec(av1 ? av1.value : availableCodecs[0].value)
    }
  }, [availableCodecs])

  useEffect(() => {
    if (availableAudio.length > 0 && !audioQuality) {
      setAudioQuality(availableAudio[0].value)
    }
  }, [availableAudio, audioQuality])

  const togglePage = (cid) => {
    setSelectedPages(prev =>
      prev.includes(cid)
        ? prev.filter(id => id !== cid)
        : [...prev, cid]
    )
  }

  const isHighQuality = parseInt(quality) > HIGH_QUALITY_THRESHOLD
  const isVip = authStatus?.userInfo?.vipStatus === 1

  const startDownload = async (selectedCids) => {
    if (!videoInfo || selectedCids.length === 0) return
    const tasks = videoInfo.pages
      .filter(p => selectedCids.includes(p.cid))
      .map(p => ({
        bvid: videoInfo.bvid,
        cid: p.cid,
        title: p.part,
        qn: quality,
        codec,
        audioQuality: isNaN(parseInt(audioQuality)) ? audioQuality : parseInt(audioQuality),
        mode: downloadMode,
        audioFormat
      }))

    try {
      await fetch('/api/video/download/batch', {
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
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-white">极速下载</h1>
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
              onKeyDown={e => e.key === 'Enter' && inspectVideo()}
              placeholder="输入 BV号、av号、B站链接或短链..."
              className="flex-1 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-cyan-400 transition text-sm"
            />
            <button
              onClick={inspectVideo}
              disabled={loading}
              className="px-6 py-4 rounded-2xl bg-cyan-400 text-slate-950 font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-400/30 disabled:opacity-50 disabled:hover:scale-100 text-sm"
            >
              {loading ? '解析中...' : '解析'}
            </button>
          </div>
        </div>

        {videoInfo && (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl space-y-5">
            <div className="flex gap-5">
              {videoInfo.pic && (
                <img src={`/api/proxy/image?url=${encodeURIComponent(videoInfo.pic)}`} alt="" className="w-32 h-20 rounded-xl object-cover shrink-0" />
              )}
              <div className="min-w-0 space-y-1.5">
                <h3 className="font-semibold text-white line-clamp-2">{videoInfo.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{videoInfo.owner?.name || '未知UP主'}</span>
                  <span>{formatDuration(videoInfo.duration)}</span>
                  <span>{videoInfo.pages?.length || 0} P</span>
                </div>
              </div>
            </div>

            {videoInfo.pages && videoInfo.pages.length > 1 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {videoInfo.pages.map((p, i) => (
                  <label key={p.cid} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedPages.includes(p.cid)}
                      onChange={() => togglePage(p.cid)}
                      className="rounded accent-cyan-400"
                    />
                    <span className="text-sm text-gray-300 flex-1">P{i + 1}. {p.part}</span>
                    <span className="text-xs text-gray-500">{formatDuration(p.duration)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">视频画质</label>
                <select
                  value={quality}
                  onChange={e => setQuality(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {availableQualities.length > 0 ? (
                    availableQualities.map(o => (
                      <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                    ))
                  ) : (
                    <option className="bg-gray-900">解析后显示</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">视频编码</label>
                <select
                  value={codec}
                  onChange={e => setCodec(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {availableCodecs.length > 0 ? (
                    availableCodecs.map(o => (
                      <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                    ))
                  ) : (
                    <option className="bg-gray-900">解析后显示</option>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">音频质量</label>
                <select
                  value={audioQuality}
                  onChange={e => setAudioQuality(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
                >
                  {availableAudio.length > 0 ? (
                    availableAudio.map(o => (
                      <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                    ))
                  ) : (
                    <option className="bg-gray-900">解析后显示</option>
                  )}
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

            {isHighQuality && !isVip && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                该画质可能需要大会员，建议登录后下载
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => startDownload(selectedPages)}
                disabled={selectedPages.length === 0}
                className="flex-1 px-6 py-3 rounded-2xl bg-cyan-400 text-slate-950 font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-400/30 disabled:opacity-40 disabled:hover:scale-100 text-sm"
              >
                下载选中 ({selectedPages.length})
              </button>
              {videoInfo.pages && videoInfo.pages.length > 1 && (
                <button
                  onClick={() => {
                    const allCids = videoInfo.pages.map(p => p.cid)
                    setSelectedPages(allCids)
                    startDownload(allCids)
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
            <p className="text-xs text-gray-600 mt-1">解析视频后开始下载</p>
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
