# Elestio Skills

Agent skills for [Elestio](https://elest.io), following the [Agent Skills](https://agentskills.io) open format.

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
<summary>Local skills copy (any agent)</summary>

Copy `plugins/elestio/skills/` to your agent's skills directory:
- Claude: `~/.claude/skills/`
- Codex: `~/.codex/skills/`
- OpenCode: `~/.config/opencode/skill/`
- Cursor: `~/.cursor/skills/`
</details>

## Available Skills

| Skill | Description |
|-------|-------------|
| [elestio](plugins/elestio/skills/elestio/SKILL.md) | Deploy and manage services, projects, CI/CD, backups, domains, firewall, volumes, and billing on Elestio |

## Repository Structure

```
elestio-skill/
├── plugins/elestio/
│   └── skills/
│       └── elestio/
│           └── SKILL.md           # Skill instructions
├── scripts/
│   └── install.sh                 # Universal installer
└── README.md
```

## Creating New Skills

Create `plugins/elestio/skills/{name}/SKILL.md`:

```yaml
---
name: my-skill
description: What this skill does and when to use it
---

# Instructions

Step-by-step guidance for the agent.

## Examples

Concrete examples showing expected input/output.
```

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Elestio Dashboard](https://dash.elest.io)
- [Elestio API Docs](https://api-doc.elest.io)
- [Elestio Templates](https://elest.io/open-source) (400+)

## License

MIT
