#!/bin/bash

# 使用方法：
# 1. chmod +x ./anti-clean.sh
# 2. sudo ./anti-clean.sh
#
# 本脚本支持 macOS 和 Linux：
# - macOS: $HOME/Library/Application Support/Antigravity
# - Linux: ${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity

# 确保脚本在错误时停止
set -e

OS_TYPE=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0
DATA_DIR=""
TARGET_ANTIGRAVITY=0
TARGET_GEMINI=0
TARGET_CODEX=0
TARGET_CLAUDE=0
TARGET_OPENCODE=0
TARGET_OPENCLAW=0

# 参数解析
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        --antigravity) TARGET_ANTIGRAVITY=1 ;;
        --gemini) TARGET_GEMINI=1 ;;
        --codex) TARGET_CODEX=1 ;;
        --claude) TARGET_CLAUDE=1 ;;
        --opencode) TARGET_OPENCODE=1 ;;
        --openclaw) TARGET_OPENCLAW=1 ;;
        --all)
            TARGET_ANTIGRAVITY=1
            TARGET_GEMINI=1
            TARGET_CODEX=1
            TARGET_CLAUDE=1
            TARGET_OPENCODE=1
            TARGET_OPENCLAW=1
            ;;
        *) DATA_DIR="$arg" ;;
    esac
done

# 未指定目标时，默认全量清理（兼容旧用法）
if [ "$TARGET_ANTIGRAVITY" -eq 0 ] && [ "$TARGET_GEMINI" -eq 0 ] && [ "$TARGET_CODEX" -eq 0 ] && [ "$TARGET_CLAUDE" -eq 0 ] && [ "$TARGET_OPENCODE" -eq 0 ] && [ "$TARGET_OPENCLAW" -eq 0 ]; then
    TARGET_ANTIGRAVITY=1
    TARGET_GEMINI=1
    TARGET_CODEX=1
    TARGET_CLAUDE=1
    TARGET_OPENCODE=1
    TARGET_OPENCLAW=1
fi

backup_file() {
    local src="$1"
    local name="$(basename "$src")"
    if [ -f "$src" ]; then
        echo "备份 $name -> $name.bak.$TIMESTAMP"
        cp "$src" "$src.bak.$TIMESTAMP"
    fi
}

clean_db() {
    local db="$1"
    local name="$(basename "$db")"
    if [ ! -f "$db" ]; then
        echo "跳过: 未找到 $name"
        return
    fi

    local before after
    before=$(sqlite3 "$db" "select count(*) from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';")

    sqlite3 "$db" "delete from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';"
    
    after=$(sqlite3 "$db" "select count(*) from ItemTable where key='antigravityUnifiedStateSync.trajectorySummaries';")

    echo "清理 $name (before=$before, after=$after)"
}

clean_opencode_db() {
    local db="$1"
    local name="$(basename "$db")"
    if [ ! -f "$db" ]; then
        echo "跳过: 未找到 $name"
        return
    fi

    if ! command -v sqlite3 >/dev/null 2>&1; then
        echo "错误: 未找到 sqlite3，请先安装后再运行"
        exit 1
    fi

    local before after
    before=$(sqlite3 "$db" "select count(*) from session;")

    sqlite3 "$db" "
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
DELETE FROM session;
DELETE FROM project;
COMMIT;
VACUUM;
"

    after=$(sqlite3 "$db" "select count(*) from session;")

    echo "清理 $name (before=$before, after=$after)"
}

clean_dir_contents() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "清理目录内容: $dir"
        # 使用 find 删除目录下的所有文件和子目录 (包括隐藏文件)
        # -mindepth 1 确保不删除目录本身
        find "$dir" -mindepth 1 -delete
    else
        echo "跳过: 目录不存在 $dir"
    fi
}

clean_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "删除文件: $file"
        rm -f "$file"
    else
        echo "跳过: 文件不存在 $file"
    fi
}

check_running() {
    local name="$1"
    local pattern="$2"
    if pgrep -f "$pattern" >/dev/null 2>&1; then
        echo "错误: 检测到 ${name} 正在运行，请先退出后再执行 (或使用 --force)"
        exit 1
    fi
}

