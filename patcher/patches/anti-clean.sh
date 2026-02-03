#!/bin/bash

# Run manually
# 1. chmod +x ./anti-clean.sh
# 2. sudo ./anti-clean.sh
#
# Default paths
# - macOS: $HOME/Library/Application Support/Antigravity
# - Linux: ${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity

set -e

OS_TYPE=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0
DATA_DIR=""

for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE=1
    else
        DATA_DIR="$arg"
    fi
done

# Use the platform default when no data path is supplied
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

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "错误: 未找到 sqlite3，请先安装后再运行"
    exit 1
fi

if [ "$FORCE" -ne 1 ]; then
    if pgrep -f "Antigravity" >/dev/null 2>&1; then
        echo "错误: 检测到 Antigravity 正在运行，请先退出后再执行 (或使用 --force)"
        exit 1
    fi
fi

if [ ! -d "$DATA_DIR" ]; then
    echo "错误: 找不到数据目录 $DATA_DIR"
    exit 1
fi

TIMESTAMP="$(date +%m%d%H%M)"
DB_DIR="$DATA_DIR/User/globalStorage"

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

echo -e "\n[1/3] 备份数据库..."
backup_file "$DB_DIR/state.vscdb"
backup_file "$DB_DIR/state.vscdb.backup"

echo -e "\n[2/3] 清理对话标题记录..."
clean_db "$DB_DIR/state.vscdb"
clean_db "$DB_DIR/state.vscdb.backup"

echo -e "\n[3/3] 清理其他缓存和临时文件..."

clean_dir_contents() {
    local dir="$1"
    if [ -d "$dir" ]; then
        echo "清理目录内容: $dir"
        # Keep the parent directory while clearing its contents
        find "$dir" -mindepth 1 -delete
    else
        echo "跳过: 目录不存在 $dir"
    fi
}

# Clear Gemini CLI cache directories under the user's home directory
clean_dir_contents "$HOME/.gemini/tmp"
clean_dir_contents "$HOME/.gemini/antigravity/annotations"
clean_dir_contents "$HOME/.gemini/antigravity/brain"
clean_dir_contents "$HOME/.gemini/antigravity/browser_recordings"
clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/active"
clean_dir_contents "$HOME/.gemini/antigravity/code_tracker/history"
clean_dir_contents "$HOME/.gemini/antigravity/conversations"
clean_dir_contents "$HOME/.gemini/antigravity/implicit"

echo -e "\n完成！"
