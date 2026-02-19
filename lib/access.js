import { apiRequest, loadConfig } from './api.js';
import { log, colors } from './utils.js';

// Get service details (internal helper)
async function getServiceDetails(vmID, projectId) {
  const response = await apiRequest('/api/servers/getServerDetails', 'POST', {
    vmID: String(vmID),
    projectID: String(projectId)
  });

  if (response.serviceInfos && response.serviceInfos.length > 0) {
    return response.serviceInfos[0];
  }
  return null;
}

// Get app credentials (URL, user, password)
export async function getCredentials(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  // First get service details to retrieve correct ports
  const serviceInfo = await getServiceDetails(vmID, pid);
  if (!serviceInfo) {
    throw new Error('Failed to get service details');
  }

  const targetPort = serviceInfo.adminInternalPort || 8080;
  const srvPort = serviceInfo.adminExternalPort || 443;

  const response = await apiRequest('/api/servers/getAppCredentials', 'POST', {
    vmID: String(vmID),
    targetPort,
    srvPort,
    projectID: String(pid),
    appID: 'CloudVM',
    isServerDeleted: false,
    mode: 'dbAdmin'
  });

  if (!response.url) {
    throw new Error(response.message || 'Failed to get credentials');
  }

  console.log(`\n${colors.bold}Service Info${colors.reset}\n`);
  console.log(`  Name:     ${serviceInfo.displayName}`);
  console.log(`  Type:     ${serviceInfo.serverType} (${serviceInfo.cores} CPU / ${serviceInfo.ramGB} GB RAM)`);
  console.log(`  Status:   ${serviceInfo.status}`);
  console.log(`  IP:       ${serviceInfo.ipv4}`);

  console.log(`\n${colors.bold}App Credentials${colors.reset}\n`);
  console.log(`  URL:      ${colors.cyan}${response.url}${colors.reset}`);
  console.log(`  User:     ${response.user || 'N/A'}`);
  console.log(`  Password: ${response.password || 'N/A'}`);

  // Show DB connection info if available
  if (serviceInfo.managedDBPort) {
    console.log('');
    console.log(`${colors.bold}Database Connection${colors.reset}`);
    console.log(`  Host:     ${serviceInfo.cname}`);
    console.log(`  Port:     ${serviceInfo.managedDBPort}`);
    console.log(`  CLI:      PGPASSWORD=${response.password} psql --host=${serviceInfo.cname} --port=${serviceInfo.managedDBPort} --username=postgres`);
  }
  console.log('');

  return response;
}

// Get SSH terminal access
export async function getSSH(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/servers/startSSHDirect', 'POST', {
    vmID: String(vmID),
    projectID: String(pid),
    path: '/root/'
  });

  if (!response.url) {
    throw new Error(response.message || 'Failed to get SSH access');
  }

  console.log(`\n${colors.bold}SSH Access${colors.reset}\n`);
  console.log(`  Web Terminal: ${colors.cyan}${response.url}${colors.reset}`);
  console.log('');

  return response;
}

// Get direct SSH info
export async function getSSHDirect(vmID) {
  const response = await apiRequest('/api/servers/startSSHDirect', 'POST', {
    vmID: String(vmID)
  });

  if (response.status !== 'OK' && !response.ip) {
    throw new Error(response.message || 'Failed to get SSH info');
  }

  console.log(`\n${colors.bold}Direct SSH${colors.reset}\n`);
  console.log(`  Host: ${response.ip || response.host || 'N/A'}`);
  console.log(`  Port: ${response.port || 22}`);
  console.log(`  User: ${response.user || 'root'}`);
  console.log('');
  console.log(`  ${colors.dim}ssh ${response.user || 'root'}@${response.ip || response.host} -p ${response.port || 22}${colors.reset}`);
  console.log('');

  return response;
}

// Get VSCode web access
export async function getVSCode(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/servers/startVSCode', 'POST', {
    vmID: String(vmID),
    projectID: String(pid)
  });

  if (!response.url) {
    throw new Error(response.message || 'Failed to get VSCode access');
  }

  console.log(`\n${colors.bold}VSCode Web Access${colors.reset}\n`);
  console.log(`  URL:      ${colors.cyan}${response.url}${colors.reset}`);
  console.log(`  User:     ${response.user || 'N/A'}`);
  console.log(`  Password: ${response.password || 'N/A'}`);
  console.log('');

  return response;
}

// Get File Explorer access
export async function getFileExplorer(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/servers/startFileExplorer', 'POST', {
    vmID: String(vmID),
    projectID: String(pid)
  });

  if (!response.url) {
    throw new Error(response.message || 'Failed to get File Explorer access');
  }

  console.log(`\n${colors.bold}File Explorer Access${colors.reset}\n`);
  console.log(`  URL:      ${colors.cyan}${response.url}${colors.reset}`);
  console.log(`  User:     ${response.user || 'N/A'}`);
  console.log(`  Password: ${response.password || 'N/A'}`);
  console.log('');

  return response;
}

// Get log viewer access
// Note: The logs API requires a 'mode' parameter but valid values are not documented.
// This function is currently disabled until the API documentation is updated.
export async function getLogs(vmID, projectId = null, mode = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  // The mode parameter is required but valid values are undocumented
  // Use SSH or web dashboard to view logs instead
  throw new Error(
    'Log viewer API requires undocumented mode parameter. ' +
    'Use SSH or the web dashboard to view logs: https://dash.elest.io'
  );
}
