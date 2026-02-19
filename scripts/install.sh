#!/usr/bin/env bash
set -e

REPO="https://github.com/elestio/elestio-skill"
SKILL_NAME="elestio"

# ANSI colors
BOLD=$'\033[1m'
GREY=$'\033[90m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
MAGENTA=$'\033[35m'
CYAN=$'\033[36m'
NC=$'\033[0m'

info() { printf "${BOLD}${GREY}>${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}! %s${NC}\n" "$*"; }
error() { printf "${RED}x %s${NC}\n" "$*" >&2; }
completed() { printf "${GREEN}✓${NC} %s\n" "$*"; }

print_banner() {
  printf "\n${MAGENTA}"
  cat <<'EOF'
   _____ _           _   _
  | ____| | ___  ___| |_(_) ___
  |  _| | |/ _ \/ __| __| |/ _ \
  | |___| |  __/\__ \ |_| | (_) |
  |_____|_|\___||___/\__|_|\___/

EOF
  printf "${NC}"
}

install_skill() {
  local skills_dir="$1"
  local name="$2"
  local temp_dir="$3"
  local dest="$skills_dir/$SKILL_NAME"

  mkdir -p "$skills_dir"
  rm -rf "$dest" 2>/dev/null || true
  mkdir -p "$dest"

  # Copy skill files (exclude repo-only files)
  cp "$temp_dir/SKILL.md" "$dest/"
  cp "$temp_dir/cli.js" "$dest/"
  cp "$temp_dir/package.json" "$dest/"
  cp -R "$temp_dir/lib" "$dest/"
  cp -R "$temp_dir/templates" "$dest/"

  completed "$name: skill installed ${CYAN}$dest${NC}"
}

# Targets: [dir, name]
declare -a TARGETS=(
  "$HOME/.claude/skills|Claude Code"
  "$HOME/.codex/skills|OpenAI Codex"
  "$HOME/.config/opencode/skill|OpenCode"
  "$HOME/.cursor/skills|Cursor"
)

# Detect available tools
declare -a FOUND=()
for target in "${TARGETS[@]}"; do
  dir="${target%%|*}"
  parent="${dir%/*}"
  [ -d "$parent" ] && FOUND+=("$target")
done

if [ ${#FOUND[@]} -eq 0 ]; then
  error "No supported tools found."
  printf "\nSupported:\n"
  printf "  - Claude Code (~/.claude)\n"
  printf "  - OpenAI Codex (~/.codex)\n"
  printf "  - OpenCode (~/.config/opencode)\n"
  printf "  - Cursor (~/.cursor)\n"
  exit 1
fi

print_banner

info "Downloading from ${CYAN}$REPO${NC}..."
temp_dir=$(mktemp -d)
git clone --depth 1 --quiet "$REPO" "$temp_dir"
printf "\n"

for target in "${FOUND[@]}"; do
  dir="${target%%|*}"
  name="${target##*|}"
  install_skill "$dir" "$name" "$temp_dir"
done

# Local installs (skip if CWD is $HOME)
if [ "$(pwd)" != "$HOME" ]; then
  declare -a LOCAL_TARGETS=(
    ".claude/skills|Claude Code (local)"
    ".codex/skills|OpenAI Codex (local)"
    ".config/opencode/skill|OpenCode (local)"
    ".cursor/skills|Cursor (local)"
  )
  for target in "${LOCAL_TARGETS[@]}"; do
    dir="${target%%|*}"
    name="${target##*|}"
    parent="${dir%/*}"
    [ -d "./$parent" ] && install_skill "./$dir" "$name" "$temp_dir"
  done
fi

rm -rf "$temp_dir"

printf "\n${GREEN}✓ Elestio skill installed successfully!${NC}\n"
printf "\n"
warn "Restart your tool(s) to load the skill."
printf "\n"
info "Re-run anytime to update."
printf "\n"
