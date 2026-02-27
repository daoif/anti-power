#!/bin/bash

# 使用方法：
# 1. chmod +x ./anti-power.sh
# 2. sudo ./anti-power.sh
#
# 本脚本支持 macOS 和 Linux：
# - macOS: /Applications/Antigravity.app/Contents/Resources/app
# - Linux: /usr/share/antigravity/resources/app

# 确保脚本在错误时停止
set -e

# 运行模式
MODE="install"
APP_PATH=""
CASCADE_ENABLED="true"
MANAGER_ENABLED="true"
SIDEBAR_VARIANT="legacy"
IDE_VERSION=""
VERSION_THRESHOLD="1.18.3"

# 参数解析
while [ $# -gt 0 ]; do
    case "$1" in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --app-path)
            APP_PATH="$2"
            shift 2
            ;;
        --cascade-enabled)
            CASCADE_ENABLED="$2"
            shift 2
            ;;
        --manager-enabled)
            MANAGER_ENABLED="$2"
            shift 2
            ;;
        *)
            shift 1
            ;;
    esac
done

# 检测操作系统
OS_TYPE=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$SCRIPT_DIR"

# 根据操作系统设置路径 (可被参数覆盖)
if [ -z "$APP_PATH" ]; then
    if [ "$OS_TYPE" = "Darwin" ]; then
        APP_PATH="/Applications/Antigravity.app/Contents/Resources/app"
        echo "检测到 macOS 系统"
    elif [ "$OS_TYPE" = "Linux" ]; then
        APP_PATH="/usr/share/antigravity/resources/app"
        echo "检测到 Linux 系统"
    else
        echo "错误: 不支持的操作系统 $OS_TYPE"
        exit 1
    fi
else
    echo "使用自定义安装路径"
fi

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo "错误: 权限不足！"
    exit 1
fi

echo "Antigravity 安装路径: $APP_PATH"
echo "运行模式: $MODE"
echo "开始执行 Antigravity 补丁脚本"

# 检查补丁源目录是否存在
if [ ! -d "$PATCHES_DIR" ]; then
    echo "错误: 找不到补丁目录 $PATCHES_DIR"
    exit 1
fi

TARGET_DIR_1="$APP_PATH/extensions/antigravity"
TARGET_DIR_2="$APP_PATH/out/vs/code/electron-browser/workbench"
PRODUCT_JSON="$APP_PATH/product.json"

find_python_bin() {
    if command -v python3 >/dev/null 2>&1; then
        echo "python3"
    elif command -v python >/dev/null 2>&1; then
        echo "python"
    else
        echo ""
    fi
}

normalize_version() {
    local input="$1"
    local major minor patch
    IFS='.' read -r major minor patch _ <<<"$input"

    major="${major%%[^0-9]*}"
    minor="${minor%%[^0-9]*}"
    patch="${patch%%[^0-9]*}"

    [ -z "$major" ] && major=0
    [ -z "$minor" ] && minor=0
    [ -z "$patch" ] && patch=0

    echo "${major}.${minor}.${patch}"
}

version_ge() {
    local left right
    local l_major l_minor l_patch r_major r_minor r_patch

    left=$(normalize_version "$1")
    right=$(normalize_version "$2")

    IFS='.' read -r l_major l_minor l_patch <<<"$left"
    IFS='.' read -r r_major r_minor r_patch <<<"$right"

    if [ "$l_major" -gt "$r_major" ]; then
        return 0
    fi
    if [ "$l_major" -lt "$r_major" ]; then
        return 1
    fi

    if [ "$l_minor" -gt "$r_minor" ]; then
        return 0
    fi
    if [ "$l_minor" -lt "$r_minor" ]; then
        return 1
    fi

    if [ "$l_patch" -ge "$r_patch" ]; then
        return 0
    fi
    return 1
}

read_ide_version() {
    if [ ! -f "$PRODUCT_JSON" ]; then
        echo ""
        return 0
    fi

    local py
    py=$(find_python_bin)
    if [ -z "$py" ]; then
        echo ""
        return 0
    fi

    "$py" - "$PRODUCT_JSON" <<'PY' 2>/dev/null || true
import json
import sys

path = sys.argv[1]
try:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    value = data.get('ideVersion', '')
    print(value if isinstance(value, str) else '')
except Exception:
    print('')
PY
}

detect_sidebar_variant() {
    IDE_VERSION="$(read_ide_version)"

    if [ -n "$IDE_VERSION" ] && version_ge "$IDE_VERSION" "$VERSION_THRESHOLD"; then
        SIDEBAR_VARIANT="modern"
    else
        SIDEBAR_VARIANT="legacy"
    fi

    if [ -n "$IDE_VERSION" ]; then
        echo "检测到 ideVersion: $IDE_VERSION"
    else
        echo "未读取到 ideVersion，默认使用 legacy 侧边栏补丁"
    fi
    echo "侧边栏补丁模式: $SIDEBAR_VARIANT"
}

