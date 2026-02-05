#!/bin/bash

# Usage:
# 1. chmod +x ./anti-clean.en.sh
# 2. sudo ./anti-clean.en.sh
#
# This script supports macOS and Linux:
# - macOS: $HOME/Library/Application Support/Antigravity
# - Linux: ${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity

# Exit on error
set -e

OS_TYPE=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0
DATA_DIR=""
TARGET_ANTIGRAVITY=0
TARGET_GEMINI=0
TARGET_CODEX=0
TARGET_CLAUDE=0

# Parse args
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        --antigravity) TARGET_ANTIGRAVITY=1 ;;
        --gemini) TARGET_GEMINI=1 ;;
        --codex) TARGET_CODEX=1 ;;
        --claude) TARGET_CLAUDE=1 ;;
        --all)
            TARGET_ANTIGRAVITY=1
            TARGET_GEMINI=1
            TARGET_CODEX=1
            TARGET_CLAUDE=1
            ;;
        *) DATA_DIR="$arg" ;;
    esac
done

# If no target is specified, clean all (backward compatible)
if [ "$TARGET_ANTIGRAVITY" -eq 0 ] && [ "$TARGET_GEMINI" -eq 0 ] && [ "$TARGET_CODEX" -eq 0 ] && [ "$TARGET_CLAUDE" -eq 0 ]; then
    TARGET_ANTIGRAVITY=1
    TARGET_GEMINI=1
    TARGET_CODEX=1
    TARGET_CLAUDE=1
fi

backup_file() {
    local src="$1"
    local name="$(basename "$src")"
    if [ -f "$src" ]; then
        echo "Backup $name -> $name.bak.$TIMESTAMP"
        cp "$src" "$src.bak.$TIMESTAMP"
    fi
}

clean_db() {
    local db="$1"
    local name="$(basename "$db")"
    if [ ! -f "$db" ]; then
        echo "Skip: $name not found"
        return
    fi

    local before after
    before=$(sqlite3 "$db" "select count(*) from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';")

    sqlite3 "$db" "delete from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';"

    after=$(sqlite3 "$db" "select count(*) from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';")

    echo "Cleaned $name (before=$before, after=$after)"
}

clean_dir_contents() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "Cleaning directory: $dir"
        # Delete all files and subdirectories (including hidden files)
        # -mindepth 1 ensures the directory itself is not deleted
        find "$dir" -mindepth 1 -delete
    else
        echo "Skip: Directory not found: $dir"
    fi
}

clean_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Removing file: $file"
        rm -f "$file"
    else
        echo "Skip: File not found: $file"
    fi
}

check_running() {
    local name="$1"
    local pattern="$2"
    if pgrep -f "$pattern" >/dev/null 2>&1; then
        echo "Error: $name is running. Please quit it before cleaning or use --force."
        exit 1
    fi
}

if [ "$FORCE" -ne 1 ]; then
    if [ "$TARGET_ANTIGRAVITY" -eq 1 ]; then
        check_running "Antigravity" "antigravity"
    fi

    if [ "$TARGET_GEMINI" -eq 1 ]; then
        check_running "Gemini CLI" "gemini"
    fi

    if [ "$TARGET_CODEX" -eq 1 ]; then
        check_running "Codex" "codex"
    fi

    if [ "$TARGET_CLAUDE" -eq 1 ]; then
        check_running "Claude Code" "claude"
    fi
fi

if [ "$TARGET_ANTIGRAVITY" -eq 1 ]; then
    # Default data directory
    if [ -z "$DATA_DIR" ]; then
        if [ "$OS_TYPE" = "Darwin" ]; then
            DATA_DIR="$HOME/Library/Application Support/Antigravity"
            echo "Detected macOS system"
        elif [ "$OS_TYPE" = "Linux" ]; then
            DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity"
            echo "Detected Linux system"
        else
            echo "Error: Unsupported OS $OS_TYPE"
            exit 1
        fi
    fi

    # sqlite3 check
    if ! command -v sqlite3 >/dev/null 2>&1; then
        echo "Error: sqlite3 not found. Please install it first."
        exit 1
    fi

    # Directory check
    if [ ! -d "$DATA_DIR" ]; then
        echo "Error: Data directory not found: $DATA_DIR"
        exit 1
    fi

    TIMESTAMP="$(date +%m%d%H%M)"
    DB_DIR="$DATA_DIR/User/globalStorage"

    echo -e "\n[Antigravity] Backing up database..."
    backup_file "$DB_DIR/state.vscdb"
    backup_file "$DB_DIR/state.vscdb.backup"

    echo -e "\n[Antigravity] Cleaning database..."
    clean_db "$DB_DIR/state.vscdb"
    clean_db "$DB_DIR/state.vscdb.backup"

    echo -e "\n[Antigravity] Cleaning conversation cache..."
    clean_dir_contents "$HOME/.gemini/antigravity/annotations"
    clean_dir_contents "$HOME/.gemini/antigravity/brain"
    clean_dir_contents "$HOME/.gemini/antigravity/browser_recordings"
    clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/active"
    clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/history"
    clean_dir_contents "$HOME/.gemini/antigravity/conversations"
    clean_dir_contents "$HOME/.gemini/antigravity/implicit"
fi

if [ "$TARGET_GEMINI" -eq 1 ]; then
    echo -e "\n[Gemini CLI] Cleaning cache..."
    clean_dir_contents "$HOME/.gemini/tmp"
fi

if [ "$TARGET_CODEX" -eq 1 ]; then
    echo -e "\n[Codex] Cleaning archived sessions..."
    clean_dir_contents "$HOME/.codex/archived_sessions"
fi

if [ "$TARGET_CLAUDE" -eq 1 ]; then
    echo -e "\n[Claude Code] Cleaning conversation cache..."
    clean_dir_contents "$HOME/.claude/projects"
    clean_dir_contents "$HOME/.claude/file-history"
    clean_dir_contents "$HOME/.claude/session-env"
    clean_dir_contents "$HOME/.claude/shell-snapshots"
    clean_dir_contents "$HOME/.claude/todos"
    clean_dir_contents "$HOME/.claude/debug"
    clean_file "$HOME/.claude/history.jsonl"
fi

echo -e "\nDone!"
