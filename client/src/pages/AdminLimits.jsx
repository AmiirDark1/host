import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// =================================================================
// پلن‌های فضای دیسک سراسری - هر سایتی که ساخته می‌شود
// به صورت خودکار محدود به این فضاها می‌شود
// =================================================================
const predefinedDiskPlans = [
  {
    id: '1gb',
    name: '۱ گیگابایت',
    wpDiskSize: 1,
    dbDiskSize: 0.5,
    wpCpu: 0.5,
    dbCpu: 0.3,
    wpMemory: '256m',
    dbMemory: '256m',
    desc: 'مناسب برای سایت‌های کوچک',
    icon: '📄',
    color: 'rgba(39,174,96,0.12)',
  },
  {
    id: '3gb',
    name: '۳ گیگابایت',
    wpDiskSize: 3,
    dbDiskSize: 1,
    wpCpu: 0.5,
    dbCpu: 0.3,
    wpMemory: '512m',
    dbMemory: '256m',
    desc: 'مناسب برای وبلاگ‌ها',
    icon: '📦',
    color: 'rgba(108,92,231,0.12)',
  },
  {
    id: '5gb',
    name: '۵ گیگابایت',
    wpDiskSize: 5,
    dbDiskSize: 2,
    wpCpu: 1,
    dbCpu: 0.5,
    wpMemory: '1024m',
    dbMemory: '512m',
    desc: 'مناسب برای کسب و کارها',
    icon: '🚀',
    color: 'rgba(52,152,219,0.12)',
  },
  {
    id: '10gb',
    name: '۱۰ گیگابایت',
    wpDiskSize: 10,
    dbDiskSize: 5,
    wpCpu: 2,
    dbCpu: 1,
    wpMemory: '2g',
    dbMemory: '1g',
    desc: 'مناسب برای فروشگاه‌ها',
    icon: '💎',
    color: 'rgba(243,156,18,0.12)',
  },
  {
    id: '25gb',
    name: '۲۵ گیگابایت',
    wpDiskSize: 25,
    dbDiskSize: 15,
    wpCpu: 4,
    dbCpu: 2,
    wpMemory: '4g',
    dbMemory: '2g',
    desc: 'مناسب برای سازمان‌ها',
    icon: '🏢',
    color: 'rgba(231,76,60,0.12)',
  },
]

const planStyles = `
  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  .plan-card {
    border: 2px solid var(--border);
    border-radius: 14px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--surface);
  }
  .plan-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  .plan-card.selected {
    border-color: var(--primary);
    background: rgba(108,92,231,0.06);
    box-shadow: 0 4px 16px rgba(108,92,231,0.15);
  }
  .plan-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .plan-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  .plan-card-name {
    font-weight: bold;
    font-size: 15px;
  }
  .plan-card-desc {
    font-size: 11px;
    color: var(--gray-500);
    margin-bottom: 12px;
  }
  .plan-card-stats {
    font-size: 12px;
    color: var(--gray-600);
  }
  .plan-card-stats .row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    border-bottom: 1px dashed var(--border);
  }
  .plan-card-stats .row:last-child {
    border-bottom: none;
  }
  .plan-card-stats .val {
    font-weight: bold;
  }
  .plan-card .selected-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: var(--success);
    color: white;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 20px;
  }
  .active-plan-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(39,174,96,0.12);
    color: var(--success);
    border: 1px solid rgba(39,174,96,0.3);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: bold;
  }
  .plan-detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .plan-detail-table th, .plan-detail-table td {
    padding: 10px;
    text-align: right;
    border-bottom: 1px solid var(--border);
  }
  .plan-detail-table th {
    color: var(--gray-500);
    font-weight: normal;
    width: 45%;
  }
  .plan-detail-table td {
    font-weight: bold;
  }
`

