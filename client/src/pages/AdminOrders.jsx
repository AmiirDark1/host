import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AdminOrders() {
  const { apiCall } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall('/admin/orders')
      .then(data => setOrders(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">📋 سفارشات</h2>
        <p className="page-desc">مشاهده و مدیریت سفارشات کاربران</p>
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
                    <th>شماره سفارش</th>
                    <th>کاربر</th>
                    <th>پکیج</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th>تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                        هیچ سفارشی یافت نشد
                      </td>
                    </tr>
                  ) : (
                    orders.map(order => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 'bold' }}>#{order.id}</td>
                        <td>{order.username}</td>
                        <td>{order.package}</td>
                        <td>{order.amount?.toLocaleString('fa-IR')} تومان</td>
                        <td>
                          <span className={`badge ${order.status === 'completed' ? 'badge-success' : order.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                            {order.status === 'completed' ? 'تکمیل شده' : order.status === 'pending' ? 'در انتظار' : 'لغو شده'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fa-IR') : '-'}
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
    </div>
  )
}