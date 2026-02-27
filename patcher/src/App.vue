<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { useI18n } from 'vue-i18n';
import TitleBar from "./components/TitleBar.vue";
import PathCard from "./components/PathCard.vue";
import FeatureCard from "./components/FeatureCard.vue";
import ManagerFeatureCard from "./components/ManagerFeatureCard.vue";
import AboutModal from "./components/AboutModal.vue";
import ConfirmModal from "./components/ConfirmModal.vue";

const { t, locale } = useI18n();

// 应用版本号
const APP_VERSION = "3.2.1";
// GitHub 仓库地址
const GITHUB_URL = "https://github.com/daoif/anti-power";

type SidebarVariant = 'legacy' | 'modern';

interface AntigravityVersionInfo {
  ideVersion: string | null;
  sidebarVariant: SidebarVariant;
}

// Antigravity 安装路径
const antigravityPath = ref<string | null>(null);
// 检测到的 ideVersion
const detectedIdeVersion = ref<string | null>(null);
// 当前侧边栏补丁模式（由 ideVersion 推导）
const detectedSidebarVariant = ref<SidebarVariant>('legacy');
// 是否正在检测路径
const isDetecting = ref(false);
// 补丁是否已安装
const isInstalled = ref(false);
// 是否显示关于弹窗
const showAbout = ref(false);
// 是否显示确认弹窗
const showConfirm = ref(false);
// 当前平台标识
const platform = navigator.platform.toLowerCase();
// 是否支持清理功能
const isCleanSupported = platform.includes('mac') || platform.includes('linux') || platform.includes('win');
// 是否正在执行清理
const isCleaning = ref(false);
const STORAGE_KEYS = {
  INSTALL_PATH: 'anti-power-install-path',
  CLEAN_ENABLED: 'anti-power-clean-enabled',
  CLEAN_TARGETS: 'anti-power-clean-targets'
};

try {
  const saved = localStorage.getItem(STORAGE_KEYS.INSTALL_PATH);
  if (saved !== null) {
    antigravityPath.value = JSON.parse(saved);
  }
} catch (e) {
  console.error('Failed to load install path', e);
}

// 是否启用清理功能
const cleanEnabled = ref(true);
try {
  const saved = localStorage.getItem(STORAGE_KEYS.CLEAN_ENABLED);
  if (saved !== null) {
    cleanEnabled.value = JSON.parse(saved);
  }
} catch (e) {
  console.error('Failed to load clean enabled state', e);
}

// 清理目标选择
const defaultTargets = {
  antigravity: true,
  gemini: false,
  codex: false,
  claude: false,
};
const cleanTargets = ref({ ...defaultTargets });

try {
  const saved = localStorage.getItem(STORAGE_KEYS.CLEAN_TARGETS);
  if (saved) {
    cleanTargets.value = { ...defaultTargets, ...JSON.parse(saved) };
  }
} catch (e) {
  console.error('Failed to load clean targets', e);
}

// 自动保存状态
watch(antigravityPath, (val) => {
  localStorage.setItem(STORAGE_KEYS.INSTALL_PATH, JSON.stringify(val));
});

watch(cleanEnabled, (val) => {
  localStorage.setItem(STORAGE_KEYS.CLEAN_ENABLED, JSON.stringify(val));
});

watch(cleanTargets, (val) => {
  localStorage.setItem(STORAGE_KEYS.CLEAN_TARGETS, JSON.stringify(val));
}, { deep: true });

const hasAnyCleanTarget = computed(() =>
  Object.values(cleanTargets.value).some(Boolean)
);

const cleanTargetLabels = computed(() => {
  const labels: string[] = [];
  if (cleanTargets.value.antigravity) labels.push(t('cleanTool.targets.antigravity'));
  if (cleanTargets.value.gemini) labels.push(t('cleanTool.targets.gemini'));
  if (cleanTargets.value.codex) labels.push(t('cleanTool.targets.codex'));
  if (cleanTargets.value.claude) labels.push(t('cleanTool.targets.claude'));
  return labels;
});

const cleanTargetText = computed(() =>
  cleanTargetLabels.value.join(t('cleanTool.targetSeparator'))
);

const isCleanActionDisabled = computed(() =>
  isCleaning.value || !cleanEnabled.value || !hasAnyCleanTarget.value
);

/**
 * 侧边栏功能开关配置
 * 控制侧边栏补丁中各项功能的启用状态
 */
