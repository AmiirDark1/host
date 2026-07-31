import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { apiCall, user } = useAuth();
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inst = await apiCall("/instances");
        if (!cancelled) setInstances(inst || []);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiCall]);

  const runningCount = instances.filter((i) => i.status === "running").length;
  const stoppedCount = instances.filter((i) => i.status === "stopped").length;
  const sslActive = instances.filter((i) => i.sslStatus === "active").length;
  const activeDomains = instances.filter((i) => i.domain && i.status === "running").length;

  const filteredInstances = instances.filter((inst) => {
    const matchesFilter =
      filter === "all" ? true : filter === "running" ? inst.status === "running" : inst.status === "stopped";
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (inst.instanceName || "").toLowerCase().includes(q) ||
      (inst.domain || "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const formatDate = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("fa-IR");
    } catch {
      return "-";
    }
  };

  const handleDelete = async (name, e) => {
    e?.stopPropagation();
    if (!window.confirm(`آیا از حذف سرویس ${name} مطمئن هستید؟`)) return;
    try {
      await apiCall(`/instances/${name}`, "DELETE");
      setInstances((prev) => prev.filter((i) => i.instanceName !== name));
    } catch (err) {
      alert(`خطا در حذف سرویس: ${err.message || err}`);
    }
  };

  const handleToggle = async (inst, e) => {
    e?.stopPropagation();
    try {
      if (inst.status === "running") {
        await apiCall(`/instances/${inst.instanceName}/stop`, { method: "POST" });
      } else {
        await apiCall(`/instances/${inst.instanceName}/start`, { method: "POST" });
      }
      setInstances((prev) =>
        prev.map((i) =>
          i.instanceName === inst.instanceName
            ? { ...i, status: inst.status === "running" ? "stopped" : "running" }
            : i
        )
      );
    } catch (err) {
      alert(`خطا: ${err.message || err}`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const inst = await apiCall("/instances");
      setInstances(inst || []);
    } catch (err) {
      console.error("Error refreshing:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="mdash-loading">
        <div className="mdash-spinner" />
        <p>در حال بارگذاری داشبورد...</p>
      </div>
    );
  }

  const firstName = user?.fullName?.split(" ")[0] || user?.username || "کاربر";

  return (
    <div className="mdash">
      {/* ===== Hero / Welcome ===== */}
      <div className="mdash-hero">
        <div className="mdash-hero-text">
          <h1>سلام {firstName} 👋</h1>
          <p>به پنل مدیریت هاست‌های خود خوش آمدید. همه سرویس‌های شما در یک نگاه.</p>
        </div>
        <div className="mdash-hero-actions">
          <button
            className="mdash-btn mdash-btn-ghost"
            onClick={handleRefresh}
            title="به‌روزرسانی"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginInlineEnd: 6 }}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {refreshing ? "در حال به‌روزرسانی..." : "تازه‌سازی"}
          </button>
          <button className="mdash-btn mdash-btn-primary" onClick={() => navigate("/store")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginInlineEnd: 6 }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            خرید هاست جدید
          </button>
        </div>
      </div>

      {/* ===== Stats Cards ===== */}
      <div className="mdash-stats">
        <div className="mdash-stat">
          <div className="mdash-stat-icon primary-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="3" y="13" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="7" cy="7.5" r="1.2" fill="currentColor" />
              <circle cx="7" cy="16.5" r="1.2" fill="currentColor" />
            </svg>
          </div>
          <div className="mdash-stat-info">
            <div className="mdash-stat-value">{instances.length}</div>
            <div className="mdash-stat-label">کل سرویس‌ها</div>
            <div className="mdash-stat-trend up">+{runningCount} فعال</div>
          </div>
        </div>

        <div className="mdash-stat">
          <div className="mdash-stat-icon green-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
            </svg>
          </div>
          <div className="mdash-stat-info">
            <div className="mdash-stat-value">{runningCount}</div>
            <div className="mdash-stat-label">سرویس فعال</div>
            <div className="mdash-stat-trend up">در حال اجرا</div>
          </div>
        </div>

        <div className="mdash-stat">
          <div className="mdash-stat-icon red-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 9h4v6h-4z" fill="currentColor" />
            </svg>
          </div>
          <div className="mdash-stat-info">
            <div className="mdash-stat-value">{stoppedCount}</div>
            <div className="mdash-stat-label">متوقف</div>
            <div className="mdash-stat-trend down">غیرفعال</div>
          </div>
        </div>

        <div className="mdash-stat">
          <div className="mdash-stat-icon blue-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="mdash-stat-info">
            <div className="mdash-stat-value">{sslActive}</div>
            <div className="mdash-stat-label">SSL فعال</div>
            <div className="mdash-stat-trend up">{activeDomains} دامنه</div>
          </div>
        </div>
      </div>

      {/* ===== My Sites Section ===== */}
      <div className="mdash-section">
        <div className="mdash-section-head">
          <div className="mdash-section-title">
            <h2>🌐 سایت‌های من</h2>
            <p>{filteredInstances.length} سایت در حساب شما</p>
          </div>
          <div className="mdash-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mdash-search-icon">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="جستجوی سایت یا دامنه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mdash-tabs">
          <button className={`mdash-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            همه سایت‌ها
            <span className="mdash-tab-count">{instances.length}</span>
          </button>
          <button className={`mdash-tab ${filter === "running" ? "active" : ""}`} onClick={() => setFilter("running")}>
            <span className="mdash-tab-dot on" />
            فعال
            <span className="mdash-tab-count">{runningCount}</span>
          </button>
          <button className={`mdash-tab ${filter === "stopped" ? "active" : ""}`} onClick={() => setFilter("stopped")}>
            <span className="mdash-tab-dot off" />
            متوقف
            <span className="mdash-tab-count">{stoppedCount}</span>
          </button>
        </div>

        {/* Site Cards Grid */}
        {filteredInstances.length === 0 ? (
          <div className="mdash-empty">
            <div className="mdash-empty-icon">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>{searchQuery ? "سایتی یافت نشد" : "هنوز سایتی ندارید"}</h3>
            <p>
              {searchQuery
                ? `نتیجه‌ای برای «${searchQuery}» پیدا نشد`
                : "همین حالا اولین هاست خود را خریداری کنید و وبسایت خود را آنلاین کنید"}
            </p>
            {!searchQuery && (
              <button className="mdash-btn mdash-btn-primary" onClick={() => navigate("/store")}>
                + خرید هاست جدید
              </button>
            )}
          </div>
        ) : (
          <div className="mdash-grid">
            {filteredInstances.map((inst) => (
              <div
                key={inst.instanceName}
                className={`mdash-site-card ${inst.status === "running" ? "running" : "stopped"}`}
                onClick={() => navigate(`/sites/${inst.instanceName}`)}
              >
                {/* Cover / Header */}
                <div className="mdash-site-cover">
                  <div className="mdash-site-cover-top">
                    <div className="mdash-site-logo">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M4 12h16M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="mdash-site-title">
                      <h3>{inst.instanceName}</h3>
                      <a
                        href={inst.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mdash-site-domain"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginInlineEnd: 4 }}>
                          <path d="M10 14L20 4M20 4h-6M20 4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {inst.domain || "بدون دامنه"}
                      </a>
                    </div>
                    <div className={`mdash-site-badge ${inst.status}`}>
                      <span className="mdash-site-badge-dot" />
                      {inst.status === "running" ? "فعال" : "متوقف"}
                    </div>
                  </div>
                  <div className="mdash-site-cover-glow" />
                </div>

                {/* Details */}
                <div className="mdash-site-details">
                  <div className="mdash-site-detail">
                    <span className="mdash-site-detail-icon">🌍</span>
                    <span className="mdash-site-detail-label">موقعیت</span>
                    <span className="mdash-site-detail-value">🇮🇷 ایران</span>
                  </div>
                  <div className="mdash-site-detail">
                    <span className="mdash-site-detail-icon">🛡️</span>
                    <span className="mdash-site-detail-label">SSL</span>
                    <span className={`mdash-site-detail-value ${inst.sslStatus === "active" ? "ssl-ok" : "ssl-pending"}`}>
                      {inst.sslStatus === "active" ? "فعال ✓" : inst.sslStatus === "pending" ? "در انتظار" : "—"}
                    </span>
                  </div>
                  <div className="mdash-site-detail">
                    <span className="mdash-site-detail-icon">💳</span>
                    <span className="mdash-site-detail-label">هزینه</span>
                    <span className="mdash-site-detail-value mdash-free">رایگان</span>
                  </div>
                  <div className="mdash-site-detail">
                    <span className="mdash-site-detail-icon">📅</span>
                    <span className="mdash-site-detail-label">ایجاد</span>
                    <span className="mdash-site-detail-value">{formatDate(inst.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mdash-site-actions">
                  <button
                    className="mdash-site-btn manage"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sites/${inst.instanceName}`);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", marginInlineEnd: 5 }}>
                      <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    مدیریت
                  </button>
                  <button className="mdash-site-btn startstop" onClick={(e) => handleToggle(inst, e)}>
                    {inst.status === "running" ? "توقف" : "شروع"}
                  </button>
                  <button className="mdash-site-btn delete" onClick={(e) => handleDelete(inst.instanceName, e)}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}