# Elestio Skill

Agent skill for [Elestio](https://elest.io), following the [Agent Skills](https://agentskills.io) open format.

Deploy and manage services on the Elestio DevOps platform. 400+ open-source templates, 9 cloud providers, 100+ regions.

Uses the **official Elestio CLI** (`npm install -g elestio`).

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/elestio/elestio-skill/main/scripts/install.sh | bash
```

You can also install via [skills.sh](https://skills.sh):

```bash
npx skills add elestio/elestio-skill
```

Supports Claude Code, OpenAI Codex, OpenCode, and Cursor. Re-run to update.

The installer will:
1. Install the official Elestio CLI globally (`npm install -g elestio`)
2. Copy `SKILL.md` to your agent's skills directory

### Manual Installation

<details>
<summary>Copy to your agent's skills directory</summary>

```bash
# 1. Install the official Elestio CLI
npm install -g elestio

# 2. Copy the skill file
# Claude Code
mkdir -p ~/.claude/skills/elestio
cp SKILL.md ~/.claude/skills/elestio/

# Codex
mkdir -p ~/.codex/skills/elestio
cp SKILL.md ~/.codex/skills/elestio/
```

</details>

## Quick Start

```bash
# Configure credentials
elestio login --email "you@example.com" --token "your_api_token"

# Verify authentication
elestio auth test

# Search the catalog
elestio templates search postgresql

# Deploy PostgreSQL
elestio deploy postgresql --project 112 --name my-db

# Deploy from GitHub (fully automated)
elestio deploy cicd --project 112 --name my-cicd
elestio cicd create --auto --target <vmID> --name my-app --repo owner/repo --mode github
```

## Repository Structure

```
elestio-skill/
├── SKILL.md              # Skill instructions (read by agents)
├── scripts/
│   └── install.sh        # Installer (CLI + skill file)
├── README.md
└── .gitignore
```

## Requirements

- Node.js >= 18
- An Elestio account with API token ([create one here](https://dash.elest.io/account/security))

## References

- [Elestio CLI (npm)](https://www.npmjs.com/package/elestio)
- [Agent Skills Specification](https://agentskills.io/specification)
- [Elestio Dashboard](https://dash.elest.io)
- [Elestio API Docs](https://api-doc.elest.io)
- [Elestio Templates](https://elest.io/open-source) (400+)

## License

MIT
