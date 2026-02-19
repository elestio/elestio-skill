import { apiRequest } from './api.js';
import { log, colors, formatTable } from './utils.js';
import { getServiceDetails } from './services.js';
import { filterSizes } from './templates.js';
import dns from 'dns/promises';

// Generic DoActionOnServer wrapper
export async function doAction(vmID, action, additionalParams = {}) {
  const response = await apiRequest('/api/servers/DoActionOnServer', 'POST', {
    vmID: String(vmID),
    action,
    ...additionalParams
  });

  // Some actions return arrays directly (e.g., SSLDomainsList)
  if (Array.isArray(response)) {
    return { data: response, status: 'OK' };
  }

  // Check for error responses
  if (response.status === 'KO' || response.status === 'error') {
    throw new Error(response.message || `Action "${action}" failed`);
  }

  return response;
}

// ============= POWER MANAGEMENT =============

export async function reboot(vmID) {
  log('info', `Rebooting VM ${vmID}...`);
  const result = await doAction(vmID, 'reboot');
  log('success', 'Reboot initiated');
  return result;
}

export async function reset(vmID) {
  log('info', `Hard resetting VM ${vmID}...`);
  const result = await doAction(vmID, 'reset');
  log('success', 'Hard reset initiated');
  return result;
}

// Managed database templates that don't support shutdown
const MANAGED_DB_TEMPLATES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'memcached', 'keydb', 'clickhouse', 'couchdb', 'elasticsearch', 'opensearch', 'meilisearch', 'typesense', 'ferretdb'];

export async function shutdown(vmID, options = {}) {
  // Check if this is a managed database
  try {
    const service = await getServiceDetails(vmID, options.project);
    const templateName = (service.templateName || service.displayName || '').toLowerCase();
    const isManagedDB = MANAGED_DB_TEMPLATES.some(db => templateName.includes(db));
    if (isManagedDB) {
      throw new Error(`Cannot shutdown managed database "${service.templateName || service.displayName}". Managed databases are kept running by Elestio and do not support shutdown. Use "reboot" instead if needed.`);
    }
  } catch (e) {
    // If the error is our managed DB check, re-throw it
    if (e.message?.includes('Cannot shutdown managed database')) throw e;
    // Otherwise ignore (service details lookup might fail, proceed with shutdown)
  }

  log('info', `Shutting down VM ${vmID}...`);
  const result = await doAction(vmID, 'shutdown');
  log('success', 'Shutdown initiated');
  return result;
}

export async function poweroff(vmID) {
  log('info', `Forcing power off VM ${vmID}...`);
  const result = await doAction(vmID, 'powerOff');
  log('success', 'Power off initiated');
  return result;
}

export async function poweron(vmID) {
  log('info', `Powering on VM ${vmID}...`);
  const result = await doAction(vmID, 'powerOn');
  log('success', 'Power on initiated');
  return result;
}

export async function restartStack(vmID) {
  log('info', `Restarting Docker stack on ${vmID}...`);
  const result = await doAction(vmID, 'restartAppStack');
  log('success', 'Docker stack restart initiated');
  return result;
}

// ============= TERMINATION PROTECTION =============

export async function lock(vmID) {
  log('info', `Enabling termination protection on ${vmID}...`);
  const result = await doAction(vmID, 'lock');
  log('success', 'Termination protection enabled');
  return result;
}

export async function unlock(vmID) {
  log('info', `Disabling termination protection on ${vmID}...`);
  const result = await doAction(vmID, 'unlock');
  log('success', 'Termination protection disabled');
  return result;
}

// ============= FIREWALL =============

export async function getFirewallRules(vmID) {
  const result = await doAction(vmID, 'getFirewallRules');
  const rules = result.data?.rules || result.rules || [];

  if (rules.length === 0) {
    log('info', 'No firewall rules configured');
    return rules;
  }

  const columns = [
    { key: 'type', label: 'Type' },
    { key: 'port', label: 'Port' },
    { key: 'protocol', label: 'Protocol' },
    { key: 'targets', label: 'Targets' }
  ];

  const data = rules.map(r => ({
    ...r,
    targets: Array.isArray(r.targets) ? r.targets.join(', ') : r.targets
  }));

  console.log(`\n${colors.bold}Firewall Rules${colors.reset}\n`);
  console.log(formatTable(data, columns));
  console.log('');

  return rules;
}

