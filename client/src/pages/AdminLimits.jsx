import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AdminLimits() {
  const { apiCall } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState(null)
  const [editLimits, setEditLimits] = useState({})
  const [globalLimits, setGlobalLimits] = useState(null)
  const [editingGlobal, setEditingGlobal] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [u, g] = await Promise.all([
        apiCall('/admin/users'),
        apiCall('/admin/limits').catch(() => null),
      ])
      setUsers(u || [])
      setGlobalLimits(g)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleEditUser(user) {
    setEditLimits({
      username: user.username,
      diskLimit: user.diskLimit || 3000,
      memoryLimit: user.memoryLimit || 512,
      cpuLimit: user.cpuLimit || 0.5,
    })
  }

  async function handleSaveUser() {
    const { username, diskLimit, memoryLimit, cpuLimit } = editLimits
    setSavingUserId(username)
    try {
      await apiCall(`/admin/users/${username}/limits`, {
        method: 'PUT',
        body: JSON.stringify({ diskLimit, memoryLimit, cpuLimit }),
      })
      setEditLimits({})
      await loadAll()
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleSaveGlobal() {
    if (!globalLimits) return
    try {
      await apiCall('/admin/limits', {
        method: 'PUT',
        body: JSON.stringify(globalLimits),
      })
      setEditingGlobal(false)
    } catch (err) {
      alert(err.message)
    }
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
      <div className="page-header">
        <h2 className="page-title">🔒 محدودیت منابع</h2>
        <p className="page-desc">مدیریت محدودیت CPU، RAM و دیسک برای کاربران</p>
      </div>

      {/* Global Limits */}
      {globalLimits && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🌐 محدودیت‌های سراسری</div>
            <button className="btn btn-sm btn-outline" onClick={() => setEditingGlobal(!editingGlobal)}>
              {editingGlobal ? 'انصراف' : '✏️ ویرایش'}
            </button>
          </div>
          <div className="card-body">
            {editingGlobal ? (
              <div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">حداکثر دیسک به‌ازای کاربر (MB)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={globalLimits.defaultDiskLimit}
                      onChange={e => setGlobalLimits({ ...globalLimits, defaultDiskLimit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">حداکثر RAM به‌ازای کاربر (MB)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={globalLimits.defaultMemoryLimit}
                      onChange={e => setGlobalLimits({ ...globalLimits, defaultMemoryLimit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">حداکثر CPU به‌ازای کاربر</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={globalLimits.defaultCpuLimit}
                      onChange={e => setGlobalLimits({ ...globalLimits, defaultCpuLimit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <button className="btn btn-primary mt-4" onClick={handleSaveGlobal}>
                  ذخیره تنظیمات سراسری
                </button>
              </div>
            ) : (
              <div className="grid-3">
                <div>
                  <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>حداکثر دیسک</p>
                  <p style={{ fontSize: 18, fontWeight: 'bold' }}>
                    {globalLimits.defaultDiskLimit ? `${(globalLimits.defaultDiskLimit / 1024).toFixed(1)} GB` : '∞'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>حداکثر RAM</p>
                  <p style={{ fontSize: 18, fontWeight: 'bold' }}>
                    {globalLimits.defaultMemoryLimit ? `${(globalLimits.defaultMemoryLimit / 1024).toFixed(1)} GB` : '∞'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>حداکثر CPU</p>
                  <p style={{ fontSize: 18, fontWeight: 'bold' }}>
                    {globalLimits.defaultCpuLimit ? `${globalLimits.defaultCpuLimit} هسته` : '∞'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-User Limits */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">👤 محدودیت‌های کاربران</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>دیسک</th>
                  <th>RAM</th>
                  <th>CPU</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                      کاربری یافت نشد
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.username}>
                      <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                      <td>
                        <span className="badge badge-info">
                          {user.diskLimit ? `${(user.diskLimit / 1024).toFixed(1)} GB` : '∞'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">
                          {user.memoryLimit ? `${(user.memoryLimit / 1024).toFixed(1)} GB` : '∞'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-warning">
                          {user.cpuLimit ? `${user.cpuLimit} هسته` : '∞'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleEditUser(user)}
                        >
                          ✏️ ویرایش
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

      {/* Edit User Limits Modal */}
      {editLimits.username && (
        <div className="modal-overlay" onClick={() => setEditLimits({})}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔒 ویرایش محدودیت‌های {editLimits.username}</div>
              <button className="modal-close" onClick={() => setEditLimits({})}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">حداکثر فضای دیسک (MB)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editLimits.diskLimit}
                  onChange={e => setEditLimits({ ...editLimits, diskLimit: parseInt(e.target.value) || 0 })}
                />
                <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                  0 = بدون محدودیت (پیش‌فرض: 3000 MB = 3 GB)
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">حداکثر RAM (MB)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editLimits.memoryLimit}
                  onChange={e => setEditLimits({ ...editLimits, memoryLimit: parseInt(e.target.value) || 0 })}
                />
                <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                  0 = بدون محدودیت (پیش‌فرض: 512 MB)
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">محدودیت CPU (هسته)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={editLimits.cpuLimit}
                  onChange={e => setEditLimits({ ...editLimits, cpuLimit: parseFloat(e.target.value) || 0 })}
                />
                <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                  0 = بدون محدودیت (پیش‌فرض: 0.5 هسته)
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditLimits({})} disabled={savingUserId === editLimits.username}>
                انصراف
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveUser}
                disabled={savingUserId === editLimits.username}
              >
                {savingUserId === editLimits.username ? <span className="spinner" /> : null}
                {savingUserId === editLimits.username ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}