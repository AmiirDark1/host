import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminDashboard() {
  const { apiCall } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall('/stats').then(setStats).catch(() => null).finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'کاربران', value: stats?.totalUsers || 0, icon: '👥', color: 'blue', link: '/admin/users' },
    { label: 'نمونه‌های فعال', value: stats?.runningInstances || 0, icon: '✅', color: 'green' },
    { label: 'نمونه‌های متوقف', value: stats?.stoppedInstances || 0, icon: '⛔', color: 'red' },
    { label: 'هسته‌های CPU', value: stats?.cpuCount || '-', icon: '💻', color: 'orange' },
    { label: 'RAM', value: stats?.totalMemory ? `${(stats.totalMemory / 1073741824).toFixed(1)} GB` : '-', icon: '🧠', color: 'teal' },
    { label: 'فضای دیسک', value: stats?.totalDisk ? `${(stats.totalDisk / 1073741824).toFixed(1)} GB` : '-', icon: '💾', color: 'purple' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">⚙️ پنل مدیریت</h2>
        <p className="page-desc">مدیریت کلی سرور، کاربران و منابع</p>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner spinner-lg" />
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {statCards.map((card, i) => (
              <div
                key={i}
                className="stat-card"
                style={card.link ? { cursor: 'pointer' } : {}}
                onClick={() => card.link && navigate(card.link)}
              >
                <div className={`stat-icon ${card.color}`}>{card.icon}</div>
                <div className="stat-info">
                  <h3>{card.value}</h3>
                  <p>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 24 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">👥 مدیریت کاربران</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                  مشاهده، ویرایش و مدیریت کاربران سیستم
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/admin/users')}>
                  رفتن به کاربران
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">🔒 محدودیت منابع</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                  تنظیم محدودیت CPU، RAM و دیسک برای هر کاربر
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/admin/limits')}>
                  مدیریت محدودیت‌ها
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">📋 سفارشات</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                  مشاهده و مدیریت سفارشات کاربران
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/admin/orders')}>
                  مشاهده سفارشات
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">🌐 فروشگاه</div>
              </div>
              <div className="card-body">
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
                  مدیریت پکیج‌های فروشگاه و قیمت‌ها
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/store')}>
                  مشاهده فروشگاه
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}