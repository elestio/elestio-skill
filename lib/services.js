import { apiRequest, loadConfig } from './api.js';
import { findTemplate, validateCombo } from './templates.js';
import { formatTable, formatService, colors, log, sleep, validateServerName } from './utils.js';

// List all projects (raw, for internal use)
async function listProjectsRaw() {
  const response = await apiRequest('/api/projects/getList');
  if (response.status !== 'OK') return [];
  return response.data?.projects || [];
}

// Find a service across all projects by vmID
export async function findServiceAcrossProjects(vmID) {
  const projects = await listProjectsRaw();
  for (const project of projects) {
    const pid = project.projectID;
    try {
      const services = await listServicesRaw(pid);
      const svc = services.find(s => String(s.vmID) === String(vmID));
      if (svc) {
        return { service: svc, projectId: pid, projectName: project.project_name };
      }
    } catch (e) {
      // Skip projects we can't access
    }
  }
  return null;
}

// List services in a project
export async function listServices(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required. Use --project or set default with: config --set-default-project <id>');
  }

  const response = await apiRequest('/api/servers/getServices', 'POST', {
    appid: 'Cloudxx',
    projectId: String(pid),
    isActiveService: 'true'
  });

  if (response.status === 'KO' || response.code === 'AccessDenied') {
    throw new Error(response.message || 'Access denied.');
  }

  const services = response.servers || response.data?.services || [];

  if (services.length === 0) {
    log('info', `No services in project ${pid}`);
    return [];
  }

  const columns = [
    { key: 'displayName', label: 'Name' },
    { key: 'templateName', label: 'Software' },
    { key: 'status', label: 'Status' },
    { key: 'deploymentStatus', label: 'Deploy' },
    { key: 'vmID', label: 'vmID' },
    { key: 'ipv4', label: 'IP' }
  ];

  console.log(`\n${colors.bold}Services in project ${pid} (${services.length})${colors.reset}\n`);
  console.log(formatTable(services, columns));
  console.log('');

  return services;
}

// Get service details
export async function getServiceDetails(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/servers/getServerDetails', 'POST', {
    vmID: String(vmID),
    projectID: String(pid)
  });

  // API returns serviceInfos array directly
  if (response.serviceInfos && response.serviceInfos.length > 0) {
    return response.serviceInfos[0];
  }

  // Fallback for other response formats
  if (response.status === 'OK' && response.data) {
    return response.data;
  }

  if (response.status === 'KO' || response.message) {
    throw new Error(response.message || 'Failed to get service details');
  }

  return null;
}

// Get service by vmID from services list
export async function getServiceByVmId(vmID, projectId = null) {
  const services = await listServicesRaw(projectId);
  return services.find(s => String(s.vmID) === String(vmID));
}

// List services without formatting (raw)
export async function listServicesRaw(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/servers/getServices', 'POST', {
    appid: 'Cloudxx',
    projectId: String(pid),
    isActiveService: 'true'
  });

  return response.servers || response.data?.services || [];
}

// Find serverID from vmID
export async function getServerIdFromVmId(vmID, projectId = null) {
  const service = await getServiceByVmId(vmID, projectId);
  if (!service) {
    throw new Error(`Service with vmID ${vmID} not found`);
  }
  return service.id;
}

