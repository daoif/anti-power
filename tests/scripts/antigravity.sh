#!/bin/bash

# Run manually
# 1. chmod +x ./antigravity.sh
# 2. sudo ./antigravity.sh
#
# Default paths
# - macOS: $HOME/Library/Application Support/Antigravity
# - Linux: ${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity

# Clear Antigravity conversation titles on macOS and Linux (@mikessslxxx)
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

echo -e "\n[1/2] 备份数据库..."
backup_file "$DB_DIR/state.vscdb"
backup_file "$DB_DIR/state.vscdb.backup"

echo -e "\n[2/2] 清理对话标题记录..."
clean_db "$DB_DIR/state.vscdb"
clean_db "$DB_DIR/state.vscdb.backup"

echo -e "\n完成！"
