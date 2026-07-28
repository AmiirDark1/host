const Docker = require('dockerode');
const docker = new Docker();
const os = require('os');

class DockerManager {
  constructor() {
    this.containers = new Map();
    this.networks = new Map();
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

    // Generate random port for WordPress (internal, not exposed)
    const dbPort = 3306 + Math.floor(Math.random() * 1000);
    
    const dbName = `wp_db_${instanceName}`;
    const dbUser = `wp_user_${instanceName}`;
    const dbPassword = Math.random().toString(36).substring(2, 15);
    
    const containerName = `wp-${instanceName}`;
    const dbContainerName = `db-${instanceName}`;

    try {
      // Create MySQL container
      const dbContainer = await docker.createContainer({
        name: dbContainerName,
        Image: 'mysql:5.7',
        Env: [
          `MYSQL_ROOT_PASSWORD=${dbPassword}`,
          `MYSQL_DATABASE=${dbName}`,
          `MYSQL_USER=${dbUser}`,
          `MYSQL_PASSWORD=${dbPassword}`,
        ],
        HostConfig: {
          NetworkMode: 'wordpress-net',
          RestartPolicy: { Name: 'always' },
        },
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'database',
        },
      });

      await dbContainer.start();
      console.log(`MySQL container ${dbContainerName} started`);

      // Wait for MySQL to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Create WordPress container with Traefik labels for reverse proxy
      const labels = {
        'wp-managed': 'true',
        'wp-user': userId,
        'wp-instance': instanceName,
        'wp-type': 'wordpress',
        'traefik.enable': 'true',
      };
      labels['traefik.http.routers.wp-' + instanceName + '.rule'] = 'Host(`' + domain + '`)';
      labels['traefik.http.routers.wp-' + instanceName + '.entrypoints'] = 'web';
      labels['traefik.http.services.wp-' + instanceName + '.loadbalancer.server.port'] = '80';

      const wpContainer = await docker.createContainer({
        name: containerName,
        Image: 'wordpress:latest',
        Env: [
          `WORDPRESS_DB_HOST=${dbContainerName}:3306`,
          `WORDPRESS_DB_USER=${dbUser}`,
          `WORDPRESS_DB_PASSWORD=${dbPassword}`,
          `WORDPRESS_DB_NAME=${dbName}`,
          `WORDPRESS_CONFIG_EXTRA=define('WP_SITEURL', 'http://${domain}'); define('WP_HOME', 'http://${domain}');`,
        ],
        HostConfig: {
          NetworkMode: 'wordpress-net',
          RestartPolicy: { Name: 'always' },
          Links: [dbContainerName],
        },
        Labels: labels,
      });

      await wpContainer.start();
      console.log(`WordPress container ${containerName} started for domain ${domain}`);

      const key = `${userId}-${instanceName}`;
      const instance = {
        instanceName,
        userId,
        domain,
        wpPort: 80, // internal port, served via Traefik
        dbPort,
        wpContainerId: wpContainer.id,
        dbContainerId: dbContainer.id,
        wpContainerName: containerName,
        dbContainerName: dbContainerName,
        status: 'running',
        url: `http://${domain}`,
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
        instances[key] = {
          instanceName: labels['wp-instance'],
          userId: labels['wp-user'],
          domain: labels['traefik.enable'] ? 'domain_set' : null,
          status: 'running',
          wpPort: null,
          wpContainerId: null,
          dbContainerId: null,
          url: null,
          serverIp: this.getServerIp(),
          createdAt: null,
        };
      }

      if (labels['wp-type'] === 'wordpress') {
        instances[key].wpContainerId = containerInfo.Id;
        instances[key].status = containerInfo.State;
        // Extract domain from Traefik labels
        for (const [labelKey, labelValue] of Object.entries(labels)) {
          if (labelKey.includes('Host')) {
            instances[key].domain = labelValue.replace(/[`()]/g, '').replace('Host', '').trim();
            instances[key].url = `http://${instances[key].domain}`;
          }
        }
      } else if (labels['wp-type'] === 'database') {
        instances[key].dbContainerId = containerInfo.Id;
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