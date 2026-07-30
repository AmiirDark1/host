const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dockerManager = require("./dockerManager");
const resourceLimits = require("./resourceLimits");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, "public")));

// =================================================================
// User Database
// =================================================================
const users = [
  { id: "1", username: "admin", password: "admin123", role: "admin", name: "مدیر سیستم" },
  { id: "2", username: "user1", password: "user123", role: "user", name: "کاربر یک" },
  { id: "3", username: "user2", password: "user123", role: "user", name: "کاربر دو" },
];

// =================================================================
// Auth Middleware
// =================================================================
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const userData = JSON.parse(Buffer.from(token, "base64").toString());
    const user = users.find(
      (u) => u.username === userData.username && u.password === userData.password,
    );
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// =================================================================
// Auth Routes
// =================================================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );

  if (!user) {
    return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
  }

  const token = Buffer.from(
    JSON.stringify({ username: user.username, password: user.password }),
  ).toString("base64");
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  });
});

// =================================================================
// DNS Check - بررسی اینکه دامنه به سرور اشاره دارد
// =================================================================
app.post("/api/check-dns", authenticate, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: "domain is required" });
    }
    const result = await dockerManager.checkDomainDNS(domain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// SSL Status - بررسی وضعیت SSL برای یک دامنه
// =================================================================
app.get("/api/ssl-status", authenticate, async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) {
      return res.status(400).json({ error: "domain is required" });
    }
    const result = await dockerManager.getDomainSSLStatus(domain);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Server IP (public - no auth needed)
// =================================================================
app.get("/api/server-ip", (req, res) => {
  try {
    const ip = dockerManager.getServerIp();
    res.json({ ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Server Info
// =================================================================
app.get("/api/server-info", authenticate, async (req, res) => {
  try {
    const ip = dockerManager.getServerIp();
    res.json({
      ip,
      dnsInstruction: `⚠️ لطفاً رکورد A دامنه خود را به ${ip}指向 کنید`,
      networkRequired: "شبکه nginx-proxy باید از قبل ایجاد شده باشد",
      setupCommand: "docker network create nginx-proxy",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Create WordPress Instance (با دامنه - نیازی به پورت نیست)
// =================================================================
app.post("/api/instances", authenticate, async (req, res) => {
  try {
    const { instanceName, domain } = req.body;
    if (!instanceName) {
      return res.status(400).json({ error: "instanceName is required" });
    }
    if (!domain) {
      return res.status(400).json({ error: "domain is required - لطفاً دامنه را وارد کنید" });
    }

    const instance = await dockerManager.createWordPressInstance(
      instanceName,
      req.user.username,
      domain,
    );
    res.json(instance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Create Multiple Instances (3 or 6) با دامنه‌ها
// =================================================================
app.post("/api/instances/bulk", authenticate, async (req, res) => {
  try {
    const { count, domains } = req.body;
    if (![3, 6].includes(count)) {
      return res.status(400).json({ error: "Count must be 3 or 6" });
    }
    if (!domains || domains.length !== count) {
      return res.status(400).json({ error: `لطفاً ${count} دامنه وارد کنید` });
    }

    const result = await dockerManager.createMultipleInstances(
      req.user.username,
      count,
      domains,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// List Instances
// =================================================================
app.get("/api/instances", authenticate, async (req, res) => {
  try {
    let instances;
    if (req.user.role === "admin") {
      instances = await dockerManager.listInstances();
    } else {
      instances = await dockerManager.listInstances(req.user.username);
    }
    res.json(instances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Get Single Instance Details
// =================================================================
app.get("/api/instances/:instanceName", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;
    let instances;
    if (req.user.role === "admin") {
      instances = await dockerManager.listInstances();
    } else {
      instances = await dockerManager.listInstances(req.user.username);
    }
    const instance = instances.find(i => i.instanceName === instanceName);
    if (!instance) {
      return res.status(404).json({ error: "Instance not found" });
    }
    res.json(instance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Instance Actions (Start/Stop/Logs)
// =================================================================
app.post("/api/instances/:instanceName/start", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;
    await checkOwnership(req, instanceName);
    const result = await dockerManager.startInstance(instanceName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/instances/:instanceName/stop", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;
    await checkOwnership(req, instanceName);
    const result = await dockerManager.stopInstance(instanceName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/instances/:instanceName/logs", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;
    const { type = 'wp', lines = 50 } = req.query;
    await checkOwnership(req, instanceName);
    const result = await dockerManager.getInstanceLogs(instanceName, type, parseInt(lines));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Helper: Check Ownership
// =================================================================
async function checkOwnership(req, instanceName) {
  if (req.user.role !== "admin") {
    const instances = await dockerManager.listInstances(req.user.username);
    const owns = instances.some((i) => i.instanceName === instanceName);
    if (!owns) {
      throw new Error("You do not own this instance");
    }
  }
}

// =================================================================
// Delete Instance
// =================================================================
app.delete("/api/instances/:instanceName", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;
    await checkOwnership(req, instanceName);
    const result = await dockerManager.deleteInstance(instanceName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Stats
// =================================================================
app.get("/api/stats", authenticate, adminOnly, async (req, res) => {
  try {
    const stats = await dockerManager.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Users (admin only)
// =================================================================
app.get("/api/users", authenticate, adminOnly, (req, res) => {
  res.json(
    users.map((u) => ({ id: u.id, username: u.username, role: u.role, name: u.name })),
  );
});

// =================================================================
// ==================== RESOURCE LIMITS API =========================
// =================================================================

// دریافت تنظیمات فعلی محدودیت منابع
// تبدیل از فرمت داخلی به فرمت فرانت‌اند برای سازگاری
app.get("/api/limits", authenticate, adminOnly, async (req, res) => {
  try {
    const internal = resourceLimits.getLimits();
    const defaults = resourceLimits.getDefaults();

    // تبدیل از فرمت داخلی { cpu: { wp: 0.5 }, memory: { wp: '256m' }, disk: { wp: 2 } }
    // به فرمت فرانت‌اند { wp: { cpu: 0.5, memory: 256, diskSize: 2 }, db: {...} }
    const frontendFormat = {
      wp: {
        cpu: internal.cpu?.wp ?? defaults.cpu?.wp ?? 0.5,
        memory: internal.memory?.wp ? parseInt(internal.memory.wp) : (defaults.memory?.wp ? parseInt(defaults.memory.wp) : 256),
        diskSize: internal.disk?.wp ?? defaults.disk?.wp ?? 2,
      },
      db: {
        cpu: internal.cpu?.db ?? defaults.cpu?.db ?? 0.3,
        memory: internal.memory?.db ? parseInt(internal.memory.db) : (defaults.memory?.db ? parseInt(defaults.memory.db) : 256),
        diskSize: internal.disk?.db ?? defaults.disk?.db ?? 1,
      },
      total: {
        cpu: (internal.cpu?.wp ?? 0.5) + (internal.cpu?.db ?? 0.3),
        memory: parseMemoryToMB(internal.memory?.swap || defaults.memory?.swap || '512m'),
        diskSize: (internal.disk?.wp ?? 2) + (internal.disk?.db ?? 1),
      },
    };

    // همچنین پیش‌فرض‌ها را هم به فرمت فرانت‌اند تبدیل کن
    const defaultsFrontend = {
      wp: {
        cpu: defaults.cpu?.wp ?? 0.5,
        memory: defaults.memory?.wp ? parseInt(defaults.memory.wp) : 256,
        diskSize: defaults.disk?.wp ?? 2,
      },
      db: {
        cpu: defaults.cpu?.db ?? 0.3,
        memory: defaults.memory?.db ? parseInt(defaults.memory.db) : 256,
        diskSize: defaults.disk?.db ?? 1,
      },
      total: {
        cpu: (defaults.cpu?.wp ?? 0.5) + (defaults.cpu?.db ?? 0.3),
        memory: parseMemoryToMB(defaults.memory?.swap || '512m'),
        diskSize: (defaults.disk?.wp ?? 2) + (defaults.disk?.db ?? 1),
      },
    };

    // برگردون هر دو فرمت (فرمت داخلی برای دیباگ و فرمت فرانت‌اند برای UI)
    res.json({
      limits: frontendFormat,
      defaults: defaultsFrontend,
      internalLimits: internal,       // فرمت داخلی برای دیباگ
      internalDefaults: defaults,     // فرمت داخلی پیش‌فرض
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: تبدیل رشته حافظه به مگابایت
function parseMemoryToMB(str) {
  if (typeof str === 'number') return str;
  const match = str.toString().match(/^(\d+)(b|k|m|g)?$/i);
  if (!match) return 512;
  const val = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  switch (unit) {
    case 'b': return Math.round(val / (1024 * 1024));
    case 'k': return Math.round(val / 1024);
    case 'm': return val;
    case 'g': return val * 1024;
    default: return val;
  }
}

// ذخیره تنظیمات جدید محدودیت منابع
app.post("/api/limits", authenticate, adminOnly, async (req, res) => {
  try {
    const newLimits = req.body;
    const result = resourceLimits.saveLimits(newLimits);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// دریافت مصرف منابع یک کانتینر خاص
app.get("/api/resource-usage/:containerName", authenticate, async (req, res) => {
  try {
    const { containerName } = req.params;

    // بررسی مالکیت (اگر ادمین نیست)
    if (req.user.role !== "admin") {
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }

    const usage = await resourceLimits.getContainerResourceUsage(containerName);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// دریافت مصرف منابع همه کانتینرهای یک نمونه
app.get("/api/resource-usage/instance/:instanceName", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;

    // بررسی مالکیت
    if (req.user.role !== "admin") {
      const instances = await dockerManager.listInstances(req.user.username);
      const owns = instances.some((i) => i.instanceName === instanceName);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }

    const wpUsage = await resourceLimits.getContainerResourceUsage(`wp-${instanceName}`);
    const dbUsage = await resourceLimits.getContainerResourceUsage(`db-${instanceName}`);

    res.json({
      instanceName,
      wordpress: wpUsage,
      database: dbUsage,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// بروزرسانی محدودیت‌های یک کانتینر در حال اجرا (داینامیک)
app.post("/api/resource-usage/update", authenticate, adminOnly, async (req, res) => {
  try {
    const { containerName, cpu, memory, memorySwap } = req.body;
    if (!containerName) {
      return res.status(400).json({ error: "containerName is required" });
    }
    const result = await resourceLimits.updateRunningContainerLimits(containerName, { cpu, memory, memorySwap });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// ==================== FILE MANAGER API ============================
// =================================================================

app.get("/api/filemanager/list", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, path } = req.query;
    if (!instanceName || !containerType || !path) {
      return res.status(400).json({ error: "instanceName, containerType, and path are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.listFiles(instanceName, containerType, path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/filemanager/read", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, filePath } = req.query;
    if (!instanceName || !containerType || !filePath) {
      return res.status(400).json({ error: "instanceName, containerType, and filePath are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.readFile(instanceName, containerType, filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/filemanager/write", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, filePath, content } = req.body;
    if (!instanceName || !containerType || !filePath || content === undefined) {
      return res.status(400).json({ error: "instanceName, containerType, filePath, and content are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.writeFile(instanceName, containerType, filePath, content);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/filemanager/delete", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, filePath } = req.body;
    if (!instanceName || !containerType || !filePath) {
      return res.status(400).json({ error: "instanceName, containerType, and filePath are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.deleteFile(instanceName, containerType, filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/filemanager/mkdir", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, dirPath } = req.body;
    if (!instanceName || !containerType || !dirPath) {
      return res.status(400).json({ error: "instanceName, containerType, and dirPath are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.createDir(instanceName, containerType, dirPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/filemanager/upload", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, destPath, content } = req.body;
    if (!instanceName || !containerType || !destPath || content === undefined) {
      return res.status(400).json({ error: "instanceName, containerType, destPath, and content are required" });
    }
    if (req.user.role !== "admin") {
      const containerName = containerType === "db" ? `db-${instanceName}` : `wp-${instanceName}`;
      const owns = await dockerManager.userOwnsContainer(containerName, req.user.username);
      if (!owns) return res.status(403).json({ error: "Access denied" });
    }
    const result = await dockerManager.uploadFile(instanceName, containerType, destPath, content);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// Catch-all Routes
// =================================================================

// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch-all for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// SPA catch-all
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =================================================================
// Start Server
// =================================================================
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("🚀  WordPress Panel با Nginx Reverse Proxy + SSL خودکار");
  console.log("=".repeat(60));
  console.log(`   🌐  پنل مدیریت:          http://localhost:${PORT}`);
  console.log(`   🔑  ادمین:               admin / admin123`);
  console.log(`   👤  کاربر:               user1 / user123`);
  console.log(`   🖥️   آی‌پی سرور:          ${dockerManager.getServerIp()}`);
  console.log("-".repeat(60));
  console.log("   ⚡  راه‌اندازی زیرساخت:");
  console.log("   📡  docker network create nginx-proxy");
  console.log("   📦  cd infrastructure && docker-compose up -d");
  console.log("-".repeat(60));
  console.log("   ✅  سایتها با دامنه ساخته می‌شوند و SSL خودکار می‌گیرند");
  console.log("=".repeat(60));
});