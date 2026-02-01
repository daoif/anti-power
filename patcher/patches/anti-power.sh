#!/bin/bash

# Usage:
# 1. chmod +x ./anti-power.sh
# 2. sudo ./anti-power.sh
#
# This script supports both macOS and Linux:
# - macOS: /Applications/Antigravity.app/Contents/Resources/app
# - Linux: /usr/share/antigravity/resources/app

# 确保脚本在错误时停止
set -e

# 运行模式
MODE="install"
APP_PATH=""
CASCADE_ENABLED="true"
MANAGER_ENABLED="true"

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

# 1. Cascade Panel
install_cascade() {
    echo -e "\n[1/3] 正在处理 Cascade Panel..."
    echo "目标目录: $TARGET_DIR_1"

    if [ -d "$TARGET_DIR_1" ]; then
    # 备份
        if [ -f "$TARGET_DIR_1/cascade-panel.html" ]; then
            if [ ! -f "$TARGET_DIR_1/cascade-panel.html.bak" ]; then
                echo "备份 cascade-panel.html -> cascade-panel.html.bak"
                cp "$TARGET_DIR_1/cascade-panel.html" "$TARGET_DIR_1/cascade-panel.html.bak"
            else
                echo "备份已存在，跳过备份步骤 (保留原始备份)"
            fi
        fi

    # 复制文件
        echo "复制 cascade-panel.html..."
        cp "$PATCHES_DIR/cascade-panel.html" "$TARGET_DIR_1/"

        echo "复制 cascade-panel 文件夹..."
    # 如果目标文件夹已存在，cp -r 可能会合并或覆盖，这里直接覆盖
        if [ -d "$TARGET_DIR_1/cascade-panel" ]; then
            rm -rf "$TARGET_DIR_1/cascade-panel"
        fi
        cp -r "$PATCHES_DIR/cascade-panel" "$TARGET_DIR_1/"
    else
        echo "警告: 目录 $TARGET_DIR_1 不存在，跳过任务 1"
    fi
}

restore_cascade() {
    echo -e "\n[1/3] 正在恢复 Cascade Panel..."
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

# 2. Workbench Jetski Agent
install_manager() {
    echo -e "\n[2/3] 正在处理 Workbench Jetski Agent..."
    echo "目标目录: $TARGET_DIR_2"

    if [ -d "$TARGET_DIR_2" ]; then
    # 备份
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

    if [ -f "$PRODUCT_JSON" ]; then
        if [ ! -f "$PRODUCT_JSON.bak" ]; then
            echo "备份 product.json -> product.json.bak"
            cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
        else
            echo "备份已存在，跳过备份步骤 (保留原始备份)"
        fi

        echo "清空 checksums 字段..."
        PYTHON_BIN=""
        if command -v python3 >/dev/null 2>&1; then
            PYTHON_BIN="python3"
        elif command -v python >/dev/null 2>&1; then
            PYTHON_BIN="python"
        else
            echo "警告: 未找到 Python, 跳过 checksums 清理"
            return 0
        fi

        $PYTHON_BIN -c "
import json
import sys

file_path = '$PRODUCT_JSON'
try:
    with open(file_path, 'r') as f:
        data = json.load(f)

    if 'checksums' in data:
        data['checksums'] = {}
        with open(file_path, 'w') as f:
            json.dump(data, f, indent='\\t')
        print('成功: checksums 已清空')
    else:
        print('提示: checksums 字段不存在')

except Exception as e:
    print(f'错误: 处理 JSON 时失败: {e}')
    sys.exit(1)
"
    else
        echo "错误: 找不到 product.json ($PRODUCT_JSON)"
        exit 1
    fi
}

update_configs_only() {
    echo -e "\n[1/2] 正在更新 Cascade Panel 配置..."
    if [ -f "$PATCHES_DIR/cascade-panel/config.json" ] && [ -d "$TARGET_DIR_1/cascade-panel" ]; then
        cp "$PATCHES_DIR/cascade-panel/config.json" "$TARGET_DIR_1/cascade-panel/"
        echo "已更新 cascade-panel/config.json"
    else
        echo "警告: 未找到 cascade-panel 配置或目标目录不存在"
    fi

    echo -e "\n[2/2] 正在更新 Manager 配置..."
    if [ -f "$PATCHES_DIR/manager-panel/config.json" ] && [ -d "$TARGET_DIR_2/manager-panel" ]; then
        cp "$PATCHES_DIR/manager-panel/config.json" "$TARGET_DIR_2/manager-panel/"
        echo "已更新 manager-panel/config.json"
    else
        echo "警告: 未找到 manager-panel 配置或目标目录不存在"
    fi
}

case "$MODE" in
    uninstall)
        restore_cascade
        restore_manager
        ;;
    update-config)
        update_configs_only
        ;;
    install|*)
        if [ "$CASCADE_ENABLED" = "true" ]; then
            install_cascade
        else
            restore_cascade
        fi

        if [ "$MANAGER_ENABLED" = "true" ]; then
            install_manager
            update_product_json
        else
            restore_manager
        fi
        ;;
esac

echo -e "\n完成！"
