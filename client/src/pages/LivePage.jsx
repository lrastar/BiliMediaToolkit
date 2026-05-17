import { useState, useEffect, useRef } from 'react'

export default function LivePage() {
  const [roomInput, setRoomInput] = useState('')
  const [roomInfo, setRoomInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [quality, setQuality] = useState(4)
  const [recording, setRecording] = useState(false)
  const [recordId, setRecordId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [fileSize, setFileSize] = useState('0 MB')
  const [history, setHistory] = useState([])
  const timerRef = useRef(null)
  const pollRef = useRef(null)

  const qualityOptions = [
    { label: '原画', qn: 4 },
    { label: '蓝光', qn: 3 },
    { label: '超清', qn: 2 },
    { label: '高清', qn: 1 },
    { label: '流畅', qn: 0 }
  ]

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const extractRoomId = (input) => {
    const trimmed = input.trim()
    const match = trimmed.match(/live\.bilibili\.com\/(\d+)/)
    if (match) return match[1]
    if (/^\d+$/.test(trimmed)) return trimmed
    return trimmed
  }

  const fetchRoomInfo = async () => {
    const roomId = extractRoomId(roomInput)
    if (!roomId) return
    setLoading(true)
    try {
      const res = await fetch('/api/live/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      })
      const data = await res.json()
      if (data.code === 0) {
        setRoomInfo(data.data)
      } else {
        setRoomInfo(null)
      }
    } catch {
      setRoomInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: extractRoomId(roomInput), quality })
      })
      const data = await res.json()
      if (data.code === 0) {
        setRecordId(data.data.recording_id)
        setRecording(true)
        setElapsed(0)
        setFileSize('0 MB')

        timerRef.current = setInterval(() => {
          setElapsed(prev => prev + 1)
        }, 1000)

        pollRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/live/status')
            const statusData = await statusRes.json()
            if (statusData.data?.length) {
              const current = statusData.data.find(r => r.id === data.data.recording_id)
              if (current?.fileSize) {
                const mb = (current.fileSize / 1024 / 1024).toFixed(1)
                setFileSize(`${mb} MB`)
              }
            }
          } catch {}
        }, 3000)
      }
    } catch {}
  }

  const stopRecording = async () => {
    if (!recordId) return
    try {
      await fetch(`/api/live/${recordId}/stop`, { method: 'POST' })
    } catch {}
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    timerRef.current = null
    pollRef.current = null

    setHistory(prev => [
      { id: Date.now(), room: roomInput, duration: formatTime(elapsed), size: fileSize, time: new Date().toLocaleString() },
      ...prev
    ])
    setRecording(false)
    setRecordId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-cyan-400">直播录制</h1>

      <div className="flex gap-3">
        <input
          type="text"
          value={roomInput}
          onChange={e => setRoomInput(e.target.value)}
          placeholder="输入直播间号或链接"
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
        />
        <button
          onClick={fetchRoomInfo}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/80 text-white font-medium backdrop-blur-md transition disabled:opacity-50"
        >
          {loading ? '获取中...' : '获取信息'}
        </button>
      </div>

      {roomInfo && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 flex gap-5">
          {roomInfo.cover && (
            <img src={roomInfo.cover} alt="封面" className="w-40 h-24 rounded-xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div className="text-lg font-semibold text-white">{roomInfo.title || '未知房间'}</div>
            <div className="text-sm text-gray-400">主播：{roomInfo.uname || '未知'}</div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${roomInfo.live_status ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-sm ${roomInfo.live_status ? 'text-green-400' : 'text-gray-500'}`}>
                {roomInfo.live_status ? '直播中' : '未开播'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300">录制控制</h2>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={quality}
            onChange={e => setQuality(e.target.value)}
            disabled={recording}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500 transition"
          >
            {qualityOptions.map(q => (
              <option key={q.qn} value={q.qn} className="bg-gray-900">{q.label}</option>
            ))}
          </select>

          {!recording ? (
            <button
              onClick={startRecording}
              disabled={!roomInfo || !roomInfo.live_status}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600/80 hover:bg-red-500/80 text-white font-medium transition disabled:opacity-40"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
              开始录制
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-600/80 hover:bg-gray-500/80 text-white font-medium transition"
            >
              停止录制
            </button>
          )}

          {recording && (
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono">{formatTime(elapsed)}</span>
              </div>
              <span className="text-gray-500">|</span>
              <span>{fileSize}</span>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-cyan-300">录制历史</h2>
          <div className="space-y-2">
            {history.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-sm text-white">房间 {item.room}</div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{item.duration}</span>
                  <span>{item.size}</span>
                  <span>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
