import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import InstanceDetail from "./InstanceDetail";

export default function Dashboard() {
  const { apiCall, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [inst, srv] = await Promise.all([
        apiCall("/instances"),
        apiCall("/server-info").catch(() => null),
      ]);
      setInstances(inst || []);
      setServerInfo(srv);

      if (isAdmin) {
        const s = await apiCall("/stats").catch(() => null);
        setStats(s);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  const runningCount = instances.filter((i) => i.status === "running").length;
  const stoppedCount = instances.filter((i) => i.status === "stopped").length;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ===== Server Status Banner ===== */}
      <div className="dash-status-banner">
        <span className="dash-status-text">وضعیت سرویس :</span>
        <span className="dash-status-badge">
          <span className="status-dot running" />
          فعال
        </span>
      </div>

      {/* ===== Server Info Row ===== */}
      <div className="dash-section">
        <h3 className="dash-section-title">اطلاعات سرویس</h3>
        <div className="dash-info-row">
          <div className="dash-info-item">
            <div className="dash-info-icon">🌐</div>
            <span className="dash-info-label">دامنه سرویس</span>
            <span className="dash-info-value link" dir="ltr">
              {user?.username ? `${user.username}.cloudyhost.org` : "-"}
            </span>
          </div>
          <div className="dash-info-item">
            <div className="dash-info-icon">📱</div>
            <span className="dash-info-label">پلن سرویس</span>
            <span className="dash-info-badge">رایگان</span>
          </div>
          <div className="dash-info-item">
            <div className="dash-info-icon">📍</div>
            <span className="dash-info-label">موقعیت سرور</span>
            <span className="dash-info-value">اروپا</span>
          </div>
          <div className="dash-info-item">
            <div className="dash-info-icon">🔧</div>
            <span className="dash-info-label">کنترل پنل</span>
            <span className="dash-info-value">Direct Admin</span>
          </div>
          <div className="dash-info-item">
            <div className="dash-info-icon">🔒</div>
            <span className="dash-info-label">مدیریت حساب</span>
            <button
              className="dash-info-btn"
              onClick={() => navigate("/profile")}
            >
              تغییر رمز
            </button>
          </div>
        </div>
      </div>

      {/* ===== Resources & Plan Details ===== */}
      <div className="dash-cards-row">
        {/* Resources Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>منابع</h3>
          </div>
          <div className="dash-card-body">
            <div className="dash-resources-grid">
              <div className="dash-resource">
                <span className="dash-resource-label">CPU</span>
                <span className="dash-resource-value">
                  {stats?.cpuCount || 1} هسته‌ای
                </span>
              </div>
              <div className="dash-resource">
                <span className="dash-resource-label">RAM</span>
                <span className="dash-resource-value">
                  {stats?.totalMemory
                    ? `${Math.round(stats.totalMemory / 1024)} گیگابایت`
                    : "1 گیگابایت"}
                </span>
              </div>
              <div className="dash-resource">
                <span className="dash-resource-label">Storage</span>
                <span className="dash-resource-value">100 گیگابایت</span>
              </div>
              <div className="dash-resource">
                <span className="dash-resource-label">Bandwidth</span>
                <span className="dash-resource-value">10 گیگابایت</span>
              </div>
            </div>
            <button
              className="dash-card-btn"
              onClick={() => navigate("/store")}
            >
              تغییر پلن
            </button>
          </div>
        </div>

        {/* Backup Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>بک‌آپ پلاس</h3>
          </div>
          <div className="dash-card-body dash-card-center">
            <div className="dash-backup-icon">☁️</div>
            <p className="dash-card-desc">
              هر روز به صورت خودکار از سرور شما یک نسخه بک‌آپ کامل (فایل +
              دیتابیس) تهیه می‌شود و این نسخه‌ها تا مدت روز قابل بازگردانی است.
            </p>
            <button className="dash-card-btn">فعال‌سازی بک‌آپ</button>
          </div>
        </div>

        {/* Plan Details Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>جزئیات پلن</h3>
          </div>
          <div className="dash-card-body">
            <div className="dash-plan-details">
              <div className="dash-plan-row">
                <span className="dash-plan-label">تاریخ سررسید:</span>
                <span className="dash-plan-value">-</span>
              </div>
              <div className="dash-plan-row">
                <span className="dash-plan-label">دوره هااست:</span>
                <span className="dash-plan-value">-</span>
              </div>
            </div>
            <button
              className="dash-card-btn"
              onClick={() => navigate("/sites")}
            >
              تمدید سرور
            </button>
          </div>
        </div>
      </div>

      {/* ===== Quick Actions ===== */}
      <div className="dash-actions-row">
        <button
          className="dash-action-btn primary"
          onClick={() => navigate("/store")}
        >
          🛒 خرید هاست جدید
        </button>
        <button
          className="dash-action-btn success"
          onClick={() => navigate("/sites")}
        >
          🌐 مدیریت سایت‌ها
        </button>
        {isAdmin && (
          <button
            className="dash-action-btn info"
            onClick={() => navigate("/admin")}
          >
            ⚙️ پنل مدیریت
          </button>
        )}
      </div>

      {/* ===== Sites Table ===== */}
      {instances.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>📋 سایت‌های فعال</h3>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => navigate("/sites")}
            >
              مشاهده همه
            </button>
          </div>
          <div className="dash-card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>دامنه</th>
                    <th>وضعیت</th>
                    <th>تاریخ ایجاد</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {instances.slice(0, 5).map((inst) => (
                    <tr key={inst.instanceName}>
                      <td
                        style={{
                          fontWeight: "bold",
                          cursor: "pointer",
                          color: "var(--primary)",
                        }}
                        onClick={() => setSelectedInstance(inst.instanceName)}
                      >
                        {inst.instanceName}
                      </td>
                      <td dir="ltr">{inst.domain}</td>
                      <td>
                        <span className="instance-status">
                          <span
                            className={`status-dot ${inst.status === "running" ? "running" : "stopped"}`}
                          />
                          {inst.status === "running" ? "فعال" : "متوقف"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {inst.createdAt
                          ? new Date(inst.createdAt).toLocaleDateString("fa-IR")
                          : "-"}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setSelectedInstance(inst.instanceName)}
                        >
                          جزئیات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
