import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const packages = [
  {
    id: 'starter',
    name: 'استارتر',
    desc: 'مناسب برای سایت‌های شخصی و شروع کار',
    price: 99000,
    icon: '🌱',
    iconBg: 'rgba(39,174,96,0.12)',
    iconColor: 'var(--success)',
    features: [
      '1 سایت وردپرس',
      '۳ گیگابایت فضا',
      '۵ گیگابایت پهنای باند',
      '۰.۵ هسته CPU',
      '۵۱۲ مگابایت RAM',
      'داشبورد مدیریت',
      'پشتیبانی ۲۴/۷',
    ],
    popular: false,
    featured: false,
  },
  {
    id: 'professional',
    name: 'حرفه‌ای',
    desc: 'مناسب برای کسب و کارهای اینترنتی',
    price: 199000,
    icon: '🚀',
    iconBg: 'rgba(108,92,231,0.12)',
    iconColor: 'var(--primary)',
    features: [
      '3 سایت وردپرس',
      '۱۰ گیگابایت فضا',
      '۵۰ گیگابایت پهنای باند',
      '۱ هسته CPU',
      '۱ گیگابایت RAM',
      'داشبورد مدیریت',
      'SSL خودکار',
      'پشتیبانی ۲۴/۷',
      'پشتیبان‌گیری هفتگی',
    ],
    popular: true,
    featured: true,
  },
  {
    id: 'business',
    name: 'بیزینس',
    desc: 'مناسب برای فروشگاه‌ها و سایت‌های پربازدید',
    price: 349000,
    icon: '💼',
    iconBg: 'rgba(52,152,219,0.12)',
    iconColor: 'var(--info)',
    features: [
      '6 سایت وردپرس',
      '۲۵ گیگابایت فضا',
      '۱۰۰ گیگابایت پهنای باند',
      '۲ هسته CPU',
      '۲ گیگابایت RAM',
      'داشبورد مدیریت',
      'SSL خودکار',
      'پشتیبان‌گیری روزانه',
      'پشتیبانی ۲۴/۷',
      'دامنه اختصاصی',
      'اولویت پشتیبانی',
    ],
    popular: false,
    featured: false,
  },
  {
    id: 'enterprise',
    name: 'انترپرایز',
    desc: 'مناسب برای سازمان‌ها و شرکت‌های بزرگ',
    price: 699000,
    icon: '🏢',
    iconBg: 'rgba(243,156,18,0.12)',
    iconColor: 'var(--warning)',
    features: [
      'نامحدود سایت',
      '۵۰+ گیگابایت فضا',
      'پهنای باند نامحدود',
      '۴ هسته CPU',
      '۴ گیگابایت RAM',
      'داشبورد مدیریت',
      'SSL خودکار',
      'پشتیبان‌گیری روزانه',
      'پشتیبانی ۲۴/۷',
      'دامنه اختصاصی',
      'مدیر اختصاصی',
      'SLA 99.9%',
    ],
    popular: false,
    featured: false,
  },
]

