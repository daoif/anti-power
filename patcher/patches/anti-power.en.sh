#!/bin/bash

# Usage:
# 1. chmod +x ./anti-power.en.sh
# 2. sudo ./anti-power.en.sh
#
# This script supports macOS and Linux:
# - macOS: /Applications/Antigravity.app/Contents/Resources/app
# - Linux: /usr/share/antigravity/resources/app

# Exit on error
set -e

# Run mode
MODE="install"
APP_PATH=""
CASCADE_ENABLED="true"
MANAGER_ENABLED="true"
SIDEBAR_VARIANT="legacy"
IDE_VERSION=""
VERSION_THRESHOLD="1.18.3"

# Parse args
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

# Detect OS
OS_TYPE=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="$SCRIPT_DIR"

# Set default path by OS (can be overridden by args)
if [ -z "$APP_PATH" ]; then
    if [ "$OS_TYPE" = "Darwin" ]; then
        APP_PATH="/Applications/Antigravity.app/Contents/Resources/app"
        echo "Detected macOS system"
    elif [ "$OS_TYPE" = "Linux" ]; then
        APP_PATH="/usr/share/antigravity/resources/app"
        echo "Detected Linux system"
    else
        echo "Error: Unsupported OS $OS_TYPE"
        exit 1
    fi
else
    echo "Using custom install path"
fi

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Error: Insufficient permissions!"
    exit 1
fi

echo "Antigravity install path: $APP_PATH"
echo "Mode: $MODE"
echo "Starting Antigravity patch script"

# Check patches dir
if [ ! -d "$PATCHES_DIR" ]; then
    echo "Error: Patch directory not found: $PATCHES_DIR"
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
        echo "Detected ideVersion: $IDE_VERSION"
    else
        echo "ideVersion not found, defaulting to legacy sidebar patch"
    fi
    echo "Sidebar patch variant: $SIDEBAR_VARIANT"
}

# 1. Cascade Panel (legacy)
install_cascade_legacy() {
    echo -e "\n[1/3] Processing Cascade Panel (legacy)..."
    echo "Target dir: $TARGET_DIR_1"

    if [ -d "$TARGET_DIR_1" ]; then
        if [ -f "$TARGET_DIR_1/cascade-panel.html" ]; then
            if [ ! -f "$TARGET_DIR_1/cascade-panel.html.bak" ]; then
                echo "Backing up cascade-panel.html -> cascade-panel.html.bak"
                cp "$TARGET_DIR_1/cascade-panel.html" "$TARGET_DIR_1/cascade-panel.html.bak"
            else
                echo "Backup exists, skipping backup (keeping original)"
            fi
        fi

        echo "Copying cascade-panel.html..."
        cp "$PATCHES_DIR/cascade-panel.html" "$TARGET_DIR_1/"

        echo "Copying cascade-panel folder..."
        if [ -d "$TARGET_DIR_1/cascade-panel" ]; then
            rm -rf "$TARGET_DIR_1/cascade-panel"
        fi
        cp -r "$PATCHES_DIR/cascade-panel" "$TARGET_DIR_1/"
    else
        echo "Warning: Directory $TARGET_DIR_1 does not exist, skipping task 1"
    fi
}

restore_cascade_legacy() {
    echo -e "\n[1/3] Restoring Cascade Panel (legacy)..."
    echo "Target dir: $TARGET_DIR_1"
    if [ -d "$TARGET_DIR_1" ]; then
        if [ -f "$TARGET_DIR_1/cascade-panel.html.bak" ]; then
            echo "Restoring cascade-panel.html.bak -> cascade-panel.html"
            cp "$TARGET_DIR_1/cascade-panel.html.bak" "$TARGET_DIR_1/cascade-panel.html"
        fi
        if [ -d "$TARGET_DIR_1/cascade-panel" ]; then
            echo "Removing cascade-panel folder..."
            rm -rf "$TARGET_DIR_1/cascade-panel"
        fi
    else
        echo "Warning: Directory $TARGET_DIR_1 does not exist, skipping task 1"
    fi
}

