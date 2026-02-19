import { apiRequest, loadConfig } from './api.js';
import { log, colors, formatTable, sleep } from './utils.js';
import { getServiceDetails } from './services.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get CI/CD services in a project
export async function getCicdServices(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/getCICDServices', 'POST', {
    projectID: String(pid)
  });

  // API may return array directly or wrapped in object
  let services = [];
  if (Array.isArray(response)) {
    services = response;
  } else if (response.status === 'OK') {
    services = response.data?.services || [];
  } else if (response.status === 'KO' || response.message) {
    throw new Error(response.message || 'Failed to get CI/CD services');
  }

  if (services.length === 0) {
    log('info', 'No CI/CD targets found');
    return [];
  }

  const columns = [
    { key: 'displayName', label: 'Name' },
    { key: 'vmID', label: 'vmID' },
    { key: 'serverName', label: 'CNAME' },
    { key: 'vmProvider', label: 'Provider' },
    { key: 'vmRegion', label: 'Region' }
  ];

  // Normalize field names
  const data = services.map(s => ({
    displayName: s.displayName || s.name || 'N/A',
    vmID: s.providerServerID || s.vmID || 'N/A',
    serverName: s.serverName || 'N/A',
    vmProvider: s.vmProvider || s.provider || 'N/A',
    vmRegion: s.vmRegion || s.datacenter || 'N/A'
  }));

  console.log(`\n${colors.bold}CI/CD Targets (${services.length})${colors.reset}\n`);
  console.log(formatTable(data, columns));
  console.log('');

  return services;
}

// Get pipelines on a CI/CD target
export async function getServicePipelines(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/getServicePipelines', 'POST', {
    projectID: String(pid),
    vmID: String(vmID)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get pipelines');
  }

  // API returns data as array directly or nested in pipelines
  const pipelines = Array.isArray(response.data) ? response.data : (response.data?.pipelines || []);

  if (pipelines.length === 0) {
    log('info', `No pipelines on CI/CD target ${vmID}`);
    return [];
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'pipelineName', label: 'Name' },
    { key: 'type', label: 'Mode' },
    { key: 'status', label: 'Status' },
    { key: 'buildStatus', label: 'Build' }
  ];

  console.log(`\n${colors.bold}Pipelines on ${vmID}${colors.reset}\n`);
  console.log(formatTable(pipelines, columns));
  console.log('');

  return pipelines;
}

// Get pipeline details
export async function getPipelineDetails(vmID, pipelineID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/getPipelineDetails', 'POST', {
    vmID: String(vmID),
    projectID: String(pid),
    pipelineID: parseInt(pipelineID)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get pipeline details');
  }

  const pipeline = response.data;

  console.log(`\n${colors.bold}Pipeline ${pipelineID}${colors.reset}\n`);
  console.log(`  Name: ${pipeline.name || 'N/A'}`);
  console.log(`  Mode: ${pipeline.CICDMode || 'N/A'}`);
  console.log(`  Status: ${pipeline.status || 'N/A'}`);
  console.log(`  URL: ${pipeline.url || 'N/A'}`);
  if (pipeline.gitData) {
    console.log(`  Repo: ${pipeline.gitData.repoUrl || pipeline.gitData.repo || 'N/A'}`);
    console.log(`  Branch: ${pipeline.gitData.branch || 'N/A'}`);
  }
  console.log('');

  return pipeline;
}

// Get all pipelines in project
export async function getProjectPipelines(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/getProjectPipelines', 'POST', {
    projectID: String(pid)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get project pipelines');
  }

  return response.data?.pipelines || [];
}

// Create a pipeline
export async function createPipeline(configFile) {
  if (!configFile) {
    throw new Error('Config file required. Generate with: cicd init-pipeline docker > pipeline.json');
  }

  if (!fs.existsSync(configFile)) {
    throw new Error(`Config file not found: ${configFile}`);
  }

  const pipelineConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

  log('info', 'Creating pipeline...');
  const response = await apiRequest('/api/cicd/createCiCdExistServer', 'POST', pipelineConfig);

  if (response.status !== 'OK' && !response.providerServerID) {
    throw new Error(response.message || 'Failed to create pipeline');
  }

  log('success', 'Pipeline created');
  log('info', `  Service: ${response.serviceName || 'N/A'}`);
  log('info', `  Server ID: ${response.providerServerID || 'N/A'}`);

  return response;
}

