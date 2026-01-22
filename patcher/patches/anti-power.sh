#!/bin/bash

# 1. chmod +x ./anti-power.sh
# 2. sudo ./anti-power.sh

# 确保脚本在错误时停止
set -e

# 定义路径
APP_PATH="/Applications/Antigravity.app/Contents/Resources/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$SCRIPT_DIR" # "$SCRIPT_DIR/patcher/patches"

echo "开始执行 Antigravity 补丁脚本"

# 检查补丁源目录是否存在
if [ ! -d "$PATCHES_DIR" ]; then
    echo "错误: 找不到补丁目录 $PATCHES_DIR"
    exit 1
fi

# 1. Cascade Panel
TARGET_DIR_1="$APP_PATH/extensions/antigravity"
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

# 2. Workbench Jetski Agent
TARGET_DIR_2="$APP_PATH/out/vs/code/electron-browser/workbench"
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

    # 复制文件
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

# 3. Update product.json
PRODUCT_JSON="$APP_PATH/product.json"
echo -e "\n[3/3] 正在处理 product.json..."

if [ -f "$PRODUCT_JSON" ]; then
    if [ ! -f "$PRODUCT_JSON.bak" ]; then
        echo "备份 product.json -> product.json.bak"
        cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
    else
        echo "备份已存在，跳过备份步骤 (保留原始备份)"
    fi
    
    echo "清空 checksums 字段..."
    # 使用 Python 处理 JSON 以确保安全且无需额外 jq 依赖
    python3 -c "
import json
import sys

file_path = '$PRODUCT_JSON'
try:
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    if 'checksums' in data:
        data['checksums'] = {}
        with open(file_path, 'w') as f:
            json.dump(data, f, indent='\t')
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

echo -e "\n完成！"