clean_openclaw_session_dirs() {
    local agents_dir="$HOME/.openclaw/agents"
    local found=0

    for sessions_dir in "$agents_dir"/*/sessions; do
        if [ -d "$sessions_dir" ]; then
            found=1
            clean_dir_contents "$sessions_dir"
        fi
    done

    if [ "$found" -eq 0 ]; then
        echo "跳过: 目录不存在 $agents_dir/*/sessions"
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

    if [ "$TARGET_OPENCODE" -eq 1 ]; then
        check_running "OpenCode" "opencode"
    fi

    if [ "$TARGET_OPENCLAW" -eq 1 ]; then
        check_running "OpenClaw" "openclaw"
    fi
fi

if [ "$TARGET_ANTIGRAVITY" -eq 1 ]; then
    # 默认数据目录
    if [ -z "$DATA_DIR" ]; then
        if [ "$OS_TYPE" = "Darwin" ]; then
            DATA_DIR="$HOME/Library/Application Support/Antigravity"
            echo "检测到 macOS 系统"
        elif [ "$OS_TYPE" = "Linux" ]; then
            DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity"
            echo "检测到 Linux 系统"
        else
            echo "错误: 不支持的操作系统 $OS_TYPE"
            exit 1
        fi
    fi

    # sqlite3 检测
    if ! command -v sqlite3 >/dev/null 2>&1; then
        echo "错误: 未找到 sqlite3，请先安装后再运行"
        exit 1
    fi

    # 检查目录
    if [ ! -d "$DATA_DIR" ]; then
        echo "错误: 找不到数据目录 $DATA_DIR"
        exit 1
    fi

    TIMESTAMP="$(date +%m%d%H%M)"
    DB_DIR="$DATA_DIR/User/globalStorage"

    echo -e "\n[Antigravity] 备份数据库..."
    backup_file "$DB_DIR/state.vscdb"
    backup_file "$DB_DIR/state.vscdb.backup"

    echo -e "\n[Antigravity] 清理数据库..."
    clean_db "$DB_DIR/state.vscdb"
    clean_db "$DB_DIR/state.vscdb.backup"

    echo -e "\n[Antigravity] 清理对话缓存..."
    clean_dir_contents "$HOME/.gemini/antigravity/annotations"
    clean_dir_contents "$HOME/.gemini/antigravity/brain"
    clean_dir_contents "$HOME/.gemini/antigravity/browser_recordings"
    clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/active"
    clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/history"
    clean_dir_contents "$HOME/.gemini/antigravity/conversations"
    clean_dir_contents "$HOME/.gemini/antigravity/implicit"
fi

if [ "$TARGET_GEMINI" -eq 1 ]; then
    echo -e "\n[Gemini CLI] 清理对话缓存..."
    clean_dir_contents "$HOME/.gemini/tmp"
fi

if [ "$TARGET_CODEX" -eq 1 ]; then
    echo -e "\n[Codex] 清理归档对话..."
    clean_dir_contents "$HOME/.codex/archived_sessions"
fi

if [ "$TARGET_CLAUDE" -eq 1 ]; then
    echo -e "\n[Claude Code] 清理对话缓存..."
    clean_dir_contents "$HOME/.claude/projects"
    clean_dir_contents "$HOME/.claude/file-history"
    clean_dir_contents "$HOME/.claude/session-env"
    clean_dir_contents "$HOME/.claude/shell-snapshots"
    clean_dir_contents "$HOME/.claude/todos"
    clean_dir_contents "$HOME/.claude/debug"
    clean_file "$HOME/.claude/history.jsonl"
fi

if [ "$TARGET_OPENCODE" -eq 1 ]; then
    echo -e "\n[OpenCode] 清理对话缓存..."
    OPENCODE_DATA_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/opencode"
    OPENCODE_STORAGE="$OPENCODE_DATA_ROOT/storage"
    for relative in session message part todo session_share session_diff agent-usage-reminder directory-readme; do
        clean_dir_contents "$OPENCODE_STORAGE/$relative"
    done
    clean_opencode_db "$OPENCODE_DATA_ROOT/opencode.db"
fi

if [ "$TARGET_OPENCLAW" -eq 1 ]; then
    echo -e "\n[OpenClaw] 清理对话缓存..."
    clean_openclaw_session_dirs
fi

echo -e "\n完成！"
