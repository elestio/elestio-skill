import { apiRequest, loadConfig } from './api.js';
import { doAction } from './actions.js';
import { log, colors, formatTable } from './utils.js';

// List volumes in a project
export async function listVolumes(projectId = null) {
  const config = loadConfig();
  const pid = projectId || config.defaultProject;

  if (!pid) {
    throw new Error('Project ID required');
  }

  const response = await apiRequest('/api/volumes/getVolumes', 'POST', {
    projectID: String(pid)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to list volumes');
  }

  const volumes = response.data?.volumes || [];

  if (volumes.length === 0) {
    log('info', `No volumes in project ${pid}`);
    return [];
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'size', label: 'Size' },
    { key: 'provider', label: 'Provider' },
    { key: 'region', label: 'Region' },
    { key: 'attached', label: 'Attached' }
  ];

  const data = volumes.map(v => ({
    id: v.volumeID || v.id,
    name: v.volumeName || v.name,
    size: (v.volume || v.size) + 'GB',
    provider: v.providerName || v.provider,
    region: v.datacenter || v.region,
    attached: v.serverID ? 'Yes' : 'No'
  }));

  console.log(`\n${colors.bold}Volumes (${volumes.length})${colors.reset}\n`);
  console.log(formatTable(data, columns));
  console.log('');

  return volumes;
}

// Get volume count
export async function getVolumesCount() {
  const response = await apiRequest('/api/volumes/getVolumesCount', 'POST', {});

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to get volume count');
  }

  return response.data?.count || 0;
}

// Create a volume
export async function createVolume(options = {}) {
  const config = loadConfig();

  const {
    name,
    size = 10,
    provider = config.defaults?.provider || 'hetzner',
    datacenter = config.defaults?.datacenter || 'fsn1',
    projectId = config.defaultProject,
    serverId = null,
    storageType = 'NVME'
  } = options;

  if (!name) {
    throw new Error('Volume name required');
  }

  if (!projectId) {
    throw new Error('Project ID required');
  }

  // Calculate approximate price (varies by provider)
  const pricePerGB = 0.05; // ~$0.05/GB/month average
  const price = (size * pricePerGB).toFixed(2);

  log('info', `Creating volume "${name}"...`);
  log('info', `  Size: ${size}GB ${storageType}`);
  log('info', `  Location: ${provider} / ${datacenter}`);

  const body = {
    projectID: String(projectId),
    providerName: provider,
    datacenter,
    volumeName: name,
    price: price,
    isMoveData: false,
    volume: size,
    blockStorageType: storageType
  };

  if (serverId) {
    body.selectedServerID = String(serverId);
  }

  const response = await apiRequest('/api/volumes/createVolume', 'POST', body);

  if (response.status !== 'OK' && !response.volumeID) {
    throw new Error(response.message || 'Failed to create volume');
  }

  log('success', `Volume "${name}" created`);
  return response;
}

// Volume actions via service action endpoint
export async function getServiceVolumes(vmID) {
  const result = await doAction(vmID, 'getServiceVolume');
  // API returns data as array directly
  const volumes = Array.isArray(result.data) ? result.data : (result.data?.volumes || result.volumes || []);

  if (volumes.length === 0) {
    log('info', 'No volumes attached to this service');
    return [];
  }

  console.log(`\n${colors.bold}Attached Volumes${colors.reset}\n`);
  volumes.forEach(v => {
    const size = v.volumeSizeInGB || v.volume || v.size || 'N/A';
    console.log(`  ${v.volumeID || v.id}: ${v.volumeName || v.name} (${size}GB) - ${v.status || 'unknown'}`);
  });
  console.log('');

  return volumes;
}

// Create and attach volume to service
export async function createServiceVolume(vmID, options = {}) {
  const {
    name,
    size = 10,
    storageType = 'NVME',
    moveData = false
  } = options;

  if (!name) {
    throw new Error('Volume name required');
  }

  log('info', `Creating and attaching volume "${name}" to ${vmID}...`);
  const result = await doAction(vmID, 'createServiceVolume', {
    volumeName: name,
    volume: size,
    blockStorageType: storageType,
    isMoveData: moveData
  });
  log('success', `Volume "${name}" created and attached`);
  return result;
}

// Manage volume protection
export async function setVolumeProtection(vmID, volumeID, enabled = true) {
  log('info', `${enabled ? 'Enabling' : 'Disabling'} protection for volume ${volumeID}...`);
  const result = await doAction(vmID, 'manageServiceVolumeProtection', {
    volumeID: String(volumeID),
    isVolumeProtection: enabled
  });
  log('success', `Volume protection ${enabled ? 'enabled' : 'disabled'}`);
  return result;
}

// Resize volume
export async function resizeVolume(vmID, volumeID, newSize, options = {}) {
  const { moveData = false, volumeName = '' } = options;

  if (!newSize || newSize < 10) {
    throw new Error('New size must be at least 10GB');
  }

  log('info', `Resizing volume ${volumeID} to ${newSize}GB...`);
  const result = await doAction(vmID, 'resizeServiceVolume', {
    volumeID: String(volumeID),
    volume: newSize,
    volumeName,
    isMoveData: moveData,
    currentSize: 0 // API will get current size
  });
  log('success', `Volume resized to ${newSize}GB`);
  return result;
}

// Detach volume
export async function detachVolume(vmID, volumeID, options = {}) {
  const { keepVolume = true, moveData = false } = options;

  log('info', `Detaching volume ${volumeID} from ${vmID}...`);
  const result = await doAction(vmID, 'detachServiceVolume', {
    volumeID: String(volumeID),
    isKeepVolume: keepVolume,
    isMoveData: moveData
  });
  log('success', `Volume detached${keepVolume ? '' : ' and deleted'}`);
  return result;
}

// Delete volume via service action
export async function deleteServiceVolume(vmID, volumeID) {
  log('info', `Deleting volume ${volumeID}...`);
  const result = await doAction(vmID, 'deleteServiceVolume', {
    volumeID: String(volumeID)
  });
  log('success', 'Volume deleted');
  return result;
}

// Volume actions via dedicated endpoint
export async function volumeAction(action, options = {}) {
  const response = await apiRequest('/api/volumes/doActionOnVolume', 'POST', {
    action,
    ...options
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || `Volume action "${action}" failed`);
  }

  return response;
}
