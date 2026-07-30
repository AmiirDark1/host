import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { path: '/', label: 'داشبورد', icon: '📊', exact: true },
  { path: '/store', label: 'فروشگاه', icon: '🛒' },
  { path: '/sites', label: 'سایت‌های من', icon: '🌐' },
]

const adminItems = [
  { path: '/admin', label: 'مدیریت', icon: '⚙️', exact: true },
  { path: '/admin/users', label: 'کاربران', icon: '👥' },
  { path: '/admin/orders', label: 'سفارشات', icon: '📋' },
  { path: '/admin/limits', label: 'محدودیت منابع', icon: '🔒' },
]

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isActive = (path, exact) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const getPageTitle = () => {
    const all = [...navItems, ...adminItems]
    const current = all.find(i => isActive(i.path, i.exact))
    return current?.label || 'داشبورد'
  }

  return (
    <div className="layout">
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 99
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">⚡</div>
          <div>
            <div className="sidebar-title">هاست وردپرس</div>
            <div className="sidebar-subtitle">پنل مدیریت</div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name?.charAt(0) || user?.username?.charAt(0) || '?'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || user?.username}</div>
            <div className="sidebar-user-role">
              {isAdmin ? 'مدیر ارشد' : 'کاربر'}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={`sidebar-nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div style={{
                padding: '16px 20px 8px',
                fontSize: '11px',
                color: 'var(--gray-500)',
                letterSpacing: '1px',
              }}>
                پنل مدیریت
              </div>
              {adminItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={`sidebar-nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div
            className="sidebar-nav-item"
            onClick={logout}
            style={{ color: 'var(--danger)' }}
          >
            <span className="icon">🚪</span>
            خروج
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <h1 className="header-title">{getPageTitle()}</h1>
          <div className="header-left">
            <span className="header-time">
              {time.toLocaleDateString('fa-IR')} - {time.toLocaleTimeString('fa-IR')}
            </span>
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}