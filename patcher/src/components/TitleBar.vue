<template>
  <div class="titlebar" :class="{ 'is-mac': isMac }" data-tauri-drag-region>
    <div class="titlebar-left" data-tauri-drag-region>
      <img class="titlebar-icon" src="../assets/logo.png" alt="logo" />
      <span class="titlebar-title">{{ title }}</span>
    </div>
    <div class="titlebar-right">
      <slot name="right"></slot>
      <!-- 关于按钮 -->
      <button class="titlebar-btn about-btn" @click="$emit('openAbout')" title="关于">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
      <!-- 窗口控制按钮 -->
      <div class="titlebar-window-controls">
        <button class="titlebar-btn" @click="minimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="titlebar-btn" @click="toggleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="9" height="9" stroke="currentColor" fill="none" stroke-width="1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="2" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1"/>
            <rect x="2" y="0" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1"/>
          </svg>
        </button>
        <button class="titlebar-btn close-btn" @click="closeWindow" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineProps<{
  title?: string;
}>();

defineEmits(['openAbout']);

const isMaximized = ref(false);
let appWindow: any = null;
let unlistenResize: (() => void) | null = null;

onMounted(async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    appWindow = getCurrentWindow();
    isMaximized.value = await appWindow.isMaximized();

    unlistenResize = await appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });

  } catch (error) {
    console.error('TitleBar init error:', error);
  }
});

onUnmounted(() => {
  if (unlistenResize) unlistenResize();
});

// 获取窗口对象（如果还没初始化则动态获取）
const getWindow = async () => {
  if (appWindow) return appWindow;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  appWindow = getCurrentWindow();
  return appWindow;
};

const minimize = async () => {
  const win = await getWindow();
  if (win) await win.minimize();
};

const toggleMaximize = async () => {
  const win = await getWindow();
  if (win) await win.toggleMaximize();
};

const closeWindow = async () => {
  const win = await getWindow();
  if (win) await win.close();
};

const isMac = navigator.platform.toLowerCase().includes('mac');
</script>

<style scoped>
.titlebar {
  height: 36px;
  background: var(--ag-surface);
  border-bottom: 1px solid var(--ag-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
}


.titlebar-left {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 12px;
  gap: 8px;
  min-width: 0;
}

.titlebar.is-mac .titlebar-left {
  width: 100%;
  justify-content: center;
  padding-left: 80px;
  padding-right: 80px;
  box-sizing: border-box;
}


.titlebar-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.titlebar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--ag-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.titlebar-right {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
  padding-right: 4px;
}

.titlebar-right,
.titlebar-right * {
  -webkit-app-region: no-drag;
}


.titlebar-window-controls {
  display: flex;
  height: 100%;
}

.titlebar.is-mac .titlebar-window-controls {
  display: none;
}

.titlebar-btn {
  width: 40px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ag-text);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.titlebar-btn:hover {
  background-color: var(--ag-surface-2);
}

.about-btn {
  width: 36px;
  color: var(--ag-text-secondary);
}

.about-btn:hover {
  color: var(--ag-text);
}

.close-btn:hover {
  background-color: #e81123;
  color: white;
}

.titlebar-btn svg {
  opacity: 0.9;
}
</style>
