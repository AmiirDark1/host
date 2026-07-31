import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function InstanceDetail({
  instanceName: propInstanceName,
  embedded = false,
}) {
  const { instanceName: paramInstanceName } = useParams();
  const { apiCall } = useAuth();
  const navigate = useNavigate();
  // وقتی که به صورت جاسازی‌شده (Dashboard) استفاده می‌شود، نام نمونه از prop می‌آید
  const instanceName = propInstanceName || paramInstanceName;
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("info");
  const [logs, setLogs] = useState("");
  const [logsType, setLogsType] = useState("wp");
  const [logsLoading, setLogsLoading] = useState(false);
  const [resourceUsage, setResourceUsage] = useState(null);

  // File Manager state - always locked to wp /var/www/html
  const WP_BASE = "/var/www/html";
  const [fmPath, setFmPath] = useState(WP_BASE);
  const [fmEntries, setFmEntries] = useState([]);
  const [fmLoading, setFmLoading] = useState(false);
  const [fmError, setFmError] = useState(null);
  const [fmEditing, setFmEditing] = useState(null);
  const [fmEditContent, setFmEditContent] = useState("");
  const [fmMsg, setFmMsg] = useState(null);
  const [fmHistory, setFmHistory] = useState([WP_BASE]);
  const [fmSelected, setFmSelected] = useState([]);
  const [fmRenaming, setFmRenaming] = useState(null);
  const [fmRenameValue, setFmRenameValue] = useState("");
  const [fmMoveDialog, setFmMoveDialog] = useState(null); // {type: 'copy'|'move', entry}
  const [fmMoveDest, setFmMoveDest] = useState("");
  const [fmUploading, setFmUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [fmSelectAll, setFmSelectAll] = useState(false);
  // VS Code style editor state
  const [editorCursor, setEditorCursor] = useState({ line: 1, col: 1 });
  const [editorFind, setEditorFind] = useState("");
  const [editorFindOpen, setEditorFindOpen] = useState(false);
  const [editorFindMatches, setEditorFindMatches] = useState([]);
  const [editorFindIndex, setEditorFindIndex] = useState(-1);
  const [editorGoTo, setEditorGoTo] = useState("");
  const [editorGoToOpen, setEditorGoToOpen] = useState(false);
  const [editorChanged, setEditorChanged] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const editorRef = useRef(null);
  const editorPreRef = useRef(null);
  const findRef = useRef(null);
  const goToRef = useRef(null);

  useEffect(() => {
    loadInstance();
  }, [instanceName]);

  useEffect(() => {
    if (tab === "logs") loadLogs();
    if (tab === "resources") loadResourceUsage();
  }, [tab, logsType]);

  useEffect(() => {
    if (tab === "files" && instance?.status === "running") loadFmList();
  }, [tab, fmPath]);

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
        `/filemanager/list?instanceName=${instanceName}&containerType=wp&path=${encodeURIComponent(fmPath)}`,
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
        path: fmPath === WP_BASE ? `${WP_BASE}/${name}` : `${fmPath}/${name}`,
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
        `/filemanager/read?instanceName=${instanceName}&containerType=wp&filePath=${encodeURIComponent(entry.path)}`,
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
          containerType: "wp",
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
          containerType: "wp",
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
    const newPath =
      fmPath === WP_BASE ? `${WP_BASE}/${dirName}` : `${fmPath}/${dirName}`;
    try {
      const data = await apiCall(`/filemanager/mkdir`, {
        method: "POST",
        body: {
          instanceName,
          containerType: "wp",
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFmUploading(true);
    let successCount = 0;
    for (const file of files) {
      const reader = new FileReader();
      const content = await new Promise((resolve) => {
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsText(file);
      });
      const destPath =
        fmPath === WP_BASE
          ? `${WP_BASE}/${file.name}`
          : `${fmPath}/${file.name}`;
      try {
        const data = await apiCall(`/filemanager/upload`, {
          method: "POST",
          body: { instanceName, containerType: "wp", destPath, content },
        });
        if (data.success) successCount++;
      } catch (err) {
        showMsg(err.message, true);
      }
    }
    setFmUploading(false);
    showMsg(`✅ ${successCount} فایل آپلود شد`);
    setFmSelected([]);
    setFmSelectAll(false);
    loadFmList();
    e.target.value = "";
  }

  // ===== cPanel/DirectAdmin style helpers =====

  function goHome() {
    setFmHistory((prev) => [WP_BASE, ...prev.slice(1)]);
    setFmPath(WP_BASE);
    setFmSelected([]);
    setFmSelectAll(false);
  }

  function toggleSelect(entry) {
    setFmSelected((prev) => {
      const exists = prev.find((e) => e.path === entry.path);
      if (exists) return prev.filter((e) => e.path !== entry.path);
      return [...prev, entry];
    });
  }

  function toggleSelectAll() {
    if (fmSelectAll) {
      setFmSelected([]);
      setFmSelectAll(false);
    } else {
      setFmSelected(fmEntries);
      setFmSelectAll(true);
    }
  }

  function startRename(entry) {
    setFmRenaming(entry);
    setFmRenameValue(entry.name);
  }

  async function submitRename() {
    if (!fmRenaming || !fmRenameValue.trim()) return;
    if (fmRenameValue === fmRenaming.name) {
      setFmRenaming(null);
      return;
    }
    try {
      const data = await apiCall(`/filemanager/rename`, {
        method: "POST",
        body: {
          instanceName,
          containerType: "wp",
          oldPath: fmRenaming.path,
          newName: fmRenameValue.trim(),
        },
      });
      if (data.success) {
        showMsg(`✅ به "${fmRenameValue.trim()}" تغییر نام یافت`);
        setFmRenaming(null);
        loadFmList();
      } else {
        showMsg(data.error || "Failed to rename", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  function openCopyMove(entry, type) {
    setFmMoveDialog({ type, entry });
    setFmMoveDest(fmPath);
  }

  async function submitCopyMove() {
    if (!fmMoveDialog || !fmMoveDest.trim()) return;
    const { type, entry } = fmMoveDialog;
    try {
      const data = await apiCall(`/filemanager/${type}`, {
        method: "POST",
        body: {
          instanceName,
          containerType: "wp",
          srcPath: entry.path,
          destDir: fmMoveDest.trim(),
        },
      });
      if (data.success) {
        showMsg(
          `✅ ${type === "copy" ? "کپی" : "انتقال"} "${entry.name}" انجام شد`,
        );
        setFmMoveDialog(null);
        setFmMoveDest("");
        loadFmList();
      } else {
        showMsg(data.error || `Failed to ${type}`, true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function handleDownload(entry) {
    try {
      showMsg(`⏳ در حال آماده‌سازی "${entry.name}"...`);
      const data = await apiCall(
        `/filemanager/download?instanceName=${instanceName}&containerType=wp&filePath=${encodeURIComponent(entry.path)}`,
      );
      if (data.success && data.contentBase64) {
        const binary = atob(data.contentBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = entry.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMsg(`⬇️ دانلود "${entry.name}" شروع شد`);
      } else {
        showMsg(data.error || "Failed to download", true);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function deleteSelected() {
    if (fmSelected.length === 0) return;
    if (!window.confirm(`آیا از حذف ${fmSelected.length} آیتم مطمئن هستید؟`))
      return;
    let successCount = 0;
    for (const entry of fmSelected) {
      try {
        const data = await apiCall(`/filemanager/delete`, {
          method: "DELETE",
          body: { instanceName, containerType: "wp", filePath: entry.path },
        });
        if (data.success) successCount++;
      } catch (err) {
        /* ignore individual errors */
      }
    }
    showMsg(`✅ ${successCount} آیتم حذف شد`);
    setFmSelected([]);
    setFmSelectAll(false);
    loadFmList();
  }

  function getBreadcrumbs() {
    const parts = [];
    if (fmPath === WP_BASE) {
      return [{ label: "public_html", path: WP_BASE }];
    }
    const rel = fmPath.replace(WP_BASE, "").replace(/^\//, "");
    let cum = WP_BASE;
    parts.push({ label: "public_html", path: WP_BASE });
    for (const seg of rel.split("/")) {
      if (!seg) continue;
      cum = cum === WP_BASE ? `${WP_BASE}/${seg}` : `${cum}/${seg}`;
      parts.push({ label: seg, path: cum });
    }
    return parts;
  }

  // =============================================================
  // VS Code style editor helpers
  // =============================================================
  function getFileLanguage(name) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext))
      return "javascript";
    if (["php", "php7", "php8"].includes(ext)) return "php";
    if (["html", "htm"].includes(ext)) return "html";
    if (["css", "scss", "less"].includes(ext)) return "css";
    if (["json"].includes(ext)) return "json";
    if (["md"].includes(ext)) return "markdown";
    if (["py"].includes(ext)) return "python";
    if (["sh", "bash"].includes(ext)) return "shell";
    if (["sql"].includes(ext)) return "sql";
    if (["xml", "yml", "yaml", "conf", "cfg", "ini", "env"].includes(ext))
      return "yaml";
    if (["htaccess"].includes(ext)) return "apache";
    if (["txt", "log"].includes(ext)) return "plaintext";
    return "plaintext";
  }

  function getLanguageIcon(lang) {
    const icons = {
      javascript: "🟨",
      php: "🐘",
      html: "🌐",
      css: "🎨",
      json: "📋",
      markdown: "📝",
      python: "🐍",
      shell: "⚙️",
      sql: "🗄️",
      yaml: "⚙️",
      apache: "⚡",
      plaintext: "📄",
    };
    return icons[lang] || "📄";
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "\u0000A")
      .replace(/</g, "\u0000L")
      .replace(/>/g, "\u0000G")
      .replace(/"/g, "\u0000Q");
  }

  function highlightCode(content, lang) {
    if (!content) return "";
    const escaped = escapeHtml(content);
    let result = escaped;

    // Comments
    if (
      lang === "javascript" ||
      lang === "php" ||
      lang === "css" ||
      lang === "sql" ||
      lang === "python" ||
      lang === "shell"
    ) {
      if (lang === "css") {
        result = result.replace(
          /(\/\*[\s\S]*?\*\/)/g,
          '<span style="color:#6A9955">$1</span>',
        );
      } else {
        result = result.replace(
          /(\/\/[^\n]*)/g,
          '<span style="color:#6A9955">$1</span>',
        );
        result = result.replace(
          /(#[^\n]*)/g,
          '<span style="color:#6A9955">$1</span>',
        );
        result = result.replace(
          /(\/\*[\s\S]*?\*\/)/g,
          '<span style="color:#6A9955">$1</span>',
        );
      }
    }
    if (lang === "html" || lang === "apache") {
      result = result.replace(
        /(\u0000L!--[\s\S]*?--\u0000G)/g,
        '<span style="color:#6A9955">$1</span>',
      );
    }

    // Strings
    result = result.replace(
      /(\u0000Q[^\u0000A]*?\u0000Q|'[^'\n]*'|\u0060[^\u0060]*\u0060)/g,
      '<span style="color:#CE9178">$1</span>',
    );

    // Keywords
    const keywords =
      lang === "javascript"
        ? /(\b(const|let|var|function|return|if|else|for|while|import|export|from|new|class|extends|super|try|catch|finally|async|await|typeof|instanceof|switch|case|break|continue|default|null|undefined|true|false|this|throw|delete|in|of|yield|static|get|set|do|void)\b)/g
        : lang === "php"
          ? /(\b(\u0000L\?php|\?\u0000G|function|if|else|elseif|for|foreach|while|return|echo|print|class|new|extends|public|private|protected|static|const|try|catch|finally|throw|as|use|namespace|require|require_once|include|include_once|true|false|null|switch|case|break|continue|default|global|isset|empty|unset|array|list|and|or|not|do|endif|endforeach|endwhile|endfor)\b)/g
          : lang === "html"
            ? /(\u0000L\/?[a-zA-Z][a-zA-Z0-9-]*|\b(html|head|body|div|span|p|a|img|script|style|link|meta|title|h1|h2|h3|h4|h5|h6|ul|ol|li|table|tr|td|th|form|input|button|select|option|textarea|nav|header|footer|main|section|article|aside|iframe|video|audio|source|br|hr|strong|em|b|i|u|small|label|blockquote|code|pre)\b)/g
            : lang === "css"
              ? /(\b(@import|@media|@keyframes|@font-face|@supports|from|to|important)\b|#[0-9a-fA-F]{3,8}\b)/g
              : lang === "json"
                ? /(\u0000Q\w+\u0000Q)(\s*:)/g
                : /(\b(function|def|if|else|elif|for|while|return|import|from|class|try|except|finally|with|as|lambda|pass|break|continue|global|nonlocal|True|False|None|and|or|not|in|is|print|echo|select|from|where|insert|update|delete|create|table|into|values|set|drop|alter|join|left|right|inner|outer|group|order|by|having|limit|offset|null|true|false|begin|commit|rollback)\b)/g;

    result = result.replace(keywords, '<span style="color:#569CD6">$1</span>');

    // Numbers
    result = result.replace(
      /(\b\d+(\.\d+)?\b)/g,
      '<span style="color:#B5CEA8">$1</span>',
    );

    // Functions (name followed by parenthesis)
    if (lang === "javascript" || lang === "php" || lang === "python") {
      result = result.replace(
        /(\b[a-zA-Z_]\w*)(?=\s*\()/g,
        '<span style="color:#DCDCAA">$1</span>',
      );
    }

    // HTML attributes
    if (lang === "html") {
      result = result.replace(
        /([a-zA-Z-]+)(=)(\u0000Q)/g,
        '<span style="color:#9CDCFE">$1</span>$2<span style="color:#CE9178">$3',
      );
    }

    // PHP variables
    if (lang === "php") {
      result = result.replace(
        /(\$[a-zA-Z_]\w*)/g,
        '<span style="color:#9CDCFE">$1</span>',
      );
    }

    // Restore entities
    return result
      .replace(/\u0000A/g, "\u0026amp;")
      .replace(/\u0000L/g, "\u0026lt;")
      .replace(/\u0000G/g, "\u0026gt;")
      .replace(/\u0000Q/g, "\u0026quot;");
  }

  function handleEditorChange(e) {
    const value = e.target.value;
    setFmEditContent(value);
    setEditorChanged(true);
    updateCursorPos(e.target);
  }

  function updateCursorPos(el) {
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const lines = before.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setEditorCursor({ line, col });
  }

  function handleEditorKeyDown(e) {
    // Ctrl+F → open find
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setEditorFindOpen(true);
      setTimeout(() => findRef.current?.focus(), 50);
    }
    // Ctrl+G → go to line
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      setEditorGoToOpen(true);
      setTimeout(() => goToRef.current?.focus(), 50);
    }
    // Escape closes find/go-to
    if (e.key === "Escape") {
      setEditorFindOpen(false);
      setEditorGoToOpen(false);
    }
  }

  function runFind() {
    if (!editorFind.trim()) {
      setEditorFindMatches([]);
      setEditorFindIndex(-1);
      return;
    }
    const lines = fmEditContent.split("\n");
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let idx = line.indexOf(editorFind);
      while (idx !== -1) {
        matches.push({ line: i + 1, col: idx + 1 });
        idx = line.indexOf(editorFind, idx + 1);
      }
    }
    setEditorFindMatches(matches);
    setEditorFindIndex(0);
    scrollToMatch(matches[0]);
  }

  function handleEditorScroll(e) {
    if (editorPreRef.current) {
      editorPreRef.current.scrollTop = e.target.scrollTop;
      editorPreRef.current.scrollLeft = e.target.scrollLeft;
    }
    setEditorScrollTop(e.target.scrollTop);
  }

  function scrollToMatch(match, len) {
    if (!match || !editorRef.current) return;
    const lines = editorRef.current.value.split("\n");
    const target = { line: match.line, col: match.col };
    // Select the match in the textarea
    let charIndex = 0;
    for (let i = 0; i < match.line - 1; i++) {
      charIndex += lines[i].length + 1;
    }
    charIndex += match.col - 1;
    editorRef.current.focus();
    editorRef.current.setSelectionRange(
      charIndex,
      charIndex + (len !== undefined ? len : editorFind.length),
    );
    setEditorCursor(target);
  }

  function runFind(content, query) {
    const src = content !== undefined ? content : fmEditContent;
    const q = query !== undefined ? query : editorFind;
    if (!q.trim()) {
      setEditorFindMatches([]);
      setEditorFindIndex(-1);
      return;
    }
    const lines = src.split("\n");
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let idx = line.indexOf(q);
      while (idx !== -1) {
        matches.push({ line: i + 1, col: idx + 1 });
        idx = line.indexOf(q, idx + 1);
      }
    }
    setEditorFindMatches(matches);
    setEditorFindIndex(0);
    scrollToMatch(matches[0], q.length);
  }

  function findNext() {
    if (editorFindMatches.length === 0) return;
    const next = (editorFindIndex + 1) % editorFindMatches.length;
    setEditorFindIndex(next);
    scrollToMatch(editorFindMatches[next]);
  }

  function findPrev() {
    if (editorFindMatches.length === 0) return;
    const prev =
      editorFindIndex - 1 < 0
        ? editorFindMatches.length - 1
        : editorFindIndex - 1;
    setEditorFindIndex(prev);
    scrollToMatch(editorFindMatches[prev]);
  }

  function goToLine() {
    const num = parseInt(editorGoTo);
    if (!num || !editorRef.current) return;
    const lines = editorRef.current.value.split("\n");
    if (num < 1 || num > lines.length) return;
    let charIndex = 0;
    for (let i = 0; i < num - 1; i++) {
      charIndex += lines[i].length + 1;
    }
    editorRef.current.focus();
    editorRef.current.setSelectionRange(charIndex, charIndex);
    setEditorCursor({ line: num, col: 1 });
  }

  function closeEditor() {
    setFmEditing(null);
    setFmEditContent("");
    setEditorFind("");
    setEditorFindOpen(false);
    setEditorFindMatches([]);
    setEditorFindIndex(-1);
    setEditorGoTo("");
    setEditorGoToOpen(false);
    setEditorChanged(false);
  }

  // =============================================================
  // VS Code style editor derived values
  // =============================================================
  const fileLang = fmEditing ? getFileLanguage(fmEditing.name) : "plaintext";
  const highlightedCode = highlightCode(fmEditContent, fileLang);
  const lineNumbers = Array.from(
    { length: Math.max(1, (fmEditContent.match(/\n/g) || []).length + 1) },
    (_, i) => i + 1,
  );
  const vsToolbarBtn = {
    background: "#3c3c3c",
    color: "#ccc",
    border: "none",
    borderRadius: 4,
    padding: "3px 10px",
    fontSize: 12,
    cursor: "pointer",
  };
  const vsFindInput = {
    background: "#3c3c3c",
    color: "#e8e8e8",
    border: "1px solid #555",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 12,
    outline: "none",
    width: 220,
  };

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
    <div className="idetail">
      {!embedded && (
        <div className="idetail-hero">
          <button className="idetail-back" onClick={() => navigate("/sites")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            بازگشت
          </button>

          <div className="idetail-hero-main">
            <div className="idetail-logo">
              <span>🟢</span>
            </div>
            <div className="idetail-hero-info">
              <h2>{instanceName}</h2>
              {instance?.domain && (
                <a
                  href={`http://${instance.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="idetail-domain"
                >
                  {instance.domain} <span className="idetail-domain-arrow">↗</span>
                </a>
              )}
            </div>
            <div
              className={`idetail-status ${instance?.status === "running" ? "on" : "off"}`}
            >
              <span className="idetail-status-dot" />
              {instance?.status === "running" ? "فعال" : "متوقف"}
            </div>
          </div>

          <div className="idetail-hero-meta">
            <div className="idetail-meta-item">
              <span className="idetail-meta-icon">🖥️</span>
              <div className="idetail-meta-content">
                <span className="idetail-meta-label">نوع سرویس</span>
                <span className="idetail-meta-value">وردپرس</span>
              </div>
            </div>
            <div className="idetail-meta-item">
              <span className="idetail-meta-icon">📍</span>
              <div className="idetail-meta-content">
                <span className="idetail-meta-label">موقعیت</span>
                <span className="idetail-meta-value">آلمان 🇩🇪</span>
              </div>
            </div>
            <div className="idetail-meta-item">
              <span className="idetail-meta-icon">🗓️</span>
              <div className="idetail-meta-content">
                <span className="idetail-meta-label">تاریخ ایجاد</span>
                <span className="idetail-meta-value">
                  {instance?.createdAt
                    ? new Date(instance.createdAt).toLocaleDateString("fa-IR")
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="idetail-actions">
        {instance?.domain && (
          <a
            href={`http://${instance.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="idetail-btn primary"
          >
            <span className="idetail-btn-icon">🌐</span>
            باز کردن سایت
          </a>
        )}
        {instance?.domain && (
          <a
            href={`http://${instance.domain}/wp-admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="idetail-btn info"
          >
            <span className="idetail-btn-icon">🔑</span>
            ورود به وردپرس
          </a>
        )}
        {instance?.status === "running" ? (
          <button
            className="idetail-btn warning"
            onClick={() => handleAction("stop")}
          >
            <span className="idetail-btn-icon">⏹</span>
            توقف
          </button>
        ) : (
          <button
            className="idetail-btn success"
            onClick={() => handleAction("start")}
          >
            <span className="idetail-btn-icon">▶</span>
            شروع
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="idetail-tabs">
        <button
          className={`idetail-tab ${tab === "info" ? "active" : ""}`}
          onClick={() => setTab("info")}
        >
          <span className="idetail-tab-icon">📋</span>
          اطلاعات
        </button>
        <button
          className={`idetail-tab ${tab === "logs" ? "active" : ""}`}
          onClick={() => setTab("logs")}
        >
          <span className="idetail-tab-icon">📜</span>
          لاگ‌ها
        </button>
        <button
          className={`idetail-tab ${tab === "resources" ? "active" : ""}`}
          onClick={() => setTab("resources")}
        >
          <span className="idetail-tab-icon">📊</span>
          منابع
        </button>
        <button
          className={`idetail-tab ${tab === "files" ? "active" : ""}`}
          onClick={() => setTab("files")}
        >
          <span className="idetail-tab-icon">📁</span>
          فایل‌ها
        </button>
      </div>

      {/* ============== Info Tab ============== */}
      {tab === "info" && (
        <div className="idetail-info">
          <div className="idetail-stat-strip">
            <div className="idetail-stat primary-soft">
              <span className="idetail-stat-icon">🟢</span>
              <div className="idetail-stat-content">
                <span className="idetail-stat-label">وضعیت</span>
                <span className="idetail-stat-value">
                  {instance?.status === "running" ? "فعال" : "متوقف"}
                </span>
              </div>
            </div>
            <div className="idetail-stat green-soft">
              <span className="idetail-stat-icon">💰</span>
              <div className="idetail-stat-content">
                <span className="idetail-stat-label">نوع سرویس</span>
                <span className="idetail-stat-value">وردپرس</span>
              </div>
            </div>
            <div className="idetail-stat blue-soft">
              <span className="idetail-stat-icon">🎯</span>
              <div className="idetail-stat-content">
                <span className="idetail-stat-label">موقعیت</span>
                <span className="idetail-stat-value">آلمان 🇩🇪</span>
              </div>
            </div>
            <div className="idetail-stat purple-soft">
              <span className="idetail-stat-icon">🗓️</span>
              <div className="idetail-stat-content">
                <span className="idetail-stat-label">تاریخ ایجاد</span>
                <span className="idetail-stat-value">
                  {instance?.createdAt
                    ? new Date(instance.createdAt).toLocaleDateString("fa-IR")
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="idetail-card">
            <div className="idetail-card-header">
              <div className="idetail-card-title">🗂️ مشخصات نمونه</div>
            </div>
            <div className="idetail-card-body idetail-details-grid">
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">🏷️</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">نام نمونه</span>
                  <span className="idetail-detail-value">{instanceName}</span>
                </div>
              </div>
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">🌐</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">دامنه</span>
                  <span className="idetail-detail-value" dir="ltr">
                    {instance?.domain || "-"}
                  </span>
                </div>
              </div>
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">📦</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">پلتفرم</span>
                  <span className="idetail-detail-value">وردپرس</span>
                </div>
              </div>
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">🧩</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">وضعیت</span>
                  <span className="idetail-detail-value">
                    {instance?.status === "running" ? "در حال اجرا" : "متوقف"}
                  </span>
                </div>
              </div>
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">📍</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">دیتاسنتر</span>
                  <span className="idetail-detail-value">آلمان 🇩🇪</span>
                </div>
              </div>
              <div className="idetail-detail-item">
                <span className="idetail-detail-icon">💾</span>
                <div className="idetail-detail-content">
                  <span className="idetail-detail-label">آخرین بروزرسانی</span>
                  <span className="idetail-detail-value">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============== Logs Tab ============== */}
      {tab === "logs" && (
        <div className="idetail-logs-card">
          <div className="idetail-logs-header">
            <div className="idetail-logs-title-wrap">
              <span className="idetail-logs-icon">📜</span>
              <span className="idetail-logs-title">لاگ‌های سرویس</span>
            </div>
            <div className="idetail-logs-tools">
              <select
                className="idetail-logs-select"
                value={logsType}
                onChange={(e) => setLogsType(e.target.value)}
              >
                <option value="wp">وردپرس</option>
                <option value="db">دیتابیس</option>
              </select>
              <button className="idetail-logs-refresh" onClick={loadLogs}>
                <span className="idetail-logs-refresh-icon">🔄</span>
                بروزرسانی
              </button>
            </div>
          </div>
          <div className="idetail-logs-body">
            {logsLoading ? (
              <div className="loading-screen">
                <div className="spinner" />
              </div>
            ) : (
              <pre className="idetail-logs-content">{logs}</pre>
            )}
          </div>
        </div>
      )}

      {/* ============== Resources Tab ============== */}
      {tab === "resources" && (
        <div className="idetail-resources">
          {resourceUsage ? (
            <>
              <div className="idetail-res-card">
                <div className="idetail-card-header">
                  <div className="idetail-card-title">
                    <span className="idetail-card-title-icon">⚙️</span>
                    مصرف منابع - وردپرس
                  </div>
                  <span className="idetail-card-badge">زنده</span>
                </div>
                <div className="idetail-card-body idetail-res-body">
                  {resourceUsage.wordpress ? (
                    <div className="idetail-res-meters">
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.wordpress.cpu?.usage || 0}
                        limit={100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={
                          (resourceUsage.wordpress.memory?.usage || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.wordpress.memory?.limit ||
                            512 * 1024 * 1024) /
                          (1024 * 1024)
                        }
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (WP)"
                        used={
                          (resourceUsage.wordpress.disk?.usage || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.wordpress.disk?.limit ||
                            3000 * 1024 * 1024) /
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

              <div className="idetail-res-card">
                <div className="idetail-card-header">
                  <div className="idetail-card-title">
                    <span className="idetail-card-title-icon">🗄️</span>
                    مصرف منابع - دیتابیس
                  </div>
                  <span className="idetail-card-badge">زنده</span>
                </div>
                <div className="idetail-card-body idetail-res-body">
                  {resourceUsage.database ? (
                    <div className="idetail-res-meters">
                      <ResourceMeter
                        label="CPU"
                        used={resourceUsage.database.cpu?.usage || 0}
                        limit={100}
                        unit="%"
                      />
                      <ResourceMeter
                        label="RAM"
                        used={
                          (resourceUsage.database.memory?.usage || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.database.memory?.limit ||
                            512 * 1024 * 1024) /
                          (1024 * 1024)
                        }
                        unit="MB"
                      />
                      <ResourceMeter
                        label="Disk (DB)"
                        used={
                          (resourceUsage.database.disk?.usage || 0) /
                          (1024 * 1024)
                        }
                        limit={
                          (resourceUsage.database.disk?.limit ||
                            1000 * 1024 * 1024) /
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
            <div className="idetail-empty">
              <div className="idetail-empty-icon">📊</div>
              <h3>داده‌ای موجود نیست</h3>
              <p>برای مشاهده مصرف منابع، سایت باید فعال باشد</p>
            </div>
          )}
        </div>
      )}

      {/* ============== Files Tab ============== */}
      {tab === "files" && (
        <div>
          {fmMsg && (
            <div
              className={`alert ${fmMsg.isError ? "alert-danger" : "alert-success"}`}
              style={{ marginBottom: 12 }}
            >
              {fmMsg.text}
            </div>
          )}

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
              {/* Breadcrumb navigation */}
              <div
                className="flex"
                style={{
                  gap: 2,
                  alignItems: "center",
                  flex: 1,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-sm btn-outline"
                  onClick={goBack}
                  disabled={fmHistory.length <= 1}
                  title="بازگشت"
                >
                  ⬅
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={goHome}
                  title="خانه"
                >
                  🏠
                </button>
                <div
                  className="flex"
                  style={{ gap: 2, alignItems: "center", direction: "ltr" }}
                >
                  {getBreadcrumbs().map((crumb, i) => (
                    <span
                      key={crumb.path}
                      className="flex"
                      style={{ gap: 2, alignItems: "center" }}
                    >
                      {i > 0 && (
                        <span
                          style={{ color: "var(--gray-400)", fontSize: 12 }}
                        >
                          /
                        </span>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{
                          padding: "2px 6px",
                          fontSize: 12,
                          fontWeight:
                            i === getBreadcrumbs().length - 1 ? 700 : 400,
                          color:
                            i === getBreadcrumbs().length - 1
                              ? "var(--primary)"
                              : "var(--gray-700)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setFmHistory((prev) => [...prev, crumb.path]);
                          setFmPath(crumb.path);
                        }}
                      >
                        {crumb.label}
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn btn-sm btn-primary" onClick={createDir}>
                  📁 پوشه جدید
                </button>
                <button className="btn btn-sm btn-success" onClick={uploadFile}>
                  📤 آپلود
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={loadFmList}
                  title="بروزرسانی"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>

          {/* Bulk actions bar - shown when items selected */}
          {fmSelected.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom: 12,
                border: "1px solid var(--primary)",
                background: "var(--primary-50, #eaf2ff)",
              }}
            >
              <div
                className="card-body"
                style={{
                  padding: "8px 16px",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {fmSelected.length} آیتم انتخاب شده:
                </span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={deleteSelected}
                >
                  🗑️ حذف
                </button>
                {fmSelected.length === 1 && (
                  <>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => startRename(fmSelected[0])}
                    >
                      ✏️ تغییر نام
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openCopyMove(fmSelected[0], "copy")}
                    >
                      📋 کپی
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openCopyMove(fmSelected[0], "move")}
                    >
                      ✂️ انتقال
                    </button>
                    {!fmSelected[0].isDir && (
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleDownload(fmSelected[0])}
                      >
                        ⬇️ دانلود
                      </button>
                    )}
                  </>
                )}
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setFmSelected([]);
                    setFmSelectAll(false);
                  }}
                >
                  لغو انتخاب
                </button>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            onChange={handleFileUpload}
          />

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
                    توجه: کانتینر "{instanceName}_wp" باید در حال اجرا باشد
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
                      <th style={{ width: 30 }}>
                        <input
                          type="checkbox"
                          checked={fmSelectAll}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th style={{ width: "35%" }}>نام</th>
                      <th style={{ width: "10%" }}>اندازه</th>
                      <th style={{ width: "15%" }}>مجوزها</th>
                      <th style={{ width: "25%" }}>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fmEntries.map((entry, idx) => {
                      const isSelected = fmSelected.some(
                        (e) => e.path === entry.path,
                      );
                      return (
                        <tr
                          key={idx}
                          style={{
                            background: isSelected
                              ? "var(--primary-50, #eaf2ff)"
                              : undefined,
                          }}
                          onDoubleClick={() =>
                            entry.isDir
                              ? navigateToDir(entry.path)
                              : isTextFile(entry.name)
                                ? openFile(entry)
                                : null
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(entry)}
                            />
                          </td>
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
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              {!entry.isDir && isTextFile(entry.name) && (
                                <button
                                  className="btn btn-sm btn-outline"
                                  title="ویرایش"
                                  onClick={() => openFile(entry)}
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-outline"
                                title="تغییر نام"
                                onClick={() => startRename(entry)}
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                title="کپی"
                                onClick={() => openCopyMove(entry, "copy")}
                              >
                                📋
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                title="انتقال"
                                onClick={() => openCopyMove(entry, "move")}
                              >
                                ✂️
                              </button>
                              {!entry.isDir && (
                                <button
                                  className="btn btn-sm btn-outline"
                                  title="دانلود"
                                  onClick={() => handleDownload(entry)}
                                >
                                  ⬇️
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                title="حذف"
                                onClick={() => deleteEntry(entry)}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {fmEditing && (
            <div className="modal-overlay">
              <div
                className="modal"
                style={{
                  width: "90%",
                  maxWidth: 1100,
                  height: "85vh",
                  display: "flex",
                  flexDirection: "column",
                  padding: 0,
                  overflow: "hidden",
                  background: "#1e1e1e",
                  borderRadius: 8,
                  border: "1px solid #3c3c3c",
                }}
              >
                {/* Title/tab bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#252526",
                    borderBottom: "1px solid #3c3c3c",
                    padding: "0 8px",
                    height: 38,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {getLanguageIcon(fileLang)}
                    </span>
                    <span
                      style={{
                        color: "#e8e8e8",
                        fontSize: 13,
                        direction: "ltr",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {fmEditing.name}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        fontSize: 11,
                        direction: "ltr",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmEditing.path}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <button
                      className="btn btn-sm"
                      style={{
                        background: "#0e639c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "3px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      onClick={saveFile}
                    >
                      💾 ذخیره {editorChanged ? "•" : ""}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: "transparent",
                        color: "#ccc",
                        border: "none",
                        fontSize: 18,
                        cursor: "pointer",
                        padding: "0 6px",
                      }}
                      onClick={closeEditor}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "#252526",
                    borderBottom: "1px solid #3c3c3c",
                    flexShrink: 0,
                  }}
                >
                  <button
                    className="btn btn-sm"
                    style={vsToolbarBtn}
                    onClick={() => {
                      setEditorFindOpen(true);
                      setTimeout(() => findRef.current?.focus(), 50);
                    }}
                  >
                    🔍 جستجو
                  </button>
                  <button
                    className="btn btn-sm"
                    style={vsToolbarBtn}
                    onClick={() => {
                      setEditorGoToOpen(true);
                      setTimeout(() => goToRef.current?.focus(), 50);
                    }}
                  >
                    ⏭ برو به خط
                  </button>
                  <span
                    style={{
                      color: "#858585",
                      fontSize: 11,
                      marginRight: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      direction: "ltr",
                    }}
                  >
                    {getLanguageIcon(fileLang)} {fileLang}
                  </span>
                </div>

                {/* Find bar */}
                {editorFindOpen && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "#1e1e1e",
                      borderBottom: "1px solid #3c3c3c",
                    }}
                  >
                    <input
                      ref={findRef}
                      style={vsFindInput}
                      placeholder="جستجو..."
                      value={editorFind}
                      onChange={(e) => {
                        setEditorFind(e.target.value);
                        runFind(e.target.value, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (e.shiftKey) findPrev();
                          else findNext();
                        }
                        if (e.key === "Escape") setEditorFindOpen(false);
                      }}
                      dir="ltr"
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ color: "#ccc", padding: "2px 8px" }}
                      onClick={findPrev}
                      title="قبلی"
                    >
                      ▲
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ color: "#ccc", padding: "2px 8px" }}
                      onClick={findNext}
                      title="بعدی"
                    >
                      ▼
                    </button>
                    <span style={{ color: "#9a9a9a", fontSize: 12 }}>
                      {editorFindMatches.length > 0
                        ? String(editorFindIndex + 1) +
                          " / " +
                          String(editorFindMatches.length)
                        : editorFind
                          ? "موردی یافت نشد"
                          : ""}
                    </span>
                  </div>
                )}

                {/* Go to line bar */}
                {editorGoToOpen && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "#1e1e1e",
                      borderBottom: "1px solid #3c3c3c",
                    }}
                  >
                    <span style={{ color: "#9a9a9a", fontSize: 12 }}>
                      برو به خط:
                    </span>
                    <input
                      ref={goToRef}
                      style={Object.assign({}, vsFindInput, { width: 80 })}
                      placeholder="خط"
                      value={editorGoTo}
                      onChange={(e) => setEditorGoTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") goToLine();
                        if (e.key === "Escape") setEditorGoToOpen(false);
                      }}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ color: "#ccc" }}
                      onClick={goToLine}
                    >
                      برو
                    </button>
                  </div>
                )}

                {/* Editor area */}
                <div
                  style={{
                    position: "relative",
                    flex: 1,
                    overflow: "hidden",
                    background: "#1e1e1e",
                  }}
                >
                  <pre
                    ref={editorPreRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      margin: 0,
                      padding: "12px 12px 12px 64px",
                      fontSize: 13,
                      fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                      lineHeight: 1.6,
                      color: "#d4d4d4",
                      whiteSpace: "pre",
                      overflow: "auto",
                      pointerEvents: "none",
                      direction: "ltr",
                      textAlign: "left",
                      tabSize: 2,
                    }}
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 52,
                      background: "#252526",
                      borderRight: "1px solid #3c3c3c",
                      padding: "12px 0",
                      textAlign: "right",
                      color: "#858585",
                      fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                      fontSize: 13,
                      lineHeight: 1.6,
                      userSelect: "none",
                      direction: "ltr",
                      transform: "translateY(-" + editorScrollTop + "px)",
                    }}
                  >
                    {lineNumbers.map((n) => (
                      <div key={n} style={{ paddingRight: 8 }}>
                        {n}
                      </div>
                    ))}
                  </div>
                  <textarea
                    ref={editorRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      margin: 0,
                      padding: "12px 12px 12px 64px",
                      fontSize: 13,
                      fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                      lineHeight: 1.6,
                      color: "transparent",
                      caretColor: "#aeafad",
                      WebkitTextFillColor: "transparent",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      whiteSpace: "pre",
                      overflow: "auto",
                      direction: "ltr",
                      textAlign: "left",
                      tabSize: 2,
                      zIndex: 2,
                    }}
                    value={fmEditContent}
                    onChange={handleEditorChange}
                    onKeyDown={handleEditorKeyDown}
                    onScroll={handleEditorScroll}
                    onClick={(e) => updateCursorPos(e.target)}
                    onKeyUp={(e) => updateCursorPos(e.target)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>

                {/* Status bar */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    background: "#007acc",
                    color: "#fff",
                    padding: "3px 12px",
                    fontSize: 12,
                    flexShrink: 0,
                    direction: "ltr",
                  }}
                >
                  <span>⎇ main</span>
                  <span>{editorChanged ? "⚠ اصلاح نشده" : "✔"}</span>
                  <span style={{ marginLeft: "auto" }}>
                    Ln {editorCursor.line}, Col {editorCursor.col}
                  </span>
                  <span>
                    {getLanguageIcon(fileLang)} {fileLang}
                  </span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span>Spaces: 2</span>
                </div>
              </div>
            </div>
          )}

          {/* Rename modal */}
          {fmRenaming && (
            <div className="modal-overlay" onClick={() => setFmRenaming(null)}>
              <div
                className="modal"
                style={{ width: 420 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>✏️ تغییر نام</h3>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setFmRenaming(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body">
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--gray-500)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    نام جدید:
                  </label>
                  <input
                    className="form-input"
                    style={{ width: "100%" }}
                    value={fmRenameValue}
                    onChange={(e) => setFmRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitRename()}
                    autoFocus
                    dir="ltr"
                  />
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--gray-400)",
                      marginTop: 8,
                    }}
                  >
                    مسیر فعلی: <span dir="ltr">{fmRenaming.path}</span>
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    onClick={() => setFmRenaming(null)}
                  >
                    انصراف
                  </button>
                  <button className="btn btn-primary" onClick={submitRename}>
                    ✅ تایید
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Copy/Move modal */}
          {fmMoveDialog && (
            <div
              className="modal-overlay"
              onClick={() => setFmMoveDialog(null)}
            >
              <div
                className="modal"
                style={{ width: 480 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>
                    {fmMoveDialog.type === "copy"
                      ? "📋 کپی فایل/پوشه"
                      : "✂️ انتقال فایل/پوشه"}
                  </h3>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setFmMoveDialog(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body">
                  <p style={{ fontSize: 13, marginBottom: 12 }}>
                    {fmMoveDialog.type === "copy" ? "کپی" : "انتقال"}{" "}
                    <strong dir="ltr">{fmMoveDialog.entry.name}</strong> به:
                  </p>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--gray-500)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    مسیر مقصد (محدود به /var/www/html):
                  </label>
                  <input
                    className="form-input"
                    style={{ width: "100%", direction: "ltr" }}
                    value={fmMoveDest}
                    onChange={(e) => setFmMoveDest(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitCopyMove()}
                    placeholder="/var/www/html/..."
                  />
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--gray-400)",
                      marginTop: 8,
                    }}
                  >
                    مثال: <span dir="ltr">/var/www/html/wp-content/themes</span>
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    onClick={() => setFmMoveDialog(null)}
                  >
                    انصراف
                  </button>
                  <button className="btn btn-primary" onClick={submitCopyMove}>
                    {fmMoveDialog.type === "copy" ? "📋 کپی" : "✂️ انتقال"}
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