const features = ref({
  enabled: true,
  mermaid: true,
  math: true,
  copyButton: true,
  tableColor: true,
  fontSizeEnabled: true,
  fontSize: 16,
  // 复制按钮子选项
  copyButtonSmartHover: true,
  copyButtonShowBottom: 'float' as 'float' | 'feedback',
  copyButtonStyle: 'icon' as 'arrow' | 'icon' | 'chinese' | 'custom',
  copyButtonCustomText: '',
});

/**
 * Manager 功能开关配置
 * 控制 manager-panel 中各项功能的启用状态，独立于侧边栏配置
 */
const managerFeatures = ref({
  enabled: true,
  mermaid: true,
  math: true,
  copyButton: true,
  maxWidthEnabled: true,
  maxWidthRatio: 75,
  fontSizeEnabled: true,
  fontSize: 16,
  // 复制按钮子选项
  copyButtonSmartHover: true,
  copyButtonShowBottom: 'float' as 'float' | 'feedback',
  copyButtonStyle: 'icon' as 'arrow' | 'icon' | 'chinese' | 'custom',
  copyButtonCustomText: '',
});

const isModernSidebarVariant = computed(() => detectedSidebarVariant.value === 'modern');

const detectedVersionLabel = computed(() => {
  if (detectedIdeVersion.value) {
    return t('status.ideVersion', { version: detectedIdeVersion.value });
  }
  return t('status.ideVersionUnknown');
});

const confirmModalMessage = computed(() => {
  if (!detectedIdeVersion.value) {
    return t('confirmModal.messageUnknown');
  }
  return t(
    isModernSidebarVariant.value
      ? 'confirmModal.messageModern'
      : 'confirmModal.messageLegacy'
  );
});

/**
 * 补丁文件清单
 * 根据当前版本模式和模块开关动态展示确认安装内容
 */
const PATCH_FILES = computed(() => {
  const modified: string[] = [];
  const added: string[] = [];
  const deprecated: string[] = [];

  if (features.value.enabled) {
    if (isModernSidebarVariant.value) {
      modified.push("workbench.html");
      added.push(`sidebar-panel/ ${t('app.files.sidebarModernLabel')}`);
      deprecated.push(`cascade-panel/ ${t('app.files.sidebarLegacyCleanupLabel')}`);
    } else {
      modified.push("cascade-panel.html");
      added.push(`cascade-panel/ ${t('app.files.sidebarLegacyLabel')}`);
      deprecated.push(`sidebar-panel/ ${t('app.files.sidebarModernCleanupLabel')}`);
    }
  }

  if (managerFeatures.value.enabled) {
    modified.push("workbench-jetski-agent.html");
    added.push(`manager-panel/ ${t('app.files.managerPanelLabel')}`);
  }

  return { modified, added, deprecated };
});

const hasPatchChanges = computed(() =>
  PATCH_FILES.value.modified.length > 0 ||
  PATCH_FILES.value.added.length > 0 ||
  PATCH_FILES.value.deprecated.length > 0
);

/**
 * 读取 Antigravity ideVersion 与侧边栏模式
 * @param path - Antigravity 安装路径
 */
async function readAntigravityVersion(path: string) {
  try {
    const info = await invoke<AntigravityVersionInfo | null>("detect_antigravity_version", { path });
    detectedIdeVersion.value = info?.ideVersion ?? null;
    detectedSidebarVariant.value = info?.sidebarVariant === 'modern' ? 'modern' : 'legacy';
  } catch (e) {
    detectedIdeVersion.value = null;
    detectedSidebarVariant.value = 'legacy';
    console.error(t('app.error.readVersion'), e);
  }
}

/**
 * 刷新路径相关状态
 * @param path - Antigravity 安装路径
 */
async function refreshPathState(path: string | null) {
  if (!path) {
    isInstalled.value = false;
    detectedIdeVersion.value = null;
    detectedSidebarVariant.value = 'legacy';
    return;
  }

  await Promise.all([
    checkPatchStatus(path),
    readAntigravityVersion(path),
  ]);
}

/**
 * 检测 Antigravity 安装路径
 * 自动搜索系统中的 Antigravity 安装位置
 */
async function detectPath() {
  isDetecting.value = true;
  try {
    const path = await invoke<string | null>("detect_antigravity_path");
    const normalized = path ? await normalizePath(path) : null;
    const resolvedPath = normalized ?? path;
    antigravityPath.value = resolvedPath;
    await refreshPathState(resolvedPath);
  } catch (e) {
    console.error(t('app.error.detect'), e);
  } finally {
    isDetecting.value = false;
  }
}

