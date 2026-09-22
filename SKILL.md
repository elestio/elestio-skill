---
name: elestio
description: Deploy and manage services on the Elestio DevOps platform. Use when the user wants to deploy apps, databases, or infrastructure on Elestio, manage projects, services, clusters, CI/CD pipelines, backups, domains, firewall, volumes, or billing. Covers 400+ open-source templates across 9 cloud providers, database clustering, and deploying catalog software as CI/CD pipelines.
compatibility: Requires Node.js >= 18, the official Elestio CLI >= 1.1.0 (npm install -g elestio), and an Elestio account with API token
metadata:
  author: getateam
  version: "2.1"
---

# Elestio Skill

**Version:** 2.1
**Purpose:** Deploy and manage services on Elestio DevOps platform
**Status:** Ready to use
**Last Updated:** 2026-09-22

Elestio is a fully managed DevOps platform. Dedicated VMs (not shared Kubernetes). 400+ open-source templates, 9 cloud providers, 100+ regions. Handles deployment, security, updates, backups, monitoring, support.

This skill uses the **official Elestio CLI** (`elestio` command, installed via `npm install -g elestio`).

---

## When to Use This Skill

Use this skill when:
- User wants to deploy PostgreSQL, MySQL, Redis, MongoDB, Elasticsearch, etc.
- User says "deploy", "spin up", "create a server", "I need a database"
- User mentions ANY open-source software (WordPress, Grafana, n8n, Metabase, etc.)
- User wants to deploy custom code via CI/CD
- User needs to manage backups, firewall, SSL, SSH access
- User asks about service status, costs, or credentials

**Trigger phrases:**
- "Deploy PostgreSQL" -> `elestio deploy postgresql`
- "I need a Redis cache" -> `elestio deploy redis`
- "Set up n8n for automation" -> `elestio deploy n8n`
- "Deploy my app from GitHub" -> CI/CD workflow (Phase 4)
- "What services are running?" -> `elestio services`
- "How much is this costing?" -> `elestio billing`

## When NOT to Use This Skill

- **Initial account setup** - Signup, payment, approval must be done manually by human
- **Interactive SSH sessions** - Use direct SSH instead
- **Complex Docker Compose editing** - SSH into the server directly

---

## Decision Tree: What Should I Deploy?

There are THREE deployment shapes, not two. Choosing wrong is the single most
common cause of a failed deployment.

```
Is the software in the Elestio catalog?  (elestio templates search <name>)
|
+-- YES
|   |
|   +-- Does the user want a managed, isolated VM?  (production databases,
|   |   anything needing backups / monitoring / support)
|   |       -> MANAGED SERVICE
|   |          elestio deploy <template> --project <id>
|   |
|   +-- Does the user want replication / high availability?
|   |       -> CLUSTER   (19 templates only: elestio clusters templates)
|   |          elestio deploy <template> --cluster --nodes <n> --project <id>
|   |
|   +-- Does the user want it cheap, or several apps on one VM?
|           -> PIPELINE FROM CATALOG TEMPLATE
|              elestio cicd deploy-template <software> --target <vmID>
|
+-- NO, it is the user's own code
    |
    +-- In a Git repo?
    |       -> elestio cicd create --auto --target <vmID> --name X --repo owner/repo
    |
    +-- Just a docker-compose file?
            -> elestio cicd create <pipeline.json>
```

### CRITICAL: catalog software in a pipeline

To run catalog software (n8n, Rybbit, Plausible, ...) on a CI/CD target, you
MUST use `elestio cicd deploy-template`. You must NOT use `elestio cicd create`.

`cicd create` builds an EMPTY pipeline. It does not know the software's ports,
environment variables or install scripts, so the pipeline deploys and nothing
runs. This is the most frequently reported failure.

`deploy-template` reads the template's `elestio.yml` (from
`github.com/elestio-examples/<software>`) and configures the pipeline from it.

```bash
# RIGHT
elestio cicd deploy-template n8n --target <vmID>

# WRONG -- produces an empty pipeline
elestio cicd create --auto --target <vmID> --name n8n --repo elestio-examples/n8n
```

To check the catalog:
  elestio templates search <software-name>     # everything
  elestio cicd templates <software-name>       # deployable as a pipeline
  elestio clusters templates                   # supports clustering

---

## Setup (One-Time -- Human Action Required)

### Prerequisites

1. **Create Account:** https://dash.elest.io/signup
2. **Verify Email:** Check inbox, click verification link
3. **Add Credit Card:** https://dash.elest.io/account/payment
4. **Wait for Approval:** Usually instant, sometimes 24-48h
5. **Create API Token:** https://dash.elest.io/account/security -> Manage API Tokens -> Create Token
6. **Configure skill:** Give email + API token to agent

