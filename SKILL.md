---
name: elestio
description: Deploy and manage services on the Elestio DevOps platform. Use when the user wants to deploy apps, databases, or infrastructure on Elestio, manage projects, services, CI/CD pipelines, backups, domains, firewall, volumes, or billing. Covers 400+ open-source templates across 9 cloud providers.
compatibility: Requires Node.js >= 18 and an Elestio account with API token
metadata:
  author: getateam
  version: "1.5"
---

# Elestio Skill

**Version:** 1.5
**Purpose:** Deploy and manage services on Elestio DevOps platform
**Status:** Ready to use
**Last Updated:** 2026-02-17

Elestio is a fully managed DevOps platform. Dedicated VMs (not shared Kubernetes). 400+ open-source templates, 9 cloud providers, 100+ regions. Handles deployment, security, updates, backups, monitoring, support.

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
- "Deploy PostgreSQL" -> `services deploy postgresql`
- "I need a Redis cache" -> `services deploy redis`
- "Set up n8n for automation" -> `services deploy n8n`
- "Deploy my app from GitHub" -> CI/CD workflow (Phase 4)
- "What services are running?" -> `services list`
- "How much is this costing?" -> `billing summary`

## When NOT to Use This Skill

- **Initial account setup** - Signup, payment, approval must be done manually by human
- **Interactive SSH sessions** - Use direct SSH instead
- **Complex Docker Compose editing** - SSH into the server directly

---

## Decision Tree: What Should I Deploy?

```
Does user want to deploy their own custom code?
+-- YES (from GitHub/GitLab) -> Automated CI/CD deployment
|   1. services deploy cicd --project <id>
|   2. cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app
|   (CLI auto-handles: SSH key, repo discovery, Dockerfile fix, build, start)
|
+-- YES (custom Docker) -> Manual CI/CD
|   1. services deploy cicd --project <id>
|   2. ssh-keys <vmID> add "name" "key"
|   3. cicd create-pipeline --config pipeline.json
|   4. SSH in and configure
|
+-- NO -> Check if software is in catalog
    |
    +-- FOUND -> Use Phase 3 (Catalog Deploy)
    |   services deploy <template> --project <id>
    |
    +-- NOT FOUND -> Use Phase 4 (CI/CD Target)

To check catalog:
  templates search <software-name>
```

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
node cli.js config --email "user@domain.com" --token "xxx_..."
node cli.js auth test
```

### Verify Setup

```bash
# Should show: [SUCCESS] Authenticated as user@domain.com
node cli.js auth test

# List projects (should show at least one)
node cli.js projects list
```

---

## Quick Start Examples

### Deploy PostgreSQL (2 commands)

```bash
# 1. Find template ID
node cli.js templates search postgresql
# -> ID: 11, PostgreSQL

# 2. Deploy (uses defaults: netcup/nbg/MEDIUM-2C-4G)
node cli.js services deploy postgresql --project 112 --name my-db
# -> Waits for deployment, shows credentials when ready
```

### Deploy Redis Cache

```bash
node cli.js services deploy redis --project 112
```

### Deploy WordPress

```bash
node cli.js services deploy wordpress --project 112
```

### Deploy Custom App from GitHub (Automated -- Recommended)

```bash
# 1. Deploy CI/CD target
node cli.js services deploy cicd --project 112 --name my-cicd

# 2. Auto-create pipeline (handles everything: SSH, Dockerfile, build, start)
node cli.js cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app --auth-id <authID>
# -> Site is live at https://<name>-u<userID>.vm.elestio.app/
```

### Deploy Custom App (Manual -- Docker mode)

```bash
# 1. Deploy CI/CD target
node cli.js services deploy cicd --project 112 --name my-cicd

# 2. Add SSH key for agent access
node cli.js ssh-keys <vmID> add "agent-key" "ssh-ed25519 AAAA..."

# 3. Generate pipeline config
node cli.js cicd init-pipeline docker > pipeline.json
# Edit pipeline.json with correct CI/CD target info...

# 4. Create pipeline
node cli.js cicd create-pipeline --config pipeline.json

