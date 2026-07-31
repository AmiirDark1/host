import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

// =================================================================
// پلن‌های فضای دیسک - هر سایت یک فضای مشخص دارد
// =================================================================
const diskPlans = [
  {
    id: '1gb',
    name: '۱ گیگابایت',
    desc: 'مناسب برای سایت‌های کوچک و شخصی',
    wpDiskSize: 1,          // 1GB for WordPress files
    dbDiskSize: 0.5,        // 512MB for database
    wpCpu: 0.5,
    dbCpu: 0.3,
    wpMemory: '256m',
    dbMemory: '256m',
    price: 49000,
    icon: '📄',
    recommended: false,
  },
  {
    id: '3gb',
    name: '۳ گیگابایت',
    desc: 'مناسب برای وبلاگ و سایت‌های معمولی',
    wpDiskSize: 3,
    dbDiskSize: 1,
    wpCpu: 0.5,
    dbCpu: 0.3,
    wpMemory: '512m',
    dbMemory: '256m',
    price: 99000,
    icon: '📦',
    recommended: true,
  },
  {
    id: '5gb',
    name: '۵ گیگابایت',
    desc: 'مناسب برای کسب و کارهای کوچک',
    wpDiskSize: 5,
    dbDiskSize: 2,
    wpCpu: 1,
    dbCpu: 0.5,
    wpMemory: '1024m',
    dbMemory: '512m',
    price: 149000,
    icon: '🚀',
    recommended: false,
  },
  {
    id: '10gb',
    name: '۱۰ گیگابایت',
    desc: 'مناسب برای فروشگاه‌ها و سایت‌های پربازدید',
    wpDiskSize: 10,
    dbDiskSize: 5,
    wpCpu: 2,
    dbCpu: 1,
    wpMemory: '2g',
    dbMemory: '1g',
    price: 249000,
    icon: '💎',
    recommended: false,
  },
  {
    id: '25gb',
    name: '۲۵ گیگابایت',
    desc: 'مناسب برای سازمان‌ها و سایت‌های حرفه‌ای',
    wpDiskSize: 25,
    dbDiskSize: 15,
    wpCpu: 4,
    dbCpu: 2,
    wpMemory: '4g',
    dbMemory: '2g',
    price: 449000,
    icon: '🏢',
    recommended: false,
  },
]