// Merge new rules with existing ones: if a rule for the same port/protocol/type
// already exists, replace it instead of creating a duplicate.
async function mergeFirewallRules(vmID, newRules) {
  let existingRules = [];
  try {
    const result = await doAction(vmID, 'getFirewallRules');
    existingRules = result.data?.rules || result.rules || [];
  } catch (e) {
    // No existing rules, use new rules as-is
  }

  if (existingRules.length === 0) return newRules;

  // Build a map of existing rules keyed by type+port+protocol
  const ruleMap = new Map();
  for (const rule of existingRules) {
    const key = `${rule.type}|${rule.port}|${rule.protocol}`;
    ruleMap.set(key, rule);
  }

  // Override with new rules (replace matching port/protocol/type)
  for (const rule of newRules) {
    const key = `${rule.type}|${rule.port}|${rule.protocol}`;
    ruleMap.set(key, rule);
  }

  return Array.from(ruleMap.values());
}

export async function enableFirewall(vmID, rules) {
  if (!rules || !Array.isArray(rules)) {
    throw new Error('Rules array required. Example: [{"type":"INPUT","port":"22","protocol":"tcp","targets":["0.0.0.0/0"]}]');
  }

  // Check if firewall is already active by fetching existing rules
  let existingRules = [];
  try {
    const result = await doAction(vmID, 'getFirewallRules');
    existingRules = result.data?.rules || result.rules || [];
  } catch (e) {
    // Firewall not active yet
  }

  if (existingRules.length > 0) {
    // Firewall already active: merge rules and use updateFirewall (replaces full ruleset)
    const mergedRules = await mergeFirewallRules(vmID, rules);
    log('info', `Updating firewall on ${vmID} (replacing matching port rules)...`);
    const result = await doAction(vmID, 'updateFirewall', { rules: mergedRules });
    log('success', 'Firewall updated');
    return result;
  }

  // Firewall not active: enable with provided rules
  log('info', `Enabling firewall on ${vmID}...`);
  try {
    const result = await doAction(vmID, 'enableFirewall', { rules });
    log('success', 'Firewall enabled');
    return result;
  } catch (e) {
    // Fallback to update if enable fails
    const result = await doAction(vmID, 'updateFirewall', { rules });
    log('success', 'Firewall enabled');
    return result;
  }
}

export async function updateFirewall(vmID, rules) {
  if (!rules || !Array.isArray(rules)) {
    throw new Error('Rules array required');
  }

  // Merge new rules with existing ones (replace matching port rules, keep others)
  const mergedRules = await mergeFirewallRules(vmID, rules);
  log('info', `Updating firewall on ${vmID}...`);
  const result = await doAction(vmID, 'updateFirewall', { rules: mergedRules });
  log('success', 'Firewall updated');
  return result;
}

export async function disableFirewall(vmID) {
  log('info', `Disabling firewall on ${vmID}...`);
  const result = await doAction(vmID, 'disableFirewall');
  log('success', 'Firewall disabled');
  return result;
}

// ============= SSL / CUSTOM DOMAINS =============

export async function listSslDomains(vmID, projectId = null) {
  // getDomains is a project-level endpoint, not a service-level action
  const { loadConfig } = await import('./api.js');
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/domains/getDomains', 'POST', {
    projectID: Number(pid)
  });

  const domains = response.data || [];

  if (domains.length === 0) {
    log('info', 'No custom domains configured for this project');
    return domains;
  }

  console.log(`\n${colors.bold}SSL Domains${colors.reset}\n`);
  domains.forEach(d => {
    const name = d.domain || d.name || d;
    console.log(`  ${typeof name === 'string' ? name : JSON.stringify(d)}`);
  });
  console.log('');

  return domains;
}

export async function addSslDomain(vmID, domain) {
  if (!domain) {
    throw new Error('Domain required');
  }

  // DNS validation: check if domain resolves to the service IP
  try {
    const addresses = await dns.resolve4(domain);
    log('info', `Domain ${domain} resolves to: ${addresses.join(', ')}`);
  } catch (e) {
    if (e.code === 'ENODATA' || e.code === 'ENOTFOUND' || e.code === 'SERVFAIL') {
      throw new Error(`Domain "${domain}" does not resolve to any IP address. Make sure the domain has an A record pointing to your service IP before adding it.`);
    }
    // Other DNS errors: warn but continue
    log('warn', `Could not verify DNS for ${domain}: ${e.code || e.message}. Proceeding anyway.`);
  }

  log('info', `Adding SSL domain ${domain} to ${vmID}...`);
  const result = await doAction(vmID, 'SSLDomainsAdd', { domain });
  log('success', `Domain ${domain} added with auto-SSL`);
  return result;
}