// ============= AUTO PIPELINE CREATION =============

// Get authID for a git provider by checking existing pipelines or config
async function findGitAuthID(gitType, projectId) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  // Strategy 1: Check existing pipelines for authID (silent - no console output)
  try {
    const cicdResp = await apiRequest('/api/cicd/getCICDServices', 'POST', { projectID: String(pid) });
    const cicdServices = Array.isArray(cicdResp) ? cicdResp : (cicdResp.data?.services || []);
    for (const svc of cicdServices) {
      const vmID = svc.providerServerID || svc.vmID;
      try {
        const pipResp = await apiRequest('/api/cicd/getServicePipelines', 'POST', { projectID: String(pid), vmID: String(vmID) });
        const pipelines = Array.isArray(pipResp.data) ? pipResp.data : (pipResp.data?.pipelines || []);
        for (const p of pipelines) {
          if (p.type === gitType || p.mode === gitType) {
            const detResp = await apiRequest('/api/cicd/getPipelineDetails', 'POST', { vmID: String(vmID), projectID: String(pid), pipelineID: p.id });
            if (detResp.status === 'OK' && detResp.data?.authID) {
              return String(detResp.data.authID);
            }
          }
        }
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* no existing pipelines */ }

  return null;
}

// Get GitHub/GitLab orgs for an authID
async function getGitOrgs(authID, gitType, projectId) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  const response = await apiRequest('/api/cicd/getGitOrgs', 'POST', {
    projectID: String(pid),
    gitType,
    authID: String(authID)
  });

  if (response.status !== 'OK' && !response.data) {
    throw new Error(response.message || 'Failed to get git orgs');
  }

  return response.data?.scopeUsers || [];
}

// Get repos for an org/user
async function getGitRepos(authID, gitType, gitUser, projectId) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  const response = await apiRequest('/api/cicd/getRepoByOrg', 'POST', {
    projectID: String(pid),
    gitType,
    authID: String(authID),
    orgName: gitUser,
    gitUser
  });

  return response.data || response || [];
}

// Find a specific repo by owner/name
async function findRepo(authID, gitType, ownerRepo, projectId) {
  const [owner, repoName] = ownerRepo.split('/');
  if (!owner || !repoName) {
    throw new Error('Repo must be in "owner/repo" format');
  }

  const repos = await getGitRepos(authID, gitType, owner, projectId);
  if (!Array.isArray(repos)) {
    throw new Error('Failed to fetch repo list');
  }

  const repo = repos.find(r =>
    r.name?.toLowerCase() === repoName.toLowerCase() ||
    r.full_name?.toLowerCase() === ownerRepo.toLowerCase()
  );

  if (!repo) {
    const available = repos.map(r => r.name).join(', ');
    throw new Error(`Repo "${repoName}" not found. Available: ${available}`);
  }

  return repo;
}

// Get CI/CD target info
async function getCicdTargetInfo(vmID, projectId) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  // Get from cicd services list
  const response = await apiRequest('/api/cicd/getCICDServices', 'POST', {
    projectID: String(pid)
  });

  const services = Array.isArray(response) ? response : (response.data?.services || []);
  const target = services.find(s =>
    String(s.providerServerID) === String(vmID) ||
    String(s.vmID) === String(vmID)
  );

  if (!target) {
    throw new Error(`CI/CD target ${vmID} not found in project ${pid}`);
  }

  return {
    displayName: target.displayName || target.name,
    id: String(target.id || target.serverID),
    serverName: target.serverName || '',
    vmID: String(target.providerServerID || target.vmID)
  };
}

