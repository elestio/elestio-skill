import { apiRequest } from './api.js';
import { doAction } from './actions.js';
import { getServerIdFromVmId } from './services.js';
import { log, colors, formatTable } from './utils.js';

// ============= LOCAL BACKUPS (templateAction) =============

async function templateAction(vmID, action, param1 = '', param2 = '', param3 = '') {
  const response = await apiRequest('/api/servers/templateAction', 'POST', {
    vmID: String(vmID),
    action,
    param1,
    param2,
    param3
  });

  if (response.status !== 'OK' && !response.data) {
    throw new Error(response.message || `Action "${action}" failed`);
  }

  return response;
}

export async function listLocalBackups(vmID) {
  let result;
  try {
    result = await templateAction(vmID, 'scriptBackupsList');
  } catch (e) {
    log('info', 'No local backups found (this service may not support application-level backups)');
    return [];
  }
  const backups = result.data?.backups || result.backups || [];

  if (backups.length === 0) {
    log('info', 'No local backups found');
    return [];
  }

  console.log(`\n${colors.bold}Local Backups${colors.reset}\n`);
  backups.forEach(b => {
    console.log(`  ${b}`);
  });
  console.log('');

  return backups;
}

export async function takeLocalBackup(vmID) {
  log('info', `Taking local backup on ${vmID}...`);
  const result = await templateAction(vmID, 'scriptBackup');
  log('success', 'Local backup initiated');
  return result;
}

export async function restoreLocalBackup(vmID, backupPath) {
  if (!backupPath) {
    throw new Error('Backup path required (e.g., /opt/app-backups/backup.zst)');
  }

  log('info', `Restoring local backup ${backupPath} on ${vmID}...`);
  const result = await templateAction(vmID, 'scriptRestore', backupPath);
  log('success', 'Local backup restore initiated');
  return result;
}

export async function deleteLocalBackup(vmID, backupPath) {
  if (!backupPath) {
    throw new Error('Backup path required');
  }

  log('info', `Deleting local backup ${backupPath} on ${vmID}...`);
  const result = await templateAction(vmID, 'scriptBackupDelete', backupPath);
  log('success', 'Local backup deleted');
  return result;
}

// ============= REMOTE BACKUPS (uses serverID) =============

export async function listRemoteBackups(vmID, projectId = null) {
  // Note: The backups API uses vmID in the serverID field (not the actual serverID)
  const response = await apiRequest('/api/backups/GetBackupList', 'POST', {
    serverID: String(vmID)
  });

  if (response.status !== 'OK') {
    log('info', 'No remote backups found (remote backups may not be configured for this service)');
    return [];
  }

  const backups = response.data?.backups || [];

  if (backups.length === 0) {
    log('info', 'No remote backups found');
    return [];
  }

  console.log(`\n${colors.bold}Remote Backups${colors.reset}\n`);
  backups.forEach(b => {
    console.log(`  ${b.snapshotName || b.name || b}`);
  });
  console.log('');

  return backups;
}

