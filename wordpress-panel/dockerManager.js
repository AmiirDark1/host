const Docker = require('dockerode');
const docker = new Docker();
const os = require('os');

class DockerManager {
  constructor() {
    this.containers = new Map();
    this.nextWpPort = 8080;
    this.nextDbPort = 3307;
  }

  getServerIp() {
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

  async getNextWpPort() {
    const usedPorts = new Set();
    try {
      const containers = await docker.listContainers({ all: true });
      for (const c of containers) {
        if (c.Ports) {
          for (const p of c.Ports) {
            if (p.PublicPort) usedPorts.add(p.PublicPort);
          }
        }
      }
    } catch (e) { /* ignore */ }
    
    let port = this.nextWpPort;
    while (usedPorts.has(port)) port++;
    this.nextWpPort = port + 1;
    return port;
  }

  async getNextDbPort() {
    const usedPorts = new Set();
    try {
      const containers = await docker.listContainers({ all: true });
      for (const c of containers) {
        if (c.Ports) {
          for (const p of c.Ports) {
            if (p.PublicPort) usedPorts.add(p.PublicPort);
          }
        }
      }
    } catch (e) { /* ignore */ }
    
    let port = this.nextDbPort;
    while (usedPorts.has(port)) port++;
    this.nextDbPort = port + 1;
    return port;
  }

  async ensureNetwork() {
    try {
      const network = docker.getNetwork('wordpress-net');
      const data = await network.inspect();
      return network;
    } catch (err) {
      const network = await docker.createNetwork({
        Name: 'wordpress-net',
        Driver: 'bridge',
      });
      return network;
    }
  }

  async createWordPressInstance(instanceName, userId, domain) {
    const network = await this.ensureNetwork();
    const serverIp = this.getServerIp();
    const wpPort = await this.getNextWpPort();
    const dbPort = await this.getNextDbPort();

    const dbName = `wp_db_${instanceName}`;
    const dbUser = `wp_user_${instanceName}`;
    const dbPassword = Math.random().toString(36).substring(2, 15) + 'Aa1!';
    
    const containerName = `wp-${instanceName}`;
    const dbContainerName = `db-${instanceName}`;

    try {
      // Create MySQL container with exposed port for external admin access
      const dbContainer = await docker.createContainer({
        name: dbContainerName,
        Image: 'mysql:5.7',
        Env: [
          `MYSQL_ROOT_PASSWORD=${dbPassword}`,
          `MYSQL_DATABASE=${dbName}`,
          `MYSQL_USER=${dbUser}`,
          `MYSQL_PASSWORD=${dbPassword}`,
        ],
        ExposedPorts: {
          '3306/tcp': {},
        },
        HostConfig: {
          NetworkMode: 'wordpress-net',
          RestartPolicy: { Name: 'always' },
          PortBindings: {
            '3306/tcp': [{ HostPort: String(dbPort) }],
          },
        },
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'database',
        },
      });

      await dbContainer.start();
      console.log(`MySQL container ${dbContainerName} started on port ${dbPort}`);

      // Wait for MySQL to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Create WordPress container with exposed port
      const wpContainer = await docker.createContainer({
        name: containerName,
        Image: 'wordpress:latest',
        Env: [
          `WORDPRESS_DB_HOST=${dbContainerName}:3306`,
          `WORDPRESS_DB_USER=${dbUser}`,
          `WORDPRESS_DB_PASSWORD=${dbPassword}`,
          `WORDPRESS_DB_NAME=${dbName}`,
          `WORDPRESS_CONFIG_EXTRA=define('WP_SITEURL', 'http://${serverIp}:${wpPort}'); define('WP_HOME', 'http://${serverIp}:${wpPort}');`,
        ],
        ExposedPorts: {
          '80/tcp': {},
        },
        HostConfig: {
          NetworkMode: 'wordpress-net',
          RestartPolicy: { Name: 'always' },
          PortBindings: {
            '80/tcp': [{ HostPort: String(wpPort) }],
          },
          Links: [dbContainerName],
        },
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'wordpress',
          'wp-domain': domain,
        },
      });

      await wpContainer.start();
      console.log(`WordPress container ${containerName} started on port ${wpPort} for ${domain}`);

      const key = `${userId}-${instanceName}`;
      const instance = {
        instanceName,
        userId,
        domain,
        wpPort,
        dbPort,
        wpContainerId: wpContainer.id,
        dbContainerId: dbContainer.id,
        wpContainerName: containerName,
        dbContainerName: dbContainerName,
        status: 'running',
        url: `http://${serverIp}:${wpPort}`,
        serverIp,
        createdAt: new Date(),
      };
      
      this.containers.set(key, instance);
      return instance;
    } catch (err) {
      console.error('Error creating WordPress instance:', err);
      await this.cleanupFailedInstance(instanceName);
      throw err;
    }
  }

  async createMultipleInstances(userId, count, domains) {
    const instances = [];
    for (let i = 0; i < count; i++) {
      const instanceName = `${userId}-site-${i + 1}`;
      const domain = domains[i] || `site${i + 1}.${userId}.local`;
      try {
        const instance = await this.createWordPressInstance(instanceName, userId, domain);
        instances.push(instance);
      } catch (err) {
        console.error(`Failed to create instance ${instanceName}:`, err);
      }
    }
    return instances;
  }

  // Check if user owns a container
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

  // File Manager - List directory contents
  async listFiles(instanceName, containerType, path) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `ls -la ${path} 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const startResult = await exec.start({ Tty: true, Detach: false, stdin: false });
      const stream = startResult;
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = output.replace(/[^\x20-\x7E\n]/g, '').trim();
          resolve({ success: true, output: clean });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Read file content from container
  async readFile(instanceName, containerType, filePath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `cat ${filePath} 2>&1`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const startResult = await exec.start({ Tty: true, Detach: false, stdin: false });
      const stream = startResult;
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          const clean = output.replace(/[^\x20-\x7E\n]/g, '').trim();
          resolve({ success: true, content: clean });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Write file content to container
  async writeFile(instanceName, containerType, filePath, content) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      // Use base64 to avoid escaping issues
      const b64 = Buffer.from(content).toString('base64');
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `echo ${b64} | base64 -d > ${filePath}`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const startResult = await exec.start({ Tty: true, Detach: false, stdin: false });
      const stream = startResult;
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          resolve({ success: true, message: 'File saved successfully' });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Upload file to container
  async uploadFile(instanceName, containerType, destPath, content) {
    return this.writeFile(instanceName, containerType, destPath, content);
  }

  // Delete file/directory
  async deleteFile(instanceName, containerType, filePath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      const exec = await container.exec({
        Cmd: ['sh', '-c', `rm -rf ${filePath}`],
        AttachStdout: true,
        AttachStderr: true,
      });

      const startResult = await exec.start({ Tty: true, Detach: false, stdin: false });
      const stream = startResult;
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          resolve({ success: true, message: 'Deleted successfully' });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Create directory
  async createDir(instanceName, containerType, dirPath) {
    try {
      const containerName = containerType === 'db' ? `db-${instanceName}` : `wp-${instanceName}`;
      const container = docker.getContainer(containerName);
      
      const exec = await container.exec({
        Cmd: ['mkdir', '-p', dirPath],
        AttachStdout: true,
        AttachStderr: true,
      });

      const startResult = await exec.start({ Tty: true, Detach: false, stdin: false });
      const stream = startResult;
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', () => {
          resolve({ success: true, message: 'Directory created' });
        });
        stream.on('error', (err) => reject({ success: false, error: err.message }));
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

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

  async deleteInstance(instanceName) {
    try {
      await this.stopContainer(`db-${instanceName}`);
      await this.removeContainer(`db-${instanceName}`);
      await this.stopContainer(`wp-${instanceName}`);
      await this.removeContainer(`wp-${instanceName}`);

      // Clean up from in-memory map
      for (const [key, value] of this.containers) {
        if (value.instanceName === instanceName) {
          this.containers.delete(key);
          break;
        }
      }
      return true;
    } catch (err) {
      console.error('Error deleting instance:', err);
      throw err;
    }
  }

  async stopContainer(name) {
    try {
      const container = docker.getContainer(name);
      await container.stop();
    } catch (err) {
      if (err.statusCode !== 304) throw err;
    }
  }

  async removeContainer(name) {
    try {
      const container = docker.getContainer(name);
      await container.remove({ force: true });
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }
  }

  async listInstances(userId = null) {
    const allContainers = await docker.listContainers({
      all: true,
      filters: { label: ['wp-managed=true'] },
    });

    const instances = {};
    for (const containerInfo of allContainers) {
      const labels = containerInfo.Labels;
      const key = `${labels['wp-user']}-${labels['wp-instance']}`;

      if (!instances[key]) {
        let wpPort = null;
        let dbPort = null;
        let url = null;
        const serverIp = this.getServerIp();

        // Extract ports from container info
        if (containerInfo.Ports) {
          for (const p of containerInfo.Ports) {
            if (p.PrivatePort === 80) {
              wpPort = p.PublicPort;
              url = `http://${serverIp}:${wpPort}`;
            }
            if (p.PrivatePort === 3306) {
              dbPort = p.PublicPort;
            }
          }
        }

        instances[key] = {
          instanceName: labels['wp-instance'],
          userId: labels['wp-user'],
          domain: labels['wp-domain'] || null,
          status: containerInfo.State,
          wpPort,
          dbPort,
          wpContainerId: null,
          dbContainerId: null,
          url,
          serverIp,
          createdAt: null,
        };
      }

      if (labels['wp-type'] === 'wordpress') {
        instances[key].wpContainerId = containerInfo.Id;
        instances[key].status = containerInfo.State;
        // Update URL/port from the running container
        if (containerInfo.Ports) {
          for (const p of containerInfo.Ports) {
            if (p.PrivatePort === 80 && p.PublicPort) {
              instances[key].wpPort = p.PublicPort;
              instances[key].url = `http://${instances[key].serverIp}:${p.PublicPort}`;
            }
          }
        }
      } else if (labels['wp-type'] === 'database') {
        instances[key].dbContainerId = containerInfo.Id;
        if (containerInfo.Ports) {
          for (const p of containerInfo.Ports) {
            if (p.PrivatePort === 3306 && p.PublicPort) {
              instances[key].dbPort = p.PublicPort;
            }
          }
        }
      }
    }

    let result = Object.values(instances);
    if (userId) {
      result = result.filter(inst => inst.userId === userId);
    }
    return result;
  }

  async getStats() {
    const allContainers = await docker.listContainers({
      all: true,
      filters: { label: ['wp-managed=true'] },
    });
    
    const stats = {
      totalContainers: allContainers.length,
      running: allContainers.filter(c => c.State === 'running').length,
      stopped: allContainers.filter(c => c.State === 'exited').length,
      users: new Set(),
      instances: 0,
      wordpressContainers: allContainers.filter(c => c.Labels['wp-type'] === 'wordpress').length,
      databaseContainers: allContainers.filter(c => c.Labels['wp-type'] === 'database').length,
      serverIp: this.getServerIp(),
    };

    for (const c of allContainers) {
      stats.users.add(c.Labels['wp-user']);
    }
    
    stats.instances = stats.users.size;
    stats.users = stats.users.size;

    return stats;
  }
}

module.exports = new DockerManager();