import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { path: '/', label: '下载' },
  { path: '/live', label: '直播' },
  { path: '/history', label: '历史' },
  { path: '/settings', label: '设置' }
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-cyan-400">Bilibili Downloader</h1>
          <div className="flex gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-400/20 text-cyan-300'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main className="pt-20 px-6 pb-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