### Configure Credentials

```bash
elestio login --email "user@domain.com" --token "xxx_..."
elestio auth test
```

### Verify Setup

```bash
# Should show: [SUCCESS] Authenticated as user@domain.com
elestio auth test

# List projects (should show at least one)
elestio projects
```

---

## Quick Start Examples

### Deploy PostgreSQL (2 commands)

```bash
# 1. Find template ID
elestio templates search postgresql
# -> ID: 11, PostgreSQL

# 2. Deploy (uses defaults: netcup/nbg/MEDIUM-2C-4G)
elestio deploy postgresql --project 112 --name my-db
# -> Waits for deployment, shows credentials when ready
```

### Deploy Redis Cache

```bash
elestio deploy redis --project 112
```

### Deploy WordPress

```bash
elestio deploy wordpress --project 112
```

### Deploy a Cluster (replication / HA)

```bash
# 1. Check the software supports clustering and see its minimum node count
elestio clusters templates

# 2. ALWAYS dry-run first: billing is per VM, --nodes 3 bills 3 VMs
elestio deploy postgresql --cluster --nodes 3 --project 112 --dry-run

# 3. Deploy
elestio deploy postgresql --cluster --nodes 3 --project 112

# 4. Follow it
elestio clusters list --project 112
elestio clusters info <clusterID>
```

Rules:
- `--nodes` is the TOTAL, primary included. `--nodes 3` = 1 primary + 2 replicas.
- ClickHouse, Vault, OpenSearch, RabbitMQ, rke2 and Nats need at least 3 nodes.
- Everything else starts at 2. Maximum is 15.
- `--cluster-mode multi-master` works for MySQL only; all others are
  `primary-replica` (the default).

### Deploy Catalog Software as a Pipeline (n8n, Rybbit, Plausible...)

This is the route to use whenever the user wants catalog software on a CI/CD
target rather than a dedicated VM.

```bash
# 1. Create a CI/CD target if none exists (this is a VM; pipelines share it)
elestio deploy CI-CD-Target --project 112 --name my-target
# -> note the vmID

# 2. Confirm the software is available as a pipeline template
elestio cicd templates n8n

# 3. ALWAYS dry-run first: it prints the ports, env vars and lifecycle hooks
#    that will be applied, and creates nothing
elestio cicd deploy-template n8n --target <vmID> --dry-run

# 4. Deploy
elestio cicd deploy-template n8n --target <vmID>
```

On success the CLI prints the software's URL, login and generated password.

**Two routes:**

| | compose (default) | git (`--owner <git-user>`) |
|---|---|---|
| Needs a connected Git account | No | Yes |
| Lifecycle scripts (preInstall/postInstall) | Skipped | Run |
| Repo files the compose mounts | Unavailable | Available |
| Works for | Templates needing no repo files | Every template |

**The git route is currently unavailable**: it needs
`POST /api/cicd/createRepoByTemplate`, which the Elestio API returns 404 for
(the controller exists but is not registered in the backend route whitelist).

**The compose route does not work for every template.** If the compose
bind-mounts a file from the repo, the CLI refuses with the file names. Do NOT
pass --force to get past it: Docker creates the missing file as a directory and
the container fails to start. Tell the user that software needs the git route,
which is currently blocked, and offer a managed service instead
(`elestio deploy <template>`).

Verified: vaultwarden, redis and metabase deploy cleanly on the compose route;
n8n, rybbit and wordpress need the git route.

ALWAYS verify a deployment instead of assuming it worked:

```bash
elestio cicd pipelines <vmID>                          # Build column must say "success"
elestio cicd pipeline-history <vmID> <pipelineID>      # Status, duration, log file
```

### Deploy Custom App from GitHub (user's own code)

```bash
# 1. Deploy CI/CD target
elestio deploy CI-CD-Target --project 112 --name my-cicd

# 2. Auto-create pipeline
elestio cicd create --auto --target <vmID> --name my-app --repo owner/repo --mode github --auth-id <authID>
# -> Site is live at https://<name>-u<userID>.vm.elestio.app/
```

Use this ONLY for the user's own repository. For catalog software, use
`cicd deploy-template` instead -- see above.

### Deploy Custom App (Manual -- Docker mode)