# 5. SSH and configure
ssh root@<ipv4>
cd /opt/app/<pipeline-name>
# Edit docker-compose.yml, add code, docker-compose up -d
```

---

## Command Reference

### Configuration

```bash
config --email X --token Y      # Set credentials
config --show                   # Show current config
config --set-default-project X  # Set default project
auth test                       # Verify authentication
```

### Catalog (No Auth Required)

```bash
templates list                  # List all 400+ templates
templates list --category "Databases & Cache"
templates search <query>        # Search by name
templates categories            # List categories
sizes list                      # All provider/region/size combos
sizes list --provider netcup    # Filter by provider
```

### Projects

```bash
projects list                   # List all projects
projects create <name>          # Create project
projects delete <id> --force    # Delete project
projects members <id>           # List members
projects add-member <id> --email X --role admin
```

### Services

```bash
services list                   # List all services
services list --project 123     # Filter by project
services get <vmID>             # Service details
services deploy <template> --project X --name Y
services deploy cicd --project X  # Deploy CI/CD target
services delete <vmID> --force
services move <id> --to-project X
services wait <vmID>            # Wait for deployment
```

### Power Management

```bash
action <vmID> reboot            # Graceful reboot
action <vmID> reset             # Hard reset
action <vmID> shutdown          # Graceful shutdown
action <vmID> poweroff          # Force power off
action <vmID> poweron           # Power on
action <vmID> restart-stack     # Restart Docker only (fastest)
action <vmID> lock              # Enable termination protection
action <vmID> unlock            # Disable termination protection
action <vmID> resize LARGE-4C-8G  # Upgrade/downgrade VM size
```

### Firewall

```bash
firewall <vmID> list            # List rules
firewall <vmID> enable --rules '[{"type":"INPUT","port":"22","protocol":"tcp","targets":["0.0.0.0/0"]}]'
firewall <vmID> disable
```

### SSL / Custom Domains

```bash
ssl <vmID> list                 # List domains
ssl <vmID> add myapp.example.com  # Add with auto-SSL
ssl <vmID> remove myapp.example.com
```

### SSH Keys

```bash
ssh-keys <vmID> list            # List keys
ssh-keys <vmID> add "name" "ssh-ed25519 AAAA..."
ssh-keys <vmID> remove "name"
```

**Note:** When adding SSH keys, provide only the key type and key data (e.g., `ssh-ed25519 AAAA...`). Do NOT include the comment/email at the end of the key.

### Auto-Updates

```bash
updates <vmID> system-enable --day 0 --hour 5 --security-only
updates <vmID> system-disable
updates <vmID> system-now       # Run OS update now
updates <vmID> app-enable --day 0 --hour 3
updates <vmID> app-disable
updates <vmID> app-now          # Run app update now
updates <vmID> change-version --tag "15"  # e.g., PostgreSQL 15
```

### Alerts

```bash
alerts <vmID> get               # Get current rules
alerts <vmID> enable --rules '{...}' --cycle 60  # cycle in seconds (default: 60)
alerts <vmID> disable
```

### Backups

```bash
# Local backups (application-level)
backups <vmID> local-list
backups <vmID> local-take
backups <vmID> local-restore /opt/app-backups/backup.zst
backups <vmID> local-delete /opt/app-backups/backup.zst

# Remote backups (Elestio managed)
backups <vmID> remote-list
backups <vmID> remote-take
backups <vmID> remote-restore <snapshot-name>
backups <vmID> remote-setup --hour "03:00"
backups <vmID> remote-disable

