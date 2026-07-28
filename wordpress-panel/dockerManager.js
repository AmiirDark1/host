const Docker = require('dockerode');
const docker = new Docker();

class DockerManager {
  constructor() {
    this.containers = new Map();
    this.networks = new Map();
  }

  async ensureNetwork() {
    try {
      const network = docker.getNetwork('wordpress-net');
      const data = await network.inspect();
      return network;
    } catch (err) {
      // Network doesn't exist, create it
      const network = await docker.createNetwork({
        Name: 'wordpress-net',
        Driver: 'bridge',
      });
      return network;
    }
  }

  async createWordPressInstance(instanceName, userId) {
    const network = await this.ensureNetwork();
    
    // Generate random port
    const wpPort = 8000 + Math.floor(Math.random() * 1000);
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
          PortBindings: {
            '3306/tcp': [{ HostPort: String(dbPort) }],
          },
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
      console.log(`MySQL container ${dbContainerName} started on port ${dbPort}`);

      // Wait for MySQL to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Create WordPress container
      const wpContainer = await docker.createContainer({
        name: containerName,
        Image: 'wordpress:latest',
        Env: [
          `WORDPRESS_DB_HOST=${dbContainerName}:3306`,
          `WORDPRESS_DB_USER=${dbUser}`,
          `WORDPRESS_DB_PASSWORD=${dbPassword}`,
          `WORDPRESS_DB_NAME=${dbName}`,
        ],
        HostConfig: {
          PortBindings: {
            '80/tcp': [{ HostPort: String(wpPort) }],
          },
          NetworkMode: 'wordpress-net',
          RestartPolicy: { Name: 'always' },
          Links: [dbContainerName],
        },
        Labels: {
          'wp-managed': 'true',
          'wp-user': userId,
          'wp-instance': instanceName,
          'wp-type': 'wordpress',
        },
      });

      await wpContainer.start();
      console.log(`WordPress container ${containerName} started on port ${wpPort}`);

      const key = `${userId}-${instanceName}`;
      this.containers.set(key, {
        instanceName,
        userId,
        wpPort,
        dbPort,
        wpContainerId: wpContainer.id,
        dbContainerId: dbContainer.id,
        wpContainerName: containerName,
        dbContainerName: dbContainerName,
        status: 'running',
        url: `http://localhost:${wpPort}`,
        createdAt: new Date(),
      });

      return this.containers.get(key);
    } catch (err) {
      console.error('Error creating WordPress instance:', err);
      // Cleanup on failure
      await this.cleanupFailedInstance(instanceName);
      throw err;
    }
  }

  async createMultipleInstances(userId, count) {
    const instances = [];
    for (let i = 1; i <= count; i++) {
      const instanceName = `${userId}-site-${i}`;
      try {
        const instance = await this.createWordPressInstance(instanceName, userId);
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
      
      // Remove from map
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
      if (err.statusCode !== 304) throw err; // 304 = already stopped
    }
  }

  async removeContainer(name) {
    try {
      const container = docker.getContainer(name);
      await container.remove({ force: true });
    } catch (err) {
      if (err.statusCode !== 404) throw err; // 404 = not found
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
          status: 'running',
          wpPort: null,
          wpContainerId: null,
          dbContainerId: null,
          url: null,
          createdAt: null,
        };
      }

      if (labels['wp-type'] === 'wordpress') {
        instances[key].wpContainerId = containerInfo.Id;
        instances[key].wpPort = containerInfo.Ports[0]?.PublicPort;
        instances[key].url = `http://localhost:${instances[key].wpPort}`;
        instances[key].status = containerInfo.State;
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