# 1. Cascade Panel (legacy)
install_cascade_legacy() {
    echo -e "\n[1/3] 正在处理 Cascade Panel (legacy)..."
    echo "目标目录: $TARGET_DIR_1"

    if [ -d "$TARGET_DIR_1" ]; then
        if [ -f "$TARGET_DIR_1/cascade-panel.html" ]; then
            if [ ! -f "$TARGET_DIR_1/cascade-panel.html.bak" ]; then
                echo "备份 cascade-panel.html -> cascade-panel.html.bak"
                cp "$TARGET_DIR_1/cascade-panel.html" "$TARGET_DIR_1/cascade-panel.html.bak"
            else
                echo "备份已存在，跳过备份步骤 (保留原始备份)"
            fi
        fi

        echo "复制 cascade-panel.html..."
        cp "$PATCHES_DIR/cascade-panel.html" "$TARGET_DIR_1/"

        echo "复制 cascade-panel 文件夹..."
        if [ -d "$TARGET_DIR_1/cascade-panel" ]; then
            rm -rf "$TARGET_DIR_1/cascade-panel"
        fi
        cp -r "$PATCHES_DIR/cascade-panel" "$TARGET_DIR_1/"
    else
        echo "警告: 目录 $TARGET_DIR_1 不存在，跳过任务 1"
    fi
}

restore_cascade_legacy() {
    echo -e "\n[1/3] 正在恢复 Cascade Panel (legacy)..."
    echo "目标目录: $TARGET_DIR_1"
    if [ -d "$TARGET_DIR_1" ]; then
        if [ -f "$TARGET_DIR_1/cascade-panel.html.bak" ]; then
            echo "恢复 cascade-panel.html.bak -> cascade-panel.html"
            cp "$TARGET_DIR_1/cascade-panel.html.bak" "$TARGET_DIR_1/cascade-panel.html"
        fi
        if [ -d "$TARGET_DIR_1/cascade-panel" ]; then
            echo "删除 cascade-panel 文件夹..."
            rm -rf "$TARGET_DIR_1/cascade-panel"
        fi
    else
        echo "警告: 目录 $TARGET_DIR_1 不存在，跳过任务 1"
    fi
}

