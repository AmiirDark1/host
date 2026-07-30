import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MySites() {
  const { apiCall } = useAuth()
  const navigate = useNavigate()
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadInstances() }, [])

  async function loadInstances() {
    try {
      const data = await apiCall('/instances')
      setInstances(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action, instanceName) {
    setActionLoading(`${action}-${instanceName}`)
    try {
      if (action === 'start') await apiCall(`/instances/${instanceName}/start`, { method: 'POST' })
      else if (action === 'stop') await apiCall(`/instances/${instanceName}/stop`, { method: 'POST' })
      else if (action === 'delete') {
        if (!window.confirm('آیا از حذف این سایت اطمینان دارید؟')) return
        await apiCall(`/instances/${instanceName}`, { method: 'DELETE' })
      }
      await loadInstances()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

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
      <div className="page-header">
        <h2 className="page-title">🌐 سایت‌های من</h2>
        <p className="page-desc">مدیریت سایت‌های وردپرسی خود</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate('/store')}>
          🛒 خرید هاست جدید
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🌐</div>
            <h3>هنوز سایتی ندارید</h3>
            <p>با خرید یک پکیج هاست، اولین سایت وردپرسی خود را راه‌اندازی کنید</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/store')}>
              رفتن به فروشگاه
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>دامنه</th>
                    <th>وضعیت</th>
                    <th>تاریخ ایجاد</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map(inst => (
                    <tr key={inst.instanceName}>
                      <td style={{ fontWeight: 'bold' }}>{inst.instanceName}</td>
                      <td dir="ltr">{inst.domain || '-'}</td>
                      <td>
                        <span className="instance-status">
                          <span className={`status-dot ${inst.status === 'running' ? 'running' : 'stopped'}`} />
                          {inst.status === 'running' ? 'فعال' : 'متوقف'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString('fa-IR') : '-'}
                      </td>
                      <td>
                        <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => navigate(`/sites/${inst.instanceName}`)}
                          >
                            جزئیات
                          </button>

                          {inst.status === 'running' ? (
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleAction('stop', inst.instanceName)}
                              disabled={actionLoading === `stop-${inst.instanceName}`}
                            >
                              {actionLoading === `stop-${inst.instanceName}` ? <span className="spinner" /> : '⏹'}
                              توقف
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleAction('start', inst.instanceName)}
                              disabled={actionLoading === `start-${inst.instanceName}`}
                            >
                              {actionLoading === `start-${inst.instanceName}` ? <span className="spinner" /> : '▶'}
                              شروع
                            </button>
                          )}

                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleAction('delete', inst.instanceName)}
                            disabled={actionLoading === `delete-${inst.instanceName}`}
                          >
                            🗑 حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}