export async function removeSslDomain(vmID, domain) {
  if (!domain) {
    throw new Error('Domain required');
  }

  log('info', `Removing SSL domain ${domain} from ${vmID}...`);
  const result = await doAction(vmID, 'SSLDomainsRemove', { domain });
  log('success', `Domain ${domain} removed`);
  return result;
}

// ============= SSH KEYS =============

export async function listSshKeys(vmID) {
  const result = await doAction(vmID, 'SSHPubKeysList');
  // API returns data as array directly or nested
  const keys = Array.isArray(result.data) ? result.data : (result.data?.keys || result.keys || []);

  if (keys.length === 0) {
    log('info', 'No SSH keys configured');
    return keys;
  }

  console.log(`\n${colors.bold}SSH Keys${colors.reset}\n`);
  keys.forEach(k => {
    const keyPreview = k.key ? k.key.slice(0, 50) + '...' : 'N/A';
    console.log(`  ${colors.cyan}${k.name}${colors.reset}: ${keyPreview}`);
  });
  console.log('');

  return keys;
}

export async function addSshKey(vmID, name, key) {
  if (!name || !key) {
    throw new Error('Both name and key are required');
  }

  log('info', `Adding SSH key "${name}" to ${vmID}...`);
  const result = await doAction(vmID, 'SSHPubKeysAdd', { name, key });
  log('success', `SSH key "${name}" added`);
  return result;
}

export async function removeSshKey(vmID, name) {
  if (!name) {
    throw new Error('Key name required');
  }

  log('info', `Removing SSH key "${name}" from ${vmID}...`);
  const result = await doAction(vmID, 'SSHPubKeysRemove', { deleteParams: name });
  log('success', `SSH key "${name}" removed`);
  return result;
}

// ============= OS AUTO-UPDATES =============

export async function enableSystemAutoUpdate(vmID, options = {}) {
  const dayOfWeek = options.day ?? 0; // Sunday
  const hour = options.hour ?? 5;
  const minute = options.minute ?? 0;
  const securityOnly = options.securityOnly ?? true;

  log('info', `Enabling OS auto-updates on ${vmID}...`);
  const result = await doAction(vmID, 'systemAutoUpdateEnable', {
    systemAutoUpdateRebootDayOfWeek: String(dayOfWeek),
    systemAutoUpdateRebootHour: String(hour),
    systemAutoUpdateRebootMinute: String(minute),
    systemAutoUpdateSecurityPatchesOnly: securityOnly
  });
  log('success', `OS auto-updates enabled (Day ${dayOfWeek}, ${hour}:${minute.toString().padStart(2, '0')}, security-only: ${securityOnly})`);
  return result;
}

export async function disableSystemAutoUpdate(vmID) {
  log('info', `Disabling OS auto-updates on ${vmID}...`);
  const result = await doAction(vmID, 'systemAutoUpdateDisable');
  log('success', 'OS auto-updates disabled');
  return result;
}

export async function runSystemUpdate(vmID) {
  log('info', `Running OS update on ${vmID}...`);
  const result = await doAction(vmID, 'systemAutoUpdateNow');
  log('success', 'OS update initiated');
  return result;
}

// ============= APP AUTO-UPDATES =============

export async function enableAppAutoUpdate(vmID, options = {}) {
  const dayOfWeek = options.day ?? 0;
  const hour = options.hour ?? 3;
  const minute = options.minute ?? 0;

  log('info', `Enabling app auto-updates on ${vmID}...`);
  const result = await doAction(vmID, 'appAutoUpdateEnable', {
    appAutoUpdateDayOfWeek: String(dayOfWeek),
    appAutoUpdateHour: String(hour),
    appAutoUpdateMinute: String(minute).padStart(2, '0')
  });
  log('success', `App auto-updates enabled (Day ${dayOfWeek}, ${hour}:${String(minute).padStart(2, '0')})`);
  return result;
}

export async function disableAppAutoUpdate(vmID) {
  log('info', `Disabling app auto-updates on ${vmID}...`);
  const result = await doAction(vmID, 'appAutoUpdateDisable');
  log('success', 'App auto-updates disabled');
  return result;
}

