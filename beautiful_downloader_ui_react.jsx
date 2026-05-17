export default function DownloaderUI() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* Left Panel */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-400 mb-2">
                Smart Downloader
              </p>
              <h1 className="text-4xl font-bold leading-tight">
                极速下载
                <span className="block text-slate-400 text-2xl mt-2 font-medium">
                  Elegant • Fast • Minimal
                </span>
              </h1>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-cyan-400/20 flex items-center justify-center border border-cyan-400/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-cyan-300"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3"
                />
              </svg>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-4">
            <label className="text-slate-300 text-sm">下载链接</label>

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="https://example.com/file.zip"
                className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-cyan-400 text-white placeholder:text-slate-500"
              />

              <button className="px-7 py-4 rounded-2xl bg-cyan-400 text-slate-950 font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-400/30">
                下载
              </button>
            </div>
          </div>

          {/* Download Card */}
          <div className="mt-8 bg-black/30 rounded-3xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-lg text-black">
                  ZIP
                </div>

                <div>
                  <h3 className="font-semibold text-lg">design-assets.zip</h3>
                  <p className="text-slate-400 text-sm">2.4 GB • 高速节点</p>
                </div>
              </div>

              <span className="text-cyan-300 text-sm">78%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-4">
              <div className="h-full w-[78%] bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"></div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>18 MB/s</span>
              <span>剩余 1 分钟</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              {
                title: '批量下载',
                desc: '支持多任务',
              },
              {
                title: '云端同步',
                desc: '自动备份',
              },
              {
                title: '智能加速',
                desc: '高速稳定',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors"
              >
                <h4 className="font-semibold mb-1">{item.title}</h4>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">下载队列</h2>
              <p className="text-slate-400 text-sm mt-1">
                当前 3 个活动任务
              </p>
            </div>

            <button className="text-sm px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              管理
            </button>
          </div>

          <div className="space-y-4 flex-1">
            {[
              {
                name: 'video_project.mp4',
                size: '1.2 GB',
                progress: '92%',
              },
              {
                name: 'ui_kit.fig',
                size: '380 MB',
                progress: '64%',
              },
              {
                name: 'music_pack.rar',
                size: '920 MB',
                progress: '37%',
              },
            ].map((file) => (
              <div
                key={file.name}
                className="bg-black/20 border border-white/10 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{file.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{file.size}</p>
                  </div>

                  <span className="text-sm text-cyan-300">{file.progress}</span>
                </div>

                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    style={{ width: file.progress }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer Stats */}
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl p-4">
              <p className="text-slate-400 text-sm mb-1">今日下载</p>
              <h3 className="text-2xl font-bold">48 GB</h3>
            </div>

            <div className="bg-black/20 rounded-2xl p-4">
              <p className="text-slate-400 text-sm mb-1">平均速度</p>
              <h3 className="text-2xl font-bold">24 MB/s</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