# S3 external backups
backups <vmID> s3-verify --key X --secret Y --bucket Z --endpoint S
backups <vmID> s3-enable --key X --secret Y --bucket Z --endpoint S
backups <vmID> s3-disable
backups <vmID> s3-take
backups <vmID> s3-list
backups <vmID> s3-restore <backup-key>
backups <vmID> s3-delete <backup-key>
```

### Snapshots (Provider-level)

```bash
snapshots <vmID> list           # List all snapshots
snapshots <vmID> take           # Create manual snapshot
snapshots <vmID> restore <id>   # Restore snapshot (0 = most recent)
snapshots <vmID> delete <id>    # Delete snapshot
snapshots <vmID> enable-auto    # Enable automatic snapshots
snapshots <vmID> disable-auto   # Disable automatic snapshots
```

### Access & Credentials

```bash
access <vmID> credentials       # App URL + login
access <vmID> ssh               # SSH terminal URL
access <vmID> vscode            # VSCode web URL
access <vmID> file-explorer     # File explorer URL
access <vmID> logs              # Log viewer URL
```

### Volumes

**Note:** Volume support depends on the cloud provider. Hetzner supports full volume operations. Some providers like netcup have limited or no volume support.

```bash
volumes list --project X        # List all volumes in project
volumes create <name> --size 10 --project X
volumes attached <vmID>         # List attached to service
volumes attach <vmID> --name X --size 10
volumes resize <vmID> <volumeID> <newSize>   # Resize volume (e.g., 20 for 20GB)
volumes detach <vmID> <volumeID>             # Detach from service
volumes delete <vmID> <volumeID>             # Delete volume
volumes protect <vmID> <volumeID>            # Enable deletion protection
```

### CI/CD Pipelines

```bash
cicd services                   # List CI/CD targets
cicd pipelines <vmID>           # List pipelines

# Automated pipeline creation (recommended for GitHub/GitLab repos)
cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app
cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app --auth-id <id>
# Modes: github, github-fullstack, gitlab, gitlab-fullstack, docker
# Optional: --branch, --build-cmd, --run-cmd, --install-cmd, --build-dir, --framework, --node-version

# Manual pipeline creation (from JSON template)
cicd init-pipeline docker       # Docker Compose (custom, no Git)
cicd init-pipeline github       # GitHub Static SPA (Vite/React)
cicd init-pipeline github-fullstack  # GitHub Full Stack (Node.js)
cicd init-pipeline gitlab       # GitLab Static SPA (Vite/React)
cicd init-pipeline gitlab-fullstack  # GitLab Full Stack (Node.js)
cicd create-pipeline --config X.json

# Pipeline actions
cicd action <vmID> <pipelineID> restart
cicd action <vmID> <pipelineID> stop
cicd action <vmID> <pipelineID> logs
cicd action <vmID> <pipelineID> delete --force
```

**Auto-create pipeline flow:** The CLI automatically discovers the Git account, finds the repo, creates the pipeline via API, adds an SSH key, writes a correct multi-stage Dockerfile (Node build + Nginx serve), builds the Docker image, starts the container, and verifies HTTP 200. The entire process takes ~2 minutes after CI/CD target is deployed.

### Billing

```bash
billing summary                 # Total costs
billing project <id>            # Per-service breakdown
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

Use `sizes list --provider <provider>` to get exact available regions if needed.

**3. Service Plan (Size)** -- Ask using `AskUserQuestion`, propose available sizes with pricing:
- SMALL-1C-2G -- 1 core, 2GB RAM (~$7/mo)
- MEDIUM-2C-4G -- 2 cores, 4GB RAM (~$14/mo)
- LARGE-4C-8G -- 4 cores, 8GB RAM (~$28/mo)
- XL-8C-16G -- 8 cores, 16GB RAM (~$55/mo)

Use `sizes list --provider <provider>` to get exact sizes/pricing for the chosen provider.

**4. Name of Service** -- Do NOT use `AskUserQuestion`. Simply ask the user in plain text to provide a name, suggesting a default based on the service type (e.g., "prod-postgres", "staging-redis"). Wait for user text input.

**5. Admin Email** -- Ask using `AskUserQuestion`, propose the employer's email as default. Let the user confirm or change.

### Example Flow:

```
User: "Deploy PostgreSQL"
Agent: [AskUserQuestion] Which cloud provider? (Netcup recommended, Hetzner, AWS, Azure)
User: "Netcup"
Agent: [AskUserQuestion] Which region? (nbg Europe-Germany, mns North America-US)
User: "nbg"
Agent: [AskUserQuestion] Which service plan? (SMALL ~$7/mo, MEDIUM ~$14/mo, LARGE ~$28/mo, XL ~$55/mo)
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
2. **vmID != serverID** -- Most endpoints use `vmID`, backup/notes use `serverID` (both from `services list`)
3. **Check deployment status** -- After deploy, wait for `deploymentStatus = "Deployed"` before accessing
4. **Never delete without confirmation** -- Always require `--force` flag
5. **Use catalog when possible** -- Phase 3 (catalog) is simpler than Phase 4 (CI/CD)
6. **Validate combos** -- Provider + datacenter + serverType must match `sizes list`
7. **Account must be approved** -- New accounts need credit card + approval before deploying
8. **ALWAYS follow the Interactive Deployment Procedure above** -- Never skip parameter questions
9. **Set default project** -- Use `config --set-default-project <id>` to avoid passing `--project` every time
10. **Service belongs to project** -- When using `services get`, ensure the vmID belongs to the current default project or specify `--project`

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
| "Not configured" | Missing credentials | `config --email X --token Y` |
| "Authentication failed" | Wrong credentials or expired token | Re-create API token in dashboard |
| "Account not approved" | New account without approval | Wait for approval or contact support@elest.io |
| "Template not found" | Wrong name/ID | Use `templates search <name>` |
| "Invalid serverType" | Provider/region/size combo doesn't exist | Check `sizes list --provider X` |
| "Service not found" | Wrong vmID or project | Check `services list --project X` |
| "Deployment timeout" | Taking too long | Check dashboard, contact support if > 10 min |
| "Project not found" | Wrong projectId | Check `projects list` |

---

## Composability: What to Do After...

### After Deploying a Service

1. **Get credentials:** `access <vmID> credentials`
2. **Verify running:** Open the URL, confirm service works
3. **Enable backups:** `backups <vmID> remote-setup --hour "03:00"`
4. **Add custom domain:** `ssl <vmID> add myapp.example.com`
5. **Configure firewall:** `firewall <vmID> enable --rules [...]`
6. **Enable auto-updates:** `updates <vmID> system-enable --security-only`

### After Creating CI/CD Target

**Automated (recommended):**
1. **Auto-create pipeline:** `cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app --auth-id <id>`
2. Site is live -- CLI handles SSH, Dockerfile, build, start automatically

**Manual:**
1. **Add SSH key:** `ssh-keys <vmID> add "name" "key"`
2. **Create pipeline:** `cicd create-pipeline --config pipeline.json`
3. **SSH and configure:** `ssh root@<ipv4>`
4. **Add domain:** `cicd action <vmID> <pipelineID> add-domain myapp.example.com`

### After an Error

1. **Re-authenticate:** `auth test`
2. **Check status:** `services get <vmID>`
3. **View logs:** `access <vmID> logs`
4. **Restart stack:** `action <vmID> restart-stack`

---

## Troubleshooting

### "Authentication failed" repeatedly

```bash
# 1. Verify current config
node cli.js config --show

# 2. Re-configure with fresh token from dashboard
node cli.js config --email "..." --token "..."

# 3. Test
node cli.js auth test
```

### Service stuck in "Deploying"

1. Normal deployment takes 2-5 minutes
2. If > 10 minutes, check Elestio dashboard for errors
3. Contact support@elest.io if still stuck

### "Service not found" but it exists

- Make sure you're using `vmID`, not `serverID`
- Check the correct project: `services list --project X`
- vmID looks like: `12345678` (numeric)

### Pipeline not working

1. SSH into CI/CD target: `ssh root@<ipv4>`
2. Check logs: `cd /opt/app/<pipeline-name> && docker-compose logs`
3. Verify docker-compose.yml syntax
4. Check port mapping: `172.17.0.1:3000` (internal network)

---

## ID Reference (Critical)

| Term | Find it in | Use in |
|------|------------|--------|
| `vmID` | `services list` -> `.vmID` | Most endpoints (actions, firewall, ssl, etc.) |
| `serverID` | `services list` -> `.id` | Backup endpoints, notes |
| `projectID` | `projects list` -> `.projectID` | Almost everything |
| `templateID` | `templates list` -> `.id` | `services deploy` |
| `pipelineID` | `cicd pipelines` -> `.pipelineID` | CI/CD actions |
| `volumeID` | `volumes list` -> `.id` | Volume actions |

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