/**
 * 检测补丁状态并读取配置
 * @param path - Antigravity 安装路径
 */
async function checkPatchStatus(path: string) {
  try {
    isInstalled.value = await invoke<boolean>("check_patch_status", { path, locale: locale.value });
    if (isInstalled.value) {
      // 读取侧边栏与 Manager 配置
      const [config, managerConfig] = await Promise.all([
        invoke<{
          enabled?: boolean;
          mermaid: boolean;
          math: boolean;
          copyButton: boolean;
          tableColor: boolean;
          fontSizeEnabled?: boolean;
          fontSize?: number;
        } | null>("read_patch_config", { path, locale: locale.value }),
        invoke<{
          enabled?: boolean;
          mermaid: boolean;
          math: boolean;
          copyButton: boolean;
          maxWidthEnabled?: boolean;
          maxWidthRatio?: number;
          fontSizeEnabled?: boolean;
          fontSize?: number;
        } | null>("read_manager_patch_config", { path, locale: locale.value }),
      ]);

      features.value = {
        ...features.value,
        ...(config ?? {}),
        enabled: config ? (config.enabled ?? true) : false,
      };

      managerFeatures.value = {
        ...managerFeatures.value,
        ...(managerConfig ?? {}),
        enabled: managerConfig ? (managerConfig.enabled ?? true) : false,
      };
    }
  } catch (e) {
    console.error(t('app.error.checkPatch'), e);
  }
}

/**
 * 手动选择 Antigravity 安装路径
 * 打开目录选择对话框让用户选择
 */
async function browsePath() {
  try {
    const selected = await open({
      directory: true,
      title: t('pathCard.selectTitle'),
    });
    if (selected) {
      const normalized = await normalizePath(selected as string);
      const resolvedPath = normalized ?? (selected as string);
      antigravityPath.value = resolvedPath;
      await refreshPathState(resolvedPath);
    }
  } catch (e) {
    console.error(t('app.error.selectPath'), e);
  }
}

/**
 * 请求安装补丁
 * 显示确认弹窗，等待用户确认后执行安装
 */
function requestInstall() {
  if (!antigravityPath.value) return;
  if (!hasPatchChanges.value) {
    showToast(t('toast.noPatchEnabled'));
    return;
  }
  showConfirm.value = true;
}

/**
 * 确认并执行安装补丁
 * 调用后端命令安装补丁文件
 */
async function confirmInstall() {
  showConfirm.value = false;
  if (!antigravityPath.value) return;
  if (!hasPatchChanges.value) {
    showToast(t('toast.noPatchEnabled'));
    return;
  }
  try {
    await invoke("install_patch", { 
      path: antigravityPath.value,
      features: features.value,
      managerFeatures: managerFeatures.value,
      locale: locale.value
    });
    await refreshPathState(antigravityPath.value);
    showToast(t('toast.installSuccess'));
  } catch (e) {
    console.error(t('app.error.install'), e);
    showToast(t('toast.installFailed', { error: getErrorMessage(e) }));
  }
}

/**
 * 卸载补丁
 * 恢复原始文件，移除补丁相关内容
 */
async function uninstallPatch() {
  if (!antigravityPath.value) return;
  try {
    await invoke("uninstall_patch", { path: antigravityPath.value, locale: locale.value });
    isInstalled.value = false;
    showToast(t('toast.restoreSuccess'));
  } catch (e) {
    console.error(t('app.error.uninstall'), e);
    showToast(t('toast.restoreFailed', { error: getErrorMessage(e) }));
  }
}

/**
 * 清理对话缓存
 * @param force - 是否强制清理（删除更多缓存数据）
 */
async function runAntiClean(force = false) {
  if (!isCleanSupported || isCleaning.value) return;
  if (!hasAnyCleanTarget.value) {
    showToast(t('cleanTool.targetHint'));
    return;
  }
  const includesAntigravity = cleanTargets.value.antigravity;
  const messageKey = force
    ? (includesAntigravity ? 'cleanTool.forceConfirmMessage' : 'cleanTool.forceConfirmMessageNoApp')
    : (includesAntigravity ? 'cleanTool.confirmMessage' : 'cleanTool.confirmMessageNoApp');
  const message = t(messageKey, { targets: cleanTargetText.value });
  const confirmed = await ask(message, {
    title: force ? t('cleanTool.forceConfirmTitle') : t('cleanTool.confirmTitle'),
    kind: 'warning'
  });
  
  if (!confirmed) {
    return;
  }
  isCleaning.value = true;
  try {
    const output = await invoke<string>("run_anti_clean", { 
      force, 
      targets: cleanTargets.value,
      locale: locale.value
    });
    if (output) {
      console.log("[anti-clean]", output);
    }
    showToast(t('toast.cleanSuccess'));
  } catch (e) {
    console.error(t('app.error.clean'), e);
    showToast(t('toast.cleanFailed', { error: getErrorMessage(e) }));
  } finally {
    isCleaning.value = false;
  }
}