```bash
# 1. Deploy CI/CD target
elestio deploy CI-CD-Target --project 112 --name my-cicd

# 2. Add SSH key for agent access
elestio ssh-keys add <vmID> --name "agent-key" --key "ssh-ed25519 AAAA..."

# 3. Generate pipeline config
elestio cicd template docker > pipeline.json
# Edit pipeline.json with correct CI/CD target info (see JSON reference below)

# 4. Create pipeline
elestio cicd create pipeline.json

# 5. SSH and configure
ssh root@<ipv4>
cd /opt/app/<pipeline-name>
# Edit docker-compose.yml, add code, docker-compose up -d
```

#### Pipeline JSON Reference (Docker mode -- `createCiCdExistServer` payload)

**CRITICAL:** The pipeline.json must match the API format exactly. Common mistakes are documented below.

```json
{
  "CICDMode": "DockerCompose",
  "pipelineName": "my-pipeline",
  "configData": {
    "runTime": "Docker Compose",
    "framework": "NoFramework",
    "version": "20",
    "buildCommand": "",
    "runCommand": "",
    "installCommand": "",
    "buildDir": ""
  },
  "imageData": {
    "isPrivate": false,
    "compose": "version: '3.3'\nservices:\n  app:\n    image: nginx:alpine\n    restart: always\n    ports:\n      - 172.17.0.1:3000:80",
    "dockerExample": "",
    "repoName": "CustomDocker"
  },
  "gitData": {},
  "authID": null,
  "isPublicGitRepo": false,
  "gitVolumeConfig": [{}],
  "cluster": {
    "target": {
      "vmID": 848528,
      "vmProvider": "netcup",
      "vmRegion": "nbg",
      "levelName": "MEDIUM-2C-4G",
      "projectID": 74333
    }
  },
  "ports": [
    {
      "protocol": "HTTPS",
      "targetPort": 443,
      "publishedPort": "3000",
      "isDefault": "yes",
      "loginTitle": ""
    }
  ],
  "lifeCycleCommand": {
    "preInstallCommand": "", "postInstallCommand": "",
    "preBackupCommand": "", "postBackupCommand": "",
    "preRestoreCommand": "", "postRestoreCommand": "",
    "preUpdateCommand": "", "postUpdateCommand": "",
    "preDeployCommand": "", "postDeployCommand": ""
  },
  "monoRepoWorkSpaces": [""],
  "copyCommandConfig": [],
  "variables": "",
  "gitUserFormData": {
    "selectedUser": "", "searchGitUser": "",
    "gitOrgsFilteredList": { "GITHUB": [], "GITLAB": [] },
    "gitOrgsList": [], "selectedRepo": {},
    "thirdPartyRepoInput": "", "gitScopesUsers": [],
    "thirdPartyRepoScopeName": "",
    "getGitScopeUser": { "GITHUB": [], "GITLAB": [] },
    "thirdPartyRepoName": "", "thirdPartyRepoPrivate": false,
    "loadSearch": false
  }
}
```

**Common payload mistakes to avoid:**

| Field | WRONG | CORRECT |
|-------|-------|---------|
| `CICDMode` | `"DOCKER"` | `"DockerCompose"` |
| `configData.runTime` | `runtime` (lowercase t) | `runTime` (capital T) |
| `configData.framework` | `""` | `"NoFramework"` |
| `configData.version` | `""` | `"20"` |
| `imageData` | `{ imageName, imageTag, registryUrl }` | `{ isPrivate, compose, dockerExample, repoName }` |
| `gitData` (docker mode) | `{ projectName, branch, ... }` | `{}` (empty object) |
| `authID` (docker mode) | `"0"` | `null` |
| `isPublicGitRepo` | `"false"` (string) | `false` (boolean) |
| `gitVolumeConfig` | `[]` | `[{}]` |
| `ports[].loginTitle` | (missing) | `""` (empty string, required) |
| `nonRepoWorkSpaces` | present | remove — use `monoRepoWorkSpaces` instead |
| `cluster.target` | only `vmID` | must include `vmProvider`, `vmRegion`, `levelName`, `projectID` |
| `variables` | omitted or `[]` (array) | `""` (empty string; backend runs variables.trim()) |

---

## Command Reference

### Authentication & Configuration

```bash
elestio login --email X --token Y  # Set credentials
elestio auth test                  # Verify authentication
elestio whoami                     # Show current user
elestio config                     # Show current config
elestio config --set-default-project X  # Set default project
```

### Catalog (No Auth Required)

```bash
elestio templates                  # List all 400+ templates
elestio templates search <query>   # Search by name
elestio templates info <name>      # Template details
elestio categories                 # List categories
elestio sizes                      # All provider/region/size combos
elestio sizes --provider netcup    # Filter by provider
```

