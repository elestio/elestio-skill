# Elestio Skill

Agent skill for [Elestio](https://elest.io), following the [Agent Skills](https://agentskills.io) open format.

Deploy and manage services on the Elestio DevOps platform. 400+ open-source templates, 9 cloud providers, 100+ regions.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/elestio/elestio-skill/main/scripts/install.sh | bash
```

You can also install via [skills.sh](https://skills.sh):

```bash
npx skills add elestio/elestio-skill
```

Supports Claude Code, OpenAI Codex, OpenCode, and Cursor. Re-run to update.

### Manual Installation

<details>
<summary>Copy to your agent's skills directory</summary>

Copy the skill files to your agent's skills directory:

```bash
# Claude Code
mkdir -p ~/.claude/skills/elestio
cp SKILL.md cli.js package.json ~/.claude/skills/elestio/
cp -R lib templates ~/.claude/skills/elestio/

# Codex
mkdir -p ~/.codex/skills/elestio
cp SKILL.md cli.js package.json ~/.codex/skills/elestio/
cp -R lib templates ~/.codex/skills/elestio/
```

</details>

## Quick Start

```bash
# Configure credentials
node cli.js config --email "you@example.com" --token "your_api_token"

# Verify authentication
node cli.js auth test

# Search the catalog
node cli.js templates search postgresql

# Deploy PostgreSQL
node cli.js services deploy postgresql --project 112 --name my-db

# Deploy from GitHub (fully automated)
node cli.js services deploy cicd --project 112 --name my-cicd
node cli.js cicd create-pipeline --mode github --repo owner/repo --target <vmID> --name my-app
```

## Repository Structure

```
elestio-skill/
├── SKILL.md              # Skill instructions (read by agents)
├── cli.js                # CLI entry point
├── lib/                  # CLI modules
│   ├── api.js            # HTTP client, JWT management
│   ├── auth.js           # Config, auth test
│   ├── utils.js          # Arg parser, formatters
│   ├── templates.js      # Template catalog, server sizes
│   ├── projects.js       # Project CRUD
│   ├── services.js       # Deploy, list, delete, move
│   ├── actions.js        # Power, firewall, SSL, SSH keys, resize
│   ├── access.js         # Credentials, SSH, VSCode URLs
│   ├── backups.js        # Local/remote/S3 backups, snapshots
│   ├── volumes.js        # Block storage CRUD
│   ├── cicd.js           # CI/CD pipelines, auto-create
│   └── billings.js       # Cost tracking
├── templates/
│   └── pipeline-docker.json
├── package.json
├── scripts/
│   └── install.sh        # Universal installer
└── README.md
```

Zero npm dependencies. Built on Node.js built-ins (`fs`, `path`, `url`, `child_process`, `dns/promises`, native `fetch`).

## Requirements

- Node.js >= 18
- An Elestio account with API token ([create one here](https://dash.elest.io/account/security))

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Elestio Dashboard](https://dash.elest.io)
- [Elestio API Docs](https://api-doc.elest.io)
- [Elestio Templates](https://elest.io/open-source) (400+)

## License

MIT