// Toast 提示消息内容
const toastMessage = ref('');
// 是否显示 Toast 提示
const showToastFlag = ref(false);

/**
 * 显示 Toast 提示
 * @param message - 提示消息内容
 */
function showToast(message: string) {
  toastMessage.value = message;
  showToastFlag.value = true;
  setTimeout(() => {
    showToastFlag.value = false;
  }, 3000);
}

/**
 * 从错误对象中提取错误消息
 * @param error - 错误对象
 * @returns 错误消息字符串
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? t('app.error.unknown'));
  }
  return t('app.error.unknown');
}

/**
 * 规范化 Antigravity 路径
 * 兼容 macOS/Linux 目录结构，将用户选择的路径转换为标准根目录
 * @param path - 用户输入或选择的路径
 * @returns 规范化后的路径，或 null
 */
async function normalizePath(path: string): Promise<string | null> {
  try {
    const normalized = await invoke<string | null>("normalize_antigravity_path", { path });
    return normalized;
  } catch (e) {
    console.error(t('app.error.normalizePath'), e);
    return null;
  }
}

/**
 * 仅更新配置
 * 在补丁已安装的情况下，只更新功能配置而不重新安装
 */
async function updateConfigOnly() {
  if (!antigravityPath.value) return;
  try {
    await invoke("update_config", { 
      path: antigravityPath.value,
      features: features.value,
      managerFeatures: managerFeatures.value,
      locale: locale.value
    });
    showToast(t('toast.configUpdated'));
  } catch (e) {
    console.error(t('app.error.updateConfig'), e);
    showToast(t('toast.updateFailed', { error: getErrorMessage(e) }));
  }
}

onMounted(() => {
  detectPath();
});
</script>