// Deploy a service from catalog
export async function deployService(templateNameOrId, options = {}) {
  const config = loadConfig();

  // Find template
  const template = await findTemplate(templateNameOrId);
  if (!template) {
    throw new Error(`Template "${templateNameOrId}" not found. Use: templates search <name>`);
  }

  // Get options with defaults
  const projectId = options.project || config.defaultProject;
  if (!projectId) {
    throw new Error('Project ID required. Use --project or set default');
  }

  const serverName = options.name || `${template.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
  const serverType = options.size || config.defaults?.serverType || 'MEDIUM-2C-4G';
  const datacenter = options.region || config.defaults?.datacenter || 'nbg';
  const support = options.support || config.defaults?.support || 'level1';
  const adminEmail = options.email || config.email;
  const provider = options.provider || config.defaults?.provider || 'netcup';

  // Validate server name
  const nameValidation = validateServerName(serverName);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error);
  }

  // Determine service type
  const isCicd = template.title?.toLowerCase().includes('ci-cd') ||
                 templateNameOrId?.toLowerCase() === 'cicd';
  const serviceType = isCicd ? 'CICD' : 'Service';

  // Get version from template or options
  const version = options.version || template.dockerhub_default_tag || 'latest';

  // Dry run mode - show config without deploying
  if (options.dryRun) {
    console.log(`\n${colors.bold}Deployment Preview (--dry-run)${colors.reset}\n`);
    console.log(`  Software:   ${colors.cyan}${template.title}${colors.reset} (ID: ${template.id})`);
    console.log(`  Version:    ${version}`);
    console.log(`  Project:    ${projectId}`);
    console.log(`  Name:       ${serverName}`);
    console.log(`  Provider:   ${provider}`);
    console.log(`  Region:     ${datacenter}`);
    console.log(`  Size:       ${serverType}`);
    console.log(`  Support:    ${support}`);
    console.log(`  Admin:      ${adminEmail}`);
    console.log('');
    log('info', 'To deploy, run the same command without --dry-run');
    return {
      dryRun: true,
      template: template.title,
      templateId: template.id,
      version,
      projectId,
      serverName,
      provider,
      datacenter,
      serverType,
      support,
      adminEmail,
      serviceType
    };
  }

  log('info', `Deploying ${template.title} (ID: ${template.id})`);
  log('info', `  Project: ${projectId}`);
  log('info', `  Name: ${serverName}`);
  log('info', `  Provider: ${provider}`);
  log('info', `  Size: ${serverType} @ ${datacenter}`);
  log('info', `  Version: ${version}`);

  // Build request payload
  const payload = {
    templateID: String(template.id),
    serverType,
    datacenter,
    providerName: provider,
    serverName,
    appid: 'Cloudxx',
    data: 'data',
    support,
    projectId: String(projectId),
    version,
    adminEmail,
    deploymentServiceType: 'normal',
    serviceType
  };

  // CI/CD targets require cicdPayload
  if (isCicd) {
    payload.cicdPayload = {
      pipelineName: options.pipelineName || serverName
    };
  }

  const response = await apiRequest('/api/servers/createServer', 'POST', payload);

  if (!response.providerServerID && !response.action) {
    throw new Error(response.message || 'Failed to create service');
  }

  log('success', `Deployment started!`);
  log('info', `  Provider Server ID: ${response.providerServerID}`);

  // Wait for deployment if requested
  if (options.wait !== false) {
    log('info', 'Waiting for deployment to complete...');
    const service = await waitForDeployment(response.providerServerID, projectId, options.timeout);
    return service;
  }

  return response;
}

// Wait for deployment to complete
export async function waitForDeployment(vmID, projectId, timeoutMs = 600000) {
  const start = Date.now();
  let lastStatus = '';

  while (Date.now() - start < timeoutMs) {
    const services = await listServicesRaw(projectId);
    const svc = services.find(s =>
      String(s.vmID) === String(vmID) ||
      String(s.providerServerID) === String(vmID)
    );

    if (!svc) {
      await sleep(10000);
      continue;
    }

    if (svc.deploymentStatus !== lastStatus) {
      lastStatus = svc.deploymentStatus;
      log('info', `Status: ${svc.deploymentStatus}`);
    }

    if (svc.deploymentStatus === 'Deployed' && svc.status === 'running') {
      log('success', 'Deployment complete!');
      console.log('\n' + formatService(svc) + '\n');
      return svc;
    }

    await sleep(15000);
  }

  throw new Error(`Deployment timed out after ${timeoutMs / 1000}s. Check status manually.`);
}

// Delete a service
export async function deleteService(vmID, options = {}) {
  if (!options.force) {
    throw new Error('Deleting a service requires --force flag to confirm');
  }

  const config = loadConfig();
  const projectId = options.project || config.defaultProject;

  if (!projectId) {
    throw new Error('Project ID required. Use --project or set default');
  }

  const response = await apiRequest('/api/servers/deleteServer', 'POST', {
    vmID: String(vmID),
    projectID: String(projectId),
    isDeleteServiceWithBackup: options.withBackups ? 'true' : 'false'
  });

  if (response.status !== 'OK' && !response.action) {
    throw new Error(response.message || 'Failed to delete service');
  }

  log('success', `Service ${vmID} deletion initiated`);
  return response;
}

// Move service between projects
// Note: API uses serverID, but we accept vmID for consistency and convert it
export async function moveService(vmIDOrServerID, targetProjectId, sourceProjectId = null) {
  const config = loadConfig();
  const sourcePid = sourceProjectId || config.defaultProject;

  // Try to get serverID from vmID in specified/default project first
  let serverID = vmIDOrServerID;
  let foundInProject = null;
  try {
    const service = await getServiceByVmId(vmIDOrServerID, sourcePid);
    if (service && service.id) {
      serverID = service.id;
      foundInProject = sourcePid;
    }
  } catch (e) {
    // Not found in specified project
  }

  // If not found, search across all projects
  if (!foundInProject) {
    log('info', `Service not found in project ${sourcePid}, searching across all projects...`);
    const found = await findServiceAcrossProjects(vmIDOrServerID);
    if (found) {
      serverID = found.service.id;
      foundInProject = found.projectId;
      log('info', `Found service in project "${found.projectName}" (${found.projectId})`);
    } else {
      throw new Error(`Service ${vmIDOrServerID} not found in any project`);
    }
  }

  const response = await apiRequest('/api/servers/moveService', 'PUT', {
    serviceId: String(serverID),
    projectId: String(targetProjectId)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to move service');
  }

  log('success', `Service moved to project ${targetProjectId}`);
  return response;
}

// Show detailed service info
export async function showService(vmID, projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  // Get extended details (contains all info)
  const details = await getServiceDetails(vmID, pid);
  if (!details) {
    throw new Error(`Service with vmID ${vmID} not found`);
  }

  console.log('\n' + formatService(details));

  console.log(`\n${colors.bold}Extended Details${colors.reset}`);
  console.log(`  Server ID: ${details.id || 'N/A'}`);
  console.log(`  Firewall: ${details.isFirewallActivated ? 'enabled' : 'disabled'} (ID: ${details.firewall_id || 'N/A'})`);
  console.log(`  Firewall Ports: ${details.firewallPorts || 'N/A'}`);
  console.log(`  Alerts: ${details.isAlertsActivated ? 'enabled' : 'disabled'}`);
  console.log(`  Remote Backup: ${details.remoteBackupsActivated ? 'enabled' : 'disabled'}`);
  console.log(`  External Backup: ${details.isExternalBackupActivated ? 'enabled' : 'disabled'}`);
  console.log(`  System Auto-Update: ${details.system_AutoUpdate_Enabled ? 'enabled' : 'disabled'}${details.system_AutoUpdate_SecurityPatchesOnly ? ' (security only)' : ''}`);
  console.log(`  App Auto-Update: ${details.app_AutoUpdate_Enabled ? 'enabled' : 'disabled'}`);
  console.log(`  Rate Limiter: ${details.rateLimiter || 'N/A'}`);
  console.log(`  Price/Hour: $${details.pricePerHour || 'N/A'}`);
  if (details.managedDBPort) {
    console.log(`  Managed DB Port: ${details.managedDBPort}`);
  }

  console.log('');
  return { service: details, details };
}
