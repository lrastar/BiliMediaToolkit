import { useState, useEffect } from 'react'

export default function HistoryPage() {
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const limit = 20

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/history?page=${page}&limit=${limit}`)
      const data = await res.json()
      if (data.code === 0 && data.data) {
        setRecords(data.data.records || [])
        setTotalPages(data.data.totalPages || 1)
      } else {
        setRecords([])
      }
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [page])

  const deleteRecord = async (id) => {
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' })
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  const clearAll = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' })
      setRecords([])
      setPage(1)
      setTotalPages(1)
    } catch {}
    setConfirmClear(false)
  }

  const openFileLocation = async (filePath) => {
    try {
      await fetch('/api/history/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      })
    } catch {}
  }

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '--'
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const typeLabel = (type) => {
    const map = { video: '视频', audio: '音频', live: '直播' }
    return map[type] || type
  }

  const statusLabel = (status) => {
    const map = { completed: '已完成', failed: '失败', cancelled: '已取消' }
    return map[status] || status
  }

  const statusColor = (status) => {
    if (status === 'completed') return 'text-green-400'
    if (status === 'failed') return 'text-red-400'
    return 'text-gray-400'
  }

  const filtered = records.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-cyan-400">下载历史</h1>
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索标题..."
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/40 transition text-sm"
          >
            清空历史
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-xl bg-red-600/80 text-white text-sm transition hover:bg-red-500"
            >
              确认清空
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm transition hover:text-white"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-gray-500">暂无下载记录</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(record => (
            <div
              key={record.id}
              className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{record.title}</div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-900/40 text-cyan-300">{typeLabel(record.type)}</span>
                  <span>{record.quality}</span>
                  <span>{formatSize(record.fileSize)}</span>
                  <span>{record.createdAt}</span>
                  <span className={statusColor(record.status)}>{statusLabel(record.status)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openFileLocation(record.filePath)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white hover:border-cyan-500/50 transition"
                >
                  打开位置
                </button>
                <button
                  onClick={() => deleteRecord(record.id)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-red-400 hover:text-red-300 hover:border-red-500/50 transition"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white transition disabled:opacity-30"
          >
            上一页
          </button>
          <span className="px-4 py-2 text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white transition disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