### Projects

```bash
elestio projects                   # List all projects
elestio projects create <name>     # Create project
elestio projects delete <id> --force  # Delete project
elestio projects members <id>      # List members
elestio projects add-member <id> <email>
elestio projects remove-member <id> <memberId>
```

### Services

```bash
elestio services                   # List all services
elestio services --project 123     # Filter by project
elestio service <vmID>             # Service details
elestio deploy <template> --project X --name Y
elestio deploy <template> --cluster --nodes 3   # Cluster (see Clusters below)
elestio deploy CI-CD-Target --project X         # Deploy a CI/CD target VM
elestio delete-service <vmID> --force
elestio move-service <vmID> <targetProjectId>
elestio wait <vmID>                # Wait for deployment
```

### Power Management

```bash
elestio reboot <vmID>              # Graceful reboot
elestio reset <vmID>               # Hard reset
elestio shutdown <vmID>            # Graceful shutdown
elestio poweroff <vmID>            # Force power off
elestio poweron <vmID>             # Power on
elestio restart-stack <vmID>       # Restart Docker only (fastest)
elestio lock <vmID>                # Enable termination protection
elestio unlock <vmID>              # Disable termination protection
elestio resize <vmID> --size LARGE-4C-8G  # Upgrade/downgrade VM size
```

### Firewall

```bash
elestio firewall get <vmID>        # List rules
elestio firewall enable <vmID> --rules '[{"type":"INPUT","port":"22","protocol":"tcp","targets":["0.0.0.0/0"]}]'
elestio firewall update <vmID> --rules '[...]'
elestio firewall disable <vmID>
```

### SSL / Custom Domains

```bash
elestio ssl list <vmID>            # List domains
elestio ssl add <vmID> <domain>    # Add with auto-SSL
elestio ssl remove <vmID> <domain>
```

### SSH Keys

```bash
elestio ssh-keys list <vmID>       # List keys
elestio ssh-keys add <vmID> --name "name" --key "ssh-ed25519 AAAA..."
elestio ssh-keys remove <vmID> --name "name"
```

**Note:** When adding SSH keys, provide only the key type and key data (e.g., `ssh-ed25519 AAAA...`). Do NOT include the comment/email at the end of the key.

### Auto-Updates

```bash
elestio updates system-enable <vmID> --day 0 --hour 5 --security-only
elestio updates system-disable <vmID>
elestio updates system-now <vmID>  # Run OS update now
elestio updates app-enable <vmID> --day 0 --hour 3
elestio updates app-disable <vmID>
elestio updates app-now <vmID>     # Run app update now
elestio change-version <vmID> <version>  # e.g., PostgreSQL 15
```

### Alerts

```bash
elestio alerts get <vmID>          # Get current rules
elestio alerts enable <vmID> --rules '{...}' --cycle 60
elestio alerts disable <vmID>
```

### Backups

```bash
# Local backups (application-level)
elestio backups local-list <vmID>
elestio backups local-take <vmID>
elestio backups local-restore <vmID> /opt/app-backups/backup.zst
elestio backups local-delete <vmID> /opt/app-backups/backup.zst

# Remote backups (Elestio managed)
elestio backups remote-list <vmID>
elestio backups remote-take <vmID>
elestio backups remote-restore <vmID> <snapshot-name>
elestio backups auto-enable <vmID>
elestio backups auto-disable <vmID>

# S3 external backups
elestio s3-backup verify <vmID> --key X --secret Y --bucket Z --endpoint S
elestio s3-backup enable <vmID> --key X --secret Y --bucket Z --endpoint S
elestio s3-backup disable <vmID>
elestio s3-backup take <vmID>
elestio s3-backup list <vmID>
elestio s3-backup restore <vmID> <backup-key>
elestio s3-backup delete <vmID> <backup-key>
```

### Snapshots (Provider-level)

```bash
elestio snapshots list <vmID>      # List all snapshots
elestio snapshots take <vmID>      # Create manual snapshot
elestio snapshots restore <vmID> <id>  # Restore snapshot (0 = most recent)
elestio snapshots delete <vmID> <id>   # Delete snapshot
elestio snapshots auto-enable <vmID>   # Enable automatic snapshots
elestio snapshots auto-disable <vmID>  # Disable automatic snapshots
```

### Access & Credentials

```bash
elestio credentials <vmID>         # App URL + login
elestio ssh <vmID>                 # SSH terminal URL
elestio ssh <vmID> --direct        # Direct SSH command
elestio vscode <vmID>              # VSCode web URL
elestio files <vmID>               # File explorer URL
```

