import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import InstanceDetail from "./InstanceDetail";

export default function Dashboard() {
  const { apiCall, user } = useAuth();
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

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
  const totalCount = instances.length;
  const domainCount = instances.filter((i) => i.domain).length;

  // فیلتر بر اساس تب و جستجو
  const filteredInstances = instances.filter((inst) => {
    const matchesTab =
      activeTab === "all" ? true : activeTab === "running" ? inst.status === "running" : inst.status === "stopped";
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (inst.instanceName || "").toLowerCase().includes(q) ||
      (inst.domain || "").toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  // صفحه‌بندی
  const totalPages = Math.max(1, Math.ceil(filteredInstances.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredInstances.slice((safePage - 1) * perPage, safePage * perPage);

  const goToPage = (p) => {
    const target = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(target);
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

  const stats = [
    {
      label: "کل سرویس‌ها",
      value: totalCount,
      icon: "🖥️",
      color: "primary",
      desc: "مجموع هاست‌ها",
    },
    {
      label: "سرویس‌های فعال",
      value: runningCount,
      icon: "🟢",
      color: "success",
      desc: "در حال اجرا",
    },
    {
      label: "سرویس‌های متوقف",
      value: stoppedCount,
      icon: "⏸️",
      color: "warning",
      desc: "غیرفعال",
    },
    {
      label: "دامنه‌های متصل",
      value: domainCount,
      icon: "🌐",
      color: "info",
      desc: "متصل شده",
    },
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="my-hosts">
      {/* ===== Welcome Banner ===== */}
      <div className="dash-welcome-banner">
        <div className="dash-welcome-content">
          <div className="dash-welcome-icon">
            {user?.username?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="dash-welcome-text">
            <h2>خوش آمدید، {user?.username || "کاربر"} 👋</h2>
            <p>مدیریت سرویس‌های میزبانی وب شما در یک نگاه</p>
          </div>
        </div>
        <div className="dash-welcome-badge">
          <span className="status-dot running" />
          سیستم فعال
        </div>
      </div>

      {/* ===== Stats Cards ===== */}
      <div className="dash-stats-grid">
        {stats.map((s) => (
          <div key={s.label} className={`dash-stat-card ${s.color}`}>
            <div className="dash-stat-icon">{s.icon}</div>
            <div className="dash-stat-info">
              <div className="dash-stat-value">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
              <div className="dash-stat-desc">{s.desc}</div>
            </div>
            <div className="dash-stat-glow" />
          </div>
        ))}
      </div>

      {/* ===== Header ===== */}
      <div className="hosts-header">
        <div className="hosts-title">
          <h2>📦 سرویس‌های من</h2>
          <span className="hosts-subtitle">مدیریت و نظارت بر هاست‌های خود</span>
        </div>
        <div className="hosts-header-actions">
          <div className="hosts-search">
            <span className="hosts-search-icon">🔍</span>
            <input
              type="text"
              placeholder="جستجوی سرویس یا دامنه..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <button
            className="btn btn-primary hosts-buy-btn"
            onClick={() => navigate("/store")}
          >
            + خرید هاست جدید
          </button>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="hosts-tabs">
        <button
          className={`hosts-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("all");
            setCurrentPage(1);
          }}
        >
          همه سرویس‌ها
          <span className="hosts-tab-count">{instances.length}</span>
        </button>
        <button
          className={`hosts-tab ${activeTab === "running" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("running");
            setCurrentPage(1);
          }}
        >
          هاست فعال
          <span className="hosts-tab-count">{runningCount}</span>
        </button>
        <button
          className={`hosts-tab ${activeTab === "stopped" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("stopped");
            setCurrentPage(1);
          }}
        >
          غیر فعال
          <span className="hosts-tab-count">{stoppedCount}</span>
        </button>
      </div>

      {/* ===== Table ===== */}
      <div className="hosts-table-card">
        <div className="table-wrapper">
          <table className="hosts-table">
            <thead>
              <tr>
                <th>مشخصات سرویس</th>
                <th>موقعیت</th>
                <th>هزینه</th>
                <th>تاریخ سررسید</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="icon">📭</div>
                      <h3>سرویسی یافت نشد</h3>
                      <p>برای شروع یک هاست جدید خریداری کنید.</p>
                    </div>
                  </td>
                </tr>
              )}
              {paginated.map((inst) => (
                <tr key={inst.instanceName}>
                  {/* مشخصات سرویس */}
                  <td>
                    <div className="host-service">
                      <div className="host-service-icon">
                        {inst.status === "running" ? "🟢" : "⭕"}
                      </div>
                      <div className="host-service-info">
                        <div className="host-service-name">
                          {inst.instanceName}
                        </div>
                        <div className="host-service-domain" dir="ltr">
                          {inst.domain || "-"}
                        </div>
                        <div className="host-service-status">
                          <span
                            className={`status-dot ${inst.status === "running" ? "running" : "stopped"}`}
                          />
                          {inst.status === "running" ? "فعال" : "متوقف"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* موقعیت */}
                  <td>
                    <div className="host-location">
                      <span className="host-location-flag">🇪🇺</span>
                      اروپا
                    </div>
                  </td>

                  {/* هزینه */}
                  <td>
                    <span className="host-price">رایگان</span>
                  </td>

                  {/* تاریخ سررسید */}
                  <td className="host-due-date">
                    {inst.createdAt
                      ? new Date(inst.createdAt).toLocaleDateString("fa-IR")
                      : "-"}
                  </td>

                  {/* عملیات */}
                  <td>
                    <div className="host-actions">
                      <button
                        className="host-action-btn manage"
                        onClick={() => setSelectedInstance(inst.instanceName)}
                      >
                        مدیریت
                      </button>
                      <button
                        className="host-action-btn delete"
                        onClick={() => handleDelete(inst.instanceName)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Pagination ===== */}
        {totalPages > 1 && (
          <div className="hosts-pagination">
            <button
              className="hosts-page-btn"
              disabled={safePage === 1}
              onClick={() => goToPage(safePage - 1)}
            >
              قبلی
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`hosts-page-btn ${p === safePage ? "active" : ""}`}
                onClick={() => goToPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="hosts-page-btn"
              disabled={safePage === totalPages}
              onClick={() => goToPage(safePage + 1)}
            >
              بعدی
            </button>
          </div>
        )}
      </div>

      {/* ===== Embedded Site Details ===== */}
      {selectedInstance && (
        <div className="dash-card" style={{ marginTop: 16 }}>
          <div className="dash-card-header">
            <h3>📋 جزئیات سایت</h3>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setSelectedInstance(null)}
            >
              بستن ✕
            </button>
          </div>
          <div className="dash-card-body">
            <InstanceDetail instanceName={selectedInstance} embedded />
          </div>
        </div>
      )}
    </div>
  );
}