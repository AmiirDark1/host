import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function InstanceDetail() {
  const { instanceName } = useParams()
  const { apiCall } = useAuth()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('info')
  const [logs, setLogs] = useState('')
  const [logsType, setLogsType] = useState('wp')
  const [logsLoading, setLogsLoading] = useState(false)
  const [resourceUsage, setResourceUsage] = useState(null)

  useEffect(() => {
    loadInstance()
  }, [instanceName])

  async function loadInstance() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall(`/instances/${instanceName}`)
      setInstance(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'logs') loadLogs()
    if (tab === 'resources') loadResourceUsage()
  }, [tab, logsType])

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const data = await apiCall(`/instances/${instanceName}/logs?type=${logsType}&lines=100`)
      setLogs(data.logs || 'داده‌ای برای نمایش وجود ندارد')
    } catch (err) {
      setLogs('خطا در دریافت لاگ‌ها')
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadResourceUsage() {
    try {
      const data = await apiCall(`/resource-usage/instance/${instanceName}`)
      setResourceUsage(data)
    } catch (err) {
      setResourceUsage(null)
    }
  }

  async function handleAction(action) {
    try {
      if (action === 'start') await apiCall(`/instances/${instanceName}/start`, { method: 'POST' })
      else if (action === 'stop') await apiCall(`/instances/${instanceName}/stop`, { method: 'POST' })
      await loadInstance()
    } catch (err) {
      alert(err.message)
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

  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
        <button className="btn btn-sm btn-outline" onClick={() => navigate('/sites')}>
          بازگشت به لیست
        </button>
      </div>
    )
  }

  // Resource meter helper
  function ResourceMeter({ label, used, limit, unit }) {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
    const color = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'green'
    return (
      <div className="resource-meter">
        <div className="resource-meter-label">
          <span>{label}</span>
          <span>{used?.toFixed(1) || 0} / {limit || '∞'} {unit}</span>
        </div>
        <div className="resource-meter-bar">
          <div className={`resource-meter-fill ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/sites')}>←</button>
          <div>
            <h2 className="page-title">{instanceName}</h2>
            <p className="page-desc">
              {instance?.domain && <span dir="ltr">{instance.domain}</span>}
              {instance?.domain && ' | '}
              وضعیت: {instance?.status === 'running' ? 'فعال' : 'متوقف'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {instance?.domain && (
          <a
            href={`http://${instance.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-success"
          >
            🌐 باز کردن سایت
          </a>
        )}
        <a
          href={`http://${instance?.domain}/wp-admin`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-info"
        >
          🔑 ورود به وردپرس
        </a>
        {instance?.status === 'running' ? (
          <button className="btn btn-warning" onClick={() => handleAction('stop')}>
            ⏹ توقف
          </button>
        ) : (
          <button className="btn btn-success" onClick={() => handleAction('start')}>
            ▶ شروع
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
          📋 اطلاعات
        </div>
        <div className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          📜 لاگ‌ها
        </div>
        <div className={`tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => setTab('resources')}>
          📊 منابع
        </div>
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 اطلاعات نمونه</div>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>نام نمونه</p>
                <p style={{ fontWeight: 'bold' }}>{instanceName}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>دامنه</p>
                <p style={{ fontWeight: 'bold', direction: 'ltr' }}>{instance?.domain || '-'}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>وضعیت</p>
                <span className={`badge ${instance?.status === 'running' ? 'badge-success' : 'badge-danger'}`}>
                  {instance?.status === 'running' ? 'فعال' : 'متوقف'}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>تاریخ ایجاد</p>
                <p>{instance?.createdAt ? new Date(instance.createdAt).toLocaleDateString('fa-IR') : '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📜 لاگ‌ها</div>
            <div className="flex" style={{ gap: 8 }}>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '6px 10px' }}
                value={logsType}
                onChange={e => setLogsType(e.target.value)}
              >
                <option value="wp">وردپرس</option>
                <option value="db">دیتابیس</option>
              </select>
              <button className="btn btn-sm btn-outline" onClick={loadLogs}>
                🔄 بروزرسانی
              </button>
            </div>
          </div>
          <div className="card-body">
            {logsLoading ? (
              <div className="loading-screen">
                <div className="spinner" />
              </div>
            ) : (
              <pre style={{
                background: '#1a1a2e',
                color: '#a5d6ff',
                padding: 16,
                borderRadius: 8,
                fontSize: 12,
                direction: 'ltr',
                textAlign: 'left',
                maxHeight: 400,
                overflow: 'auto',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                margin: 0,
              }}>
                {logs}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {tab === 'resources' && (
        <div>
          {resourceUsage ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📊 مصرف منابع - وردپرس</div>
                </div>
                <div className="card-body">
                  {resourceUsage.wordpress ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.wordpress.cpuPercent || 0}
                        limit={resourceUsage.wordpress.cpuLimit || 100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={(resourceUsage.wordpress.memoryBytes || 0) / (1024 * 1024)}
                        limit={(resourceUsage.wordpress.memoryLimit || 512 * 1024 * 1024) / (1024 * 1024)}
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (WP)"
                        used={(resourceUsage.wordpress.diskBytes || 0) / (1024 * 1024)}
                        limit={(resourceUsage.wordpress.diskLimit || 3000) / (1024 * 1024) || 3000}
                        unit="MB"
                      />
                    </div>
                  ) : (
                    <p className="text-muted">داده‌ای موجود نیست</p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">📊 مصرف منابع - دیتابیس</div>
                </div>
                <div className="card-body">
                  {resourceUsage.database ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.database.cpuPercent || 0}
                        limit={resourceUsage.database.cpuLimit || 100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={(resourceUsage.database.memoryBytes || 0) / (1024 * 1024)}
                        limit={(resourceUsage.database.memoryLimit || 512 * 1024 * 1024) / (1024 * 1024)}
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (DB)"
                        used={(resourceUsage.database.diskBytes || 0) / (1024 * 1024)}
                        limit={(resourceUsage.database.diskLimit || 1000) / (1024 * 1024) || 1000}
                        unit="MB"
                      />
                    </div>
                  ) : (
                    <p className="text-muted">داده‌ای موجود نیست</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="icon">📊</div>
                  <h3>داده‌ای موجود نیست</h3>
                  <p>برای مشاهده مصرف منابع، سایت باید فعال باشد</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}