### Volumes

**Note:** Volume support depends on the cloud provider. Hetzner supports full volume operations. Some providers like netcup have limited or no volume support.

```bash
elestio volumes                    # List all volumes in project
elestio volumes create --name X --size 10
elestio volumes service-list <vmID>    # List attached to service
elestio volumes service-create <vmID> --name X --size 10
elestio volumes resize <vmID> <volumeID> --size 20
elestio volumes detach <vmID> <volumeID>
elestio volumes delete <vmID> <volumeID>
elestio volumes protect <vmID> <volumeID>
```

### Clusters

```bash
elestio clusters templates                  # Software that supports clustering
elestio clusters                            # List clusters in the project
elestio clusters info <clusterID>           # Details + nodes
elestio clusters nodes <clusterID>          # Active nodes only

# Creation goes through deploy, not through clusters
elestio deploy <template> --cluster --nodes <n> [--cluster-mode multi-master]

# Operations -- all destructive ones require --force
elestio clusters promote <clusterID> <vmID> --force   # Promote a replica
elestio clusters failover <clusterID> on|off          # AUTOMATIC failover switch, does not switch now
elestio clusters resync <clusterID> --force           # ERASES replica data
elestio clusters lock <clusterID>                     # Termination protection
elestio clusters unlock <clusterID>
elestio clusters delete <clusterID> --force           # Deletes ALL nodes (not delete-service)
```

**Constraints (the CLI enforces these before calling the API):**

| Rule | Value |
|---|---|
| `--nodes` counts | Total nodes, primary included |
| Minimum, most software | 2 |
| Minimum: ClickHouse, Vault, OpenSearch, RabbitMQ, rke2, Nats | 3 (quorum) |
| Maximum | 15 |
| `--cluster-mode multi-master` | MySQL only |
| Billing | Per VM. `--nodes 5` bills 5 VMs. |
| Switching primary by hand | `promote`, NOT `failover` (which only toggles automatic failover) |
| Replicas | Read-only, and no SSL: `sslmode=require` fails on a replica |

NEVER deploy a cluster without running `--dry-run` first and telling the user
the VM count and cost.

### CI/CD Pipelines

```bash
# CATALOG SOFTWARE -> always use deploy-template (reads the template elestio.yml)
elestio cicd templates [query]     # Catalog software deployable as a pipeline
elestio cicd deploy-template <software> --target <vmID>
elestio cicd deploy-template <software> --target <vmID> --dry-run
elestio cicd deploy-template <software> --target <vmID> --owner <git-user>  # git route (currently 404)
# Options: --name, --branch, --private, --non-org, --auth-id, --git-type,
#          --repo-name, --build-cmd, --run-cmd, --install-cmd, --build-dir

elestio cicd targets               # List CI/CD targets
elestio cicd pipelines <vmID>      # List pipelines
elestio cicd pipeline-info <vmID> <pipelineID>

# USER'S OWN REPO -> create --auto. Never use this for catalog software.
elestio cicd create --auto --target <vmID> --name my-app --repo owner/repo --mode github
elestio cicd create --auto --target <vmID> --name my-app --repo owner/repo --mode github --auth-id <id>
# Modes: github, github-fullstack, gitlab, gitlab-fullstack, docker
# Optional: --branch, --build-cmd, --run-cmd, --install-cmd, --build-dir, --framework, --node-version

# Manual pipeline creation (from JSON template)
elestio cicd template docker       # Docker Compose (custom, no Git)
elestio cicd template github       # GitHub Static SPA (Vite/React)
elestio cicd template github-fullstack  # GitHub Full Stack (Node.js)
elestio cicd template gitlab       # GitLab Static SPA (Vite/React)
elestio cicd template gitlab-fullstack  # GitLab Full Stack (Node.js)
elestio cicd create <config.json>

# Pipeline actions
elestio cicd pipeline-restart <vmID> <pipelineID>
elestio cicd pipeline-stop <vmID> <pipelineID>
elestio cicd pipeline-logs <vmID> <pipelineID>
elestio cicd pipeline-history <vmID> <pipelineID>
elestio cicd pipeline-delete <vmID> <pipelineID> --force

# Pipeline domains
elestio cicd domains <vmID> <pipelineID>
elestio cicd domain-add <vmID> --pipeline <id> --domain myapp.example.com
elestio cicd domain-remove <vmID> --pipeline <id> --domain myapp.example.com

# Docker registries
elestio cicd registries
elestio cicd registry-add --name X --username U --password P --url URL
```

