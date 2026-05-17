import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react';

export default function SettingsPage() {
  const [authStatus, setAuthStatus] = useState(null)
  const [config, setConfig] = useState({ concurrency: 3, audioFormat: 'mp3', downloadPath: './downloads' })
  const [ffmpeg, setFfmpeg] = useState({ installed: false, version: '', path: '' })
  const [ffmpegDownloading, setFfmpegDownloading] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [qrKey, setQrKey] = useState('')
  const [qrPolling, setQrPolling] = useState(false)
  const [qrStatus, setQrStatus] = useState('')
  const [qrError, setQrError] = useState('')
  const [showCookieInput, setShowCookieInput] = useState(false)
  const [cookieValue, setCookieValue] = useState('')
  const [cookieLoading, setCookieLoading] = useState(false)
  const pollTimerRef = useRef(null)

  useEffect(() => {
    fetchAuthStatus()
    fetchSettings()
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status')
      const data = await res.json()
      if (data.code === 0) {
        setAuthStatus(data.data)
      }
    } catch {}
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.config) setConfig(data.config)
      if (data.ffmpeg) setFfmpeg(data.ffmpeg)
    } catch {}
  }

  const updateSettings = async (newConfig) => {
    const merged = { ...config, ...newConfig }
    setConfig(merged)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      })
      const data = await res.json()
      if (data.concurrency !== undefined) setConfig(data)
    } catch {}
  }

  const generateQR = async () => {
    setQrError('')
    try {
      const res = await fetch('/api/auth/qr/generate', { method: 'POST' })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        setQrUrl(data.data.url)
        setQrKey(data.data.qrcode_key)
        setQrPolling(true)
        setQrStatus('等待扫码...')
        startQrPolling(data.data.qrcode_key)
      } else {
        setQrError(data.message || '二维码生成失败，请重试')
        setTimeout(() => setQrError(''), 5000)
      }
    } catch (err) {
      setQrError('网络错误，无法连接服务器')
      setTimeout(() => setQrError(''), 5000)
    }
  }

  const startQrPolling = (key) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr/poll?qrcode_key=${key}`)
        const data = await res.json()
        if (data.code !== 0 || !data.data) return
        const { status } = data.data
        if (status === 'success') {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
          setQrPolling(false)
          setQrUrl('')
          setQrStatus('')
          fetchAuthStatus()
        } else if (status === 'scanned') {
          setQrStatus('已扫码，请在手机上确认...')
        } else if (status === 'expired') {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
          setQrPolling(false)
          setQrUrl('')
          setQrStatus('二维码已过期，请重新获取')
        }
      } catch {}
    }, 2000)
  }

  const submitCookie = async () => {
    if (!cookieValue.trim()) return
    setCookieLoading(true)
    try {
      const res = await fetch('/api/auth/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieValue.trim() })
      })
      const data = await res.json()
      if (data.code === 0 && data.data?.success) {
        setShowCookieInput(false)
        setCookieValue('')
        fetchAuthStatus()
      } else {
        setQrError('Cookie 验证失败，请检查是否正确')
        setTimeout(() => setQrError(''), 5000)
      }
    } catch {
      setQrError('网络错误，无法连接服务器')
      setTimeout(() => setQrError(''), 5000)
    }
    setCookieLoading(false)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'DELETE' })
      setAuthStatus(null)
      fetchAuthStatus()
    } catch {}
  }

  const downloadFfmpeg = async () => {
    setFfmpegDownloading(true)
    try {
      const res = await fetch('/api/settings/ffmpeg/download', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchSettings()
      }
    } catch {}
    setFfmpegDownloading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-cyan-400">设置</h1>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300">账号管理</h2>
        {authStatus?.isLogin ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {authStatus.userInfo?.face && (
                <img src={`/api/proxy/image?url=${encodeURIComponent(authStatus.userInfo.face)}`} alt="头像" className="w-12 h-12 rounded-full" />
              )}
              <div>
                <div className="text-white font-medium">{authStatus.userInfo?.uname || '用户'}</div>
                <div className="text-xs text-gray-400">
                  {authStatus.userInfo?.vipStatus === 1 ? <span className="text-pink-400">大会员</span> : '普通用户'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/40 transition text-sm"
            >
              退出登录
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">未登录（高清画质和番剧需要登录）</div>
            <div className="flex gap-3">
              <button
                onClick={generateQR}
                disabled={qrPolling}
                className="px-4 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/80 text-white text-sm transition disabled:opacity-50"
              >
                扫码登录
              </button>
              <button
                onClick={() => setShowCookieInput(!showCookieInput)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white text-sm transition"
              >
                手动输入Cookie
              </button>
            </div>

            {qrError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {qrError}
              </div>
            )}

            {qrUrl && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="p-3 bg-white rounded-xl">
                  <QRCodeSVG value={qrUrl} size={180} />
                </div>
                <div className="text-xs text-gray-400">
                  {qrStatus || (qrPolling ? '等待扫码...' : '二维码已过期')}
                </div>
              </div>
            )}

            {showCookieInput && (
              <div className="space-y-3">
                <textarea
                  value={cookieValue}
                  onChange={e => setCookieValue(e.target.value)}
                  placeholder="粘贴 Cookie 内容..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-cyan-500 transition"
                />
                <button
                  onClick={submitCookie}
                  disabled={cookieLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/80 text-white text-sm transition disabled:opacity-50"
                >
                  {cookieLoading ? '验证中...' : '验证Cookie'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300">下载设置</h2>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">并发下载数</span>
              <span className="text-sm text-cyan-400 font-mono">{config.concurrency}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={config.concurrency}
              onChange={e => updateSettings({ concurrency: parseInt(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>8</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">默认音频格式</span>
            <select
              value={config.audioFormat || 'mp3'}
              onChange={e => updateSettings({ audioFormat: e.target.value })}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
            >
              <option value="mp3" className="bg-gray-900">MP3</option>
              <option value="flac" className="bg-gray-900">FLAC</option>
              <option value="m4a" className="bg-gray-900">M4A</option>
            </select>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-gray-300">下载目录</span>
            <div className="flex gap-3">
              <input
                type="text"
                value={config.downloadPath || './downloads'}
                onChange={e => setConfig(prev => ({ ...prev, downloadPath: e.target.value }))}
                onBlur={e => updateSettings({ downloadPath: e.target.value })}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <p className="text-xs text-gray-500">下载文件将保存到此目录，相对路径或绝对路径均可</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-300">系统信息</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-gray-300">ffmpeg</span>
              <div className="text-xs text-gray-500">
                {ffmpeg.installed
                  ? <span className="text-green-400">已安装 {ffmpeg.version && `(${ffmpeg.version})`}</span>
                  : <span className="text-red-400">未安装 — 下载合并和直播录制需要 ffmpeg</span>
                }
              </div>
            </div>
            {!ffmpeg.installed && (
              <button
                onClick={downloadFfmpeg}
                disabled={ffmpegDownloading}
                className="px-4 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/80 text-white text-sm transition disabled:opacity-50"
              >
                {ffmpegDownloading ? '下载中...' : '自动下载 ffmpeg'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
