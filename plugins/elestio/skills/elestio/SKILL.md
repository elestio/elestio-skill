---
name: elestio
description: Deploy and manage services on the Elestio DevOps platform. Use when the user wants to deploy apps, databases, or infrastructure on Elestio, manage projects, services, CI/CD pipelines, backups, domains, firewall, volumes, or billing. Covers 400+ open-source templates across 9 cloud providers.
compatibility: Requires Node.js >= 18 and an Elestio account with API token
metadata:
  author: getateam
  version: "1.5"
---

# Elestio CLI

A zero-dependency Node.js CLI to deploy and manage services on the [Elestio](https://elest.io) DevOps platform.

Dedicated VMs (not shared Kubernetes). 400+ open-source templates. 9 cloud providers. 100+ regions. Handles deployment, security, updates, backups, monitoring.

## When to Use

- User wants to deploy a service, database, or app on Elestio
- User says "deploy on Elestio", "create a project", "manage my server"
- User needs to manage backups, domains, SSL, firewall, or CI/CD pipelines
- User asks about Elestio infrastructure, billing, or service status

## Requirements

- Node.js >= 18
- An Elestio account with API token ([create one here](https://dash.elest.io/account/security))

## Setup

```bash
# Configure credentials
node cli.js config --email "you@example.com" --token "your_api_token"

# Verify authentication
node cli.js auth test

# Set default project (avoids --project on every command)
node cli.js config --set-default-project 12345
```

Credentials are stored in `.env` (never in `config.json`). The JWT is cached locally and auto-refreshes on expiry.

## Quick Start

```bash
# Search the catalog
node cli.js templates search postgresql

# Deploy PostgreSQL (defaults: netcup/nbg/MEDIUM-2C-4G)
node cli.js services deploy postgresql --project 112 --name my-db

# Deploy from GitHub (fully automated)
node cli.js services deploy cicd --project 112 --name my-cicd
node cli.js cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app

# Get credentials
node cli.js access <vmID> credentials
```

## Command Reference

### Configuration

```bash
config --email X --token Y          # Set credentials
config --show                       # Show current config
config --set-default-project X      # Set default project
config --provider X --datacenter Y  # Set deployment defaults
auth test                           # Verify authentication
```

### Catalog (no auth required)

```bash
templates list                      # List all 400+ templates
templates list --category "Databases & Cache"
templates search <query>            # Search by name
templates categories                # List categories
sizes list                          # All provider/region/size combos
sizes list --provider hetzner       # Filter by provider
```

### Projects

```bash
projects list                       # List all projects
projects create <name>              # Create project
projects edit <id> --name X         # Edit project
projects delete <id> --force        # Delete project
projects members <id>               # List members
projects add-member <id> --email X --role admin
projects remove-member <id> --member X
```

### Services

```bash
services list                       # List all services
services list --project 123         # Filter by project
services get <vmID>                 # Full service details
services deploy <template> --project X --name Y
services deploy <template> --dry-run  # Preview without deploying
services deploy cicd --project X    # Deploy CI/CD target
services delete <vmID> --force
services move <vmID> --to-project X
services wait <vmID>                # Wait for deployment to complete
```

**Template aliases:** `cicd`, `postgres`/`pg`, `mysql`, `mariadb`, `mongo`, `elastic`, `wp`/`wordpress`, `k8s`

### Power Management

```bash
action <vmID> reboot                # Graceful reboot
action <vmID> reset                 # Hard reset
action <vmID> shutdown              # Graceful shutdown
action <vmID> poweroff              # Force power off
action <vmID> poweron               # Power on
action <vmID> restart-stack         # Restart Docker containers (fastest)
action <vmID> lock                  # Enable termination protection
action <vmID> unlock                # Disable termination protection
action <vmID> resize LARGE-4C-8G   # Upgrade/downgrade VM size
```

### Firewall

```bash
firewall <vmID> list                # List rules
firewall <vmID> enable --rules '[{"type":"INPUT","port":"22","protocol":"tcp","targets":["0.0.0.0/0"]}]'
firewall <vmID> update --rules '[...]'  # Merge with existing rules
firewall <vmID> disable
```

### SSL / Custom Domains

```bash
ssl <vmID> list                     # List domains
ssl <vmID> add myapp.example.com    # Add with auto-SSL (DNS validated)
ssl <vmID> remove myapp.example.com
```

### SSH Keys

```bash
ssh-keys <vmID> list
ssh-keys <vmID> add "name" "ssh-ed25519 AAAA..."
ssh-keys <vmID> remove "name"
```

### Auto-Updates

```bash
updates <vmID> system-enable --day 0 --hour 5 --security-only
updates <vmID> system-disable
updates <vmID> system-now           # Run OS update now
updates <vmID> app-enable --day 0 --hour 3
updates <vmID> app-disable
updates <vmID> app-now              # Run app update now
updates <vmID> change-version --tag "15"
```

### Alerts

```bash
alerts <vmID> get                   # Get current rules
alerts <vmID> enable --rules '{...}' --cycle 60
alerts <vmID> disable
```

### Backups

```bash
# Local (application-level)
backups <vmID> local-list
backups <vmID> local-take
backups <vmID> local-restore /opt/app-backups/backup.zst
backups <vmID> local-delete /opt/app-backups/backup.zst

# Remote (Elestio managed)
backups <vmID> remote-list
backups <vmID> remote-take
backups <vmID> remote-restore <snapshot-name>
backups <vmID> remote-setup --hour "03:00"
backups <vmID> remote-disable

# S3 external
backups <vmID> s3-verify --key X --secret Y --bucket Z --endpoint S
backups <vmID> s3-enable --key X --secret Y --bucket Z --endpoint S
backups <vmID> s3-disable
backups <vmID> s3-take
backups <vmID> s3-list
backups <vmID> s3-restore <backup-key>
backups <vmID> s3-delete <backup-key>
```

### Snapshots (provider-level)

```bash
snapshots <vmID> list
snapshots <vmID> take
snapshots <vmID> restore <id>       # 0 = most recent
snapshots <vmID> delete <id>
snapshots <vmID> enable-auto
snapshots <vmID> disable-auto
```

### Access & Credentials

```bash
access <vmID> credentials           # App URL + login + DB connection string
access <vmID> ssh                   # SSH web terminal URL
access <vmID> ssh-direct            # Direct SSH command
access <vmID> vscode                # VSCode web URL
access <vmID> file-explorer         # File explorer URL
```

### Volumes

```bash
volumes list --project X
volumes create <name> --size 10 --project X
volumes attached <vmID>             # List attached to service
volumes attach <vmID> --name X --size 10
volumes resize <vmID> <volumeID> <newSize>
volumes detach <vmID> <volumeID>
volumes delete <vmID> <volumeID>
volumes protect <vmID> <volumeID>
```

### CI/CD Pipelines

```bash
cicd services                       # List CI/CD targets
cicd pipelines <vmID>               # List pipelines on a target

# Automated (recommended) -- handles SSH, Dockerfile, build, start
cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app
cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app --auth-id <id>

# Modes: github, github-fullstack, gitlab, gitlab-fullstack, docker
# Options: --branch, --build-cmd, --run-cmd, --install-cmd, --build-dir, --framework, --node-version

# Manual (from JSON template)
cicd init-pipeline docker > pipeline.json
cicd create-pipeline --config pipeline.json

# Pipeline actions
cicd action <vmID> <pipelineID> restart
cicd action <vmID> <pipelineID> stop
cicd action <vmID> <pipelineID> logs
cicd action <vmID> <pipelineID> history
cicd action <vmID> <pipelineID> resync
cicd action <vmID> <pipelineID> delete --force
cicd action <vmID> <pipelineID> domains
cicd action <vmID> <pipelineID> add-domain myapp.example.com
cicd action <vmID> <pipelineID> remove-domain myapp.example.com

# Docker registries
cicd registries
cicd add-registry --name X --username Y --password Z --url W
```

### Billing

```bash
billing summary                     # Total costs across all projects
billing project <id>                # Per-service breakdown
```

## Automated Pipeline Flow

When using `cicd create-pipeline --mode github`, the CLI automatically:

1. Discovers the CI/CD target info
2. Finds the connected GitHub account
3. Locates and validates the repository
4. Creates the pipeline via the Elestio API
5. Generates and adds an SSH key
6. Waits for the repo to be cloned
7. Writes an optimized multi-stage Dockerfile (Node build + Nginx serve)
8. Generates `docker-compose.yml`
9. Builds the Docker image on the server
10. Starts the container and verifies HTTP 200

## Provider Comparison

| Feature | netcup | Hetzner | AWS | GCP | Azure | Scaleway |
|---------|--------|---------|-----|-----|-------|----------|
| Catalog deploy | yes | yes | yes | yes | yes | yes |
| CI/CD deploy | yes | yes | yes | yes | yes | yes |
| Volumes | no | yes | yes | yes | yes | yes |
| Snapshots | limited | yes | yes | yes | yes | yes |
| Power actions | limited | yes | yes | yes | yes | yes |
| Firewall | yes | yes | yes | yes | yes | yes |
| SSL/Domains | yes | yes | yes | yes | yes | yes |
| Size downgrade | yes | no | yes | no | yes | yes |

**netcup** -- best price/performance, EU-based. **Hetzner** -- best feature support (volumes, snapshots, power management).

## Default Sizes

| Plan | Specs | ~Price |
|------|-------|--------|
| SMALL-1C-2G | 1 core, 2GB RAM | $7/mo |
| MEDIUM-2C-4G | 2 cores, 4GB RAM | $14/mo |
| LARGE-4C-8G | 4 cores, 8GB RAM | $28/mo |
| XL-8C-16G | 8 cores, 16GB RAM | $55/mo |

## ID Reference

| Term | Where to find | Used in |
|------|---------------|---------|
| `vmID` | `services list` -> `.vmID` | Most endpoints |
| `serverID` | `services list` -> `.id` | Backup endpoints |
| `projectID` | `projects list` -> `.projectID` | Almost everything |
| `templateID` | `templates list` -> `.id` | `services deploy` |
| `pipelineID` | `cicd pipelines` -> `.pipelineID` | CI/CD actions |
| `volumeID` | `volumes list` -> `.id` | Volume actions |

## Architecture

```
cli.js                 Entry point + command router
lib/
  api.js               HTTP client, JWT management, .env credential loader
  auth.js              Config CRUD, auth test, default project resolution
  utils.js             Arg parser, table formatter, colors, helpers
  templates.js         Template catalog + server size validation
  projects.js          Project + member CRUD
  services.js          Deploy, list, delete, move, wait
  actions.js           Power, firewall, SSL, SSH keys, updates, alerts, resize
  access.js            Credentials, SSH, VSCode, file explorer URLs
  backups.js           Local/remote/S3 backups + provider snapshots
  volumes.js           Block storage CRUD
  cicd.js              CI/CD pipelines, auto-create, SSH deploy, templates
  billings.js          Cost tracking + estimates
templates/
  pipeline-docker.json Docker pipeline JSON template
config.json            JWT cache + defaults (no secrets)
```

Zero npm dependencies. Built entirely on Node.js built-ins (`fs`, `path`, `url`, `child_process`, `dns/promises`, native `fetch`).

## Links

- **Dashboard:** https://dash.elest.io
- **API Docs:** https://api-doc.elest.io
- **Templates:** https://elest.io/open-source (400+)
- **Support:** support@elest.io
