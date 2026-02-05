<template>
  <div class="titlebar" :class="{ 'is-mac': isMac }" data-tauri-drag-region>
    <div class="titlebar-left" data-tauri-drag-region>
      <img class="titlebar-icon" src="../assets/logo.png" alt="logo" />
      <span class="titlebar-title">{{ title }}</span>
    </div>
    <div class="titlebar-right">
      <slot name="right"></slot>
      <!-- 语言切换按钮 -->
      <button class="titlebar-btn lang-btn" @click="toggleLanguage" :title="$t('titleBar.switchLanguage')">
        <span class="lang-text">{{ locale === 'zh-CN' ? '中' : 'En' }}</span>
      </button>
      <!-- 主题切换按钮 -->
      <button class="titlebar-btn theme-btn" @click="toggleTheme" :title="isDark ? $t('titleBar.toggleThemeLight') : $t('titleBar.toggleThemeDark')">
        <!-- 月亮图标（深色模式显示） -->
        <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <!-- 太阳图标（浅色模式显示） -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      </button>
      <!-- 关于按钮 -->
      <button class="titlebar-btn about-btn" @click="$emit('openAbout')" :title="$t('titleBar.about')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
      <!-- 窗口控制按钮 -->
      <div class="titlebar-window-controls">
        <button class="titlebar-btn" @click="minimize" :title="$t('titleBar.minimize')">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5" width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="titlebar-btn" @click="toggleMaximize" :title="isMaximized ? $t('titleBar.restore') : $t('titleBar.maximize')">
          <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="9" height="9" stroke="currentColor" fill="none" stroke-width="1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="2" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1"/>
            <rect x="2" y="0" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1"/>
          </svg>
        </button>
        <button class="titlebar-btn close-btn" @click="closeWindow" :title="$t('titleBar.close')">
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
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

/**
 * 切换界面语言
 * 在中文和英文之间切换，并保存到 localStorage
 */
const toggleLanguage = () => {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  localStorage.setItem('anti-power-locale', locale.value);
};

defineProps<{
  title?: string;
}>();

defineEmits(['openAbout']);

// 窗口是否最大化
const isMaximized = ref(false);
// 是否为深色主题
const isDark = ref(true);
// Tauri 窗口对象
let appWindow: any = null;
// 窗口尺寸变化监听器取消函数
let unlistenResize: (() => void) | null = null;

// 主题存储键名
const THEME_STORAGE_KEY = 'anti-power-theme';
// 深色主题标识
const THEME_DARK = 'dark';
// 浅色主题标识
const THEME_LIGHT = 'light';

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

  // 初始化主题
  initTheme();
});

onUnmounted(() => {
  if (unlistenResize) unlistenResize();
});

/**
 * 获取窗口对象
 * 如果窗口对象尚未初始化则动态获取
 * @returns Tauri 窗口对象
 */
const getWindow = async () => {
  if (appWindow) return appWindow;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  appWindow = getCurrentWindow();
  return appWindow;
};

// 最小化窗口
const minimize = async () => {
  const win = await getWindow();
  if (win) await win.minimize();
};

// 切换窗口最大化/还原状态
const toggleMaximize = async () => {
  const win = await getWindow();
  if (win) await win.toggleMaximize();
};

// 关闭窗口
const closeWindow = async () => {
  const win = await getWindow();
  if (win) await win.close();
};

/**
 * 初始化主题
 * 从 localStorage 读取保存的主题设置，默认使用深色主题
 */
const initTheme = () => {
  // 从 localStorage 读取保存的主题
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  
  if (savedTheme) {
    // 使用保存的主题
    isDark.value = savedTheme === THEME_DARK;
  } else {
    // 默认使用深色主题（与原始设计保持一致）
    isDark.value = true;
  }
  
  applyTheme();
};

/**
 * 应用主题到 DOM
 * 通过设置 data-theme 属性切换主题样式
 */
const applyTheme = () => {
  if (isDark.value) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

/**
 * 切换主题
 * 在深色和浅色主题之间切换，并保存到 localStorage
 */
const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme();
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? THEME_DARK : THEME_LIGHT);
};

// 是否为 macOS 平台
const isMac = navigator.platform.toLowerCase().includes('mac');
</script>

<style scoped>
.titlebar {
  height: 44px;
  background: var(--ag-titlebar-bg);
  border-bottom: 1px solid var(--ag-titlebar-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
}

.titlebar::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  pointer-events: none;
}

.titlebar::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(51, 118, 205, 0.2), transparent);
  opacity: 0.6;
  pointer-events: none;
}

.titlebar-left {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 18px;
  gap: 10px;
  min-width: 0;
}

.titlebar.is-mac .titlebar-left {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  height: 100%;
  padding: 0;
  justify-content: center;
  z-index: 1;
  pointer-events: none;
}

.titlebar.is-mac .titlebar-left * {
  pointer-events: auto;
}

.titlebar-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(255, 255, 255, 0.1);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.titlebar-icon:hover {
  transform: scale(1.05);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.15);
}

.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ag-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}

.titlebar-right {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 2px;
  padding-right: 8px;
  margin-left: auto;
  z-index: 2;
}

.titlebar-right,
.titlebar-right * {
  -webkit-app-region: no-drag;
}

.titlebar-window-controls {
  display: flex;
  height: 100%;
  margin-left: 6px;
}

.titlebar.is-mac .titlebar-window-controls {
  display: none;
}

.titlebar-btn {
  width: 36px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ag-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
  border-radius: 0;
  position: relative;
}

.titlebar-btn::before {
  content: '';
  position: absolute;
  inset: 8px 4px;
  background: transparent;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  z-index: -1;
}

.titlebar-btn:hover {
  color: var(--ag-text-strong);
}

.titlebar-btn:hover::before {
  background: rgba(204, 204, 204, 0.1);
}

.lang-btn {
  width: 36px;
  color: var(--ag-text-tertiary);
  margin: 0 2px;
}

.lang-btn:hover {
  color: var(--ag-accent);
}

.lang-btn:hover::before {
  background: var(--ag-accent-subtle);
}

.lang-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.theme-btn {
  width: 36px;
  color: var(--ag-text-tertiary);
  margin: 0 2px;
}

.theme-btn:hover {
  color: var(--ag-accent);
}

.theme-btn:hover::before {
  background: var(--ag-accent-subtle);
}

.about-btn {
  width: 36px;
  color: var(--ag-text-tertiary);
  margin: 0 2px;
}

.about-btn:hover {
  color: var(--ag-text);
}

.about-btn:hover::before {
  background: rgba(255, 255, 255, 0.06);
}

.close-btn:hover {
  color: white !important;
}

.close-btn:hover::before {
  background: var(--ag-error) !important;
}

.titlebar-btn svg {
  opacity: 1;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.titlebar-btn:hover svg {
  transform: scale(1.08);
}

.titlebar-btn:active svg {
  transform: scale(0.95);
}
</style>