export async function runAppUpdate(vmID) {
  log('info', `Running app update on ${vmID}...`);
  const result = await doAction(vmID, 'appAutoUpdateNow');
  log('success', 'App update initiated');
  return result;
}

export async function changeVersion(vmID, versionTag) {
  if (!versionTag) {
    throw new Error('Version tag required');
  }

  log('info', `Changing version to ${versionTag} on ${vmID}...`);
  const result = await doAction(vmID, 'softwareChangeSelectedVersion', { versionTag });
  log('success', `Version changed to ${versionTag}`);
  return result;
}

// ============= ALERTS =============

export async function getAlerts(vmID) {
  const result = await doAction(vmID, 'getAlertsRules');
  const rules = result.data?.rules || result.rules || {};

  console.log(`\n${colors.bold}Alert Rules${colors.reset}\n`);
  console.log(JSON.stringify(rules, null, 2));
  console.log('');

  return rules;
}

export async function enableAlerts(vmID, rules, cycleSeconds = 60) {
  if (!rules) {
    throw new Error('Rules configuration required');
  }

  // Rules must be sent as a JSON string, not as an object
  const rulesStr = typeof rules === 'string' ? rules : JSON.stringify(rules);

  log('info', `Updating alerts on ${vmID}...`);
  const result = await doAction(vmID, 'updateAlerts', {
    monitCycleInSeconds: Number(cycleSeconds),
    rules: rulesStr
  });
  log('success', 'Alerts updated');
  return result;
}

export async function disableAlerts(vmID) {
  log('info', `Disabling alerts on ${vmID}...`);
  const result = await doAction(vmID, 'disableAlerts');
  log('success', 'Alerts disabled');
  return result;
}

// ============= RESIZE / CHANGE SERVER TYPE =============

// Providers that support instance size downgrade
const DOWNGRADE_SUPPORTED_PROVIDERS = ['netcup', 'aws', 'azure', 'scaleway'];

// Parse CPU and RAM from size name (e.g., "MEDIUM-2C-4G" → { cpu: 2, ram: 4 })
function parseSizeSpec(sizeName) {
  const cpuMatch = sizeName.match(/(\d+)C/i);
  const ramMatch = sizeName.match(/(\d+)G/i);
  return {
    cpu: cpuMatch ? parseInt(cpuMatch[1]) : 0,
    ram: ramMatch ? parseInt(ramMatch[1]) : 0
  };
}

// Check if the new size is a downgrade compared to the current size
function isDowngrade(currentType, newType) {
  const current = parseSizeSpec(currentType);
  const newSpec = parseSizeSpec(newType);
  if (current.cpu === 0 || newSpec.cpu === 0) return false; // Can't determine, allow
  return newSpec.cpu < current.cpu || newSpec.ram < current.ram;
}

// Validate size name against real API data for the provider/region
async function validateSizeForProvider(newType, providerName, region, currentType) {
  // Fetch available sizes for this provider
  const availableSizes = await filterSizes(providerName);
  const regionSizes = availableSizes.filter(s => s.regionID?.toLowerCase() === region?.toLowerCase());
  const allProviderSizes = regionSizes.length > 0 ? regionSizes : availableSizes;

  // Check exact match
  const exactMatch = allProviderSizes.find(s => s.title?.toLowerCase() === newType.toLowerCase());
  if (exactMatch) return exactMatch.title;

  // Try to find a match by base name (e.g., user gives "LARGE-4C-8G", API has "LARGE-4C-8G-CPX")
  const baseName = newType.toUpperCase();
  const candidates = allProviderSizes.filter(s => s.title?.toUpperCase().startsWith(baseName));

  if (candidates.length === 1) {
    const corrected = candidates[0].title;
    log('warn', `Size "${newType}" auto-corrected to "${corrected}" for ${providerName}/${region}`);
    return corrected;
  }

  if (candidates.length > 1) {
    // If current type gives a hint about the suffix family, prefer that
    if (currentType) {
      const currentSuffix = currentType.replace(/^.*?(\d+G)/, '').toUpperCase(); // e.g., "-CPX"
      if (currentSuffix) {
        const sameFamilyMatch = candidates.find(s => s.title?.toUpperCase().endsWith(currentSuffix));
        if (sameFamilyMatch) {
          log('warn', `Size "${newType}" auto-corrected to "${sameFamilyMatch.title}" (same family as current "${currentType}")`);
          return sameFamilyMatch.title;
        }
      }
    }

    const options = candidates.map(s => `${s.title} (${s.vCPU} CPU, ${s.ramGB}GB RAM, $${(parseFloat(s.pricePerHour) * 24 * 30).toFixed(0)}/mo)`).join('\n  - ');
    throw new Error(
      `Multiple sizes match "${newType}" for ${providerName}/${region}. Please specify the exact name:\n  - ${options}`
    );
  }

  // No match at all — show available sizes for this provider/region
  const uniqueSizes = [...new Map(allProviderSizes.map(s => [s.title, s])).values()];
  const sizeList = uniqueSizes
    .map(s => `${s.title} (${s.vCPU} CPU, ${s.ramGB}GB RAM, $${(parseFloat(s.pricePerHour) * 24 * 30).toFixed(0)}/mo)`)
    .join('\n  - ');
  throw new Error(
    `Size "${newType}" is not available for ${providerName}/${region}.\n` +
    `  Available sizes:\n  - ${sizeList}`
  );
}