// Runtime config presets
const RUNTIME_PRESETS = {
  'static': {
    runtime: 'staticSPA',
    buildDir: '/dist',
    framework: 'Vite.js',
    buildCmd: 'npm run build',
    runCmd: '',
    installCmd: 'npm install',
    version: '20',
    containerPort: '3000'
  },
  'node': {
    runtime: 'node',
    buildDir: '/',
    framework: 'No Framework',
    buildCmd: 'npm run build',
    runCmd: 'npm start',
    installCmd: 'npm install',
    version: '20',
    containerPort: '3000'
  },
  'docker': {
    runtime: '',
    buildDir: '/',
    framework: '',
    buildCmd: '',
    runCmd: '',
    installCmd: '',
    version: '',
    containerPort: '80'
  }
};

// Dockerfile templates per app type
const DOCKERFILES = {
  static: (preset) => `# Build stage
FROM node:${preset.version}-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN ${preset.installCmd}
COPY . .
RUN ${preset.buildCmd}

# Serve stage
FROM nginx:alpine
COPY --from=build /app${preset.buildDir} /usr/share/nginx/html
RUN printf 'server {\\n  listen 3000;\\n  location / {\\n    root /usr/share/nginx/html;\\n    index index.html;\\n    try_files $uri $uri/ /index.html;\\n  }\\n}\\n' > /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
`,
  node: (preset) => `FROM node:${preset.version}-alpine
WORKDIR /app
COPY package*.json ./
RUN ${preset.installCmd}
COPY . .
RUN ${preset.buildCmd}
EXPOSE 3000
CMD ["npm", "start"]
`
};

// Generate docker-compose for a pipeline
function generateDockerCompose(pipelineName, domain) {
  return `services:
  app:
    container_name: ${pipelineName}
    image: ${pipelineName}
    restart: always
    build:
      context: .
    ports:
      - 172.17.0.1:3000:3000
    environment:
      DOMAIN: ${domain}
    env_file:
      - .env
`;
}

// Ensure SSH key exists and is added to the service
async function ensureSSHAccess(vmID, projectId) {
  const sshKeyPath = path.join(process.env.HOME || '/root', '.ssh', 'id_ed25519');
  const sshPubPath = sshKeyPath + '.pub';

  // Generate SSH key if it doesn't exist
  if (!fs.existsSync(sshKeyPath)) {
    log('info', 'Generating SSH key...');
    execSync(`ssh-keygen -t ed25519 -C "elestio-agent" -f ${sshKeyPath} -N "" -q`);
  }

  // Read public key (without comment)
  const pubKey = fs.readFileSync(sshPubPath, 'utf-8').trim().split(' ').slice(0, 2).join(' ');

  // Add to service (uses SSHPubKeysAdd action with name/key fields)
  log('info', 'Adding SSH key to service...');
  await apiRequest('/api/servers/DoActionOnServer', 'POST', {
    vmID: String(vmID),
    action: 'SSHPubKeysAdd',
    name: 'elestio-agent',
    key: pubKey
  });

  // Wait for key propagation
  log('info', 'Waiting for SSH key propagation...');
  await sleep(10000);

  return sshKeyPath;
}

// SSH options for all SSH/SCP commands
const SSH_OPTS = '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10';