<template>
  <div class="app-wrapper">
    <TitleBar :title="$t('app.title')" @openAbout="showAbout = true" />
    
    <main class="app-container">
      <div class="app-content">
        <div class="layout-grid">
        <section class="side">
          <PathCard 
            v-model="antigravityPath"
            :isDetecting="isDetecting"
            @detect="detectPath"
            @browse="browsePath"
          />

          <section class="actions-card">
            <div class="actions-meta">
              <div class="status-badges">
                <span class="status-pill" :class="{ installed: isInstalled }">
                  {{ isInstalled ? $t('status.installed') : $t('status.notInstalled') }}
                </span>
                <span
                  v-if="antigravityPath"
                  class="status-pill version-pill"
                  :class="{ modern: isModernSidebarVariant }"
                >
                  {{ detectedVersionLabel }}
                </span>
              </div>
              <span class="status-text">
                {{ isInstalled ? $t('status.installedHint') : $t('status.notInstalledHint') }}
              </span>
            </div>

            <div class="actions-grid">
              <button 
                @click="requestInstall"
                :disabled="!antigravityPath"
                class="primary-btn"
              >
                {{ isInstalled ? $t('actions.reinstall') : $t('actions.install') }}
              </button>
              
              <button 
                @click="updateConfigOnly"
                :disabled="!antigravityPath"
                class="secondary-btn"
              >
                {{ $t('actions.updateConfig') }}
              </button>
              
              <button 
                @click="uninstallPatch"
                :disabled="!antigravityPath"
                class="secondary-btn danger"
              >
                {{ $t('actions.restore') }}
              </button>
            </div>
          </section>

          <!-- 桌面端清理工具 (宽屏显示在左侧) -->
          <section v-show="isCleanSupported" class="clean-area desktop-only">
            <div class="clean-header">
              <h2 class="clean-title">{{ $t('cleanTool.title') }}</h2>
              <label class="enable-toggle" @click.stop>
                <span class="toggle-label">{{ $t('cleanTool.enableToggle') }}</span>
                <input type="checkbox" v-model="cleanEnabled" class="checkbox" :disabled="isCleaning" />
              </label>
            </div>
            <div class="clean-content">
              <div class="clean-targets">
                <div class="clean-target-title">{{ $t('cleanTool.targetTitle') }}</div>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.antigravity" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.antigravity') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.gemini" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.gemini') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.codex" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.codex') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.claude" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.claude') }}</span>
                </label>
                <p v-if="!hasAnyCleanTarget" class="clean-target-hint">
                  {{ $t('cleanTool.targetHint') }}
                </p>
              </div>
              <div class="clean-actions">
                <button 
                  @click="runAntiClean(false)"
                  :disabled="isCleanActionDisabled"
                  class="secondary-btn"
                >
                  {{ isCleaning ? $t('cleanTool.cleaning') : $t('cleanTool.cleanCache') }}
                </button>
                <button 
                  @click="runAntiClean(true)"
                  :disabled="isCleanActionDisabled"
                  class="secondary-btn danger"
                >
                  {{ $t('cleanTool.forceClean') }}
                </button>
              </div>
            </div>
          </section>

          </section>

        <section class="main">
          <FeatureCard v-model="features" />
          <ManagerFeatureCard v-model="managerFeatures" />

          <!-- 移动端清理工具 (窄屏显示在底部) -->
          <section v-show="isCleanSupported" class="clean-area mobile-only">
            <div class="clean-header">
              <h2 class="clean-title">{{ $t('cleanTool.title') }}</h2>
              <label class="enable-toggle" @click.stop>
                <span class="toggle-label">{{ $t('cleanTool.enableToggle') }}</span>
                <input type="checkbox" v-model="cleanEnabled" class="checkbox" :disabled="isCleaning" />
              </label>
            </div>
            <div class="clean-content">
              <div class="clean-targets">
                <div class="clean-target-title">{{ $t('cleanTool.targetTitle') }}</div>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.antigravity" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.antigravity') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.gemini" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.gemini') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.codex" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.codex') }}</span>
                </label>
                <label class="clean-target-option">
                  <input type="checkbox" v-model="cleanTargets.claude" :disabled="isCleaning || !cleanEnabled" />
                  <span>{{ $t('cleanTool.targets.claude') }}</span>
                </label>
                <p v-if="!hasAnyCleanTarget" class="clean-target-hint">
                  {{ $t('cleanTool.targetHint') }}
                </p>
              </div>
              <div class="clean-actions">
                <button 
                  @click="runAntiClean(false)"
                  :disabled="isCleanActionDisabled"
                  class="secondary-btn"
                >
                  {{ isCleaning ? $t('cleanTool.cleaning') : $t('cleanTool.cleanCache') }}
                </button>
                <button 
                  @click="runAntiClean(true)"
                  :disabled="isCleanActionDisabled"
                  class="secondary-btn danger"
                >
                  {{ $t('cleanTool.forceClean') }}
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>

      <footer class="footer">
        <p>{{ $t('app.version', { version: APP_VERSION }) }} · 
          <a :href="GITHUB_URL" target="_blank" class="link">{{ $t('app.github') }}</a>
        </p>
      </footer>
      </div>
    </main>

    <AboutModal 
      :show="showAbout" 
      :version="APP_VERSION"
      :githubUrl="GITHUB_URL"
      @close="showAbout = false" 
    />

    <ConfirmModal
      :show="showConfirm"
      :title="$t('confirmModal.title')"
      :message="confirmModalMessage"
      :modifiedFiles="PATCH_FILES.modified"
      :addedFiles="PATCH_FILES.added"
      :deprecatedFiles="PATCH_FILES.deprecated"
      @confirm="confirmInstall"
      @cancel="showConfirm = false"
    />

    <!-- Toast 提示 -->
    <Transition name="toast">
      <div v-if="showToastFlag" class="toast">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-wrapper {
  height: 100vh;
  min-width: 420px;
  display: flex;
  flex-direction: column;
  background-color: var(--ag-bg);
  background-color: var(--ag-bg);
  color: var(--ag-text);
  overflow: hidden; /* 防止最外层滚动 */
}

.app-container {
  flex: 1;
  overflow-y: auto; /* 滚动条在这里，且容器全宽 */
  min-height: 0;
  width: 100%;
}

.app-content {
  padding: 20px 24px;
  margin: 0 auto;
  width: min(1120px, 100%);
}

.layout-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
}

@media (min-width: 860px) {
  .layout-grid {
    grid-template-columns: 400px 1fr;
    gap: 18px;
  }

  .side {
    position: sticky;
    top: 8px;
    align-self: start;
    padding-bottom: 0;
  }
  
  /* 响应式显示控制 */
  .mobile-only {
    display: none;
  }
}