**Auto-create pipeline flow:** The CLI automatically discovers the Git account, finds the repo, creates the pipeline via API, adds an SSH key, writes a correct multi-stage Dockerfile (Node build + Nginx serve), builds the Docker image, starts the container, and verifies HTTP 200. The entire process takes ~2 minutes after CI/CD target is deployed.

### Billing

```bash
elestio billing                    # Total costs
elestio billing project <id>       # Per-service breakdown
```

---

## MANDATORY: Interactive Deployment Procedure

**CRITICAL:** When deploying ANY service, you MUST ask the user for each required parameter one by one using `AskUserQuestion`. NEVER deploy with default values without explicit user confirmation.

### Required Parameters (ask in this order):

**1. Provider** -- Ask using `AskUserQuestion`:
- Netcup (Recommended) -- Best price/performance ratio, EU-based, reliable
- Hetzner -- Best features: full volume, snapshot & power management support
- AWS -- Amazon Web Services, global reach
- Azure -- Microsoft cloud

**2. Region** -- Ask using `AskUserQuestion`, based on selected provider:
- Netcup: nbg (Europe - Germany, Nuremberg) | mns (North America - United States, Manassas)
- Hetzner: fsn1 (Falkenstein, DE), nbg1 (Nuremberg, DE), hel1 (Helsinki, FI), ash (Ashburn, US)
- AWS: us-east-1, eu-west-1, ap-southeast-1, etc.
- Azure: germanywestcentral, eastus, westeurope, etc.

Use `elestio sizes --provider <provider>` to get exact available regions if needed.

**3. Service Plan (Size)** -- Ask using `AskUserQuestion`, propose available sizes with pricing:
- SMALL-1C-1G -- 1 core, 1GB RAM (~$11/mo, Linode)
- MEDIUM-2C-4G -- 2 cores, 4GB RAM (~$16/mo, Netcup DE)
- LARGE-4C-8G -- 4 cores, 8GB RAM (~$30/mo, Netcup DE)
- XL-8C-16G -- 8 cores, 16GB RAM (~$55/mo, Netcup DE)

Use `elestio sizes --provider <provider>` to get exact sizes/pricing for the chosen provider.

**4. Name of Service** -- Do NOT use `AskUserQuestion`. Simply ask the user in plain text to provide a name, suggesting a default based on the service type (e.g., "prod-postgres", "staging-redis"). Wait for user text input.

**5. Admin Email** -- Ask using `AskUserQuestion`, propose the employer's email as default. Let the user confirm or change.

### Example Flow:

```
User: "Deploy PostgreSQL"
Agent: [AskUserQuestion] Which cloud provider? (Netcup recommended, Hetzner, AWS, Azure)
User: "Netcup"
Agent: [AskUserQuestion] Which region? (nbg Europe-Germany, mns North America-US)
User: "nbg"
Agent: [AskUserQuestion] Which service plan? (SMALL ~$11/mo, MEDIUM ~$16/mo, LARGE ~$30/mo, XL ~$55/mo)
User: "MEDIUM"
Agent: "What name do you want for this service? Suggestion: prod-postgresql"
User: "demo-postgres"
Agent: [AskUserQuestion] Admin email? (Suggested: user@company.com)
User: confirms
Agent: Deploys with all confirmed parameters
```

---

## Golden Rules

1. **Always authenticate first** -- Every session starts with valid JWT
2. **vmID != serverID** -- Most endpoints use `vmID`, backup/notes use `serverID` (both from `elestio services`)
3. **Check deployment status** -- After deploy, wait for `deploymentStatus = "Deployed"` before accessing
4. **Never delete without confirmation** -- Always require `--force` flag
5. **Use catalog when possible** -- Phase 3 (catalog) is simpler than Phase 4 (CI/CD)
5b. **Catalog software in a pipeline -> `cicd deploy-template`, NEVER `cicd create`** -- `cicd create` cannot know the software's ports, env vars or install scripts, so it produces a pipeline that deploys and runs nothing
6. **Validate combos** -- Provider + datacenter + serverType must match `elestio sizes`
7. **Account must be approved** -- New accounts need credit card + approval before deploying
8. **ALWAYS follow the Interactive Deployment Procedure above** -- Never skip parameter questions
9. **Set default project** -- Use `elestio config --set-default-project <id>` to avoid passing `--project` every time
10. **Service belongs to project** -- When using `elestio service <vmID>`, ensure the vmID belongs to the current default project or specify `--project`
11. **Dry-run anything that multiplies VMs** -- Always run `--dry-run` before a cluster deploy and tell the user the VM count and monthly cost; clusters bill per VM
12. **`--nodes` is the total** -- `--nodes 3` is 1 primary + 2 replicas and bills 3 VMs, not 4

