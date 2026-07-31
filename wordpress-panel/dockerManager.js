const Docker = require('dockerode');
const docker = new Docker();
const os = require('os');
const dns = require('dns');
const resourceLimits = require('./resourceLimits');

class DockerManager {
  constructor() {
    this.containers = new Map();
  }

  getServerIp() {
    // اول از متغیر محیطی بخون (وقتی توی Docker هستیم)
    if (process.env.SERVER_IP) {
      return process.env.SERVER_IP;
    }
    // بعد سعی کن از اینترنت بگیری
    try {
      const { execSync } = require('child_process');
      const ip = execSync('curl -s --max-time 5 https://api.ipify.org', { encoding: 'utf-8' }).trim();
      if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        return ip;
      }
    } catch {}
    // آخرین راه: از interface های شبکه بخون
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'SERVER_IP';
  }

  // =================================================================
  // بررسی DNS - چک می‌کند دامنه به IP سرور اشاره دارد یا نه
  // =================================================================
  async checkDomainDNS(domain) {
    return new Promise((resolve) => {
      // حذف پروتکل و مسیر اگر همراه دامنه آمده باشد
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      if (!cleanDomain) {
        return resolve({ ok: false, error: 'دامنه معتبر نیست' });
      }

      const serverIp = this.getServerIp();
      console.log(`🔍 DNS Check - Domain: ${cleanDomain}, ServerIP: ${serverIp}`);

      // سعی کن با dig resolve کنی (دقیق‌تر از dns.resolve4 توی کانتینر)
      try {
        const { execSync } = require('child_process');
        const digOutput = execSync(`nslookup ${cleanDomain} 2>/dev/null || echo 'FAILED'`, { encoding: 'utf-8', timeout: 5000 });
        console.log(`📡 dig output: ${digOutput.substring(0, 200)}`);
      } catch(e) {}

      dns.resolve4(cleanDomain, (err, addresses) => {
        if (err) {
          console.error(`❌ DNS resolve failed for ${cleanDomain}: ${err.code}`);
          return resolve({
            ok: false,
            error: `DNS برای ${cleanDomain} پیدا نشد (${err.code})`,
            dnsCheck: false,
            domain: cleanDomain
          });
        }

        // trim همه آیپی‌ها برای مقایسه دقیق
        const trimmedAddresses = addresses.map(ip => ip.trim());
        const trimmedServerIp = serverIp.trim();
        const matches = trimmedAddresses.filter(ip => ip === trimmedServerIp);

        console.log(`   📊 resolved: [${trimmedAddresses.join(', ')}], server: [${trimmedServerIp}], matches: ${matches.length}`);

        if (matches.length === 0) {
          // راه دوم: سعی کن از طریق curl api.ipify.org آیپی رو بگیری و دوباره مقایسه کن
          try {
            const { execSync } = require('child_process');
            const externalIp = execSync('curl -s --max-time 5 https://api.ipify.org', { encoding: 'utf-8' }).trim();
            console.log(`   🌐 external IP from api.ipify: ${externalIp}`);
            
            const extMatch = trimmedAddresses.filter(ip => ip === externalIp);
            if (extMatch.length > 0) {
              console.log(`   ✅ DNS matches external IP (${externalIp})`);
              return resolve({
                ok: true,
                domain: cleanDomain,
                dnsCheck: true,
                resolvedIps: addresses,
                serverIp: externalIp,
                message: `✅ DNS تأیید شد - ${cleanDomain} → ${externalIp}`
              });
            }
          } catch(e) {}

          return resolve({
            ok: false,
            error: `DNS ${cleanDomain} به این سرور اشاره نمی‌کند. آی‌پی‌های فعلی: ${addresses.join(', ')}`,
            dnsCheck: false,
            domain: cleanDomain,
            resolvedIps: addresses,
            serverIp
          });
        }

        return resolve({
          ok: true,
          domain: cleanDomain,
          dnsCheck: true,
          resolvedIps: addresses,
          serverIp,
          message: `✅ DNS تأیید شد - ${cleanDomain} → ${serverIp}`
        });
      });
    });
  }

  // =================================================================
  // بررسی وضعیت SSL برای یک دامنه
  // =================================================================
  async getDomainSSLStatus(domain) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        // چک می‌کنیم آیا گواهی در پوشه certs وجود دارد
        const certPath = `./infrastructure/nginx/certs/${domain}/fullchain.pem`;
        const fs = require('fs');
        
        if (fs.existsSync(certPath)) {
          // گواهی موجود است - تاریخ انقضا را چک می‌کنیم
          try {
            const certData = fs.readFileSync(
              `./infrastructure/nginx/certs/${domain}/fullchain.pem`,
              'utf-8'
            );
            // استخراج تاریخ انقضا از گواهی (ساده شده)
            const expiryMatch = certData.match(/notAfter=(.+?)\n/);
            const expiryDate = expiryMatch ? expiryMatch[1] : 'نامشخص';
            
            resolve({
              status: 'active',
              domain,
              expiryDate,
              message: `✅ SSL فعال است - ${domain}`
            });
          } catch (e) {
            resolve({
              status: 'error',
              domain,
              message: `⚠️ خطا در خواندن گواهی: ${e.message}`
            });
          }
        } else {
          resolve({
            status: 'pending',
            domain,
            message: `⏳ SSL در حال صدور برای ${domain} (تا ۳۰ ثانیه طول می‌کشد)`
          });
        }
      });
    } catch (err) {
      return { status: 'error', domain, message: err.message };
    }
  }

  // =================================================================
  // اطمینان از وجود شبکه‌های مورد نیاز
  // =================================================================
  async ensureNetworks() {
    const networks = {};

    // شبکه داخلی برای ارتباط WordPress-DB
    try {
      networks.internal = docker.getNetwork('wordpress-net');
      await networks.internal.inspect();
    } catch (err) {
      networks.internal = await docker.createNetwork({
        Name: 'wordpress-net',
        Driver: 'bridge',
        Internal: true,  // فقط داخلی - امنیت بیشتر
      });
    }

    // شبکه عمومی برای Nginx Proxy
    try {
      networks.proxy = docker.getNetwork('nginx-proxy');
      await networks.proxy.inspect();
    } catch (err) {
      console.log('⚠️ شبکه nginx-proxy وجود ندارد. لطفاً ابتدا زیرساخت را راه‌اندازی کنید:');
      console.log('   cd infrastructure && bash setup.sh && docker-compose up -d');
      throw new Error('شبکه nginx-proxy یافت نشد. لطفاً ابتدا زیرساخت را راه‌اندازی کنید.');
    }

    return networks;
  }

  // =================================================================
  // ایجاد یک نمونه WordPress با دامنه
  // resources = { wpDiskSize, dbDiskSize, wpCpu, dbCpu, wpMemory, dbMemory }
  // =================================================================
  async createWordPressInstance(instanceName, userId, domain, resources = {}) {
    // اول DNS را چک می‌کنیم
    const dnsCheck = await this.checkDomainDNS(domain);
    if (!dnsCheck.ok) {
      throw new Error(dnsCheck.error);
    }

    const networks = await this.ensureNetworks();
    const serverIp = this.getServerIp();

    // تمیز کردن دامنه
    let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

    const dbName = `wp_db_${instanceName}`;
    const dbUser = `wp_user_${instanceName}`;
    const dbPassword = Math.random().toString(36).substring(2, 15) + 'Aa1!';
    
    const containerName = `wp-${instanceName}`;
    const dbContainerName = `db-${instanceName}`;

    try {
      // ===== CREATE MYSQL DATABASE CONTAINER =====
      // اعمال محدودیت‌های منابع (CPU, RAM, Disk) روی کانتینر دیتابیس
      // مقدار اختصاصی هر سایت (resources) اولویت دارد، وگرنه پیش‌فرض
      const dbLimits = resourceLimits.getContainerHostConfig('db', {
        cpu: resources.dbCpu,
        memory: resources.dbMemory,
        diskSize: resources.dbDiskSize,
      });
      let dbImage = 'mariadb:10.11';
      // اگر متغیر محیطی MIRROR_REGISTRY ست شده باشه ازش استفاده کن (برای سرورهای چین)
      if (process.env.MIRROR_REGISTRY) {
        dbImage = `${process.env.MIRROR_REGISTRY}/library/mariadb:10.11`;
      }
      const dbContainer = await docker.createContainer({
        name: dbContainerName,
        Image: dbImage,
        Env: [
          `MYSQL_ROOT_PASSWORD=${dbPassword}`,
          `MYSQL_DATABASE=${dbName}`,
          `MYSQL_USER=${dbUser}`,
          `MYSQL_PASSWORD=${dbPassword}`,
        ],
        HostConfig: {
          NetworkMode: 'wordpress-net',
          ...dbLimits,
        },
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'database',
          'wp-domain': cleanDomain,
        },
      });

      await dbContainer.start();
      console.log(`✅ MySQL ${dbContainerName} started`);

      // Wait for MySQL to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));

      // ===== CREATE WORDPRESS CONTAINER =====
      // این کانتینر به دو شبکه متصل می‌شود:
      // 1. wordpress-net (داخلی) - برای ارتباط با MySQL
      // 2. nginx-proxy (عمومی) - برای دریافت ترافیک از Nginx
      //
      // اعمال محدودیت‌های منابع (CPU, RAM, Disk) روی کانتینر وردپرس
      // مقدار اختصاصی هر سایت (resources) اولویت دارد، وگرنه پیش‌فرض
      const wpLimits = resourceLimits.getContainerHostConfig('wp', {
        cpu: resources.wpCpu,
        memory: resources.wpMemory,
        diskSize: resources.wpDiskSize,
      });
      let wpImage = 'wordpress:latest';
      // اگر متغیر محیطی MIRROR_REGISTRY ست شده باشه ازش استفاده کن (برای سرورهای چین)
      if (process.env.MIRROR_REGISTRY) {
        wpImage = `${process.env.MIRROR_REGISTRY}/library/wordpress:latest`;
      }
      const wpContainer = await docker.createContainer({
        name: containerName,
        Image: wpImage,
        Env: [
          `WORDPRESS_DB_HOST=${dbContainerName}:3306`,
          `WORDPRESS_DB_USER=${dbUser}`,
          `WORDPRESS_DB_PASSWORD=${dbPassword}`,
          `WORDPRESS_DB_NAME=${dbName}`,

          // ===== مهم: متغیرهای Nginx Proxy =====
          `VIRTUAL_HOST=${cleanDomain}`,           // دامنه اصلی
          `VIRTUAL_PORT=80`,                        // پورت داخلی وردپرس
          `LETSENCRYPT_HOST=${cleanDomain}`,        // دامنه برای SSL
          `LETSENCRYPT_EMAIL=admin@${cleanDomain}`, // ایمیل برای Let's Encrypt

          // تنظیمات URL وردپرس با دامنه
          `WORDPRESS_CONFIG_EXTRA=define('WP_SITEURL', 'https://${cleanDomain}'); define('WP_HOME', 'https://${cleanDomain}'); define('FORCE_SSL_ADMIN', true);`,
        ],
        HostConfig: wpLimits,
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'wordpress',
          'wp-domain': cleanDomain,
        },
      });

      await wpContainer.start();
      console.log(`✅ WordPress ${containerName} started for ${cleanDomain}`);

      // ===== CONNECT TO NETWORKS =====
      // اتصال کانتینر وردپرس به شبکه داخلی wordpress-net (برای ارتباط با دیتابیس)
      const wpInternalNet = docker.getNetwork('wordpress-net');
      await wpInternalNet.connect({ Container: containerName });
      console.log(`   📡 Connected ${containerName} to wordpress-net`);

      // اتصال کانتینر وردپرس به شبکه Nginx Proxy (برای دریافت ترافیک)
      const wpProxyNet = docker.getNetwork('nginx-proxy');
      await wpProxyNet.connect({ Container: containerName });
      console.log(`   📡 Connected ${containerName} to nginx-proxy`);

      // کمی صبر می‌کنیم تا Nginx Proxy کانتینر جدید را شناسایی کند
      await new Promise(resolve => setTimeout(resolve, 2000));

      const key = `${userId}-${instanceName}`;
      const instance = {
        instanceName,
        userId,
        domain: cleanDomain,
        wpContainerId: wpContainer.id,
        dbContainerId: dbContainer.id,
        wpContainerName: containerName,
        dbContainerName: dbContainerName,
        status: 'running',
        url: `https://${cleanDomain}`,
        serverIp,
        sslStatus: 'pending',  // SSL در حال صدور
        resources: {
          wpDiskSize: resources.wpDiskSize || null,
          dbDiskSize: resources.dbDiskSize || null,
          wpCpu: resources.wpCpu || null,
          dbCpu: resources.dbCpu || null,
          wpMemory: resources.wpMemory || null,
          dbMemory: resources.dbMemory || null,
        },
        createdAt: new Date(),
      };
      
      this.containers.set(key, instance);

      // شروع بررسی SSL در پس‌زمینه (بعد از ۵ ثانیه چک می‌کند)
      setTimeout(() => this.checkAndUpdateSSLStatus(instance), 5000);

      return instance;
    } catch (err) {
      console.error('❌ Error creating WordPress instance:', err);
      await this.cleanupFailedInstance(instanceName);
      throw err;
    }
  }

  // =================================================================
  // بررسی و بروزرسانی وضعیت SSL در پس‌زمینه
  // =================================================================
  async checkAndUpdateSSLStatus(instance) {
    try {
      const sslStatus = await this.getDomainSSLStatus(instance.domain);
      // بروزرسانی در حافظه
      for (const [key, val] of this.containers) {
        if (val.instanceName === instance.instanceName) {
          val.sslStatus = sslStatus.status;
          break;
        }
      }
    } catch (e) {
      console.log(`SSL check pending for ${instance.domain}: ${e.message}`);
    }
  }

  // =================================================================
  // ایجاد چندین نمونه به صورت Bulk (3 یا 6 تایی)
  // resources = { wpDiskSize, dbDiskSize, wpCpu, dbCpu, wpMemory, dbMemory }
  // =================================================================
  async createMultipleInstances(userId, count, domains, resources = {}) {
    const instances = [];
    const errors = [];

    // اول DNS همه دامنه‌ها را چک می‌کنیم
    for (let i = 0; i < count; i++) {
      const dnsCheck = await this.checkDomainDNS(domains[i]);
      if (!dnsCheck.ok) {
        errors.push(`دامنه ${domains[i]}: ${dnsCheck.error}`);
      }
    }

    if (errors.length > 0) {
      throw new Error('خطاهای DNS:\n' + errors.join('\n'));
    }

    // همه چک‌ها OK - می‌سازیم
    for (let i = 0; i < count; i++) {
      const instanceName = `${userId}-site-${i + 1}`;
      try {
        const instance = await this.createWordPressInstance(
          instanceName,
          userId,
          domains[i],
          resources
        );
        instances.push(instance);
      } catch (err) {
        console.error(`❌ Failed to create instance ${instanceName}:`, err);
        errors.push(`خطا در ساخت ${domains[i]}: ${err.message}`);
      }
    }

    return { instances, errors };
  }

  // =================================================================
  // بررسی مالکیت کانتینر توسط کاربر
  // =================================================================
  async userOwnsContainer(containerName, userId) {
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      const labels = info.Config.Labels || {};
      return labels['wp-user'] === userId;
    } catch (e) {
      return false;
    }
  }

  // =================================================================
  // متد کمکی: فرمان در کانتینر اجرا کن
  // =================================================================
  async _execInContainer(containerName, cmd) {
    const container = docker.getContainer(containerName);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ Tty: false, Detach: false });
    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk) => { output += chunk.toString(); });
      stream.on('end', () => {
        resolve(this._cleanOutput(output));
      });
      stream.on('error', (err) => reject(err.message));
    });
  }

  _cleanOutput(output) {
    let cleaned = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    cleaned = cleaned.replace(/\r/g, '');
    return cleaned.trim();
  }

  _escapePath(path) {
    return path.replace(/'/g, "'\\\\''");
  }

  // =================================================================
  // قفل مسیر فایل منیجر - فقط /var/www/html برای کانتینر wp
  // =================================================================
  _resolveWpPath(path) {
    const base = '/var/www/html';
    if (!path || path === '/' || path === '.' || path === '') return base;

    // اگر قبلاً با /var/www/html شروع شده، نرمالایز کن
    let cleanPath = path.startsWith(base)
      ? path
      : base + (path.startsWith('/') ? path : '/' + path);

    // حذف اسلش‌های اضافی و اسلش انتهایی
    cleanPath = cleanPath.replace(/\/+/g, '/').replace(/\/$/, '');

    // جلوگیری از path traversal
    if (cleanPath.startsWith(base)) return cleanPath || base;

    return base;
  }

  // =================================================================
  // File Manager - List directory contents
  // =================================================================
  async listFiles(instanceName, containerType, path) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      // اگر wp است، مسیر را قفل کن به /var/www/html
      const resolvedPath = containerType === 'wp' ? this._resolveWpPath(path) : path;
      const escapedPath = this._escapePath(resolvedPath);
      const container = docker.getContainer(containerName);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `ls -la '${escapedPath}' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          resolve({ success: true, output: clean });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // Read file content from container
  // =================================================================
  async readFile(instanceName, containerType, filePath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      const resolvedPath = containerType === 'wp' ? this._resolveWpPath(filePath) : filePath;
      const escapedPath = this._escapePath(resolvedPath);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `cat '${escapedPath}' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          resolve({ success: true, content: clean });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // Write file to container using tar-stream (works on ALL containers)
  // =================================================================
  async writeFile(instanceName, containerType, filePath, content) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      // قفل مسیر به /var/www/html برای wp
      const resolvedFilePath = containerType === 'wp' ? this._resolveWpPath(filePath) : filePath;
      
      const tar = require('tar-stream');
      const pack = tar.pack();
      
      const normalizedPath = resolvedFilePath.replace(/\\/g, '/');
      const lastSlash = normalizedPath.lastIndexOf('/');
      const dirPath = lastSlash > 0 ? normalizedPath.substring(0, lastSlash) : '/';
      const fileName = lastSlash >= 0 ? normalizedPath.substring(lastSlash + 1) : normalizedPath;
      
      pack.entry({ name: fileName }, Buffer.from(content, 'utf-8'));
      pack.finalize();
      
      const chunks = [];
      for await (const chunk of pack) {
        chunks.push(chunk);
      }
      const tarBuffer = Buffer.concat(chunks);
      
      await container.putArchive(tarBuffer, { path: dirPath });
      
      return { success: true, message: 'File saved successfully' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // Upload file (alias for writeFile)
  // =================================================================
  async uploadFile(instanceName, containerType, destPath, content) {
    return this.writeFile(instanceName, containerType, destPath, content);
  }

  // =================================================================
  // Delete file/directory
  // =================================================================
  async deleteFile(instanceName, containerType, filePath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      const resolvedPath = containerType === 'wp' ? this._resolveWpPath(filePath) : filePath;
      const escapedPath = this._escapePath(resolvedPath);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `rm -rf '${escapedPath}'`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          resolve({ success: true, message: 'Deleted successfully' });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
        stream.resume();
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // Create directory
  // =================================================================
  async createDir(instanceName, containerType, dirPath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      const resolvedPath = containerType === 'wp' ? this._resolveWpPath(dirPath) : dirPath;
      
      const exec = await container.exec({
        Cmd: ['mkdir', '-p', resolvedPath],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });
      
      return new Promise((resolve) => {
        stream.on('end', () => {
          resolve({ success: true, message: 'Directory created' });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
        stream.resume();
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // File Manager - Rename file/directory
  // =================================================================
  async renameFile(instanceName, containerType, oldPath, newName) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);

      const resolvedOld = containerType === 'wp' ? this._resolveWpPath(oldPath) : oldPath;
      const oldDir = resolvedOld.substring(0, resolvedOld.lastIndexOf('/'));
      const resolvedNew = containerType === 'wp' ? this._resolveWpPath(`${oldDir}/${newName}`) : `${oldDir}/${newName}`;

      const escapedOld = this._escapePath(resolvedOld);
      const escapedNew = this._escapePath(resolvedNew);

      const exec = await container.exec({
        Cmd: ['sh', '-c', `mv '${escapedOld}' '${escapedNew}' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });

      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          if (clean && !clean.includes('No such file')) {
            return resolve({ success: true, message: `Renamed to ${newName}` });
          }
          resolve({ success: false, error: clean || 'Rename failed' });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // File Manager - Copy file/directory
  // =================================================================
  async copyFile(instanceName, containerType, srcPath, destDir) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);

      const resolvedSrc = containerType === 'wp' ? this._resolveWpPath(srcPath) : srcPath;
      const resolvedDestDir = containerType === 'wp' ? this._resolveWpPath(destDir) : destDir;

      const escapedSrc = this._escapePath(resolvedSrc);
      const escapedDest = this._escapePath(resolvedDestDir);

      const exec = await container.exec({
        Cmd: ['sh', '-c', `cp -r '${escapedSrc}' '${escapedDest}/' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });

      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          if (!clean) {
            return resolve({ success: true, message: 'Copied successfully' });
          }
          resolve({ success: false, error: clean });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // File Manager - Move file/directory
  // =================================================================
  async moveFile(instanceName, containerType, srcPath, destDir) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);

      const resolvedSrc = containerType === 'wp' ? this._resolveWpPath(srcPath) : srcPath;
      const resolvedDestDir = containerType === 'wp' ? this._resolveWpPath(destDir) : destDir;

      const escapedSrc = this._escapePath(resolvedSrc);
      const escapedDest = this._escapePath(resolvedDestDir);

      const exec = await container.exec({
        Cmd: ['sh', '-c', `mv '${escapedSrc}' '${escapedDest}/' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });

      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          if (!clean) {
            return resolve({ success: true, message: 'Moved successfully' });
          }
          resolve({ success: false, error: clean });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // File Manager - Download file as base64
  // =================================================================
  async downloadFile(instanceName, containerType, filePath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      const resolvedPath = containerType === 'wp' ? this._resolveWpPath(filePath) : filePath;
      const escapedPath = this._escapePath(resolvedPath);

      const exec = await container.exec({
        Cmd: ['sh', '-c', `base64 '${escapedPath}' 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Tty: true, Detach: false, stdin: false });

      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = this._cleanOutput(output);
          if (clean && !clean.includes('No such file')) {
            return resolve({ success: true, contentBase64: Buffer.from(clean, 'base64') });
          }
          resolve({ success: false, error: 'File not found' });
        });
        stream.on('error', (err) => resolve({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // Cleanup after failed creation
  // =================================================================
  async cleanupFailedInstance(instanceName) {
    try {
      const dbContainer = docker.getContainer(`db-${instanceName}`);
      await dbContainer.remove({ force: true });
    } catch (e) { /* ignore */ }
    try {
      const wpContainer = docker.getContainer(`wp-${instanceName}`);
      await wpContainer.remove({ force: true });
    } catch (e) { /* ignore */ }
  }

  // =================================================================
  // حذف کامل یک نمونه
  // =================================================================
  async deleteInstance(instanceName) {
    try {
      const containers = [
        { name: `db-${instanceName}`, type: 'database' },
        { name: `wp-${instanceName}`, type: 'wordpress' },
      ];

      for (const c of containers) {
        try {
          const container = docker.getContainer(c.name);
          const info = await container.inspect();

          // قطع اتصال از شبکه Nginx Proxy (برای کانتینر وردپرس)
          if (c.type === 'wordpress') {
            try {
              const proxyNet = docker.getNetwork('nginx-proxy');
              await proxyNet.disconnect({ Container: c.name, Force: true });
            } catch (e) { /* ignore */ }
          }

          await container.stop({ t: 5 }); // 5 ثانیه تایم‌اوت برای graceful shutdown
          await container.remove({ v: true }); // حذف ولوم‌های مرتبط
          console.log(`✅ Container ${c.name} removed`);
        } catch (e) {
          if (e.statusCode !== 404) console.error(`Error removing ${c.name}:`, e.message);
        }
      }

      // Clean up from in-memory map
      for (const [key, value] of this.containers) {
        if (value.instanceName === instanceName) {
          this.containers.delete(key);
          break;
        }
      }

      return { success: true, message: 'Instance deleted successfully' };
    } catch (err) {
      console.error('Error deleting instance:', err);
      throw err;
    }
  }

  // =================================================================
  // استارت/استاپ یک نمونه
  // =================================================================
  async startInstance(instanceName) {
    const containers = [`wp-${instanceName}`, `db-${instanceName}`];
    for (const name of containers) {
      try {
        const container = docker.getContainer(name);
        await container.start();
        console.log(`▶️ ${name} started`);
      } catch (e) {
        if (e.statusCode !== 304) throw e; // 304 = already started
      }
    }
    return { success: true, message: 'Instance started' };
  }

  async stopInstance(instanceName) {
    const containers = [`wp-${instanceName}`, `db-${instanceName}`];
    for (const name of containers) {
      try {
        const container = docker.getContainer(name);
        await container.stop({ t: 10 });
        console.log(`⏹️ ${name} stopped`);
      } catch (e) {
        if (e.statusCode !== 304) throw e; // 304 = already stopped
      }
    }
    return { success: true, message: 'Instance stopped' };
  }

  // =================================================================
  // دریافت لاگ‌های یک نمونه
  // =================================================================
  async getInstanceLogs(instanceName, type = 'wp', lines = 50) {
    const containerName = type === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
    try {
      const container = docker.getContainer(containerName);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: lines,
        timestamps: true,
      });
      return { success: true, logs: logs.toString('utf-8') };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // =================================================================
  // لیست همه نمونه‌ها
  // =================================================================
  async listInstances(userId = null) {
    try {
      const allContainers = await docker.listContainers({
        all: true,
        filters: { label: ['wp-managed=true'] },
      });

      const instances = {};
      for (const containerInfo of allContainers) {
        const labels = containerInfo.Labels;
        const key = `${labels['wp-user']}-${labels['wp-instance']}`;

        if (!instances[key]) {
          instances[key] = {
            instanceName: labels['wp-instance'],
            userId: labels['wp-user'],
            domain: labels['wp-domain'] || null,
            status: 'unknown',
            wpContainerId: null,
            dbContainerId: null,
            url: labels['wp-domain'] ? `https://${labels['wp-domain']}` : null,
            serverIp: this.getServerIp(),
            sslStatus: 'checking',
            createdAt: null,
          };
        }

        if (labels['wp-type'] === 'wordpress') {
          instances[key].wpContainerId = containerInfo.Id;
          instances[key].status = containerInfo.State;
        } else if (labels['wp-type'] === 'database') {
          instances[key].dbContainerId = containerInfo.Id;
        }
      }

      let result = Object.values(instances);
      if (userId) {
        result = result.filter(inst => inst.userId === userId);
      }

      // چک وضعیت SSL برای هر نمونه (در پس‌زمینه)
      for (const inst of result) {
        if (inst.domain && inst.status === 'running') {
          this.checkAndUpdateSSLStatus(inst);
        }
      }

      return result;
    } catch (err) {
      console.error('Error listing instances:', err);
      return [];
    }
  }

  // =================================================================
  // آمار سیستم
  // =================================================================
  async getStats() {
    try {
      const allContainers = await docker.listContainers({
        all: true,
        filters: { label: ['wp-managed=true'] },
      });
      
      const stats = {
        totalContainers: allContainers.length,
        running: allContainers.filter(c => c.State === 'running').length,
        stopped: allContainers.filter(c => c.State === 'exited').length,
        users: new Set(),
        wordpressContainers: allContainers.filter(c => c.Labels['wp-type'] === 'wordpress').length,
        databaseContainers: allContainers.filter(c => c.Labels['wp-type'] === 'database').length,
        serverIp: this.getServerIp(),
        activeDomains: 0,
      };

      for (const c of allContainers) {
        stats.users.add(c.Labels['wp-user']);
        if (c.Labels['wp-domain'] && c.State === 'running') {
          stats.activeDomains++;
        }
      }
      
      stats.instances = stats.users.size;
      stats.users = stats.users.size;

      return stats;
    } catch (err) {
      return {
        totalContainers: 0,
        running: 0,
        stopped: 0,
        users: 0,
        instances: 0,
        error: err.message,
      };
    }
  }
}

module.exports = new DockerManager();