@media (max-width: 859px) {
  .desktop-only {
    display: none;
  }
}

.main {
  min-width: 0;
}

.side,
.main {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.actions-card {
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-lg);
  background: var(--ag-surface);
  background-image: var(--ag-gradient-surface);
  padding: 16px 18px 18px;
  position: relative;
  overflow: hidden;
  position: relative;
  overflow: hidden;
  animation: card-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.05s backwards;
}

.actions-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  pointer-events: none;
}

.actions-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
}

.status-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(204, 204, 204, 0.06);
  border: 1px solid rgba(204, 204, 204, 0.1);
  color: var(--ag-text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: all var(--transition-normal);
}

.status-pill.installed {
  background: var(--ag-accent-subtle);
  border-color: rgba(51, 118, 205, 0.3);
  color: var(--ag-accent);
  box-shadow: 0 0 8px rgba(51, 118, 205, 0.1);
}

.version-pill {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.24);
  color: var(--ag-text-secondary);
}

.version-pill.modern {
  background: var(--ag-success-subtle);
  border-color: rgba(34, 197, 94, 0.35);
  color: var(--ag-success);
}

.status-text {
  font-size: 12px;
  color: var(--ag-text-tertiary);
  line-height: 1.4;
}

.actions-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
}

.clean-area {
  padding: 16px 18px;
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-lg);
  background: var(--ag-surface);
  background-image: var(--ag-gradient-surface);
  position: relative;
  overflow: hidden;
  animation: card-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.1s backwards;
}

.clean-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  pointer-events: none;
}

.clean-header {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.clean-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--ag-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.enable-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.enable-toggle:hover {
  background: var(--ag-accent-subtle);
}

.toggle-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text-secondary);
}

.clean-content {
  display: grid;
  gap: 12px;
}

.clean-targets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.clean-target-title {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--ag-text-tertiary);
}

.clean-target-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  background: var(--ag-surface-2);
  font-size: 12px;
  color: var(--ag-text-secondary);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.clean-target-option input {
  margin: 0;
  accent-color: var(--ag-accent);
}

.clean-target-option:hover {
  border-color: var(--ag-border-hover);
  background: var(--ag-surface-3);
  color: var(--ag-text);
}

.clean-target-option:focus-within {
  border-color: var(--ag-accent);
  box-shadow: 0 0 0 1px rgba(51, 118, 205, 0.2);
}

.clean-target-hint {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--ag-error);
  margin: 0;
}

.clean-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

/* 主操作按钮 */
.primary-btn {
  padding: 12px 16px;
  background: var(--ag-accent-gradient);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.primary-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15), transparent);
  pointer-events: none;
}

.primary-btn::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--transition-fast);
  box-shadow: var(--ag-shadow-accent-lg);
  pointer-events: none;
}

.primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.primary-btn:hover:not(:disabled)::after {
  opacity: 1;
}

.primary-btn:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.95);
}

.primary-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 次级操作按钮 */
.secondary-btn {
  padding: 12px 16px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  color: var(--ag-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.secondary-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  pointer-events: none;
}

.secondary-btn:hover:not(:disabled) {
  background: var(--ag-surface-3);
  border-color: var(--ag-border-hover);
  color: var(--ag-text);
  transform: translateY(-1px);
}

.secondary-btn:active:not(:disabled) {
  transform: translateY(0);
}

.secondary-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 危险样式变体 */
.secondary-btn.danger {
  color: var(--ag-text-secondary);
}

.secondary-btn.danger:hover:not(:disabled) {
  background: var(--ag-error-subtle);
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--ag-error);
}

/* 页脚 */
.footer {
  margin-top: 24px;
  padding: 18px 0 8px;
  border-top: 1px solid var(--ag-border);
  text-align: center;
  font-size: 12px;
  color: var(--ag-text-muted);
}

.link {
  color: var(--ag-accent);
  text-decoration: none;
  font-weight: 500;
  transition: all var(--transition-fast);
  position: relative;
}

.link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 0;
  height: 1px;
  background: var(--ag-accent);
  transition: width var(--transition-fast);
}

.link:hover {
  color: var(--ag-accent-hover);
}

.link:hover::after {
  width: 100%;
}

/* Toast 提示 */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ag-glass);
  border: 1px solid var(--ag-glass-border);
  border-radius: var(--radius-lg);
  padding: 12px 24px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ag-text);
  box-shadow: var(--ag-shadow-xl);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  z-index: 1000;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.94);
}
</style>

