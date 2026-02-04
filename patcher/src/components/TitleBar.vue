<template>
  <div class="titlebar" :class="{ 'is-mac': isMac }" data-tauri-drag-region>
    <div class="titlebar-left" data-tauri-drag-region>
      <img class="titlebar-icon" src="../assets/LOGO.png" alt="logo" />
      <span class="titlebar-title">{{ title }}</span>
    </div>
    <div class="titlebar-right">
      <slot name="right"></slot>
      <button class="titlebar-btn lang-btn" @click="toggleLanguage" :title="$t('titleBar.switchLanguage')">
        <span class="lang-text">{{ locale === 'zh-CN' ? '中' : 'En' }}</span>
      </button>
      <button class="titlebar-btn theme-btn" @click="toggleTheme" :title="isDark ? $t('titleBar.toggleThemeLight') : $t('titleBar.toggleThemeDark')">
        <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
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
      <button class="titlebar-btn about-btn" @click="$emit('openAbout')" :title="$t('titleBar.about')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
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
 * Persist the locale switch so it survives a restart
 */
const toggleLanguage = () => {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  localStorage.setItem('anti-power-locale', locale.value);
};

defineProps<{
  title?: string;
}>();

defineEmits(['openAbout']);

const isMaximized = ref(false);
const isDark = ref(true);
let appWindow: any = null;
let unlistenResize: (() => void) | null = null;

const THEME_STORAGE_KEY = 'anti-power-theme';
const THEME_DARK = 'dark';
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

  initTheme();
});

onUnmounted(() => {
  if (unlistenResize) unlistenResize();
});

/**
 * Resolve the Tauri window lazily if initialization has not run
 * @returns The current Tauri window
 */
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

/**
 * Restore the saved theme and default to dark for new installs
 */
const initTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  
  if (savedTheme) {
    isDark.value = savedTheme === THEME_DARK;
  } else {
    // Match the original dark theme by default
    isDark.value = true;
  }
  
  applyTheme();
};

/**
 * The data-theme attribute switches the CSS color tokens
 */
const applyTheme = () => {
  if (isDark.value) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

/**
 * Persist the theme switch so it survives a restart
 */
const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme();
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? THEME_DARK : THEME_LIGHT);
};

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
