import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function InstanceDetail() {
  const { instanceName } = useParams();
  const { apiCall } = useAuth();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("info");
  const [logs, setLogs] = useState("");
  const [logsType, setLogsType] = useState("wp");
  const [logsLoading, setLogsLoading] = useState(false);
  const [resourceUsage, setResourceUsage] = useState(null);

  // File Manager state
  const [fmContainerType, setFmContainerType] = useState("wp");
  const [fmPath, setFmPath] = useState("/");
  const [fmEntries, setFmEntries] = useState([]);
  const [fmLoading, setFmLoading] = useState(false);
  const [fmError, setFmError] = useState(null);
  const [fmEditing, setFmEditing] = useState(null);
  const [fmEditContent, setFmEditContent] = useState("");
  const [fmMsg, setFmMsg] = useState(null);
  const [fmHistory, setFmHistory] = useState(["/"]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadInstance();
  }, [instanceName]);

  useEffect(() => {
    if (tab === "logs") loadLogs();
    if (tab === "resources") loadResourceUsage();
  }, [tab, logsType]);

  useEffect(() => {
    if (tab === "files" && instance?.status === "running") loadFmList();
  }, [tab, fmPath, fmContainerType]);

  async function loadInstance() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall(`/instances/${instanceName}`);
      setInstance(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const data = await apiCall(
        `/instances/${instanceName}/logs?type=${logsType}&lines=100`,
      );
      setLogs(data.logs || "داده‌ای برای نمایش وجود ندارد");
    } catch (err) {
      setLogs("خطا در دریافت لاگ‌ها");
    } finally {
      setLogsLoading(false);
    }
  }

  async function loadResourceUsage() {
    try {
      const data = await apiCall(`/resource-usage/instance/${instanceName}`);
      setResourceUsage(data);
    } catch (err) {
      setResourceUsage(null);
    }
  }

  async function handleAction(action) {
    try {
      if (action === "start")
        await apiCall(`/instances/${instanceName}/start`, { method: "POST" });
      else if (action === "stop")
        await apiCall(`/instances/${instanceName}/stop`, { method: "POST" });
      await loadInstance();
    } catch (err) {
      alert(err.message);
    }
  }

  // =============================================================
  // File Manager Functions
  // =============================================================

  function showMsg(text, isError = false) {
    setFmMsg({ text, isError });
    setTimeout(() => setFmMsg(null), 3000);
  }

  async function loadFmList() {
    setFmLoading(true);
    setFmError(null);
    try {
      const data = await apiCall(
        `/filemanager/list?instanceName=${instanceName}&containerType=${fmContainerType}&path=${encodeURIComponent(fmPath)}`,
      );
      if (data.success) {
        setFmEntries(parseLsOutput(data.output));
      } else {
        setFmError(data.error || "Failed to list files");
      }
    } catch (err) {
      setFmError(err.message);
    } finally {
      setFmLoading(false);
    }
  }

  function parseLsOutput(output) {
    const lines = output.split("\n").filter((l) => l.trim());
    const entries = [];
    for (const line of lines) {
      if (line.startsWith("total ")) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      const perms = parts[0];
      const size = parseInt(parts[4]) || 0;
      const name = parts.slice(8).join(" ");
      if (name === "." || name === "..") continue;
      const isDir = perms.startsWith("d");
      entries.push({
        name,
        isDir,
        size,
        perms,
        path: fmPath === "/" ? `/${name}` : `${fmPath}/${name}`,
      });
    }
    return entries;
  }

  function navigateToDir(dirPath) {
    setFmHistory((prev) => [...prev, dirPath]);
    setFmPath(dirPath);
  }

  function goBack() {
    if (fmHistory.length > 1) {
      const newHistory = fmHistory.slice(0, -1);
      setFmHistory(newHistory);
      setFmPath(newHistory[newHistory.length - 1]);
    }
  }

  function isTextFile(name) {
    const ext = name.split(".").pop().toLowerCase();
    return [
      "txt",
      "php",
      "html",
      "css",
      "js",
      "json",
      "xml",
      "md",
      "yml",
      "yaml",
      "conf",
      "cfg",
      "ini",
      "env",
      "sql",
      "htaccess",
      "php7",
      "php8",
      "twig",
      "jsx",
      "ts",
      "tsx",
      "vue",
      "scss",
      "less",
      "log",
      "sh",
      "bash",
      "py",
      "rb",
      "go",
      "java",
      "c",
      "cpp",
      "h",
      "hpp",
    ].includes(ext);
  }

  function formatSize(bytes) {
    if (bytes === 0) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getIcon(entry) {
    if (entry.isDir) return "📁";
    const ext = entry.name.split(".").pop()?.toLowerCase();
    if (["php", "php7", "php8"].includes(ext)) return "🐘";
    if (["html", "htm"].includes(ext)) return "🌐";
    if (["css", "scss", "less"].includes(ext)) return "🎨";
    if (["js", "jsx", "ts", "tsx", "vue"].includes(ext)) return "📜";
    if (["json", "xml", "yml", "yaml"].includes(ext)) return "📋";
    if (["png", "jpg", "jpeg", "gif", "svg", "ico", "webp"].includes(ext))
      return "🖼️";
    if (["zip", "tar", "gz", "rar"].includes(ext)) return "🗜️";
    if (["sql", "db"].includes(ext)) return "🗄️";
    if (["md", "txt", "log"].includes(ext)) return "📄";
    if (["sh", "bash"].includes(ext)) return "⚙️";
    if (["conf", "cfg", "ini", "env", "htaccess"].includes(ext)) return "⚡";
    return "📄";
  }

  async function openFile(entry) {
    try {
      const data = await apiCall(
        `/filemanager/read?instanceName=${instanceName}&containerType=${fmContainerType}&filePath=${encodeURIComponent(entry.path)}`,
      );
      if (data.success) {
        setFmEditing({ path: entry.path, name: entry.name });
        setFmEditContent(data.content);
      } else {
        showMsg(data.error || "Failed to read file", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function saveFile() {
    if (!fmEditing) return;
    try {
      const data = await apiCall(`/filemanager/write`, {
        method: "POST",
        body: {
          instanceName,
          containerType: fmContainerType,
          filePath: fmEditing.path,
          content: fmEditContent,
        },
      });
      if (data.success) {
        showMsg("✅ فایل ذخیره شد");
        setFmEditing(null);
        setFmEditContent("");
        loadFmList();
      } else {
        showMsg(data.error || "Failed to save file", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function deleteEntry(entry) {
    if (!window.confirm(`آیا از حذف "${entry.name}" مطمئن هستید؟`)) return;
    try {
      const data = await apiCall(`/filemanager/delete`, {
        method: "DELETE",
        body: {
          instanceName,
          containerType: fmContainerType,
          filePath: entry.path,
        },
      });
      if (data.success) {
        showMsg(`✅ ${entry.isDir ? "پوشه" : "فایل"} "${entry.name}" حذف شد`);
        loadFmList();
      } else {
        showMsg(data.error || "Failed to delete", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function createDir() {
    const dirName = prompt("نام پوشه جدید:");
    if (!dirName) return;
    const newPath = fmPath === "/" ? `/${dirName}` : `${fmPath}/${dirName}`;
    try {
      const data = await apiCall(`/filemanager/mkdir`, {
        method: "POST",
        body: {
          instanceName,
          containerType: fmContainerType,
          dirPath: newPath,
        },
      });
      if (data.success) {
        showMsg(`✅ پوشه "${dirName}" ساخته شد`);
        loadFmList();
      } else {
        showMsg(data.error || "Failed to create directory", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function uploadFile() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target.result;
      const destPath =
        fmPath === "/" ? `/${file.name}` : `${fmPath}/${file.name}`;
      try {
        const data = await apiCall(`/filemanager/upload`, {
          method: "POST",
          body: {
            instanceName,
            containerType: fmContainerType,
            destPath,
            content,
          },
        });
        if (data.success) {
          showMsg(`✅ فایل "${file.name}" آپلود شد`);
          loadFmList();
        } else {
          showMsg(data.error || "Failed to upload", true);
        }
      } catch (err) {
        showMsg(err.message, true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // =============================================================
  // Resource Meter sub-component
  // =============================================================
  function ResourceMeter({ label, used, limit, unit }) {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const color = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
    return (
      <div className="resource-meter">
        <div className="resource-meter-label">
          <span>{label}</span>
          <span>
            {used?.toFixed(1) || 0} / {limit || "∞"} {unit}
          </span>
        </div>
        <div className="resource-meter-bar">
          <div
            className={`resource-meter-fill ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // =============================================================
  // Loading / Error states
  // =============================================================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p>در حال بارگذاری...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
        <button
          className="btn btn-sm btn-outline"
          onClick={() => navigate("/sites")}
        >
          بازگشت به لیست
        </button>
      </div>
    );
  }

  // =============================================================
  // Main Render
  // =============================================================
  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => navigate("/sites")}
          >
            ←
          </button>
          <div>
            <h2 className="page-title">{instanceName}</h2>
            <p className="page-desc">
              {instance?.domain && <span dir="ltr">{instance.domain}</span>}
              {instance?.domain && " | "}
              وضعیت: {instance?.status === "running" ? "فعال" : "متوقف"}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        {instance?.domain && (
          <a
            href={`http://${instance.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-success"
          >
            🌐 باز کردن سایت
          </a>
        )}
        {instance?.domain && (
          <a
            href={`http://${instance.domain}/wp-admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-info"
          >
            🔑 ورود به وردپرس
          </a>
        )}
        {instance?.status === "running" ? (
          <button
            className="btn btn-warning"
            onClick={() => handleAction("stop")}
          >
            ⏹ توقف
          </button>
        ) : (
          <button
            className="btn btn-success"
            onClick={() => handleAction("start")}
          >
            ▶ شروع
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${tab === "info" ? "active" : ""}`}
          onClick={() => setTab("info")}
        >
          📋 اطلاعات
        </div>
        <div
          className={`tab ${tab === "logs" ? "active" : ""}`}
          onClick={() => setTab("logs")}
        >
          📜 لاگ‌ها
        </div>
        <div
          className={`tab ${tab === "resources" ? "active" : ""}`}
          onClick={() => setTab("resources")}
        >
          📊 منابع
        </div>
        <div
          className={`tab ${tab === "files" ? "active" : ""}`}
          onClick={() => setTab("files")}
        >
          📁 فایل‌ها
        </div>
      </div>

      {/* ============== Info Tab ============== */}
      {tab === "info" && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 اطلاعات نمونه</div>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  نام نمونه
                </p>
                <p style={{ fontWeight: "bold" }}>{instanceName}</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>دامنه</p>
                <p style={{ fontWeight: "bold", direction: "ltr" }}>
                  {instance?.domain || "-"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>وضعیت</p>
                <span
                  className={`badge ${instance?.status === "running" ? "badge-success" : "badge-danger"}`}
                >
                  {instance?.status === "running" ? "فعال" : "متوقف"}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--gray-500)" }}>
                  تاریخ ایجاد
                </p>
                <p>
                  {instance?.createdAt
                    ? new Date(instance.createdAt).toLocaleDateString("fa-IR")
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============== Logs Tab ============== */}
      {tab === "logs" && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📜 لاگ‌ها</div>
            <div className="flex" style={{ gap: 8 }}>
              <select
                className="form-select"
                style={{ width: "auto", padding: "6px 10px" }}
                value={logsType}
                onChange={(e) => setLogsType(e.target.value)}
              >
                <option value="wp">وردپرس</option>
                <option value="db">دیتابیس</option>
              </select>
              <button className="btn btn-sm btn-outline" onClick={loadLogs}>
                🔄 بروزرسانی
              </button>
            </div>
          </div>
          <div className="card-body">
            {logsLoading ? (
              <div className="loading-screen">
                <div className="spinner" />
              </div>
            ) : (
              <pre
                style={{
                  background: "#1a1a2e",
                  color: "#a5d6ff",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  direction: "ltr",
                  textAlign: "left",
                  maxHeight: 400,
                  overflow: "auto",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                {logs}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ============== Resources Tab ============== */}
      {tab === "resources" && (
        <div>
          {resourceUsage ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📊 مصرف منابع - وردپرس</div>
                </div>
                <div className="card-body">
                  {resourceUsage.wordpress ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.wordpress.cpuPercent || 0}
                        limit={resourceUsage.wordpress.cpuLimit || 100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={
                          (resourceUsage.wordpress.memoryBytes || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.wordpress.memoryLimit ||
                            512 * 1024 * 1024) /
                          (1024 * 1024)
                        }
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (WP)"
                        used={
                          (resourceUsage.wordpress.diskBytes || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.wordpress.diskLimit || 3000) /
                            (1024 * 1024) || 3000
                        }
                        unit="MB"
                      />
                    </div>
                  ) : (
                    <p className="text-muted">داده‌ای موجود نیست</p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">📊 مصرف منابع - دیتابیس</div>
                </div>
                <div className="card-body">
                  {resourceUsage.database ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.database.cpuPercent || 0}
                        limit={resourceUsage.database.cpuLimit || 100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={
                          (resourceUsage.database.memoryBytes || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.database.memoryLimit ||
                            512 * 1024 * 1024) /
                          (1024 * 1024)
                        }
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (DB)"
                        used={
                          (resourceUsage.database.diskBytes || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.database.diskLimit || 1000) /
                            (1024 * 1024) || 1000
                        }
                        unit="MB"
                      />
                    </div>
                  ) : (
                    <p className="text-muted">داده‌ای موجود نیست</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="icon">📊</div>
                  <h3>داده‌ای موجود نیست</h3>
                  <p>برای مشاهده مصرف منابع، سایت باید فعال باشد</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============== Files Tab ============== */}
      {tab === "files" && (
        <div>
          {/* File Manager notification */}
          {fmMsg && (
            <div
              className={`alert ${fmMsg.isError ? "alert-danger" : "alert-success"}`}
              style={{ marginBottom: 12 }}
            >
              {fmMsg.text}
            </div>
          )}

          {/* Toolbar */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div
              className="card-body"
              style={{
                padding: "10px 16px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <select
                className="form-select"
                style={{ width: "auto", padding: "6px 10px" }}
                value={fmContainerType}
                onChange={(e) => {
                  setFmContainerType(e.target.value);
                  setFmHistory(["/"]);
                  setFmPath("/");
                }}
              >
                <option value="wp">📦 وردپرس</option>
                <option value="db">🗄️ دیتابیس</option>
              </select>

              <div
                className="flex"
                style={{ gap: 4, alignItems: "center", flex: 1 }}
              >
                <button
                  className="btn btn-sm btn-outline"
                  onClick={goBack}
                  disabled={fmHistory.length <= 1}
                >
                  ⬅
                </button>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--gray-500)",
                    direction: "ltr",
                  }}
                >
                  {fmContainerType === "wp"
                    ? "/var/www/html"
                    : "/var/lib/mysql"}
                  {fmPath}
                </span>
              </div>

              <button className="btn btn-sm btn-primary" onClick={createDir}>
                📁 پوشه جدید
              </button>
              <button className="btn btn-sm btn-success" onClick={uploadFile}>
                📤 آپلود
              </button>
              <button className="btn btn-sm btn-outline" onClick={loadFmList}>
                🔄
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          {/* File list */}
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              {fmLoading ? (
                <div className="loading-screen" style={{ padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : fmError ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="icon">⚠️</div>
                  <h3>خطا</h3>
                  <p>{fmError}</p>
                  <p style={{ fontSize: 12, color: "var(--gray-400)" }}>
                    توجه: کانتینر وردپرس باید در حال اجرا باشد
                  </p>
                </div>
              ) : fmEntries.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="icon">📂</div>
                  <h3>پوشه خالی است</h3>
                </div>
              ) : (
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40%" }}>نام</th>
                      <th style={{ width: "15%" }}>اندازه</th>
                      <th style={{ width: "25%" }}>مجوزها</th>
                      <th style={{ width: "20%" }}>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fmEntries.map((entry, idx) => (
                      <tr key={idx}>
                        <td>
                          <span
                            style={{
                              cursor: entry.isDir ? "pointer" : "default",
                              fontWeight: entry.isDir ? 600 : 400,
                            }}
                            onClick={() =>
                              entry.isDir
                                ? navigateToDir(entry.path)
                                : isTextFile(entry.name)
                                  ? openFile(entry)
                                  : null
                            }
                          >
                            {getIcon(entry)} {entry.name}
                          </span>
                        </td>
                        <td>{formatSize(entry.size)}</td>
                        <td
                          style={{
                            fontSize: 12,
                            direction: "ltr",
                            fontFamily: "monospace",
                          }}
                        >
                          {entry.perms}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {!entry.isDir && isTextFile(entry.name) && (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => openFile(entry)}
                              >
                                ✏️
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteEntry(entry)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* File Editor Modal */}
          {fmEditing && (
            <div
              className="modal-overlay"
              onClick={() => {
                setFmEditing(null);
                setFmEditContent("");
              }}
            >
              <div
                className="modal"
                style={{ width: "80%", maxWidth: 900 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>✏️ ویرایش: {fmEditing.name}</h3>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setFmEditing(null);
                      setFmEditContent("");
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                  <textarea
                    style={{
                      width: "100%",
                      height: 500,
                      border: "none",
                      padding: 16,
                      fontSize: 13,
                      fontFamily: "monospace",
                      direction: "ltr",
                      textAlign: "left",
                      background: "#1a1a2e",
                      color: "#a5d6ff",
                      resize: "vertical",
                      outline: "none",
                      lineHeight: 1.6,
                    }}
                    value={fmEditContent}
                    onChange={(e) => setFmEditContent(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setFmEditing(null);
                      setFmEditContent("");
                    }}
                  >
                    انصراف
                  </button>
                  <button className="btn btn-primary" onClick={saveFile}>
                    💾 ذخیره
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