---

## Defaults

| Setting | Default | Override |
|---------|---------|----------|
| Provider | netcup | `--provider hetzner` |
| Datacenter | nbg (Germany) | `--region fsn1` |
| Server Size | MEDIUM-2C-4G | `--size LARGE-4C-8G` |
| Support | level1 | `--support level2` |

**Why netcup?** Best price/performance ratio. EU-based. Reliable.

---

## Provider Limitations

Not all cloud providers support all features. Use `--provider` to switch.

| Feature | netcup | Hetzner | AWS | GCP | Azure | Scaleway |
|---------|--------|---------|-----|-----|-------|----------|
| Catalog deploy | yes | yes | yes | yes | yes | yes |
| CI/CD deploy | yes | yes | yes | yes | yes | yes |
| **Volumes** | no | yes | yes | yes | yes | yes |
| **Snapshots** | limited | yes | yes | yes | yes | yes |
| Power actions | limited | yes | yes | yes | yes | yes |
| Firewall | yes | yes | yes | yes | yes | yes |
| SSL/Domains | yes | yes | yes | yes | yes | yes |
| **Size downgrade** | yes | no | yes | no | yes | yes |

**Size downgrade support:** Only **Netcup, AWS, Azure, and Scaleway** support downgrading instance sizes. Other providers (Hetzner, GCP, etc.) only support upgrades. Attempting a downgrade on an unsupported provider can block the service and require Elestio support intervention. The CLI will automatically block downgrade attempts on unsupported providers.

**Recommendation:** Use **Hetzner** if you need volumes, snapshots, or full power management. Use **netcup** for best value when basic features suffice. Use **netcup, AWS, Azure, or Scaleway** if you need the flexibility to downgrade instance sizes.

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Not configured" | Missing credentials | `elestio login --email X --token Y` |
| "Authentication failed" | Wrong credentials or expired token | Re-create API token in dashboard |
| "Account not approved" | New account without approval | Wait for approval or contact support@elest.io |
| "Template not found" | Wrong name/ID | Use `elestio templates search <name>` |
| "Invalid serverType" | Provider/region/size combo doesn't exist | Check `elestio sizes --provider X` |
| "Service not found" | Wrong vmID or project | Check `elestio services --project X` |
| "Deployment timeout" | Taking too long | Check dashboard, contact support if > 10 min |
| "Project not found" | Wrong projectId | Check `elestio projects` |

---

## Composability: What to Do After...

### After Deploying a Service

1. **Get credentials:** `elestio credentials <vmID>`
2. **Verify running:** Open the URL, confirm service works
3. **Enable backups:** `elestio backups auto-enable <vmID>`
4. **Add custom domain:** `elestio ssl add <vmID> myapp.example.com`
5. **Configure firewall:** `elestio firewall enable <vmID> --rules [...]`
6. **Enable auto-updates:** `elestio updates system-enable <vmID> --security-only`

### After Creating CI/CD Target

**Catalog software (n8n, Rybbit, Plausible...) -- use this:**
1. **Check it is available:** `elestio cicd templates <software>`
2. **Preview:** `elestio cicd deploy-template <software> --target <vmID> --no-git --dry-run`
3. **Deploy:** `elestio cicd deploy-template <software> --target <vmID>`
4. **Report the printed URL, login and password to the user**
5. **Add a domain:** `elestio cicd domain-add <vmID> --pipeline <pipelineID> --domain myapp.example.com`

**User's own repo:**
1. **Auto-create pipeline:** `elestio cicd create --auto --target <vmID> --name my-app --repo owner/repo --mode github --auth-id <id>`
2. Site is live -- CLI handles SSH, Dockerfile, build, start automatically

**Manual docker-compose:**
1. **Add SSH key:** `elestio ssh-keys add <vmID> --name "name" --key "key"`
2. **Create pipeline:** `elestio cicd create pipeline.json`
3. **SSH and configure:** `ssh root@<ipv4>`
4. **Add domain:** `elestio cicd domain-add <vmID> --pipeline <pipelineID> --domain myapp.example.com`

### After an Error

1. **Re-authenticate:** `elestio auth test`
2. **Check status:** `elestio service <vmID>`
3. **View logs:** `elestio cicd pipeline-logs <vmID> <pipelineID>`
4. **Restart stack:** `elestio restart-stack <vmID>`

---

## Troubleshooting

### "Authentication failed" repeatedly

```bash
# 1. Verify current config
elestio config

# 2. Re-configure with fresh token from dashboard
elestio login --email "..." --token "..."

# 3. Test
elestio auth test
```