# 1. Sidebar Panel (modern)
install_sidebar_modern() {
    echo -e "\n[1/3] 正在处理 Sidebar Panel (modern)..."
    echo "目标目录: $TARGET_DIR_2"

    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench.html" ]; then
            if [ ! -f "$TARGET_DIR_2/workbench.html.bak" ]; then
                echo "备份 workbench.html -> workbench.html.bak"
                cp "$TARGET_DIR_2/workbench.html" "$TARGET_DIR_2/workbench.html.bak"
            else
                echo "备份已存在，跳过备份步骤 (保留原始备份)"
            fi
        fi

        echo "复制 workbench.html..."
        cp "$PATCHES_DIR/workbench.html" "$TARGET_DIR_2/"

        echo "复制 sidebar-panel 文件夹..."
        if [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
            rm -rf "$TARGET_DIR_2/sidebar-panel"
        fi
        cp -r "$PATCHES_DIR/sidebar-panel" "$TARGET_DIR_2/"
    else
        echo "警告: 目录 $TARGET_DIR_2 不存在，跳过任务 1"
    fi
}

restore_sidebar_modern() {
    echo -e "\n[1/3] 正在恢复 Sidebar Panel (modern)..."
    echo "目标目录: $TARGET_DIR_2"
    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench.html.bak" ]; then
            echo "恢复 workbench.html.bak -> workbench.html"
            cp "$TARGET_DIR_2/workbench.html.bak" "$TARGET_DIR_2/workbench.html"
        fi
        if [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
            echo "删除 sidebar-panel 文件夹..."
            rm -rf "$TARGET_DIR_2/sidebar-panel"
        fi
    else
        echo "警告: 目录 $TARGET_DIR_2 不存在，跳过任务 1"
    fi
}

# 2. Workbench Jetski Agent
install_manager() {
    echo -e "\n[2/3] 正在处理 Workbench Jetski Agent..."
    echo "目标目录: $TARGET_DIR_2"

    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench-jetski-agent.html" ]; then
            if [ ! -f "$TARGET_DIR_2/workbench-jetski-agent.html.bak" ]; then
                echo "备份 workbench-jetski-agent.html -> workbench-jetski-agent.html.bak"
                cp "$TARGET_DIR_2/workbench-jetski-agent.html" "$TARGET_DIR_2/workbench-jetski-agent.html.bak"
            else
                echo "备份已存在，跳过备份步骤 (保留原始备份)"
            fi
        fi

        echo "复制 workbench-jetski-agent.html..."
        cp "$PATCHES_DIR/workbench-jetski-agent.html" "$TARGET_DIR_2/"

        echo "复制 manager-panel 文件夹..."
        if [ -d "$TARGET_DIR_2/manager-panel" ]; then
            rm -rf "$TARGET_DIR_2/manager-panel"
        fi
        cp -r "$PATCHES_DIR/manager-panel" "$TARGET_DIR_2/"
    else
        echo "警告: 目录 $TARGET_DIR_2 不存在，跳过任务 2"
    fi
}

restore_manager() {
    echo -e "\n[2/3] 正在恢复 Workbench Jetski Agent..."
    echo "目标目录: $TARGET_DIR_2"
    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench-jetski-agent.html.bak" ]; then
            echo "恢复 workbench-jetski-agent.html.bak -> workbench-jetski-agent.html"
            cp "$TARGET_DIR_2/workbench-jetski-agent.html.bak" "$TARGET_DIR_2/workbench-jetski-agent.html"
        fi
        if [ -d "$TARGET_DIR_2/manager-panel" ]; then
            echo "删除 manager-panel 文件夹..."
            rm -rf "$TARGET_DIR_2/manager-panel"
        fi
    else
        echo "警告: 目录 $TARGET_DIR_2 不存在，跳过任务 2"
    fi
}

# 3. Update product.json
update_product_json() {
    echo -e "\n[3/3] 正在处理 product.json..."

    if [ ! -f "$PRODUCT_JSON" ]; then
        echo "错误: 找不到 product.json ($PRODUCT_JSON)"
        exit 1
    fi

    if [ ! -f "$PRODUCT_JSON.bak" ]; then
        echo "备份 product.json -> product.json.bak"
        cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
    else
        echo "备份已存在，跳过备份步骤 (保留原始备份)"
    fi

    local py
    py=$(find_python_bin)
    if [ -z "$py" ]; then
        echo "警告: 未找到 Python, 跳过 checksums 清理"
        return 0
    fi

    "$py" - "$PRODUCT_JSON" <<'PY'
import json
import sys

file_path = sys.argv[1]
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'checksums' in data:
        data['checksums'] = {}
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent='\t')
        print('成功: checksums 已清空')
    else:
        print('提示: checksums 字段不存在')

except Exception as e:
    print(f'错误: 处理 JSON 时失败: {e}')
    sys.exit(1)
PY
}

update_configs_only() {
    local updated=false

    echo -e "\n[1/2] 正在更新侧边栏配置..."
    if [ -f "$PATCHES_DIR/cascade-panel/config.json" ] && [ -d "$TARGET_DIR_1/cascade-panel" ]; then
        cp "$PATCHES_DIR/cascade-panel/config.json" "$TARGET_DIR_1/cascade-panel/"
        echo "已更新 cascade-panel/config.json"
        updated=true
    fi
    if [ -f "$PATCHES_DIR/sidebar-panel/config.json" ] && [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
        cp "$PATCHES_DIR/sidebar-panel/config.json" "$TARGET_DIR_2/sidebar-panel/"
        echo "已更新 sidebar-panel/config.json"
        updated=true
    fi
    if [ "$updated" = "false" ]; then
        echo "警告: 未找到可更新的侧边栏配置目录"
    fi

    echo -e "\n[2/2] 正在更新 Manager 配置..."
    if [ -f "$PATCHES_DIR/manager-panel/config.json" ] && [ -d "$TARGET_DIR_2/manager-panel" ]; then
        cp "$PATCHES_DIR/manager-panel/config.json" "$TARGET_DIR_2/manager-panel/"
        echo "已更新 manager-panel/config.json"
    else
        echo "警告: 未找到 manager-panel 配置或目标目录不存在"
    fi
}

detect_sidebar_variant

case "$MODE" in
    uninstall)
        restore_cascade_legacy
        restore_sidebar_modern
        restore_manager
        ;;
    update-config)
        update_configs_only
        ;;
    install|*)
        if [ "$CASCADE_ENABLED" = "true" ]; then
            if [ "$SIDEBAR_VARIANT" = "modern" ]; then
                restore_cascade_legacy
                install_sidebar_modern
            else
                restore_sidebar_modern
                install_cascade_legacy
            fi
        else
            restore_cascade_legacy
            restore_sidebar_modern
        fi

        if [ "$MANAGER_ENABLED" = "true" ]; then
            install_manager
        else
            restore_manager
        fi

        if [ "$CASCADE_ENABLED" = "true" ] || [ "$MANAGER_ENABLED" = "true" ]; then
            update_product_json
        fi
        ;;
esac

echo -e "\n完成！"