export async function takeRemoteBackup(vmID, projectId = null) {
  // Note: The backups API uses vmID in the serverID field (not the actual serverID)
  log('info', `Taking remote backup for ${vmID}...`);
  const response = await apiRequest('/api/backups/StartManualBackup', 'POST', {
    serverID: String(vmID)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to start remote backup');
  }

  log('success', 'Remote backup initiated');
  return response;
}

export async function restoreRemoteBackup(vmID, snapshotName, projectId = null) {
  if (!snapshotName) {
    throw new Error('Snapshot name required');
  }

  // Note: The backups API uses vmID in the serverID field (not the actual serverID)
  log('info', `Restoring remote backup ${snapshotName}...`);
  const response = await apiRequest('/api/backups/RestoreBackup', 'POST', {
    serverID: String(vmID),
    snapshotName
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to restore remote backup');
  }

  log('success', 'Remote backup restore initiated');
  return response;
}

export async function setupAutoBackups(vmID, backupPath = '/backup/', backupHour = '00:00', projectId = null) {
  // Note: The backups API uses vmID in the serverID field (not the actual serverID)
  log('info', `Setting up auto backups for ${vmID}...`);
  const response = await apiRequest('/api/backups/SetupAutoBackups', 'POST', {
    serverID: String(vmID),
    backupPath,
    backupHour
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to setup auto backups');
  }

  log('success', `Auto backups configured at ${backupHour}`);
  return response;
}

export async function disableAutoBackups(vmID, projectId = null) {
  // Note: The backups API uses vmID in the serverID field (not the actual serverID)
  log('info', `Disabling auto backups for ${vmID}...`);
  const response = await apiRequest('/api/backups/DisableAutoBackups', 'POST', {
    serverID: String(vmID)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to disable auto backups');
  }

  log('success', 'Auto backups disabled');
  return response;
}

// ============= SNAPSHOTS (DoActionOnServer) =============

export async function listSnapshots(vmID) {
  const result = await doAction(vmID, 'listSnapshot');
  const snapshots = result.data?.snapshots || result.snapshots || [];

  if (snapshots.length === 0) {
    log('info', 'No snapshots found');
    return [];
  }

  console.log(`\n${colors.bold}Snapshots${colors.reset}\n`);
  snapshots.forEach(s => {
    const name = s.description || s.name || s.id || s;
    const created = s.created || s.createdAt || '';
    console.log(`  ${s.id || s.orderID || 'N/A'}: ${name} ${created ? `(${created})` : ''}`);
  });
  console.log('');

  return snapshots;
}

export async function takeSnapshot(vmID) {
  log('info', `Taking snapshot of ${vmID}...`);
  const result = await doAction(vmID, 'takeSnapshot');
  log('success', 'Snapshot initiated');
  return result;
}

export async function restoreSnapshot(vmID, snapshotOrderID) {
  if (snapshotOrderID === undefined && snapshotOrderID !== 0) {
    throw new Error('Snapshot order ID required (0 = most recent)');
  }

  log('info', `Restoring snapshot ${snapshotOrderID}...`);
  const result = await doAction(vmID, 'restoreSnapshot', {
    snapshotOrderID: String(snapshotOrderID)
  });
  log('success', 'Snapshot restore initiated');
  return result;
}

export async function deleteSnapshot(vmID, snapshotID) {
  if (!snapshotID) {
    throw new Error('Snapshot ID required');
  }

  log('info', `Deleting snapshot ${snapshotID}...`);
  const result = await doAction(vmID, 'deleteSnapshot', {
    snapshotID: String(snapshotID)
  });
  log('success', 'Snapshot deleted');
  return result;
}

export async function enableAutoSnapshots(vmID) {
  log('info', `Enabling auto snapshots on ${vmID}...`);
  const result = await doAction(vmID, 'enableBackup');
  log('success', 'Auto snapshots enabled');
  return result;
}

export async function disableAutoSnapshots(vmID) {
  log('info', `Disabling auto snapshots on ${vmID}...`);
  const result = await doAction(vmID, 'disableBackup');
  log('success', 'Auto snapshots disabled');
  return result;
}

// ============= S3 EXTERNAL BACKUPS =============

export async function verifyS3Config(vmID, config) {
  const { apiKey, secretKey, bucketName, endPoint, prefix = '', providerType = 's3' } = config;

  if (!apiKey || !secretKey || !bucketName || !endPoint) {
    throw new Error('Required: apiKey, secretKey, bucketName, endPoint');
  }

  log('info', `Verifying S3 configuration for ${vmID}...`);
  const result = await doAction(vmID, 'verifyExternalBackupConfig', {
    apiKey, secretKey, bucketName, endPoint, prefix, providerType
  });
  log('success', 'S3 configuration verified');
  return result;
}

export async function enableS3Backup(vmID, config) {
  const { apiKey, secretKey, bucketName, endPoint, prefix = '', providerType = 's3' } = config;

  if (!apiKey || !secretKey || !bucketName || !endPoint) {
    throw new Error('Required: apiKey, secretKey, bucketName, endPoint');
  }

  log('info', `Enabling S3 backup for ${vmID}...`);
  const result = await doAction(vmID, 'enableExternalBackup', {
    apiKey, secretKey, bucketName, endPoint, prefix, providerType
  });
  log('success', 'S3 backup enabled');
  return result;
}

export async function disableS3Backup(vmID) {
  log('info', `Disabling S3 backup for ${vmID}...`);
  const result = await doAction(vmID, 'disableExternalBackup');
  log('success', 'S3 backup disabled');
  return result;
}

export async function takeS3Backup(vmID) {
  log('info', `Taking S3 backup for ${vmID}...`);
  const result = await doAction(vmID, 'takeExternalBackup');
  log('success', 'S3 backup initiated');
  return result;
}

export async function listS3Backups(vmID) {
  const result = await doAction(vmID, 'listExternalBackup');
  const backups = result.data?.backups || result.backups || [];

  if (backups.length === 0) {
    log('info', 'No S3 backups found');
    return [];
  }

  console.log(`\n${colors.bold}S3 Backups${colors.reset}\n`);
  backups.forEach(b => {
    console.log(`  ${b.key || b.name || b}`);
  });
  console.log('');

  return backups;
}

export async function restoreS3Backup(vmID, restoreKey) {
  if (!restoreKey) {
    throw new Error('Restore key required');
  }

  log('info', `Restoring S3 backup ${restoreKey}...`);
  const result = await doAction(vmID, 'restoreExternalBackup', { restoreKey });
  log('success', 'S3 backup restore initiated');
  return result;
}

export async function deleteS3Backup(vmID, deleteKey) {
  if (!deleteKey) {
    throw new Error('Delete key required');
  }

  log('info', `Deleting S3 backup ${deleteKey}...`);
  const result = await doAction(vmID, 'deleteExternalBackup', { deleteKey });
  log('success', 'S3 backup deleted');
  return result;
}

export async function configureS3Schedule(vmID, options = {}) {
  const {
    keepBackup = 4,
    schedulePeriod = -1,  // -1 = EveryDay, 0-6 = specific day of week
    scheduleType = 'EveryDay',  // 'EveryDay' or 'EveryWeek'
    updateHour = 1,
    updateMinute = 0
  } = options;

  log('info', `Configuring S3 backup schedule for ${vmID}...`);
  const result = await doAction(vmID, 'externalBackupSetting', {
    keepBackup: String(keepBackup),
    schedulePeriod: String(schedulePeriod),
    scheduleType,
    updateHour: String(updateHour),
    updateMinute: String(updateMinute)
  });
  log('success', 'S3 backup schedule configured');
  return result;
}
