/**
 * Resource Limits Configuration & Manager
 * ==========================================
 * Central configuration for CPU, RAM, and Disk limits
 * برای هر نمونه وردپرس (WP + DB)
 */

const DEFAULT_LIMITS = {
  // === CPU Limits ===
  cpu: {
    // حداکثر تعداد هسته‌های CPU (مثلاً 0.5 = نصف یک هسته)
    wp: 0.5,
    db: 0.3,
  },

  // === Memory Limits ===
  memory: {
    // حداکثر RAM (بر حسب مگابایت)
    wp: '256m',
    db: '256m',
    // swap: مجموع RAM + SWAP
    swap: '512m',
  },

  // === Disk Limits ===
  disk: {
    // حداکثر فضای دیسک برای هر کانتینر (بر حسب گیگابایت)
    // با Docker --storage-opt size=... روی overlay2
    wp: 2,    // 2GB برای فایل‌های وردپرس
    db: 1,    // 1GB برای دیتابیس

    // مسیر ذخیره‌سازی داده‌ها برای XFS Quota (اختیاری)
    dataRoot: '/var/lib/docker/volumes/wordpress-data',

    // آیا XFS Project Quota فعال باشد؟
    useXfsQuota: false,
  },
};

class ResourceLimitsManager {
  constructor() {
    this.limits = this.loadLimits();
  }