export default function AdminLimits() {
  const { apiCall } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editLimits, setEditLimits] = useState({})
  const [globalLimits, setGlobalLimits] = useState(null)
  const [editingGlobal, setEditingGlobal] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('3gb')
  const [saveStatus, setSaveStatus] = useState(null)

  // مدیریت کاربران و ادمین‌ها
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [u, g] = await Promise.all([
        apiCall('/users'),
        apiCall('/limits').catch(() => null),
      ])
      setUsers(u || [])
      if (g?.limits?.total?.diskSize) {
        // اگر محدودیت سراسری وجود دارد، پلن انتخابی را بر اساس آن ست کن
        const totalDisk = g.limits.total.diskSize
        const match = predefinedDiskPlans.find(p => (p.wpDiskSize + p.dbDiskSize) === totalDisk)
        if (match) setSelectedPlanId(match.id)
      }
      setGlobalLimits(g)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // اعمال پلن سراسری
  async function handleApplyGlobalPlan() {
    const plan = predefinedDiskPlans.find(p => p.id === selectedPlanId)
    if (!plan) return
    setSaveStatus('saving')
    try {
      const res = await apiCall('/limits', {
        method: 'POST',
        body: JSON.stringify({
          wp: {
            cpu: plan.wpCpu,
            memory: parseInt(plan.wpMemory),
            diskSize: plan.wpDiskSize,
          },
          db: {
            cpu: plan.dbCpu,
            memory: parseInt(plan.dbMemory),
            diskSize: plan.dbDiskSize,
          },
        }),
      })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 3000)
      await loadAll()
    } catch (err) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
      alert(err.message)
    }
  }

  async function handleSaveGlobal() {
    if (!globalLimits) return
    try {
      await apiCall('/limits', {
        method: 'POST',
        body: JSON.stringify(globalLimits),
      })
      setEditingGlobal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  // نمایش جزئیات پلن
  function PlanDetail({ plan }) {
    return (
      <table className="plan-detail-table">
        <tbody>
          <tr>
            <th>فضای وردپرس</th>
            <td>{plan.wpDiskSize} گیگابایت</td>
          </tr>
          <tr>
            <th>فضای دیتابیس</th>
            <td>{plan.dbDiskSize} گیگابایت</td>
          </tr>
          <tr>
            <th>CPU وردپرس</th>
            <td>{plan.wpCpu} هسته</td>
          </tr>
          <tr>
            <th>CPU دیتابیس</th>
            <td>{plan.dbCpu} هسته</td>
          </tr>
          <tr>
            <th>RAM وردپرس</th>
            <td>{plan.wpMemory}</td>
          </tr>
          <tr>
            <th>RAM دیتابیس</th>
            <td>{plan.dbMemory}</td>
          </tr>
        </tbody>
      </table>
    )
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  return (
    <div>
      <style>{planStyles}</style>
      <div className="page-header">
        <h2 className="page-title">💾 کنترل منابع (فضای هر سایت)</h2>
        <p className="page-desc">
          هر سایتی که ساخته می‌شود به صورت خودکار محدود به یکی از این پلن‌های فضای دیسک می‌شود
        </p>
      </div>

      {/* ==================== DISK PLANS ==================== */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🗂️ پلن‌های فضای دیسک هر سایت</div>
          <div className="active-plan-badge">
            <span>✓</span> پلن فعال: {predefinedDiskPlans.find(p => p.id === selectedPlanId)?.name}
          </div>
        </div>
        <div className="card-body">
          <p className="form-label">پلن فضای پیش‌فرض برای همه سایت‌های جدید را انتخاب کنید:</p>
          <div className="plans-grid" style={{ marginBottom: 16 }}>
            {predefinedDiskPlans.map(plan => (
              <div
                key={plan.id}
                className={`plan-card ${selectedPlanId === plan.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlanId(plan.id)}
                style={{ position: 'relative' }}
              >
                {selectedPlanId === plan.id && <span className="selected-badge">✓ فعال</span>}
                <div className="plan-card-header">
                  <div className="plan-card-icon" style={{ background: plan.color }}>
                    {plan.icon}
                  </div>
                  <div>
                    <div className="plan-card-name">{plan.name}</div>
                    <div className="plan-card-desc">{plan.desc}</div>
                  </div>
                </div>
                <div className="plan-card-stats">
                  <div className="row">
                    <span>فضای وردپرس</span>
                    <span className="val">{plan.wpDiskSize} GB</span>
                  </div>
                  <div className="row">
                    <span>فضای دیتابیس</span>
                    <span className="val">{plan.dbDiskSize} GB</span>
                  </div>
                  <div className="row">
                    <span>CPU (WP + DB)</span>
                    <span className="val">{plan.wpCpu + plan.dbCpu} هسته</span>
                  </div>
                  <div className="row">
                    <span>RAM (WP + DB)</span>
                    <span className="val">{plan.wpMemory} + {plan.dbMemory}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {saveStatus === 'saving' && (
            <div className="alert alert-info">
              <span className="spinner spinner-sm" /> در حال ذخیره تنظیمات...
            </div>
          )}
          {saveStatus === 'success' && (
            <div className="alert alert-success">
              ✅ پلن فضای سایت با موفقیت ذخیره شد. سایت‌های جدید با این محدودیت ساخته می‌شوند.
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="alert alert-danger">
              ❌ خطا در ذخیره تنظیمات. دوباره تلاش کنید.
            </div>
          )}

          <button className="btn btn-primary" onClick={handleApplyGlobalPlan} disabled={saveStatus === 'saving'}>
            💾 اعمال این پلن برای همه سایت‌های جدید
          </button>

          <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 12 }}>
            ⚠️ این تنظیمات فقط برای سایت‌های جدید اعمال می‌شود. سایت‌های موجود تغییر نمی‌کنند.
          </p>
        </div>
      </div>

      {/* ==================== INSTANCES OVERVIEW ==================== */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">🌐 همه سایت‌ها و فضای اختصاص داده شده</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>وب‌سایت</th>
                  <th>کاربر</th>
                  <th>وضعیت</th>
                  <th>فضای WP</th>
                  <th>فضای DB</th>
                  <th>CPU</th>
                  <th>RAM</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
                    لیست سایت‌ها از صفحه «سایت‌ها» قابل مشاهده است
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==================== USERS ==================== */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">👤 مدیریت کاربران</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>نقش</th>
                  <th>نام</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>
                      کاربری یافت نشد
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.username}>
                      <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                          {user.role === 'admin' ? 'مدیر' : 'کاربر'}
                        </span>
                      </td>
                      <td>{user.name}</td>
                      <td>
                        <button className="btn btn-sm btn-outline" disabled title="در نسخه بعدی">
                          🔑 مدیریت دسترسی
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==================== MODAL: PLAN DETAIL ==================== */}

      {/* Edit User Limits Modal (simplified - using predefined plans) */}
      {editLimits.username && (
        <div className="modal-overlay" onClick={() => setEditLimits({})}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔒 ویرایش محدودیت‌های {editLimits.username}</div>
              <button className="modal-close" onClick={() => setEditLimits({})}>×</button>
            </div>
            <div className="modal-body">
              <p className="form-label">پلن فضای دیسک برای کاربر را انتخاب کنید:</p>
              <div className="plans-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {predefinedDiskPlans.map(plan => (
                  <div
                    key={plan.id}
                    className={`plan-card ${editLimits.planId === plan.id ? 'selected' : ''}`}
                    onClick={() => setEditLimits({ ...editLimits, planId: plan.id })}
                    style={{ position: 'relative', padding: 12 }}
                  >
                    {editLimits.planId === plan.id && <span className="selected-badge">✓</span>}
                    <div className="plan-card-header" style={{ marginBottom: 6 }}>
                      <div className="plan-card-icon" style={{ background: plan.color, width: 32, height: 32, fontSize: 16 }}>
                        {plan.icon}
                      </div>
                      <div className="plan-card-name" style={{ fontSize: 13 }}>{plan.name}</div>
                    </div>
                    <div className="plan-card-desc" style={{ fontSize: 10 }}>{plan.desc}</div>
                    <div className="plan-card-stats" style={{ fontSize: 10 }}>
                      <div className="row">
                        <span>فضا</span>
                        <span className="val">{plan.wpDiskSize + plan.dbDiskSize} GB</span>
                      </div>
                      <div className="row">
                        <span>CPU</span>
                        <span className="val">{plan.wpCpu + plan.dbCpu}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditLimits({})}>
                انصراف
              </button>
              <button className="btn btn-primary" onClick={() => {
                setEditLimits({})
                alert('✅ تنظیمات ذخیره شد. این قابلیت در نسخه بعدی به طور کامل اعمال می‌شود.')
              }}>
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}