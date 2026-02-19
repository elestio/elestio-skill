#!/usr/bin/env node

/**
 * Elestio CLI - Manage Elestio DevOps services
 *
 * Usage: node cli.js <command> <action> [options]
 *
 * Commands:
 *   config      Configure credentials and defaults
 *   auth        Test authentication
 *   templates   Search/list deployable software (400+)
 *   sizes       List provider/region/size combinations
 *   projects    Manage projects
 *   services    Deploy and manage services
 *   action      Power management (reboot, shutdown, etc.)
 *   firewall    Manage firewall rules
 *   ssl         Manage SSL/custom domains
 *   ssh-keys    Manage SSH keys
 *   updates     Manage OS and app auto-updates
 *   alerts      Configure monitoring alerts
 *   backups     Manage backups (local, remote, S3)
 *   snapshots   Manage provider snapshots
 *   access      Get access credentials (SSH, VSCode, etc.)
 *   volumes     Manage block storage volumes
 *   cicd        Manage CI/CD pipelines
 *   billing     View costs and billing
 */

import { parseArgs, log, colors, showHelp } from './lib/utils.js';

// Import all modules
import * as auth from './lib/auth.js';
import * as templates from './lib/templates.js';
import * as projects from './lib/projects.js';
import * as services from './lib/services.js';
import * as actions from './lib/actions.js';
import * as access from './lib/access.js';
import * as backups from './lib/backups.js';
import * as volumes from './lib/volumes.js';
import * as cicd from './lib/cicd.js';
import * as billings from './lib/billings.js';

const args = parseArgs(process.argv.slice(2));
const [command, action, ...rest] = args._;

