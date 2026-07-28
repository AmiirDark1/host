const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dockerManager = require("./dockerManager");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple in-memory user database
const users = [
  {
    id: "1",
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "مدیر سیستم",
  },
  {
    id: "2",
    username: "user1",
    password: "user123",
    role: "user",
    name: "کاربر یک",
  },
  {
    id: "3",
    username: "user2",
    password: "user123",
    role: "user",
    name: "کاربر دو",
  },
];

// Simple auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Strip "Bearer " prefix if present
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const userData = JSON.parse(Buffer.from(token, "base64").toString());
    const user = users.find(
      (u) =>
        u.username === userData.username && u.password === userData.password,
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

// Auth routes
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
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    },
  });
});

// Get server IP
app.get("/api/server-ip", (req, res) => {
  res.json({ ip: dockerManager.getServerIp() });
});

// API: Create single WordPress instance with domain
app.post("/api/instances", authenticate, async (req, res) => {
  try {
    const { instanceName, domain } = req.body;
    if (!instanceName) {
      return res.status(400).json({ error: "instanceName is required" });
    }
    if (!domain) {
      return res
        .status(400)
        .json({ error: "domain is required - لطفاً دامنه را وارد کنید" });
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

// Create multiple WordPress instances (3 or 6) with domains
app.post("/api/instances/bulk", authenticate, async (req, res) => {
  try {
    const { count, domains } = req.body;
    if (![3, 6].includes(count)) {
      return res.status(400).json({ error: "Count must be 3 or 6" });
    }
    if (!domains || domains.length !== count) {
      return res.status(400).json({ error: `لطفاً ${count} دامنه وارد کنید` });
    }
    const instances = await dockerManager.createMultipleInstances(
      req.user.username,
      count,
      domains,
    );
    res.json(instances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List instances
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

// Delete instance
app.delete("/api/instances/:instanceName", authenticate, async (req, res) => {
  try {
    const { instanceName } = req.params;

    // Check if user owns this instance (non-admin)
    if (req.user.role !== "admin") {
      const instances = await dockerManager.listInstances(req.user.username);
      const owns = instances.some((i) => i.instanceName === instanceName);
      if (!owns) {
        return res.status(403).json({ error: "You do not own this instance" });
      }
    }

    await dockerManager.deleteInstance(instanceName);
    res.json({ success: true, message: "Instance deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stats (admin only)
app.get("/api/stats", authenticate, adminOnly, async (req, res) => {
  try {
    const stats = await dockerManager.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (admin only)
app.get("/api/users", authenticate, adminOnly, (req, res) => {
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name,
    })),
  );
});

// ===== FILE MANAGER API =====

// List files in a container
app.get("/api/filemanager/list", authenticate, async (req, res) => {
  try {
    const { instanceName, containerType, path } = req.query;
    if (!instanceName || !containerType || !path) {
      return res.status(400).json({ error: "instanceName, containerType, and path are required" });
    }
    
    // Verify ownership for non-admin users
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

// Read file content
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

// Write file content
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

// Delete file
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

// Create directory
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

// Upload file
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

// Catch-all for the root path - serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch-all for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Catch-all for SPA routing - serve index.html for any non-file route
app.use((req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`WordPress Panel Server running on http://localhost:${PORT}`);
  console.log("============================================");
  console.log("🚀 Admin Login: admin / admin123");
  console.log("👤 User Login: user1 / user123");
  console.log("👤 User Login: user2 / user123");
  console.log(`🖥️  Server IP: ${dockerManager.getServerIp()}`);
  console.log("============================================");
});