// =================================================================
// پکیج‌ها - هر پکیج تعداد سایت مشخصی دارد
// =================================================================
const packages = [
  {
    id: 'starter',
    name: 'استارتر',
    desc: 'مناسب برای شروع کار با یک سایت',
    price: 49000,
    icon: '🌱',
    iconBg: 'rgba(39,174,96,0.12)',
    iconColor: 'var(--success)',
    siteCount: 1,
    features: [
      '1 سایت وردپرس',
      'انتخاب فضای دلخواه برای سایت',
      '۰.۵ هسته CPU به‌ازای هر سایت',
      '۲۵۶ مگابایت RAM به‌ازای هر سایت',
      'SSL خودکار',
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
    siteCount: 3,
    features: [
      '3 سایت وردپرس',
      'انتخاب فضای دلخواه برای هر سایت',
      'SSL خودکار',
      'داشبورد مدیریت',
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
    siteCount: 6,
    features: [
      '6 سایت وردپرس',
      'انتخاب فضای دلخواه برای هر سایت',
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
    siteCount: null, // نامحدود
    features: [
      'نامحدود سایت',
      'انتخاب فضای دلخواه برای هر سایت',
      'SSL خودکار',
      'پشتیبان‌گیری روزانه',
      'پشتیبانی ۲۴/۷',
      'مدیر اختصاصی',
      'SLA 99.9%',
    ],
    popular: false,
    featured: false,
  },
]

// CSS برای انتخاب فضای دیسک
const diskPlanStyles = `
  .disk-plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 8px;
  }
  .disk-plan-card {
    border: 2px solid var(--border);
    border-radius: 12px;
    padding: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--surface);
  }
  .disk-plan-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
  }
  .disk-plan-card.selected {
    border-color: var(--primary);
    background: rgba(108,92,231,0.08);
    box-shadow: 0 4px 12px rgba(108,92,231,0.15);
  }
  .disk-plan-card .dicon {
    font-size: 24px;
    margin-bottom: 6px;
  }
  .disk-plan-card .dname {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .disk-plan-card .ddesc {
    font-size: 10px;
    color: var(--gray-500);
    margin-bottom: 6px;
  }
  .disk-plan-card .dprice {
    font-size: 13px;
    font-weight: bold;
    color: var(--primary);
  }
  .disk-plan-card .drec {
    font-size: 10px;
    color: var(--success);
    font-weight: bold;
  }
  .disk-plan-card.selected .dcheck {
    color: var(--success);
  }
  .disk-plan-card .dcheck {
    display: block;
    height: 16px;
    font-size: 14px;
  }
  .space-summary {
    background: rgba(108,92,231,0.08);
    border: 1px solid rgba(108,92,231,0.2);
    border-radius: 10px;
    padding: 12px;
    margin-top: 12px;
    font-size: 13px;
  }
  .space-summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }
  .space-summary-row .label {
    color: var(--gray-500);
  }
  .space-summary-row .value {
    font-weight: bold;
  }
  .site-order-block {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 16px;
    background: var(--surface);
  }
  .site-order-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .site-order-title {
    font-weight: bold;
    font-size: 14px;
  }
  .site-total {
    font-size: 12px;
    color: var(--gray-500);
  }
`

export default function Store() {
  const { apiCall } = useAuth()
  const navigate = useNavigate()
  const [showOrder, setShowOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Domain inputs for each package
  const [domains, setDomains] = useState({})
  // Selected disk plan for each site index
  const [selectedPlans, setSelectedPlans] = useState({})

  function handleOrder(pkg) {
    setShowOrder(pkg)
    setDomains({})
    setSelectedPlans({ 0: '3gb' })  // پیش‌فرض: 3 گیگابایت
    setResult(null)
    setError(null)
  }

  function getTotalPrice(pkg) {
    if (!pkg) return 0
    const count = pkg.siteCount === null ? 1 : pkg.siteCount
    let total = 0
    for (let i = 0; i < count; i++) {
      const plan = diskPlans.find(p => p.id === selectedPlans[i]) || diskPlans[1]
      total += plan.price
    }
    return total
  }

  // ساخت resources از روی پلن انتخاب‌شده
  function buildResources(planId) {
    const plan = diskPlans.find(p => p.id === planId) || diskPlans[1]
    return {
      wpDiskSize: plan.wpDiskSize,
      dbDiskSize: plan.dbDiskSize,
      wpCpu: plan.wpCpu,
      dbCpu: plan.dbCpu,
      wpMemory: plan.wpMemory,
      dbMemory: plan.dbMemory,
    }
  }

  async function handleSubmitOrder() {
    const pkg = showOrder
    if (!pkg) return
    setLoading(true)
    setError(null)

    try {
      // Build domain list based on package
      let count = pkg.siteCount
      if (pkg.id === 'enterprise') count = null // site count = user's choice

      const domainList = []
      if (count) {
        for (let i = 0; i < count; i++) {
          if (domains[i]?.trim()) domainList.push(domains[i].trim())
        }
        if (domainList.length !== count) {
          throw new Error(`لطفاً ${count} دامنه معتبر وارد کنید`)
        }
      } else {
        // Enterprise: حداقل 1 دامنه
        for (let i = 0; i < Object.keys(domains).length; i++) {
          if (domains[i]?.trim()) domainList.push(domains[i].trim())
        }
        if (domainList.length === 0) {
          throw new Error('لطفاً حداقل 1 دامنه وارد کنید')
        }
      }

      // Create instance(s) via API
      if (count === 1) {
        const resources = buildResources(selectedPlans[0] || '3gb')
        const result = await apiCall('/instances', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: `site-${Date.now()}`,
            domain: domainList[0],
            resources,
          }),
        })
        const plan = diskPlans.find(p => p.id === (selectedPlans[0] || '3gb'))
        setResult({
          message: `✅ سایت شما با موفقیت ساخته شد!`,
          details: `دامنه: ${domainList[0]} | فضا: ${plan?.name || '3 گیگابایت'}`,
          instanceName: result.instanceName,
        })
      } else if (count === 3 || count === 6) {
        // اگر همه سایت‌ها یک پلن دارند، bulk بساز
        const allSamePlan = Array.from({ length: count }).every(i => selectedPlans[0] === selectedPlans[i])
        if (allSamePlan) {
          const resources = buildResources(selectedPlans[0] || '3gb')
          const result = await apiCall('/instances/bulk', {
            method: 'POST',
            body: JSON.stringify({ count, domains: domainList, resources }),
          })
          const plan = diskPlans.find(p => p.id === (selectedPlans[0] || '3gb'))
          setResult({
            message: `✅ ${count} سایت با موفقیت ساخته شدند!`,
            details: `${domainList.join('، ')}\nفضای هر سایت: ${plan?.name || '3 گیگابایت'}`,
          })
        } else {
          // پلن‌های متفاوت - یکی یکی بساز
          const created = []
          for (let i = 0; i < count; i++) {
            const planId = selectedPlans[i] || '3gb'
            const resources = buildResources(planId)
            await apiCall('/instances', {
              method: 'POST',
              body: JSON.stringify({
                instanceName: `site-${Date.now()}-${i + 1}`,
                domain: domainList[i],
                resources,
              }),
            })
            created.push(domainList[i])
          }
          setResult({
            message: `✅ ${created.length} سایت با موفقیت ساخته شدند!`,
            details: domainList.join('، '),
          })
        }
      } else {
        // Enterprise: create instances one by one
        const created = []
        for (let i = 0; i < domainList.length; i++) {
          const planId = selectedPlans[i] || '3gb'
          const resources = buildResources(planId)
          const res = await apiCall('/instances', {
            method: 'POST',
            body: JSON.stringify({
              instanceName: `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              domain: domainList[i],
              resources,
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
      <style>{diskPlanStyles}</style>
      <div className="page-header">
        <h2 className="page-title">🛒 فروشگاه هاست وردپرس</h2>
        <p className="page-desc">
          یکی از پکیج‌های زیر را انتخاب کنید و برای هر سایت، فضای دلخواه (۱، ۳، ۵، ۱۰ یا ۲۵ گیگ) را انتخاب کنید
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-title">
                {showOrder.icon} سفارش {showOrder.name}
              </div>
              <button className="modal-close" onClick={() => setShowOrder(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="alert alert-info">
                💰 مبلغ پایه: {showOrder.price.toLocaleString('fa-IR')} تومان / ماه
                {showOrder.siteCount > 1 && ` (شامل ${showOrder.siteCount} سایت)`}
              </div>

              {error && <div className="alert alert-danger">{error}</div>}

              {/* انتخاب فضا برای هر سایت */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">💾 فضای دیسک هر سایت را انتخاب کنید</label>
                <div className="disk-plans-grid">
                  {diskPlans.map(plan => (
                    <div
                      key={plan.id}
                      className={`disk-plan-card ${(selectedPlans[0] === plan.id) ? 'selected' : ''}`}
                      onClick={() => {
                        const count = showOrder.siteCount || 1
                        const newPlans = {}
                        for (let i = 0; i < count; i++) {
                          newPlans[i] = plan.id
                        }
                        setSelectedPlans(newPlans)
                      }}
                    >
                      <span className="dcheck">{selectedPlans[0] === plan.id ? '✓' : ''}</span>
                      <div className="dicon">{plan.icon}</div>
                      <div className="dname">{plan.name}</div>
                      <div className="ddesc">{plan.desc}</div>
                      <div className="dprice">{plan.price.toLocaleString('fa-IR')} ت</div>
                      {plan.recommended && <div className="drec">⭐ پیشنهادی</div>}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 8 }}>
                  با انتخاب هر پلن، فضای مشخصی به کانتینر وردپرس و دیتابیس اختصاص داده می‌شود.
                </p>
              </div>

              {/* Summary */}
              <div className="space-summary">
                <div className="space-summary-row">
                  <span className="label">پلن انتخابی هر سایت:</span>
                  <span className="value">
                    {diskPlans.find(p => p.id === selectedPlans[0])?.name || '۳ گیگابایت'}
                  </span>
                </div>
                <div className="space-summary-row">
                  <span className="label">مجموع هزینه ماهانه:</span>
                  <span className="value" style={{ color: 'var(--primary)' }}>
                    {(getTotalPrice(showOrder) || showOrder.price).toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>

              {/* Domain inputs */}
              {showOrder.siteCount === 1 && (
                <div className="form-group" style={{ marginTop: 16 }}>
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

              {(showOrder.siteCount === 3 || showOrder.siteCount === 6 || showOrder.siteCount === null) && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--gray-500)' }}>
                    {showOrder.siteCount === null
                      ? 'لطفاً دامنه‌ها را وارد کنید (حداقل 1):'
                      : `لطفاً ${showOrder.siteCount} دامنه را وارد کنید:`}
                  </p>
                  {Array.from({ length: showOrder.siteCount === null ? 1 : showOrder.siteCount }).map((_, i) => (
                    <div className="site-order-block" key={i}>
                      <div className="site-order-header">
                        <span className="site-order-title">🌐 سایت {i + 1}</span>
                        <span className="site-total">
                          {diskPlans.find(p => p.id === selectedPlans[i])?.name || '۳ گیگابایت'}
                        </span>
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <input
                          className="form-input"
                          value={domains[i] || ''}
                          onChange={e => setDomains({ ...domains, [i]: e.target.value })}
                          placeholder={`domain${i + 1}.com`}
                          dir="ltr"
                        />
                      </div>
                      <div className="disk-plans-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                        {diskPlans.map(plan => (
                          <div
                            key={plan.id}
                            className={`disk-plan-card ${(selectedPlans[i] === plan.id) ? 'selected' : ''}`}
                            onClick={() => setSelectedPlans({ ...selectedPlans, [i]: plan.id })}
                            style={{ padding: 8 }}
                          >
                            <span className="dcheck">{selectedPlans[i] === plan.id ? '✓' : ''}</span>
                            <div className="dicon" style={{ fontSize: 18 }}>{plan.icon}</div>
                            <div className="dname" style={{ fontSize: 12 }}>{plan.name}</div>
                            <div className="dprice" style={{ fontSize: 11 }}>{plan.price.toLocaleString('fa-IR')} ت</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {showOrder.siteCount === null && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        const nextIndex = Object.keys(domains).length
                        setDomains({ ...domains, [nextIndex]: '' })
                        setSelectedPlans({ ...selectedPlans, [nextIndex]: '3gb' })
                      }}
                    >
                      + افزودن سایت دیگر (انترپرایز)
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--primary)' }}>
                مجموع: {(getTotalPrice(showOrder) || showOrder.price).toLocaleString('fa-IR')} تومان
              </span>
              <div>
                <button className="btn btn-secondary" onClick={() => setShowOrder(null)} disabled={loading}>
                  انصراف
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitOrder}
                  disabled={loading}
                  style={{ marginRight: 8 }}
                >
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'در حال ایجاد...' : 'تأیید و پرداخت'}
                </button>
              </div>
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
              <p style={{ fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'pre-line' }}>
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