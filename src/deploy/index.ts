/**
 * AgentDeployer - Deploy agents to Docker, Railway, Fly.io
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface DeployOptions {
  port?: number;
  env?: Record<string, string>;
  platform?: 'docker' | 'railway' | 'fly' | 'render';
  replicas?: number;
}

export interface DeployResult {
  platform: string;
  success: boolean;
  url?: string;
  message: string;
  files?: string[];
}

export class AgentDeployer {
  /**
   * Generate Dockerfile for the agent
   */
  async generateDockerfile(agentDir: string, options?: DeployOptions): Promise<string> {
    const port = options?.port || 3000;
    const pkgPath = path.join(agentDir, 'package.json');
    let startCmd = 'node src/index.js';
    
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.start) {
          startCmd = pkg.scripts.start;
        }
        if (pkg.main) {
          startCmd = `node ${pkg.main}`;
        }
      } catch {}
    }

    return `FROM node:22-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY . .

# Build if needed
RUN if [ -f "tsconfig.json" ]; then npx tsc || true; fi

EXPOSE ${port}

ENV NODE_ENV=production
ENV PORT=${port}

CMD ["${startCmd.split(' ')[0]}", ${startCmd.split(' ').slice(1).map(s => `"${s}"`).join(', ')}]
`;
  }

  /**
   * Generate docker-compose.yml
   */
  async generateCompose(agentDir: string, options?: DeployOptions): Promise<string> {
    const port = options?.port || 3000;
    const replicas = options?.replicas || 1;
    const agentName = path.basename(agentDir).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'opc-agent';
    
    const envLines = options?.env 
      ? Object.entries(options.env).map(([k, v]) => `      - ${k}=${v}`).join('\n')
      : '';

    return `version: "3.8"

services:
  ${agentName}:
    build: .
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
      - PORT=${port}
${envLines ? envLines + '\n' : ''}    restart: unless-stopped
${replicas > 1 ? `    deploy:\n      replicas: ${replicas}` : ''}
    volumes:
      - agent-data:/app/data

volumes:
  agent-data:
`;
  }

  /**
   * Deploy to Railway (via CLI)
   */
  async deployRailway(agentDir: string): Promise<DeployResult> {
    try {
      execSync('railway version', { stdio: 'pipe' });
    } catch {
      return { platform: 'railway', success: false, message: 'Railway CLI not installed. Run: npm i -g @railway/cli' };
    }

    try {
      // Ensure Dockerfile exists
      const dockerfilePath = path.join(agentDir, 'Dockerfile');
      if (!fs.existsSync(dockerfilePath)) {
        const content = await this.generateDockerfile(agentDir);
        fs.writeFileSync(dockerfilePath, content);
      }

      const output = execSync('railway up --detach', { cwd: agentDir, encoding: 'utf-8' });
      const urlMatch = output.match(/(https:\/\/[^\s]+)/);
      return { 
        platform: 'railway', 
        success: true, 
        url: urlMatch?.[1],
        message: 'Deployed to Railway successfully' 
      };
    } catch (e: any) {
      return { platform: 'railway', success: false, message: e.message };
    }
  }

  /**
   * Deploy to Fly.io
   */
  async deployFly(agentDir: string): Promise<DeployResult> {
    try {
      execSync('fly version', { stdio: 'pipe' });
    } catch {
      return { platform: 'fly', success: false, message: 'Fly CLI not installed. Run: curl -L https://fly.io/install.sh | sh' };
    }

    try {
      const agentName = path.basename(agentDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // Generate fly.toml if not exists
      const flyTomlPath = path.join(agentDir, 'fly.toml');
      if (!fs.existsSync(flyTomlPath)) {
        fs.writeFileSync(flyTomlPath, `app = "${agentName}"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

[checks]
  [checks.alive]
    type = "tcp"
    port = 3000
`);
      }

      // Ensure Dockerfile exists
      const dockerfilePath = path.join(agentDir, 'Dockerfile');
      if (!fs.existsSync(dockerfilePath)) {
        const content = await this.generateDockerfile(agentDir);
        fs.writeFileSync(dockerfilePath, content);
      }

      const output = execSync('fly deploy', { cwd: agentDir, encoding: 'utf-8' });
      return { 
        platform: 'fly', 
        success: true, 
        url: `https://${agentName}.fly.dev`,
        message: 'Deployed to Fly.io successfully' 
      };
    } catch (e: any) {
      return { platform: 'fly', success: false, message: e.message };
    }
  }

  /**
   * Deploy locally via Docker
   */
  async deployLocal(agentDir: string, options?: DeployOptions): Promise<DeployResult> {
    try {
      execSync('docker version', { stdio: 'pipe' });
    } catch {
      return { platform: 'docker', success: false, message: 'Docker not installed or not running' };
    }

    const files: string[] = [];

    // Generate Dockerfile
    const dockerfilePath = path.join(agentDir, 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      fs.writeFileSync(dockerfilePath, await this.generateDockerfile(agentDir, options));
      files.push('Dockerfile');
    }

    // Generate docker-compose.yml
    const composePath = path.join(agentDir, 'docker-compose.yml');
    if (!fs.existsSync(composePath)) {
      fs.writeFileSync(composePath, await this.generateCompose(agentDir, options));
      files.push('docker-compose.yml');
    }

    try {
      execSync('docker compose up -d --build', { cwd: agentDir, stdio: 'inherit' });
      const port = options?.port || 3000;
      return { 
        platform: 'docker', 
        success: true, 
        url: `http://localhost:${port}`,
        message: 'Running locally via Docker',
        files 
      };
    } catch (e: any) {
      return { platform: 'docker', success: false, message: e.message, files };
    }
  }

  /**
   * Generate deployment files without deploying
   */
  async generateFiles(agentDir: string, options?: DeployOptions): Promise<DeployResult> {
    const files: string[] = [];
    const port = options?.port || 3000;

    const dockerfile = await this.generateDockerfile(agentDir, options);
    fs.writeFileSync(path.join(agentDir, 'Dockerfile'), dockerfile);
    files.push('Dockerfile');

    const compose = await this.generateCompose(agentDir, options);
    fs.writeFileSync(path.join(agentDir, 'docker-compose.yml'), compose);
    files.push('docker-compose.yml');

    // Generate .dockerignore
    const dockerignore = `node_modules
.git
.env
*.log
dist
`;
    fs.writeFileSync(path.join(agentDir, '.dockerignore'), dockerignore);
    files.push('.dockerignore');

    return {
      platform: 'docker',
      success: true,
      message: `Generated ${files.length} deployment files`,
      files,
    };
  }
}