// Run SSH command on a server
function sshExec(ip, command, timeout = 60000) {
  return execSync(
    `ssh ${SSH_OPTS} root@${ip} "${command.replace(/"/g, '\\"')}"`,
    { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

// Write a file to a remote server via SSH using base64 encoding
function sshWriteFile(ip, remotePath, content, timeout = 30000) {
  const b64 = Buffer.from(content).toString('base64');
  return execSync(
    `echo "${b64}" | ssh ${SSH_OPTS} root@${ip} "base64 -d > ${remotePath}"`,
    { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

// Post-deploy: fix Dockerfile, build and start via SSH
async function postDeployFix(vmID, pipelineName, appType, preset, projectId) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  // Get service IP
  log('info', 'Getting service IP...');
  const details = await getServiceDetails(vmID, pid);
  const ip = details.ipv4;
  if (!ip) throw new Error('Could not get service IP');

  // Ensure SSH access
  await ensureSSHAccess(vmID, pid);

  // Wait for the pipeline directory to be created
  log('info', 'Waiting for pipeline to initialize...');
  let retries = 12;
  while (retries > 0) {
    try {
      const result = sshExec(ip, `ls /opt/app/${pipelineName}/package.json 2>/dev/null && echo OK || echo WAIT`);
      if (result.includes('OK')) break;
    } catch (e) { /* retry */ }
    await sleep(10000);
    retries--;
  }
  if (retries === 0) {
    log('warn', 'Pipeline directory not ready, trying anyway...');
  }

  // Get the domain from the service URL
  const domain = details.cname ? `https://${details.cname}` :
    `https://${pipelineName}-u${details.userID || ''}.vm.elestio.app`;

  // Write correct Dockerfile
  log('info', 'Writing optimized Dockerfile...');
  const dockerfile = (DOCKERFILES[appType] || DOCKERFILES.static)(preset);
  sshWriteFile(ip, `/opt/app/${pipelineName}/Dockerfile`, dockerfile);

  // Write docker-compose
  log('info', 'Writing docker-compose.yml...');
  const compose = generateDockerCompose(pipelineName, domain);
  sshWriteFile(ip, `/opt/app/${pipelineName}/docker-compose.yml`, compose);

  // Build and start
  log('info', 'Building application (this may take a minute)...');
  sshExec(ip, `touch /opt/app/${pipelineName}/.env`);
  const buildOutput = sshExec(ip,
    `cd /opt/app/${pipelineName} && docker compose build --no-cache 2>&1 | tail -5`,
    300000
  );
  log('info', buildOutput.trim());

  log('info', 'Starting application...');
  sshExec(ip, `cd /opt/app/${pipelineName} && docker compose up -d 2>&1`);

  // Verify
  await sleep(3000);
  const httpCode = sshExec(ip, `curl -s -o /dev/null -w '%{http_code}' http://172.17.0.1:3000/`).trim();

  if (httpCode === '200') {
    log('success', `Site is live! HTTP ${httpCode}`);
  } else {
    log('warn', `Site returned HTTP ${httpCode} — may need a moment to start`);
  }

  return { ip, httpCode };
}

// Auto-create a pipeline with minimal input
// mode: 'github', 'github-fullstack', 'gitlab', 'gitlab-fullstack', 'docker'
export async function autoCreatePipeline(options = {}) {
  const config = loadConfig();
  const pid = options.project || config.defaultProject;

  if (!pid) throw new Error('Project ID required');
  if (!options.target) throw new Error('CI/CD target vmID required (--target)');
  if (!options.name) throw new Error('Pipeline name required (--name)');

  const mode = options.mode || 'github';

  // Determine git type and app type
  let gitType, appType;
  if (mode === 'docker') {
    gitType = null;
    appType = 'docker';
  } else if (mode.startsWith('gitlab')) {
    gitType = 'GITLAB';
    appType = mode === 'gitlab-fullstack' ? 'node' : 'static';
  } else {
    gitType = 'GITHUB';
    appType = mode === 'github-fullstack' ? 'node' : 'static';
  }

  // 1. Get CI/CD target info
  log('info', 'Getting CI/CD target info...');
  const target = await getCicdTargetInfo(options.target, pid);
  log('success', `Target: ${target.displayName} (${target.vmID})`);

  // 2. For git modes: find authID and repo
  let authID = options.authId ? String(options.authId) : null;
  let repoData = null;
  let gitUser = null;

  if (gitType) {
    if (!options.repo) throw new Error('Repo required for git modes (--repo owner/repo)');

    // Find authID
    if (!authID) {
      log('info', `Looking for ${gitType} auth...`);
      authID = await findGitAuthID(gitType, pid);
      if (!authID) {
        throw new Error(`No ${gitType} auth found. Connect ${gitType} in Elestio dashboard first, or provide --auth-id`);
      }
    }
    log('success', `Auth ID: ${authID}`);

    // Get git user/org
    const orgs = await getGitOrgs(authID, gitType, pid);
    if (orgs.length === 0) {
      throw new Error(`No ${gitType} accounts found for auth ${authID}`);
    }
    gitUser = orgs[0].value;
    log('info', `Git account: ${gitUser}`);

    // Find repo
    log('info', `Finding repo ${options.repo}...`);
    repoData = await findRepo(authID, gitType, options.repo, pid);
    log('success', `Repo: ${repoData.name} (ID: ${repoData.id}, private: ${repoData.private})`);
  }

  // 3. Build the payload
  const preset = RUNTIME_PRESETS[appType] || RUNTIME_PRESETS.static;
  const branch = options.branch || 'main';
  const repoOwner = options.repo ? options.repo.split('/')[0] : '';
  const repoName = options.repo ? options.repo.split('/')[1] : '';
  const gitHost = gitType === 'GITLAB' ? 'gitlab.com' : 'github.com';

  const payload = {
    CICDMode: gitType || 'DOCKER',
    pipelineName: options.name,
    projectID: String(pid),
    authID: authID ? String(authID) : '0',
    ports: [{
      protocol: 'HTTPS',
      targetProtocol: 'HTTP',
      listeningPort: '443',
      targetPort: '3000',
      public: true,
      targetIP: '172.17.0.1',
      path: '/',
      isAuth: false,
      login: '',
      password: ''
    }],
    variables: options.variables || '',
    cluster: {
      isCluster: false,
      createNew: false,
      target
    },
    imageData: gitType
      ? { isPipelineTemplate: false }
      : { imageName: options.image || 'nginx', imageTag: options.imageTag || 'alpine', registryUrl: '', isPipelineTemplate: false },
    configData: {
      buildDir: options.buildDir || preset.buildDir,
      rootDir: options.rootDir || '/',
      runtime: preset.runtime,
      version: options.nodeVersion || preset.version,
      framework: options.framework || preset.framework,
      buildCmd: options.buildCmd || preset.buildCmd,
      runCmd: options.runCmd || preset.runCmd,
      installCmd: options.installCmd || preset.installCmd
    },
    gitData: gitType ? {
      projectName: options.name,
      branch,
      repoUrl: `https://${gitHost}/${options.repo}`,
      cloneUrl: `https://${gitHost}/${options.repo}.git`,
      repoID: String(repoData.id),
      repo: repoName
    } : {
      projectName: options.name,
      branch: 'main',
      repoUrl: '',
      cloneUrl: '',
      repoID: 0,
      repo: ''
    },
    exposedPorts: [{
      protocol: 'HTTP',
      hostPort: '3000',
      containerPort: preset.containerPort,
      interface: '172.17.0.1'
    }],
    gitVolumeConfig: [],
    isNeedToCreateRepo: !gitType,
    isPublicGitRepo: repoData ? String(!repoData.private) : 'false',
    isMovePipeline: false,
    nonRepoWorkSpaces: [''],
    gitUserFormData: {}
  };

  // 4. Create the pipeline
  log('info', 'Creating pipeline...');
  const response = await apiRequest('/api/cicd/createCiCdExistServer', 'POST', payload);

  if (response.status !== 'OK' && !response.providerServerID) {
    throw new Error(response.message || JSON.stringify(response));
  }

  log('success', 'Pipeline created!');
  log('info', `  Name: ${options.name}`);
  log('info', `  Mode: ${mode}`);
  if (gitType) {
    log('info', `  Repo: ${options.repo} (${branch})`);
  }
  log('info', `  Target: ${target.displayName} (${target.vmID})`);

  // Post-deploy: fix Dockerfile and build via SSH (for git modes)
  if (options.deploy !== false && appType !== 'docker') {
    log('info', 'Starting post-deploy configuration...');
    try {
      const deployResult = await postDeployFix(
        target.vmID, options.name, appType, preset, pid
      );
      if (deployResult.httpCode === '200') {
        const svcDetails = await getServiceDetails(target.vmID, pid);
        const pipelineCname = `${options.name}-u${svcDetails.userID || ''}.vm.elestio.app`;
        log('success', `Deployment complete! URL: https://${pipelineCname}/`);
      }
    } catch (e) {
      log('warn', `Post-deploy fix failed: ${e.message}`);
      log('info', 'Pipeline was created but may need manual Dockerfile configuration via SSH');
    }
  }

  return response;
}

// Pipeline actions
export async function doActionOnPipeline(vmID, pipelineID, action, additionalParams = {}, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/doActionOnPipeline', 'POST', {
    vmID: String(vmID),
    projectID: String(pid),
    pipelineID: parseInt(pipelineID),
    action,
    ...additionalParams
  });

  if (response.status !== 'OK' && !response.action) {
    throw new Error(response.message || `Action "${action}" failed`);
  }

  return response;
}

export async function restartPipeline(vmID, pipelineID, projectId = null) {
  log('info', `Restarting pipeline ${pipelineID}...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'restartAppStack', {}, projectId);
  log('success', 'Pipeline restarted');
  return result;
}

export async function stopPipeline(vmID, pipelineID, projectId = null) {
  log('info', `Stopping pipeline ${pipelineID}...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'stopAppStack', {}, projectId);
  log('success', 'Pipeline stopped');
  return result;
}

export async function deletePipeline(vmID, pipelineID, projectId = null, force = false) {
  if (!force) {
    throw new Error('Deleting pipeline requires --force flag');
  }

  log('info', `Deleting pipeline ${pipelineID}...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'deletePipeline', {}, projectId);
  log('success', 'Pipeline deleted');
  return result;
}

export async function resyncPipeline(vmID, pipelineID, projectId = null) {
  log('info', `Re-syncing pipeline ${pipelineID}...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'reSyncPipeline', {}, projectId);
  log('success', 'Pipeline re-sync initiated');
  return result;
}

export async function getPipelineLogs(vmID, pipelineID, projectId = null) {
  log('info', `Getting logs for pipeline ${pipelineID}...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'pipelineRunningLogs', {}, projectId);
  if (result.logs) {
    console.log('\n' + result.logs);
  }
  return result;
}

export async function getPipelineHistory(vmID, pipelineID, projectId = null) {
  const result = await doActionOnPipeline(vmID, pipelineID, 'getHistory', {}, projectId);
  const history = result.data?.history || result.history || [];

  if (history.length === 0) {
    log('info', 'No build history');
    return [];
  }

  console.log(`\n${colors.bold}Build History${colors.reset}\n`);
  history.forEach(h => {
    console.log(`  ${h.filepath || h.file}: ${h.status || 'N/A'}`);
  });
  console.log('');

  return history;
}

// View specific build log
export async function viewPipelineLog(vmID, pipelineID, filepath, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/cicd/viewPipelineLog', 'POST', {
    vmID: String(vmID),
    projectID: String(pid),
    pipelineID: parseInt(pipelineID),
    filepath
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get log');
  }

  console.log(response.data?.content || response.content || '');
  return response;
}

// Pipeline domain management
export async function listPipelineDomains(vmID, pipelineID, projectId = null) {
  const result = await doActionOnPipeline(vmID, pipelineID, 'SSLDomainsList', {}, projectId);
  const domains = result.data?.domains || result.domains || [];

  if (domains.length === 0) {
    log('info', 'No custom domains');
    return [];
  }

  console.log(`\n${colors.bold}Pipeline Domains${colors.reset}\n`);
  domains.forEach(d => console.log(`  ${d}`));
  console.log('');

  return domains;
}

export async function addPipelineDomain(vmID, pipelineID, domain, projectId = null) {
  log('info', `Adding domain ${domain} to pipeline...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'SSLDomainsAdd', { domain }, projectId);
  log('success', `Domain ${domain} added`);
  return result;
}

export async function removePipelineDomain(vmID, pipelineID, domain, projectId = null) {
  log('info', `Removing domain ${domain} from pipeline...`);
  const result = await doActionOnPipeline(vmID, pipelineID, 'SSLDomainsRemove', { domain }, projectId);
  log('success', `Domain ${domain} removed`);
  return result;
}

// Shared base structures for pipeline templates
function baseCluster() {
  return {
    isCluster: false,
    createNew: false,
    target: {
      displayName: 'REPLACE_WITH_CICD_DISPLAY_NAME',
      id: 'REPLACE_WITH_CICD_SERVER_ID',
      serverName: 'REPLACE_WITH_CICD_CNAME',
      vmID: 'REPLACE_WITH_CICD_VM_ID'
    }
  };
}

function basePorts(targetPort = '3000') {
  return [{
    protocol: 'HTTPS',
    targetProtocol: 'HTTP',
    listeningPort: '443',
    targetPort,
    public: true,
    targetIP: '172.17.0.1',
    path: '/',
    isAuth: false,
    login: '',
    password: ''
  }];
}

function baseExposedPorts(hostPort = '3000', containerPort = '3000') {
  return [{
    protocol: 'HTTP',
    hostPort,
    containerPort,
    interface: '172.17.0.1'
  }];
}

function baseGitFields() {
  return {
    gitVolumeConfig: [],
    isMovePipeline: false,
    nonRepoWorkSpaces: [''],
    gitUserFormData: {}
  };
}

// Generate pipeline template
// Modes: docker, github, github-fullstack, gitlab, gitlab-fullstack
export function generatePipelineTemplate(mode = 'docker') {
  const templates = {
    // ---- Docker Compose (custom, no Git repo) ----
    docker: {
      CICDMode: 'DOCKER',
      pipelineName: 'REPLACE_WITH_PIPELINE_NAME',
      projectID: 'REPLACE_WITH_PROJECT_ID',
      ports: basePorts('3000'),
      variables: '',
      cluster: baseCluster(),
      imageData: {
        imageName: 'nginx',
        imageTag: 'alpine',
        registryUrl: '',
        isPipelineTemplate: false
      },
      configData: {
        buildDir: '/',
        rootDir: '/',
        runtime: '',
        version: '',
        framework: '',
        buildCmd: '',
        runCmd: '',
        installCmd: ''
      },
      gitData: {
        projectName: 'REPLACE_WITH_PIPELINE_NAME',
        branch: 'main',
        repoUrl: '',
        cloneUrl: '',
        repoID: 0,
        repo: ''
      },
      exposedPorts: baseExposedPorts('3000', '80'),
      isNeedToCreateRepo: true,
      ...baseGitFields()
    },

    // ---- GitHub Static SPA (React/Vue/Vite/Next) ----
    github: {
      CICDMode: 'GITHUB',
      pipelineName: 'REPLACE_WITH_PIPELINE_NAME',
      projectID: 'REPLACE_WITH_PROJECT_ID',
      ports: basePorts('3000'),
      variables: '',
      cluster: baseCluster(),
      imageData: { isPipelineTemplate: false },
      configData: {
        buildDir: '/dist',
        rootDir: '/',
        runtime: 'staticSPA',
        version: '20',
        framework: 'Vite.js',
        buildCmd: 'npm run build',
        runCmd: '',
        installCmd: 'npm install'
      },
      gitData: {
        projectName: 'REPLACE_WITH_PIPELINE_NAME',
        branch: 'main',
        repoUrl: 'https://github.com/OWNER/REPO',
        cloneUrl: 'https://github.com/OWNER/REPO.git',
        repoID: 'REPLACE_WITH_GITHUB_REPO_ID',
        repo: 'OWNER/REPO'
      },
      exposedPorts: baseExposedPorts('3000', '3000'),
      isNeedToCreateRepo: false,
      isPublicGitRepo: 'false',
      ...baseGitFields()
    },

    // ---- GitHub Full Stack (Node.js backend) ----
    'github-fullstack': {
      CICDMode: 'GITHUB',
      pipelineName: 'REPLACE_WITH_PIPELINE_NAME',
      projectID: 'REPLACE_WITH_PROJECT_ID',
      ports: basePorts('3000'),
      variables: '',
      cluster: baseCluster(),
      imageData: { isPipelineTemplate: false },
      configData: {
        buildDir: '/',
        rootDir: '/',
        runtime: 'node',
        version: '20',
        framework: 'No Framework',
        buildCmd: 'npm run build',
        runCmd: 'npm start',
        installCmd: 'npm install'
      },
      gitData: {
        projectName: 'REPLACE_WITH_PIPELINE_NAME',
        branch: 'main',
        repoUrl: 'https://github.com/OWNER/REPO',
        cloneUrl: 'https://github.com/OWNER/REPO.git',
        repoID: 'REPLACE_WITH_GITHUB_REPO_ID',
        repo: 'OWNER/REPO'
      },
      exposedPorts: baseExposedPorts('3000', '3000'),
      isNeedToCreateRepo: false,
      isPublicGitRepo: 'false',
      ...baseGitFields()
    },

    // ---- GitLab Static SPA (React/Vue/Vite/Next) ----
    gitlab: {
      CICDMode: 'GITLAB',
      pipelineName: 'REPLACE_WITH_PIPELINE_NAME',
      projectID: 'REPLACE_WITH_PROJECT_ID',
      ports: basePorts('3000'),
      variables: '',
      cluster: baseCluster(),
      imageData: { isPipelineTemplate: false },
      configData: {
        buildDir: '/dist',
        rootDir: '/',
        runtime: 'staticSPA',
        version: '20',
        framework: 'Vite.js',
        buildCmd: 'npm run build',
        runCmd: '',
        installCmd: 'npm install'
      },
      gitData: {
        projectName: 'REPLACE_WITH_PIPELINE_NAME',
        branch: 'main',
        repoUrl: 'https://gitlab.com/OWNER/REPO',
        cloneUrl: 'https://gitlab.com/OWNER/REPO.git',
        repoID: 'REPLACE_WITH_GITLAB_REPO_ID',
        repo: 'OWNER/REPO'
      },
      exposedPorts: baseExposedPorts('3000', '3000'),
      isNeedToCreateRepo: false,
      isPublicGitRepo: 'false',
      ...baseGitFields()
    },

    // ---- GitLab Full Stack (Node.js backend) ----
    'gitlab-fullstack': {
      CICDMode: 'GITLAB',
      pipelineName: 'REPLACE_WITH_PIPELINE_NAME',
      projectID: 'REPLACE_WITH_PROJECT_ID',
      ports: basePorts('3000'),
      variables: '',
      cluster: baseCluster(),
      imageData: { isPipelineTemplate: false },
      configData: {
        buildDir: '/',
        rootDir: '/',
        runtime: 'node',
        version: '20',
        framework: 'No Framework',
        buildCmd: 'npm run build',
        runCmd: 'npm start',
        installCmd: 'npm install'
      },
      gitData: {
        projectName: 'REPLACE_WITH_PIPELINE_NAME',
        branch: 'main',
        repoUrl: 'https://gitlab.com/OWNER/REPO',
        cloneUrl: 'https://gitlab.com/OWNER/REPO.git',
        repoID: 'REPLACE_WITH_GITLAB_REPO_ID',
        repo: 'OWNER/REPO'
      },
      exposedPorts: baseExposedPorts('3000', '3000'),
      isNeedToCreateRepo: false,
      isPublicGitRepo: 'false',
      ...baseGitFields()
    }
  };

  if (!templates[mode]) {
    const available = Object.keys(templates).join(', ');
    log('error', `Unknown mode "${mode}". Available: ${available}`);
    return JSON.stringify({ error: `Unknown mode. Available: ${available}` }, null, 2);
  }

  return JSON.stringify(templates[mode], null, 2);
}

// Docker registry management
export async function addDockerRegistry(projectId, identityName, username, password, url) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  const response = await apiRequest('/api/cicd/addDockerRegistry', 'POST', {
    projectID: String(pid),
    identityName,
    username,
    password,
    url
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to add Docker registry');
  }

  log('success', `Docker registry "${identityName}" added`);
  return response;
}

export async function getDockerRegistries(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  const response = await apiRequest('/api/cicd/getDockerRegistry', 'GET', {
    projectID: String(pid)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get Docker registries');
  }

  const registries = response.data?.registries || [];

  if (registries.length === 0) {
    log('info', 'No Docker registries configured');
    return [];
  }

  console.log(`\n${colors.bold}Docker Registries${colors.reset}\n`);
  registries.forEach(r => {
    console.log(`  ${r.identityName}: ${r.url}`);
  });
  console.log('');

  return registries;
}
