import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { apiCall, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [instances, setInstances] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [serverInfo, setServerInfo] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [inst, srv] = await Promise.all([
        apiCall('/instances'),
        apiCall('/server-info').catch(() => null),
      ])
      setInstances(inst || [])
      setServerInfo(srv)

      if (isAdmin) {
        const s = await apiCall('/stats').catch(() => null)
        setStats(s)
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const runningCount = instances.filter(i => i.status === 'running').length
  const stoppedCount = instances.filter(i => i.status === 'stopped').length

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>در حال بارگذاری...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">📦</div>
          <div className="stat-info">
            <h3>{instances.length}</h3>
            <p>مجموع سایت‌ها</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <h3>{runningCount}</h3>
            <p>فعال</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">⛔</div>
          <div className="stat-info">
            <h3>{stoppedCount}</h3>
            <p>متوقف</p>
          </div>
        </div>

        {isAdmin && stats && (
          <>
            <div className="stat-card">
              <div className="stat-icon blue">👥</div>
              <div className="stat-info">
                <h3>{stats.totalUsers || '-'}</h3>
                <p>کاربران</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">💻</div>
              <div className="stat-info">
                <h3>{stats.cpuCount || '-'}</h3>
                <p>هسته‌های CPU</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon teal">🧠</div>
              <div className="stat-info">
                <h3>{stats.totalMemory ? `${(stats.totalMemory / 1024).toFixed(1)} GB` : '-'}</h3>
                <p>RAM سرور</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🚀 اقدامات سریع</div>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }} onClick={() => navigate('/store')}>
              🛒 خرید هاست جدید
            </button>
            <button className="btn btn-success btn-lg" style={{ justifyContent: 'center' }} onClick={() => navigate('/sites')}>
              🌐 مدیریت سایت‌ها
            </button>
            {isAdmin && (
              <button className="btn btn-info btn-lg" style={{ justifyContent: 'center' }} onClick={() => navigate('/admin')}>
                ⚙️ پنل مدیریت
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Server Info */}
      {serverInfo && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🖥️ اطلاعات سرور</div>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>آی‌پی سرور</p>
                <p style={{ fontSize: 16, fontWeight: 'bold', direction: 'ltr' }}>{serverInfo.ip}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>وضعیت</p>
                <span className="badge badge-success">آنلاین</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Instances */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 آخرین سایت‌ها</div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/sites')}>
            مشاهده همه
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {instances.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🌐</div>
              <h3>هنوز سایتی ندارید</h3>
              <p>از فروشگاه یک هاست وردپرس تهیه کنید</p>
              <button className="btn btn-primary mt-4" onClick={() => navigate('/store')}>
                رفتن به فروشگاه
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>دامنه</th>
                    <th>وضعیت</th>
                    <th>تاریخ ایجاد</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {instances.slice(0, 5).map(inst => (
                    <tr key={inst.instanceName}>
                      <td style={{ fontWeight: 'bold' }}>{inst.instanceName}</td>
                      <td dir="ltr">{inst.domain}</td>
                      <td>
                        <span className="instance-status">
                          <span className={`status-dot ${inst.status === 'running' ? 'running' : 'stopped'}`} />
                          {inst.status === 'running' ? 'فعال' : 'متوقف'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('fa-IR') : '-'}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => navigate(`/sites/${inst.instanceName}`)}>
                          جزئیات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}