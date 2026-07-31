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

  const handleDelete = async (name) => {
    if (!window.confirm(`آیا از حذف سرویس ${name} مطمئن هستید؟`)) return;
    try {
      await apiCall(`/instances/${name}`, "DELETE");
      setInstances((prev) => prev.filter((i) => i.instanceName !== name));
    } catch (err) {
      alert(`خطا در حذف سرویس: ${err.message || err}`);
    }
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="spinner" />
        <p>در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="dash-wrap">
      {/* ===== Top Bar ===== */}
      <div className="dash-topbar">
        <h1>هاست‌های من</h1>
        <div className="dash-topbar-actions">
          <div className="dash-search">
            <input
              type="text"
              placeholder="جستجوی سرویس یا دامنه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="dash-search-icon">🔍</span>
          </div>
          <button
            className="dash-buy-btn"
            onClick={() => navigate("/store")}
          >
            + خرید هاست جدید
          </button>
        </div>
      </div>

      {/* ===== Category Filter Cards ===== */}
      <div className="dash-cats">
        <div
          className={`dash-cat ${filter === "expired" ? "active" : ""}`}
          onClick={() => setFilter("expired")}
        >
          <div className="dash-cat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="dash-cat-label">هاست منقضی</div>
          <div className="dash-cat-count">۰ سرویس</div>
        </div>

        <div
          className={`dash-cat ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <div className="dash-cat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="dash-cat-label">همه سرویس‌ها</div>
          <div className="dash-cat-count">{instances.length} سرویس</div>
        </div>

        <div
          className={`dash-cat ${filter === "running" ? "active" : ""}`}
          onClick={() => setFilter("running")}
        >
          <div className="dash-cat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
            </svg>
          </div>
          <div className="dash-cat-label">هاست فعال</div>
          <div className="dash-cat-count">{runningCount} سرویس</div>
        </div>

        <div
          className={`dash-cat ${filter === "stopped" ? "active" : ""}`}
          onClick={() => setFilter("stopped")}
        >
          <div className="dash-cat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 9h4v6h-4z" fill="currentColor" />
            </svg>
          </div>
          <div className="dash-cat-label">غیر فعال</div>
          <div className="dash-cat-count">{stoppedCount} سرویس</div>
        </div>
      </div>

      {/* ===== Table Head ===== */}
      <div className="dash-table-head">
        <span>مشخصه سرویس</span>
        <span>موقعیت</span>
        <span>هزینه</span>
        <span>تاریخ سررسید</span>
        <span>عملیات</span>
      </div>

      {/* ===== Service Rows ===== */}
      {filteredInstances.length === 0 && (
        <div className="dash-empty">
          <div className="dash-empty-icon">📭</div>
          <h3>سرویسی یافت نشد</h3>
          <p>برای شروع یک هاست جدید خریداری کنید.</p>
          <button className="dash-buy-btn" onClick={() => navigate("/store")}>
            + خرید هاست جدید
          </button>
        </div>
      )}

      {filteredInstances.map((inst) => (
        <div
          key={inst.instanceName}
          className="dash-row"
          onClick={() => navigate(`/sites/${inst.instanceName}`)}
        >
          <div className="dash-svc-name">
            <div className="dash-svc-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <rect x="3" y="13" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="7" cy="7.5" r="1" fill="currentColor" />
                <circle cx="7" cy="16.5" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="dash-svc-title">
                <span className={`dash-dot ${inst.status === "running" ? "on" : "off"}`} style={{ marginInlineEnd: 6 }} />
                {inst.instanceName}
              </div>
              <div className="dash-svc-sub">
                {inst.status === "running" ? "هاست ابری" : "متوقف شده"}
              </div>
            </div>
          </div>

          <div>
            <span className="dash-loc-badge">🇮🇷 ایران</span>
          </div>

          <div className="dash-cost">رایگان</div>

          <div className="dash-due">{formatDate(inst.createdAt)}</div>

          <div>
            <div
              className="host-action-btn manage"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/sites/${inst.instanceName}`);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "middle", marginInlineEnd: 4 }}>
                <path d="M10 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              مدیریت سرویس
            </div>
          </div>
        </div>
      ))}

      {/* ===== Pagination ===== */}
      {filteredInstances.length > 8 && (
        <div className="dash-pagination">
          <span>
            نمایش ۱ تا ۸ از {filteredInstances.length} سرویس
          </span>
          <div className="dash-page-nav">
            <div className="dash-page-num">‹</div>
            <div className="dash-page-num active">۱</div>
            <div className="dash-page-num">›</div>
          </div>
        </div>
      )}
    </div>
  );
}