  /**
   * بارگذاری تنظیمات از فایل یا استفاده از پیش‌فرض
   */
  loadLimits() {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'limits-config.json');

    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        const saved = JSON.parse(data);
        // ادغام با پیش‌فرض‌ها (تنظیمات ذخیره شده اولویت دارند)
        return this._mergeDeep({ ...DEFAULT_LIMITS }, saved);
      }
    } catch (e) {
      console.warn('⚠️ Could not load limits config, using defaults:', e.message);
    }

    return JSON.parse(JSON.stringify(DEFAULT_LIMITS));
  }

  /**
   * ذخیره تنظیمات در فایل
   */
  saveLimits(newLimits) {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'limits-config.json');

    const merged = this._mergeDeep({ ...DEFAULT_LIMITS }, newLimits);
    this.limits = merged;

    try {
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
      return { success: true, limits: merged };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * دریافت HostConfig برای Docker Container (اعمال محدودیت‌ها)
   * @param {string} type - 'wp' یا 'db'
   * @param {object} custom - تنظیمات سفارشی (اختیاری)
   */
  getContainerHostConfig(type, custom = {}) {
    const limits = this._getEffectiveLimits(type, custom);

    const hostConfig = {
      RestartPolicy: { Name: 'always' },
      // محدودیت CPU
      NanoCpus: limits.cpuNanos,
      // محدودیت RAM
      Memory: limits.memoryBytes,
      MemorySwap: limits.swapBytes,
      MemorySwappiness: 0,  // عدم استفاده از swap مگر ضرورت
    };

    // محدودیت ذخیره‌سازی (فقط روی Docker با storage driver overlay2)
    if (limits.storageOpt) {
      hostConfig.StorageOpt = limits.storageOpt;
    }

    // محدودیت I/O دیسک (اختیاری)
    if (limits.blkioWeight) {
      hostConfig.BlkioWeight = limits.blkioWeight;
    }

    return hostConfig;
  }

  /**
   * محاسبه محدودیت‌های مؤثر با ادغام تنظیمات پیش‌فرض و سفارشی
   */
  _getEffectiveLimits(type, custom) {
    const typeDefaults = type === 'wp' ? this.limits.cpu.wp : this.limits.cpu.db;
    const memDefault = this.limits.memory[type] || '256m';
    const swapDefault = this.limits.memory.swap || '512m';
    const diskDefault = this.limits.disk[type] || 2;

    // CPU: از custom یا پیش‌فرض
    const cpuCount = custom.cpu !== undefined ? custom.cpu : typeDefaults;
    const cpuNanos = Math.round(cpuCount * 1e9); // تبدیل به NanoCpus

    // Memory: تبدیل به بایت
    const memStr = custom.memory || memDefault;
    const swapStr = custom.memorySwap || swapDefault;
    const memoryBytes = this._parseMemory(memStr);
    const swapBytes = this._parseMemory(swapStr);

    // Disk size
    const diskGB = custom.diskSize !== undefined ? custom.diskSize : diskDefault;

    // StorageOpt - محدودیت size برای overlay2
    const storageOpt = {};
    if (diskGB > 0) {
      storageOpt.size = `${diskGB}g`;
    }

    return {
      cpuCount,
      cpuNanos,
      memoryBytes,
      swapBytes,
      diskGB,
      storageOpt,
      blkioWeight: custom.blkioWeight || 500,
    };
  }

  /**
   * تبدیل رشته حافظه به بایت (مثلاً '256m' => 268435456)
   */
  _parseMemory(str) {
    if (typeof str === 'number') return str;
    const match = str.toString().match(/^(\d+)(b|k|m|g)?$/i);
    if (!match) return 256 * 1024 * 1024; // default 256MB

    const val = parseInt(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    switch (unit) {
      case 'b': return val;
      case 'k': return val * 1024;
      case 'm': return val * 1024 * 1024;
      case 'g': return val * 1024 * 1024 * 1024;
      default: return val * 1024 * 1024;
    }
  }

  /**
   * تبدیل بایت به رشته خوانا
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + sizes[i];
  }

  /**
   * دریافت آمار مصرف منابع یک کانتینر
   */
  async getContainerResourceUsage(containerName) {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();
      const container = docker.getContainer(containerName);
      
      // آمار لحظه‌ای
      const stats = await container.stats({ stream: false });
      
      // محاسبه CPU usage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      const cpuPercent = systemDelta > 0 
        ? (cpuDelta / systemDelta) * cpuCount * 100 
        : 0;

      // حافظه
      const memUsage = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 0;
      const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

      // اطلاعات دیسک
      const diskInfo = await this._getContainerDiskUsage(container);

      return {
        containerName,
        cpu: {
          usage: parseFloat(cpuPercent.toFixed(2)),
          cores: cpuCount,
        },
        memory: {
          usage: memUsage,
          usageFormatted: this.formatBytes(memUsage),
          limit: memLimit,
          limitFormatted: this.formatBytes(memLimit),
          percent: parseFloat(memPercent.toFixed(1)),
        },
        disk: diskInfo,
      };
    } catch (err) {
      return {
        containerName,
        error: err.message,
      };
    }
  }

  /**
   * دریافت مصرف دیسک کانتینر
   */
  async _getContainerDiskUsage(container) {
    try {
      const exec = await container.exec({
        Cmd: ['sh', '-c', 'df -B1 /var/www/html 2>/dev/null || df -B1 / 2>/dev/null'],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: false, Detach: false });
      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          // Parse df output: Filesystem 1B-blocks Used Available Use% Mounted
          const lines = output.trim().split('\n');
          if (lines.length < 2) {
            resolve({ usage: 0, usageFormatted: '0B', limit: 0, limitFormatted: '0B', percent: 0 });
            return;
          }
          const parts = lines[1].split(/\s+/);
          if (parts.length >= 4) {
            const total = parseInt(parts[1]) || 0;
            const used = parseInt(parts[2]) || 0;
            const avail = parseInt(parts[3]) || 0;
            const percent = total > 0 ? (used / total) * 100 : 0;
            resolve({
              usage: used,
              usageFormatted: this.formatBytes(used),
              limit: total,
              limitFormatted: this.formatBytes(total),
              available: avail,
              availableFormatted: this.formatBytes(avail),
              percent: parseFloat(percent.toFixed(1)),
            });
          } else {
            resolve({ usage: 0, usageFormatted: '0B', limit: 0, limitFormatted: '0B', percent: 0 });
          }
        });
        stream.on('error', () => resolve({ usage: 0, usageFormatted: '0B', limit: 0, limitFormatted: '0B', percent: 0 }));
      });
    } catch (e) {
      return { usage: 0, usageFormatted: '0B', limit: 0, limitFormatted: '0B', percent: 0 };
    }
  }

  /**
   * اعمال XFS Project Quota برای یک مسیر
   * (فقط در لینوکس با XFS کار می‌کند)
   */
  async applyXfsQuota(projectName, path, hardLimitGB) {
    const { execSync } = require('child_process');
    try {
      // بررسی وجود xfs_quota
      execSync('which xfs_quota', { stdio: 'ignore' });
      
      const projectId = this._hashProjectName(projectName);
      const hardLimitB = hardLimitGB * 1024 * 1024 * 1024;

      // ایجاد پروژه
      execSync(
        `echo "${projectId}:${path}" >> /etc/projects && ` +
        `echo "${projectName}:${projectId}" >> /etc/projid && ` +
        `xfs_quota -x -c "project -s ${projectName}" ` +
        `-c "limit -p bhard=${hardLimitB} ${projectName}" /`,
        { stdio: 'pipe', timeout: 10000 }
      );

      return { success: true, projectName, path, limitGB: hardLimitGB };
    } catch (e) {
      // XFS quota در دسترس نیست - بی‌صدا رد میشه
      return { success: false, error: 'XFS quota not available or not supported' };
    }
  }

  /**
   * هش کردن نام پروژه به عدد (برای XFS project ID)
   */
  _hashProjectName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 2147483648; // range: 1 to 2^31-1
  }

  /**
   * ادغام عمیق دو آبجکت
   */
  _mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._mergeDeep(target[key], source[key]);
      } else if (source[key] !== undefined) {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * دریافت تنظیمات فعلی
   */
  getLimits() {
    return JSON.parse(JSON.stringify(this.limits));
  }

  /**
   * دریافت پیش‌فرض‌ها
   */
  getDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_LIMITS));
  }

  /**
   * اعمال محدودیت‌ها روی یک کانتینر در حال اجرا
   * (بروزرسانی داینامیک محدودیت‌ها)
   */
  async updateRunningContainerLimits(containerName, newLimits) {
    try {
      const Docker = require('dockerode');
      const docker = new Docker();
      const container = docker.getContainer(containerName);

      const updateConfig = {};

      if (newLimits.cpu !== undefined) {
        updateConfig.NanoCpus = Math.round(newLimits.cpu * 1e9);
      }
      if (newLimits.memory) {
        updateConfig.Memory = this._parseMemory(newLimits.memory);
      }
      if (newLimits.memorySwap) {
        updateConfig.MemorySwap = this._parseMemory(newLimits.memorySwap);
      }

      if (Object.keys(updateConfig).length > 0) {
        await container.update(updateConfig);
      }

      return { success: true, message: 'Limits updated on running container' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ResourceLimitsManager();