export async function resizeServer(vmID, newType, options = {}) {
  if (!newType) {
    throw new Error('New server type required (e.g., LARGE-4C-8G)');
  }

  // Get current service details to use correct provider/region
  log('info', `Checking current service configuration...`);
  const service = await getServiceDetails(vmID, options.project);
  const providerName = service.provider || service.providerName || options.provider || 'netcup';
  const region = service.datacenter || options.region || 'nbg';
  const currentType = service.serverType || 'unknown';

  // Validate size name against real API data
  const validatedType = await validateSizeForProvider(newType, providerName, region, currentType);

  if (currentType === validatedType) {
    log('warn', `Service is already ${validatedType}, no resize needed`);
    return;
  }

  // Check if this is a downgrade and if the provider supports it
  if (isDowngrade(currentType, validatedType)) {
    const providerLower = providerName.toLowerCase();
    if (!DOWNGRADE_SUPPORTED_PROVIDERS.includes(providerLower)) {
      throw new Error(
        `Downgrade from ${currentType} to ${validatedType} is NOT supported on ${providerName}.\n` +
        `  Only these providers support downgrades: ${DOWNGRADE_SUPPORTED_PROVIDERS.join(', ')}.\n` +
        `  On ${providerName}, you can only upgrade to a larger size.\n` +
        `  To downgrade, you would need to delete this service and recreate it with the smaller size.`
      );
    }
    log('warn', `This is a downgrade (${currentType} → ${validatedType}). Provider ${providerName} supports downgrades, proceeding...`);
  }

  log('info', `Resizing VM ${vmID} from ${currentType} to ${validatedType} (${providerName}/${region})...`);

  const upgradeCPURAMOnly = options.cpuRamOnly !== false; // Default true

  const result = await doAction(vmID, 'changeType', {
    newType: validatedType,
    region,
    providerName,
    upgradeCPURAMOnly
  });

  // Verify the resize actually took effect
  log('info', 'Verifying resize...');
  // Wait a moment for the change to propagate
  await new Promise(resolve => setTimeout(resolve, 5000));
  const updated = await getServiceDetails(vmID, options.project);

  if (updated.serverType === validatedType) {
    log('success', `VM ${vmID} resized from ${currentType} to ${validatedType}`);
  } else if (updated.status === 'off' || updated.status === 'stopped') {
    log('error', `Resize failed: service was shut down but size is still ${updated.serverType}. Check the dashboard for details. You may need to power on the service manually.`);
    throw new Error(`Resize failed - service is off, size unchanged (${updated.serverType})`);
  } else {
    log('warn', `Resize requested but size is still ${updated.serverType}. The change may take a few minutes to apply. Check the dashboard.`);
  }

  return result;
}

// ============= SUPPORT PLAN =============

export async function changeSupportPlan(vmID, serverType, supportLevel) {
  if (!supportLevel || !['level1', 'level2', 'level3'].includes(supportLevel)) {
    throw new Error('Support level must be: level1, level2, or level3');
  }

  log('info', `Changing support plan to ${supportLevel} on ${vmID}...`);
  const result = await doAction(vmID, 'changeSupportPlan', {
    serverType,
    supportChoice: supportLevel
  });
  log('success', `Support plan changed to ${supportLevel}`);
  return result;
}