export default function Store() {
  const { apiCall } = useAuth()
  const navigate = useNavigate()
  const [showOrder, setShowOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Domain inputs for each package
  const [domains, setDomains] = useState({})

  function handleOrder(pkg) {
    setShowOrder(pkg)
    setDomains({})
    setResult(null)
    setError(null)
  }

  async function handleSubmitOrder() {
    const pkg = showOrder
    if (!pkg) return
    setLoading(true)
    setError(null)

    try {
      // Build domain list based on package
      let count = 0
      if (pkg.id === 'starter') count = 1
      else if (pkg.id === 'professional') count = 3
      else if (pkg.id === 'business') count = 6
      else if (pkg.id === 'enterprise') count = null // site count = user's choice

      const domainList = []
      if (count) {
        for (let i = 0; i < count; i++) {
          if (domains[i]?.trim()) domainList.push(domains[i].trim())
        }
        if (domainList.length !== count) {
          throw new Error(`لطفاً ${count} دامنه معتبر وارد کنید`)
        }
      }

      // Create instance(s) via API
      if (count === 1) {
        const result = await apiCall('/instances', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: `site-${Date.now()}`,
            domain: domainList[0],
          }),
        })
        setResult({
          message: `✅ سایت شما با موفقیت ساخته شد!`,
          details: `دامنه: ${domainList[0]}`,
          instanceName: result.instanceName,
        })
      } else if (count === 3 || count === 6) {
        const result = await apiCall('/instances/bulk', {
          method: 'POST',
          body: JSON.stringify({ count, domains: domainList }),
        })
        setResult({
          message: `✅ ${count} سایت با موفقیت ساخته شدند!`,
          details: domainList.join('، '),
        })
      } else {
        // Enterprise: create instances one by one
        const created = []
        for (const domain of domainList) {
          const res = await apiCall('/instances', {
            method: 'POST',
            body: JSON.stringify({
              instanceName: `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              domain,
            }),
          })
          created.push(res)
        }
        setResult({
          message: `✅ ${created.length} سایت با موفقیت ساخته شدند!`,
          details: domainList.join('، '),
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">🛒 فروشگاه هاست وردپرس</h2>
        <p className="page-desc">
          یکی از پکیج‌های زیر را انتخاب کنید و سایت وردپرسی خود را راه‌اندازی کنید
        </p>
      </div>

      {/* Existing orders link */}
      <div style={{ marginBottom: 20, textAlign: 'left' }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/sites')}>
          مشاهده سایت‌های من ←
        </button>
      </div>

      <div className="packages-grid">
        {packages.map(pkg => (
          <div
            key={pkg.id}
            className={`package-card ${pkg.featured ? 'featured' : ''} ${pkg.popular ? 'popular' : ''}`}
          >
            {pkg.popular && <div className="package-badge popular">محبوب</div>}
            {pkg.featured && !pkg.popular && <div className="package-badge">ویژه</div>}

            <div className="package-header">
              <div className="package-icon" style={{ background: pkg.iconBg, color: pkg.iconColor }}>
                {pkg.icon}
              </div>
              <div className="package-name">{pkg.name}</div>
              <div className="package-desc">{pkg.desc}</div>
            </div>

            <div className="package-price">
              <span className="package-price-amount">
                {pkg.price.toLocaleString('fa-IR')}
              </span>
              <span className="package-price-currency"> تومان / ماه</span>
            </div>

            <div className="package-features">
              {pkg.features.map((feat, i) => (
                <div key={i} className="package-feature">
                  <span className="check">✓</span>
                  {feat}
                </div>
              ))}
            </div>

            <div className="package-footer">
              <button
                className={`btn ${pkg.featured ? 'btn-primary' : 'btn-outline'} btn-lg`}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleOrder(pkg)}
              >
                سفارش {pkg.name}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order Modal */}
      {showOrder && !result && (
        <div className="modal-overlay" onClick={() => !loading && setShowOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {showOrder.icon} سفارش {showOrder.name}
              </div>
              <button className="modal-close" onClick={() => setShowOrder(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="alert alert-info">
                💰 مبلغ: {showOrder.price.toLocaleString('fa-IR')} تومان / ماه
              </div>

              {error && <div className="alert alert-danger">{error}</div>}

              {showOrder.id === 'starter' && (
                <div className="form-group">
                  <label className="form-label">دامنه سایت (مثال: example.com)</label>
                  <input
                    className="form-input"
                    value={domains[0] || ''}
                    onChange={e => setDomains({ ...domains, 0: e.target.value })}
                    placeholder="example.com"
                    dir="ltr"
                  />
                </div>
              )}

              {(showOrder.id === 'professional' || showOrder.id === 'business') && (
                <div>
                  <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--gray-500)' }}>
                    لطفاً {showOrder.id === 'professional' ? '۳' : '۶'} دامنه را وارد کنید:
                  </p>
                  {Array.from({ length: showOrder.id === 'professional' ? 3 : 6 }).map((_, i) => (
                    <div key={i} className="form-group">
                      <label className="form-label">دامنه {i + 1}</label>
                      <input
                        className="form-input"
                        value={domains[i] || ''}
                        onChange={e => setDomains({ ...domains, [i]: e.target.value })}
                        placeholder={`domain${i + 1}.com`}
                        dir="ltr"
                      />
                    </div>
                  ))}
                </div>
              )}

              {showOrder.id === 'enterprise' && (
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                  برای سفارش پکیج انترپرایز لطفاً با تیم فروش تماس بگیرید.
                  شما می‌توانید تعداد دلخواه سایت با دامنه‌های مختلف ایجاد کنید.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowOrder(null)} disabled={loading}>
                انصراف
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitOrder}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'در حال ایجاد...' : 'تأیید و پرداخت'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Result Modal */}
      {result && (
        <div className="modal-overlay" onClick={() => { setShowOrder(null); setResult(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--success)' }}>✅ سفارش با موفقیت ثبت شد</div>
              <button className="modal-close" onClick={() => { setShowOrder(null); setResult(null) }}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-success">
                {result.message}
              </div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                {result.details}
              </p>
              {result.instanceName && (
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  نام نمونه: <strong dir="ltr">{result.instanceName}</strong>
                </p>
              )}
              <p style={{ fontSize: 13, marginTop: 12, color: 'var(--gray-500)' }}>
                چند لحظه صبر کنید تا سایت شما آماده شود. پس از آماده شدن، از طریق دامنه وارد شده قابل دسترسی خواهد بود.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { setShowOrder(null); setResult(null); navigate('/sites') }}>
                رفتن به سایت‌های من
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}