# 1. Sidebar Panel (modern)
install_sidebar_modern() {
    echo -e "\n[1/3] Processing Sidebar Panel (modern)..."
    echo "Target dir: $TARGET_DIR_2"

    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench.html" ]; then
            if [ ! -f "$TARGET_DIR_2/workbench.html.bak" ]; then
                echo "Backing up workbench.html -> workbench.html.bak"
                cp "$TARGET_DIR_2/workbench.html" "$TARGET_DIR_2/workbench.html.bak"
            else
                echo "Backup exists, skipping backup (keeping original)"
            fi
        fi

        echo "Copying workbench.html..."
        cp "$PATCHES_DIR/workbench.html" "$TARGET_DIR_2/"

        echo "Copying sidebar-panel folder..."
        if [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
            rm -rf "$TARGET_DIR_2/sidebar-panel"
        fi
        cp -r "$PATCHES_DIR/sidebar-panel" "$TARGET_DIR_2/"
    else
        echo "Warning: Directory $TARGET_DIR_2 does not exist, skipping task 1"
    fi
}

restore_sidebar_modern() {
    echo -e "\n[1/3] Restoring Sidebar Panel (modern)..."
    echo "Target dir: $TARGET_DIR_2"
    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench.html.bak" ]; then
            echo "Restoring workbench.html.bak -> workbench.html"
            cp "$TARGET_DIR_2/workbench.html.bak" "$TARGET_DIR_2/workbench.html"
        fi
        if [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
            echo "Removing sidebar-panel folder..."
            rm -rf "$TARGET_DIR_2/sidebar-panel"
        fi
    else
        echo "Warning: Directory $TARGET_DIR_2 does not exist, skipping task 1"
    fi
}

# 2. Workbench Jetski Agent
install_manager() {
    echo -e "\n[2/3] Processing Workbench Jetski Agent..."
    echo "Target dir: $TARGET_DIR_2"

    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench-jetski-agent.html" ]; then
            if [ ! -f "$TARGET_DIR_2/workbench-jetski-agent.html.bak" ]; then
                echo "Backing up workbench-jetski-agent.html -> workbench-jetski-agent.html.bak"
                cp "$TARGET_DIR_2/workbench-jetski-agent.html" "$TARGET_DIR_2/workbench-jetski-agent.html.bak"
            else
                echo "Backup exists, skipping backup (keeping original)"
            fi
        fi

        echo "Copying workbench-jetski-agent.html..."
        cp "$PATCHES_DIR/workbench-jetski-agent.html" "$TARGET_DIR_2/"

        echo "Copying manager-panel folder..."
        if [ -d "$TARGET_DIR_2/manager-panel" ]; then
            rm -rf "$TARGET_DIR_2/manager-panel"
        fi
        cp -r "$PATCHES_DIR/manager-panel" "$TARGET_DIR_2/"
    else
        echo "Warning: Directory $TARGET_DIR_2 does not exist, skipping task 2"
    fi
}

restore_manager() {
    echo -e "\n[2/3] Restoring Workbench Jetski Agent..."
    echo "Target dir: $TARGET_DIR_2"
    if [ -d "$TARGET_DIR_2" ]; then
        if [ -f "$TARGET_DIR_2/workbench-jetski-agent.html.bak" ]; then
            echo "Restoring workbench-jetski-agent.html.bak -> workbench-jetski-agent.html"
            cp "$TARGET_DIR_2/workbench-jetski-agent.html.bak" "$TARGET_DIR_2/workbench-jetski-agent.html"
        fi
        if [ -d "$TARGET_DIR_2/manager-panel" ]; then
            echo "Removing manager-panel folder..."
            rm -rf "$TARGET_DIR_2/manager-panel"
        fi
    else
        echo "Warning: Directory $TARGET_DIR_2 does not exist, skipping task 2"
    fi
}

# 3. Update product.json
update_product_json() {
    echo -e "\n[3/3] Processing product.json..."

    if [ ! -f "$PRODUCT_JSON" ]; then
        echo "Error: product.json not found ($PRODUCT_JSON)"
        exit 1
    fi

    if [ ! -f "$PRODUCT_JSON.bak" ]; then
        echo "Backing up product.json -> product.json.bak"
        cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
    else
        echo "Backup exists, skipping backup (keeping original)"
    fi

    local py
    py=$(find_python_bin)
    if [ -z "$py" ]; then
        echo "Warning: Python not found, skipping checksums cleanup"
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
        print('Success: checksums cleared')
    else:
        print('Note: checksums field not found')

except Exception as e:
    print(f'Error: failed to process JSON: {e}')
    sys.exit(1)
PY
}

update_configs_only() {
    local updated=false

    echo -e "\n[1/2] Updating sidebar config..."
    if [ -f "$PATCHES_DIR/cascade-panel/config.json" ] && [ -d "$TARGET_DIR_1/cascade-panel" ]; then
        cp "$PATCHES_DIR/cascade-panel/config.json" "$TARGET_DIR_1/cascade-panel/"
        echo "Updated cascade-panel/config.json"
        updated=true
    fi
    if [ -f "$PATCHES_DIR/sidebar-panel/config.json" ] && [ -d "$TARGET_DIR_2/sidebar-panel" ]; then
        cp "$PATCHES_DIR/sidebar-panel/config.json" "$TARGET_DIR_2/sidebar-panel/"
        echo "Updated sidebar-panel/config.json"
        updated=true
    fi
    if [ "$updated" = "false" ]; then
        echo "Warning: no installed sidebar config directory found"
    fi

    echo -e "\n[2/2] Updating Manager config..."
    if [ -f "$PATCHES_DIR/manager-panel/config.json" ] && [ -d "$TARGET_DIR_2/manager-panel" ]; then
        cp "$PATCHES_DIR/manager-panel/config.json" "$TARGET_DIR_2/manager-panel/"
        echo "Updated manager-panel/config.json"
    else
        echo "Warning: manager-panel config missing or target dir not found"
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

echo -e "\nDone!"
