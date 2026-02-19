import { loadConfig, saveConfig, apiRequest, authenticate, saveCredentials, getCredentials, ENV_PATH } from './api.js';
import { log, colors } from './utils.js';

// Configure credentials (saves to .env, not config.json)
export async function configure(email, token) {
  if (!email || !token) {
    throw new Error('Both --email and --token are required');
  }

  // Test authentication first
  log('info', 'Testing authentication...');
  const auth = await authenticate(email, token);

  // Save credentials to .env
  saveCredentials(email, token);

  // Save JWT to config.json (non-sensitive cache)
  const config = loadConfig();
  config.jwt = auth.jwt;
  config.jwtExpiry = auth.jwtExpiry;
  saveConfig(config);

  log('success', `Configured for ${email}`);
  log('info', `Credentials saved to .env`);
  return true;
}

// Show current config (mask sensitive data)
export function showConfig() {
  const config = loadConfig();
  const creds = getCredentials();

  console.log(`\n${colors.bold}Elestio Configuration${colors.reset}\n`);
  console.log(`  Email:          ${creds.email || '(not set)'}`);
  console.log(`  API Token:      ${creds.apiToken ? creds.apiToken.slice(0, 8) + '...' : '(not set)'}`);
  console.log(`  Credentials in: ${ENV_PATH}`);
  console.log(`  JWT:            ${config.jwt ? 'present (expires ' + new Date(config.jwtExpiry).toISOString() + ')' : '(not set)'}`);
  console.log(`  Default Project: ${config.defaultProject || '(not set)'}`);
  console.log(`\n${colors.bold}Defaults${colors.reset}`);
  console.log(`  Provider:       ${config.defaults?.provider || 'netcup'}`);
  console.log(`  Datacenter:     ${config.defaults?.datacenter || 'nbg'}`);
  console.log(`  Server Type:    ${config.defaults?.serverType || 'MEDIUM-2C-4G'}`);
  console.log(`  Support:        ${config.defaults?.support || 'level1'}`);
  console.log('');
}

// Set default project
export function setDefaultProject(projectId) {
  const config = loadConfig();
  config.defaultProject = String(projectId);
  saveConfig(config);
  log('success', `Default project set to ${projectId}`);
}

// Set defaults
export function setDefaults(provider, datacenter, serverType, support) {
  const config = loadConfig();
  if (!config.defaults) config.defaults = {};
  if (provider) config.defaults.provider = provider;
  if (datacenter) config.defaults.datacenter = datacenter;
  if (serverType) config.defaults.serverType = serverType;
  if (support) config.defaults.support = support;
  saveConfig(config);
  log('success', 'Defaults updated');
}

// Test authentication
export async function testAuth() {
  const creds = getCredentials();

  if (!creds.email || !creds.apiToken) {
    throw new Error('Not configured. Run: node cli.js config --email YOUR_EMAIL --token YOUR_TOKEN');
  }

  log('info', `Testing authentication for ${creds.email}...`);

  try {
    const auth = await authenticate(creds.email, creds.apiToken);
    const config = loadConfig();
    config.jwt = auth.jwt;
    config.jwtExpiry = auth.jwtExpiry;
    saveConfig(config);

    log('success', `Authenticated as ${creds.email}`);
    log('info', `JWT valid until ${new Date(auth.jwtExpiry).toISOString()}`);
    return true;
  } catch (e) {
    log('error', `Authentication failed: ${e.message}`);
    return false;
  }
}

// Get default project (with fallback to first project)
export async function getDefaultProject() {
  const config = loadConfig();

  if (config.defaultProject) {
    return config.defaultProject;
  }

  // Try to get first project
  const response = await apiRequest('/api/projects/getList');
  if (response.status === 'OK' && response.data?.projects?.length > 0) {
    const firstProject = response.data.projects[0];
    config.defaultProject = String(firstProject.projectID);
    saveConfig(config);
    log('info', `Using project "${firstProject.project_name}" (${firstProject.projectID}) as default`);
    return config.defaultProject;
  }

  throw new Error('No projects found. Create a project first.');
}