### Service stuck in "Deploying"

1. Normal deployment takes 2-5 minutes
2. If > 10 minutes, check Elestio dashboard for errors
3. Contact support@elest.io if still stuck

### "Service not found" but it exists

- Make sure you're using `vmID`, not `serverID`
- Check the correct project: `elestio services --project X`
- vmID looks like: `12345678` (numeric)

### Pipeline deployed but the software is not running (MOST COMMON)

Almost always: the pipeline was created with `cicd create` instead of
`cicd deploy-template`, so it has no ports, no environment variables and no
install scripts.

```bash
# Confirm: a pipeline built correctly has env vars
elestio cicd pipeline-info <vmID> <pipelineID>

# Fix: delete it and redeploy through deploy-template
elestio cicd pipeline-delete <vmID> <pipelineID> --force
elestio cicd deploy-template <software> --target <vmID>
```

### Software starts then exits immediately

The template declares `preInstall`/`postInstall` scripts, and the compose route
has no repo checkout to run them from.

```bash
# See which hooks the template needs
elestio cicd deploy-template <software> --target <vmID> --dry-run
```

If a "Lifecycle:" line appears, the software needs those scripts. The git route
runs them but is currently unavailable (API returns 404 for
createRepoByTemplate). Report this to the user rather than retrying.

### "No elestio.yml found at ..."

That software has no pipeline template and cannot be deployed as a pipeline.
Deploy it as a managed service instead: `elestio deploy <template>`.

### Pipeline not working (general)

1. SSH into CI/CD target: `ssh root@<ipv4>`
2. Check logs: `cd /opt/app/<pipeline-name> && docker-compose logs`
3. Verify docker-compose.yml syntax
4. Check port mapping: `172.17.0.1:3000` (internal network)

### Cluster errors

| Message | Cause |
|---|---|
| `does not support clustering` | Not one of the clusterable templates -- run `elestio clusters templates` |
| `needs at least 3 nodes` | Quorum software (ClickHouse, Vault, OpenSearch, RabbitMQ, rke2, Nats) |
| `does not support multi-master` | `--cluster-mode multi-master` works for MySQL only |
| `cannot exceed 15 nodes` | Hard platform cap |

### "variables.trim is not a function" (500 Pipeline.CreateFailed)

The `variables` field in the pipeline payload must be a **string**, never an array or omitted. The backend runs `variables.trim()` on it, so any other type throws before your build/run/framework settings are even read (it fails even with minimal parameters).

- Correct: `"variables": ""` (no env vars) or `"variables": "KEY=value\nKEY2=value2"`.
- Wrong: `"variables": []` or leaving the field out entirely.

The CLI enforces this from 1.0.4. If you hit it, upgrade: `npm install -g elestio@latest`.

---

## ID Reference (Critical)

| Term | Find it in | Use in |
|------|------------|--------|
| `vmID` | `elestio services` -> `.vmID` | Most endpoints (actions, firewall, ssl, etc.) |
| `serverID` | `elestio services` -> `.id` | Backup endpoints, notes |
| `projectID` | `elestio projects` -> `.projectID` | Almost everything |
| `templateID` | `elestio templates` -> `.id` | `elestio deploy` |
| `pipelineID` | `elestio cicd pipelines` -> `.pipelineID` | CI/CD actions |
| `volumeID` | `elestio volumes` -> `.id` | Volume actions |

**Common mistake:** Using `serverID` where `vmID` is expected (or vice versa). They are different numbers for the same service.

---

## VM Architecture

Every Elestio service runs on a dedicated VM:

```
/opt/elestio/nginx/          <- Reverse proxy (auto-configured, don't modify)
/opt/app/                    <- Your application
    +-- docker-compose.yml   <- For catalog services
    +-- <pipeline_name>/     <- For CI/CD pipelines
```

- Reverse proxy handles HTTPS termination automatically
- SSL certificates are auto-generated via Let's Encrypt
- Port `172.17.0.1:XXXX` is the internal Docker network interface

---

## Support Tiers

| Plan | Price | Response Time |
|------|-------|---------------|
| level1 | Included | 48h (email) |
| level2 | +$50/svc/mo | 24h (priority) |
| level3 | +$200/svc/mo | 4h (dedicated engineer) |

---

## Links

- **Dashboard:** https://dash.elest.io
- **API Docs:** https://api-doc.elest.io
- **Support:** support@elest.io
- **Templates:** 400+ at https://elest.io/open-source
- **CLI:** `npm install -g elestio`
