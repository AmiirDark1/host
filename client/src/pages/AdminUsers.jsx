import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AdminUsers() {
  const { apiCall } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const data = await apiCall('/admin/users')
      setUsers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)
    try {
      await apiCall(`/admin/users/${editUser.username}`, {
        method: 'PUT',
        body: JSON.stringify(editUser),
      })
      setEditUser(null)
      await loadUsers()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(username) {
    if (!window.confirm(`آیا از حذف کاربر ${username} اطمینان دارید؟`)) return
    try {
      await apiCall(`/admin/users/${username}`, { method: 'DELETE' })
      await loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">👥 مدیریت کاربران</h2>
        <p className="page-desc">مشاهده و مدیریت کاربران سیستم</p>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-screen" style={{ padding: 40 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>نام کاربری</th>
                    <th>نام</th>
                    <th>نقش</th>
                    <th>تعداد سایت</th>
                    <th>تاریخ عضویت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                        کاربری یافت نشد
                      </td>
                    </tr>
                  ) : (
                    users.map(user => (
                      <tr key={user.username}>
                        <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                        <td>{user.name || '-'}</td>
                        <td>
                          <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                            {user.role === 'admin' ? 'مدیر' : 'کاربر'}
                          </span>
                        </td>
                        <td>{user.instanceCount || 0}</td>
                        <td style={{ fontSize: 12 }}>
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fa-IR') : '-'}
                        </td>
                        <td>
                          <div className="flex" style={{ gap: 4 }}>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => setEditUser({ ...user })}
                            >
                              ✏️ ویرایش
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(user.username)}
                            >
                              🗑 حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => !saving && setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✏️ ویرایش کاربر {editUser.username}</div>
              <button className="modal-close" onClick={() => setEditUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">نام</label>
                <input
                  className="form-input"
                  value={editUser.name || ''}
                  onChange={e => setEditUser({ ...editUser, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">نقش</label>
                <select
                  className="form-select"
                  value={editUser.role}
                  onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                >
                  <option value="user">کاربر</option>
                  <option value="admin">مدیر</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">محدودیت فضای دیسک (MB)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editUser.diskLimit || 3000}
                  onChange={e => setEditUser({ ...editUser, diskLimit: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">محدودیت RAM (MB)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editUser.memoryLimit || 512}
                  onChange={e => setEditUser({ ...editUser, memoryLimit: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditUser(null)} disabled={saving}>
                انصراف
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}