async function main() {
  try {
    switch (command) {

      // ============= CONFIG =============
      case 'config':
        if (args.email && args.token) {
          await auth.configure(args.email, args.token);
        } else if (args['set-default-project']) {
          auth.setDefaultProject(args['set-default-project']);
        } else if (args.show || !action) {
          auth.showConfig();
        } else if (args.provider || args.datacenter || args.size || args.support) {
          auth.setDefaults(args.provider, args.datacenter, args.size, args.support);
        } else {
          showHelp('config', {
            '--email X --token Y': 'Configure credentials',
            '--show': 'Show current config',
            '--set-default-project ID': 'Set default project',
            '--provider X': 'Set default provider',
            '--datacenter X': 'Set default region',
            '--size X': 'Set default server size'
          });
        }
        break;

      // ============= AUTH =============
      case 'auth':
        if (action === 'test' || !action) {
          await auth.testAuth();
        } else {
          showHelp('auth', { 'test': 'Test authentication' });
        }
        break;

      // ============= TEMPLATES =============
      case 'templates':
        switch (action) {
          case 'list':
            await templates.listTemplates(args.category);
            break;
          case 'search':
            const query = rest[0] || args.query;
            const results = await templates.searchTemplates(query, args.category);
            if (results.length === 0) {
              log('info', `No templates found for "${query}"`);
            } else {
              console.log(`\n${colors.bold}Search Results (${results.length})${colors.reset}\n`);
              results.slice(0, 20).forEach(t => {
                console.log(`  ${colors.cyan}${t.id}${colors.reset}: ${t.title} (${t.category})`);
              });
              if (results.length > 20) console.log(`  ... and ${results.length - 20} more`);
              console.log('');
            }
            break;
          case 'categories':
            await templates.listCategories();
            break;
          default:
            showHelp('templates', {
              'list': 'List all templates',
              'list --category "Databases"': 'Filter by category',
              'search <query>': 'Search templates',
              'categories': 'List categories'
            });
        }
        break;

      // ============= SIZES =============
      case 'sizes':
        switch (action) {
          case 'list':
          default:
            await templates.listSizes(args.provider, args.country);
        }
        break;

      // ============= PROJECTS =============
      case 'projects':
        switch (action) {
          case 'list':
            await projects.listProjects();
            break;
          case 'create':
            await projects.createProject(rest[0] || args.name, args.description, args.emails);
            break;
          case 'edit':
            await projects.editProject(rest[0] || args.id, args.name, args.description, args.emails);
            break;
          case 'delete':
            await projects.deleteProject(rest[0] || args.id, args.force);
            break;
          case 'members':
            await projects.listMembers(rest[0] || args.id);
            break;
          case 'add-member':
            await projects.addMember(rest[0] || args.id, args.email, args.role || 'admin');
            break;
          case 'remove-member':
            await projects.removeMember(rest[0] || args.project, args.member);
            break;
          default:
            showHelp('projects', {
              'list': 'List all projects',
              'create <name>': 'Create project',
              'delete <id> --force': 'Delete project',
              'members <id>': 'List members',
              'add-member <id> --email X': 'Add member'
            });
        }
        break;

      // ============= SERVICES =============
      case 'services':
        switch (action) {
          case 'list':
            await services.listServices(args.project);
            break;
          case 'get':
            await services.showService(rest[0] || args.vmID, args.project);
            break;
          case 'deploy':
            const templateName = rest[0];
            if (!templateName) {
              log('error', 'Template name required. Use: services deploy <template> --project <id>');
              break;
            }
            await services.deployService(templateName, {
              project: args.project,
              name: args.name,
              size: args.size,
              region: args.region,
              provider: args.provider,
              support: args.support,
              email: args.email,
              wait: args.wait !== 'false',
              dryRun: args['dry-run'] || args.dryRun
            });
            break;
          case 'delete':
            await services.deleteService(rest[0] || args.vmID, {
              force: args.force,
              project: args.project,
              withBackups: args['with-backups']
            });
            break;
          case 'move':
            await services.moveService(rest[0] || args.id, args['to-project'] || args.to, args.project);
            break;
          case 'wait':
            await services.waitForDeployment(rest[0] || args.vmID, args.project);
            break;
          default:
            showHelp('services', {
              'list': 'List services',
              'get <vmID>': 'Get service details',
              'deploy <template> --project X': 'Deploy from catalog',
              'deploy <template> --dry-run': 'Preview deployment without executing',
              'deploy cicd --project X': 'Deploy CI/CD target',
              'delete <vmID> --force': 'Delete service',
              'move <id> --to-project X': 'Move to project',
              'wait <vmID>': 'Wait for deployment'
            });
        }
        break;

      // ============= ACTION (Power) =============
      case 'action':
        const vmID = action;
        const powerAction = rest[0];
        if (!vmID || !powerAction) {
          showHelp('action <vmID>', {
            'reboot': 'Graceful reboot',
            'reset': 'Hard reset',
            'shutdown': 'Graceful shutdown',
            'poweroff': 'Force power off',
            'poweron': 'Power on',
            'restart-stack': 'Restart Docker containers',
            'lock': 'Enable termination protection',
            'unlock': 'Disable termination protection',
            'resize <size>': 'Change VM size (e.g., LARGE-4C-8G)'
          });
          break;
        }
        switch (powerAction) {
          case 'reboot': await actions.reboot(vmID); break;
          case 'reset': await actions.reset(vmID); break;
          case 'shutdown': await actions.shutdown(vmID, { project: args.project }); break;
          case 'poweroff': await actions.poweroff(vmID); break;
          case 'poweron': await actions.poweron(vmID); break;
          case 'restart-stack': await actions.restartStack(vmID); break;
          case 'lock': await actions.lock(vmID); break;
          case 'unlock': await actions.unlock(vmID); break;
          case 'resize':
            const newSize = rest[1] || args.size;
            if (!newSize) {
              log('error', 'Size required. Use: action <vmID> resize <size> (e.g., LARGE-4C-8G)');
              break;
            }
            await actions.resizeServer(vmID, newSize, {
              region: args.region,
              provider: args.provider,
              cpuRamOnly: args['cpu-ram-only'] !== 'false'
            });
            break;
          default: log('error', `Unknown action: ${powerAction}`);
        }
        break;

      // ============= FIREWALL =============
      case 'firewall':
        const fwVmID = action;
        const fwAction = rest[0];
        if (!fwVmID) {
          showHelp('firewall <vmID>', {
            'list': 'List firewall rules',
            'enable --rules \'[...]\'': 'Enable firewall',
            'update --rules \'[...]\'': 'Update rules',
            'disable': 'Disable firewall'
          });
          break;
        }
        switch (fwAction) {
          case 'list': await actions.getFirewallRules(fwVmID); break;
          case 'enable':
            const rules = args.rules ? JSON.parse(args.rules) : null;
            await actions.enableFirewall(fwVmID, rules);
            break;
          case 'update':
            await actions.updateFirewall(fwVmID, JSON.parse(args.rules));
            break;
          case 'disable': await actions.disableFirewall(fwVmID); break;
          default: await actions.getFirewallRules(fwVmID);
        }
        break;

      // ============= SSL =============
      case 'ssl':
        const sslVmID = action;
        const sslAction = rest[0];
        if (!sslVmID) {
          showHelp('ssl <vmID>', {
            'list': 'List custom domains',
            'add <domain>': 'Add domain with auto-SSL',
            'remove <domain>': 'Remove domain'
          });
          break;
        }
        switch (sslAction) {
          case 'list': await actions.listSslDomains(sslVmID); break;
          case 'add': await actions.addSslDomain(sslVmID, rest[1] || args.domain); break;
          case 'remove': await actions.removeSslDomain(sslVmID, rest[1] || args.domain); break;
          default: await actions.listSslDomains(sslVmID);
        }
        break;

      // ============= SSH-KEYS =============
      case 'ssh-keys':
        const sshVmID = action;
        const sshAction = rest[0];
        if (!sshVmID) {
          showHelp('ssh-keys <vmID>', {
            'list': 'List SSH keys',
            'add <name> <key>': 'Add SSH public key',
            'remove <name>': 'Remove SSH key'
          });
          break;
        }
        switch (sshAction) {
          case 'list': await actions.listSshKeys(sshVmID); break;
          case 'add': await actions.addSshKey(sshVmID, rest[1] || args.name, rest[2] || args.key); break;
          case 'remove': await actions.removeSshKey(sshVmID, rest[1] || args.name); break;
          default: await actions.listSshKeys(sshVmID);
        }
        break;

      // ============= UPDATES =============
      case 'updates':
        const updVmID = action;
        const updAction = rest[0];
        if (!updVmID) {
          showHelp('updates <vmID>', {
            'system-enable': 'Enable OS auto-updates (--day 0 --hour 5 --security-only)',
            'system-disable': 'Disable OS auto-updates',
            'system-now': 'Run OS update now',
            'app-enable': 'Enable app auto-updates (--day 0 --hour 3)',
            'app-disable': 'Disable app auto-updates',
            'app-now': 'Run app update now',
            'change-version --tag X': 'Change software version'
          });
          break;
        }
        switch (updAction) {
          case 'system-enable':
            await actions.enableSystemAutoUpdate(updVmID, {
              day: parseInt(args.day) || 0,
              hour: parseInt(args.hour) || 5,
              minute: parseInt(args.minute) || 0,
              securityOnly: args['security-only'] !== 'false'
            });
            break;
          case 'system-disable': await actions.disableSystemAutoUpdate(updVmID); break;
          case 'system-now': await actions.runSystemUpdate(updVmID); break;
          case 'app-enable':
            await actions.enableAppAutoUpdate(updVmID, {
              day: parseInt(args.day) || 0,
              hour: parseInt(args.hour) || 3,
              minute: parseInt(args.minute) || 0
            });
            break;
          case 'app-disable': await actions.disableAppAutoUpdate(updVmID); break;
          case 'app-now': await actions.runAppUpdate(updVmID); break;
          case 'change-version': await actions.changeVersion(updVmID, args.tag); break;
          default: log('error', `Unknown update action: ${updAction}`);
        }
        break;

      // ============= ALERTS =============
      case 'alerts':
        const alertVmID = action;
        const alertAction = rest[0];
        if (!alertVmID) {
          showHelp('alerts <vmID>', {
            'get': 'Get alert rules',
            'enable --rules \'...\'': 'Enable alerts',
            'disable': 'Disable alerts'
          });
          break;
        }
        switch (alertAction) {
          case 'get': await actions.getAlerts(alertVmID); break;
          case 'enable': await actions.enableAlerts(alertVmID, args.rules, parseInt(args.cycle) || 60); break;
          case 'disable': await actions.disableAlerts(alertVmID); break;
          default: await actions.getAlerts(alertVmID);
        }
        break;

      // ============= BACKUPS =============
      case 'backups':
        const bkpVmID = action;
        const bkpAction = rest[0];
        if (!bkpVmID) {
          showHelp('backups <vmID>', {
            'local-list': 'List local backups',
            'local-take': 'Take local backup',
            'local-restore <path>': 'Restore local backup',
            'local-delete <path>': 'Delete local backup',
            'remote-list': 'List remote backups',
            'remote-take': 'Take remote backup',
            'remote-restore <name>': 'Restore remote backup',
            'remote-setup --hour "03:00"': 'Setup auto backups',
            's3-verify': 'Verify S3 config',
            's3-enable': 'Enable S3 backups',
            's3-take': 'Take S3 backup',
            's3-list': 'List S3 backups'
          });
          break;
        }
        switch (bkpAction) {
          case 'local-list': await backups.listLocalBackups(bkpVmID); break;
          case 'local-take': await backups.takeLocalBackup(bkpVmID); break;
          case 'local-restore': await backups.restoreLocalBackup(bkpVmID, rest[1] || args.path); break;
          case 'local-delete': await backups.deleteLocalBackup(bkpVmID, rest[1] || args.path); break;
          case 'remote-list': await backups.listRemoteBackups(bkpVmID, args.project); break;
          case 'remote-take': await backups.takeRemoteBackup(bkpVmID, args.project); break;
          case 'remote-restore': await backups.restoreRemoteBackup(bkpVmID, rest[1] || args.name, args.project); break;
          case 'remote-setup': await backups.setupAutoBackups(bkpVmID, args.path || '/backup/', args.hour || '03:00', args.project); break;
          case 'remote-disable': await backups.disableAutoBackups(bkpVmID, args.project); break;
          case 's3-verify':
            await backups.verifyS3Config(bkpVmID, {
              apiKey: args.key, secretKey: args.secret,
              bucketName: args.bucket, endPoint: args.endpoint,
              prefix: args.prefix, providerType: args.type || 's3'
            });
            break;
          case 's3-enable':
            await backups.enableS3Backup(bkpVmID, {
              apiKey: args.key, secretKey: args.secret,
              bucketName: args.bucket, endPoint: args.endpoint,
              prefix: args.prefix, providerType: args.type || 's3'
            });
            break;
          case 's3-disable': await backups.disableS3Backup(bkpVmID); break;
          case 's3-take': await backups.takeS3Backup(bkpVmID); break;
          case 's3-list': await backups.listS3Backups(bkpVmID); break;
          case 's3-restore': await backups.restoreS3Backup(bkpVmID, rest[1] || args.key); break;
          case 's3-delete': await backups.deleteS3Backup(bkpVmID, rest[1] || args.key); break;
          default: log('error', `Unknown backup action: ${bkpAction}`);
        }
        break;

      // ============= SNAPSHOTS =============
      case 'snapshots':
        const snapVmID = action;
        const snapAction = rest[0];
        if (!snapVmID) {
          showHelp('snapshots <vmID>', {
            'list': 'List snapshots',
            'take': 'Take snapshot',
            'restore <id>': 'Restore snapshot',
            'delete <id>': 'Delete snapshot',
            'enable-auto': 'Enable auto snapshots',
            'disable-auto': 'Disable auto snapshots'
          });
          break;
        }
        switch (snapAction) {
          case 'list': await backups.listSnapshots(snapVmID); break;
          case 'take': await backups.takeSnapshot(snapVmID); break;
          case 'restore': await backups.restoreSnapshot(snapVmID, rest[1] || args.id); break;
          case 'delete': await backups.deleteSnapshot(snapVmID, rest[1] || args.id); break;
          case 'enable-auto': await backups.enableAutoSnapshots(snapVmID); break;
          case 'disable-auto': await backups.disableAutoSnapshots(snapVmID); break;
          default: await backups.listSnapshots(snapVmID);
        }
        break;

      // ============= ACCESS =============
      case 'access':
        const accVmID = action;
        const accAction = rest[0];
        if (!accVmID) {
          showHelp('access <vmID>', {
            'credentials': 'Get app credentials (URL, user, password)',
            'ssh': 'Get SSH access info',
            'vscode': 'Get VSCode web URL',
            'file-explorer': 'Get File Explorer URL',
            'logs': 'Get log viewer URL'
          });
          break;
        }
        switch (accAction) {
          case 'credentials': await access.getCredentials(accVmID, args.project); break;
          case 'ssh': await access.getSSH(accVmID, args.project); break;
          case 'ssh-direct': await access.getSSHDirect(accVmID); break;
          case 'vscode': await access.getVSCode(accVmID, args.project); break;
          case 'file-explorer': await access.getFileExplorer(accVmID, args.project); break;
          case 'logs': await access.getLogs(accVmID, args.project, args.mode); break;
          default: await access.getCredentials(accVmID, args.project);
        }
        break;

      // ============= VOLUMES =============
      case 'volumes':
        switch (action) {
          case 'list':
            await volumes.listVolumes(args.project);
            break;
          case 'create':
            await volumes.createVolume({
              name: rest[0] || args.name,
              size: parseInt(args.size) || 10,
              provider: args.provider,
              datacenter: args.region,
              projectId: args.project,
              serverId: args.server,
              storageType: args.type || 'NVME'
            });
            break;
          case 'attached':
            await volumes.getServiceVolumes(rest[0] || args.vmID);
            break;
          case 'attach':
            await volumes.createServiceVolume(rest[0] || args.vmID, {
              name: args.name,
              size: parseInt(args.size) || 10,
              storageType: args.type || 'NVME'
            });
            break;
          case 'resize':
            await volumes.resizeVolume(rest[0] || args.vmID, rest[1] || args.volumeID, parseInt(rest[2] || args.size));
            break;
          case 'detach':
            await volumes.detachVolume(rest[0] || args.vmID, rest[1] || args.volumeID, { keepVolume: args.keep !== 'false' });
            break;
          case 'delete':
            await volumes.deleteServiceVolume(rest[0] || args.vmID, rest[1] || args.volumeID);
            break;
          case 'protect':
            await volumes.setVolumeProtection(rest[0] || args.vmID, rest[1] || args.volumeID, args.enable !== 'false');
            break;
          default:
            showHelp('volumes', {
              'list': 'List volumes',
              'create <name> --size 10': 'Create volume',
              'attached <vmID>': 'List attached volumes',
              'attach <vmID> --name X --size 10': 'Create and attach',
              'resize <volumeID> --vmID X --size 50': 'Resize volume',
              'detach <volumeID> --vmID X': 'Detach volume',
              'delete <volumeID> --vmID X': 'Delete volume'
            });
        }
        break;

      // ============= CI/CD =============
      case 'cicd':
        switch (action) {
          case 'services':
            await cicd.getCicdServices(args.project);
            break;
          case 'pipelines':
            await cicd.getServicePipelines(rest[0] || args.vmID, args.project);
            break;
          case 'pipeline':
            await cicd.getPipelineDetails(args.vmID, rest[0] || args.pipelineID, args.project);
            break;
          case 'init-pipeline':
            console.log(cicd.generatePipelineTemplate(rest[0] || 'docker'));
            break;
          case 'create-pipeline':
            if (args.config) {
              await cicd.createPipeline(args.config);
            } else if (args.mode || args.repo || args.target) {
              await cicd.autoCreatePipeline({
                mode: args.mode || 'github',
                repo: args.repo,
                target: args.target,
                name: args.name,
                branch: args.branch,
                project: args.project,
                authId: args['auth-id'],
                buildCmd: args['build-cmd'],
                runCmd: args['run-cmd'],
                installCmd: args['install-cmd'],
                buildDir: args['build-dir'],
                rootDir: args['root-dir'],
                framework: args.framework,
                nodeVersion: args['node-version'],
                variables: args.variables,
                image: args.image,
                imageTag: args['image-tag']
              });
            } else {
              log('error', 'Provide --config OR --mode/--repo/--target/--name');
              log('info', 'Auto mode: cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app');
              log('info', 'JSON mode: cicd create-pipeline --config pipeline.json');
            }
            break;
          case 'action':
            const cicdVmID = rest[0] || args.vmID;
            const pipelineID = rest[1] || args.pipelineID;
            const cicdAction = rest[2] || args.action;
            switch (cicdAction) {
              case 'restart': await cicd.restartPipeline(cicdVmID, pipelineID, args.project); break;
              case 'stop': await cicd.stopPipeline(cicdVmID, pipelineID, args.project); break;
              case 'delete': await cicd.deletePipeline(cicdVmID, pipelineID, args.project, args.force); break;
              case 'resync': await cicd.resyncPipeline(cicdVmID, pipelineID, args.project); break;
              case 'logs': await cicd.getPipelineLogs(cicdVmID, pipelineID, args.project); break;
              case 'history': await cicd.getPipelineHistory(cicdVmID, pipelineID, args.project); break;
              case 'domains': await cicd.listPipelineDomains(cicdVmID, pipelineID, args.project); break;
              case 'add-domain': await cicd.addPipelineDomain(cicdVmID, pipelineID, args.domain, args.project); break;
              case 'remove-domain': await cicd.removePipelineDomain(cicdVmID, pipelineID, args.domain, args.project); break;
              default: log('error', `Unknown CI/CD action: ${cicdAction}`);
            }
            break;
          case 'logs':
            await cicd.viewPipelineLog(args.vmID, args.pipelineID, rest[0] || args.file, args.project);
            break;
          case 'registries':
            await cicd.getDockerRegistries(args.project);
            break;
          case 'add-registry':
            await cicd.addDockerRegistry(args.project, args.name, args.username, args.password, args.url);
            break;
          default:
            showHelp('cicd', {
              'services': 'List CI/CD targets',
              'pipelines <vmID>': 'List pipelines',
              'pipeline <pipelineID> --vmID X': 'Get pipeline details',
              'init-pipeline [mode]': 'Generate template (docker|github|github-fullstack|gitlab|gitlab-fullstack)',
              'create-pipeline --mode github --repo owner/repo --target <vmID> --name X': 'Auto-create pipeline',
              'create-pipeline --config X.json': 'Create from JSON config',
              'action <vmID> <pipelineID> restart/stop/logs/delete': 'Pipeline actions',
              'registries': 'List Docker registries'
            });
        }
        break;

      // ============= BILLING =============
      case 'billing':
        switch (action) {
          case 'summary':
          default:
            await billings.getBillingSummary();
            break;
          case 'project':
            await billings.getProjectBilling(rest[0] || args.id);
            break;
        }
        break;

      // ============= HELP =============
      case 'help':
      case '--help':
      case '-h':
      default:
        console.log(`
${colors.bold}Elestio CLI${colors.reset} - Manage Elestio DevOps services

${colors.bold}Usage:${colors.reset} node cli.js <command> [action] [options]

${colors.bold}Setup:${colors.reset}
  config --email X --token Y    Configure credentials
  auth test                     Verify authentication

${colors.bold}Catalog (no auth):${colors.reset}
  templates list                List 400+ deployable software
  templates search <query>      Search templates
  sizes list                    List provider/region/size combos

${colors.bold}Projects:${colors.reset}
  projects list                 List projects
  projects create <name>        Create project

${colors.bold}Services:${colors.reset}
  services list                 List services
  services deploy <template>    Deploy from catalog
  services get <vmID>           Get service details

${colors.bold}Actions:${colors.reset}
  action <vmID> reboot          Power management
  firewall <vmID> list          Firewall rules
  ssl <vmID> list               Custom domains
  ssh-keys <vmID> list          SSH key management
  updates <vmID> system-now     Run OS updates
  alerts <vmID> get             Monitoring alerts

${colors.bold}Backups:${colors.reset}
  backups <vmID> local-list     Local backups
  backups <vmID> remote-list    Remote backups
  snapshots <vmID> list         Provider snapshots

${colors.bold}Access:${colors.reset}
  access <vmID> credentials     Get app login
  access <vmID> ssh             SSH access
  access <vmID> vscode          VSCode web

${colors.bold}Infrastructure:${colors.reset}
  volumes list                  Block storage
  cicd services                 CI/CD targets
  billing summary               Cost tracking

${colors.bold}Options:${colors.reset}
  --project <id>                Specify project
  --force                       Confirm destructive actions
  --help                        Show command help

${colors.dim}Full docs: https://api-doc.elest.io/${colors.reset}
`);
    }
  } catch (error) {
    log('error', error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
