<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import TitleBar from "./components/TitleBar.vue";
import PathCard from "./components/PathCard.vue";
import FeatureCard from "./components/FeatureCard.vue";
import AboutModal from "./components/AboutModal.vue";
import ConfirmModal from "./components/ConfirmModal.vue";

// 常量
const APP_VERSION = "2.0.1";
const GITHUB_URL = "https://github.com/daoif/anti-power";

// 补丁文件清单
const PATCH_FILES = {
  // 将被修改的原始文件
  modified: [
    "cascade-panel.html",
  ],
  // 将添加的新文件/目录
  added: [
    "cascade-panel/  (模块目录)",
  ],
  // 废弃文件（旧版本遗留，新版本不再使用）
  deprecated: [] as string[],
};

// 状态
const antigravityPath = ref<string | null>(null);
const isDetecting = ref(false);
const isInstalled = ref(false);
const showAbout = ref(false);
const showConfirm = ref(false);

// 功能开关
const features = ref({
  mermaid: true,
  math: true,
  copyButton: true,
  tableColor: true,
});

// 检测 Antigravity 安装路径
async function detectPath() {
  isDetecting.value = true;
  try {
    const path = await invoke<string | null>("detect_antigravity_path");
    antigravityPath.value = path;
    if (path) {
      await checkPatchStatus(path);
    }
  } catch (e) {
    console.error("检测失败:", e);
  } finally {
    isDetecting.value = false;
  }
}

// 检测补丁状态和读取配置
async function checkPatchStatus(path: string) {
  try {
    isInstalled.value = await invoke<boolean>("check_patch_status", { path });
    if (isInstalled.value) {
      const config = await invoke<{ mermaid: boolean; math: boolean; copyButton: boolean; tableColor: boolean } | null>("read_patch_config", { path });
      if (config) {
        features.value = config;
      }
    }
  } catch (e) {
    console.error("检测补丁状态失败:", e);
  }
}

// 手动选择路径
async function browsePath() {
  try {
    const selected = await open({
      directory: true,
      title: "选择 Antigravity 安装目录",
    });
    if (selected) {
      antigravityPath.value = selected as string;
    }
  } catch (e) {
    console.error("选择目录失败:", e);
  }
}

// 请求安装（显示确认弹窗）
function requestInstall() {
  if (!antigravityPath.value) return;
  showConfirm.value = true;
}

// 确认安装
async function confirmInstall() {
  showConfirm.value = false;
  if (!antigravityPath.value) return;
  try {
    await invoke("install_patch", { 
      path: antigravityPath.value,
      features: features.value 
    });
    isInstalled.value = true;
    showToast('✓ 补丁安装成功');
  } catch (e) {
    console.error("安装失败:", e);
    showToast('✗ 安装失败');
  }
}

// 卸载补丁
async function uninstallPatch() {
  if (!antigravityPath.value) return;
  try {
    await invoke("uninstall_patch", { path: antigravityPath.value });
    isInstalled.value = false;
    showToast('✓ 已恢复原版');
  } catch (e) {
    console.error("卸载失败:", e);
    showToast('✗ 恢复失败');
  }
}

// Toast 提示
const toastMessage = ref('');
const showToastFlag = ref(false);

function showToast(message: string) {
  toastMessage.value = message;
  showToastFlag.value = true;
  setTimeout(() => {
    showToastFlag.value = false;
  }, 3000);
}

// 仅更新配置
async function updateConfigOnly() {
  if (!antigravityPath.value) return;
  try {
    await invoke("update_config", { 
      path: antigravityPath.value,
      features: features.value 
    });
    showToast('✓ 配置已更新');
  } catch (e) {
    console.error("更新配置失败:", e);
    showToast('✗ 更新失败');
  }
}

onMounted(() => {
  detectPath();
});
</script>

<template>
  <div class="app-wrapper">
    <TitleBar title="Anti-Power" @openAbout="showAbout = true" />
    
    <main class="app-container">
      <PathCard 
        v-model="antigravityPath"
        :isDetecting="isDetecting"
        @detect="detectPath"
        @browse="browsePath"
      />

      <FeatureCard v-model="features" />

      <section class="actions">
        <button 
          @click="requestInstall"
          :disabled="!antigravityPath"
          class="primary-btn"
        >
          {{ isInstalled ? '重新安装' : '安装补丁' }}
        </button>
        
        <button 
          @click="updateConfigOnly"
          :disabled="!antigravityPath"
          class="secondary-btn"
          title="仅更新功能开关配置，不重新复制补丁文件"
        >
          更新配置
        </button>
        
        <button 
          @click="uninstallPatch"
          :disabled="!antigravityPath"
          class="secondary-btn danger"
        >
          恢复原版
        </button>
      </section>

      <footer class="footer">
        <p>v{{ APP_VERSION }} · 
          <a :href="GITHUB_URL" target="_blank" class="link">GitHub</a>
        </p>
      </footer>
    </main>

    <AboutModal 
      :show="showAbout" 
      :version="APP_VERSION"
      :githubUrl="GITHUB_URL"
      @close="showAbout = false" 
    />

    <ConfirmModal
      :show="showConfirm"
      title="确认安装补丁"
      message="即将安装 Anti-Power 补丁，请确认以下文件变更："
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
  display: flex;
  flex-direction: column;
  background-color: var(--ag-bg);
  color: var(--ag-text);
  overflow: hidden;
}

.app-container {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  min-height: 0; /* 关键：允许 flex 子项收缩 */
}

.actions {
  display: flex;
  gap: 16px;
}

.primary-btn {
  flex: 1;
  padding: 14px 24px;
  background: var(--ag-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.primary-btn:hover:not(:disabled) {
  background: var(--ag-accent-hover);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  padding: 14px 24px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  color: var(--ag-text);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.secondary-btn:hover:not(:disabled) {
  background: var(--ag-border);
}

.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.footer {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--ag-text-secondary);
}

.link {
  color: var(--ag-accent);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* Toast 提示样式 */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  color: var(--ag-text);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>