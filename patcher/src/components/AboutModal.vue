<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">关于</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div class="about-logo">
          <img src="../assets/logo.png" alt="logo" class="about-icon" />
        </div>
        
        <h3 class="about-name">Anti-Power</h3>
        <p class="about-version">版本 {{ version }}</p>
        
        <p class="about-desc">
          Antigravity AI IDE 增强补丁管理工具，让你的 AI 对话体验更上一层楼。
        </p>
        
        <p class="about-qq">
          QQ 交流群: <a href="#" @click.prevent="openQQGroup" class="qq-link">993975349</a>
        </p>

        <div class="about-actions">
          <button 
            class="about-btn"
            @click="checkUpdate"
            :disabled="isCheckingUpdate"
          >
            {{ isCheckingUpdate ? '检查中...' : '检查更新' }}
          </button>
          <button class="about-btn" @click="openGitHub">
            GitHub 仓库
          </button>
        </div>

        <div v-if="updateInfo" class="update-info">
          <template v-if="updateInfo.hasUpdate">
            <p class="update-available">
              🎉 发现新版本: v{{ updateInfo.latestVersion }}
            </p>
            <button class="primary-btn update-btn" @click="openGitHub">
              前往下载
            </button>
          </template>
          <template v-else>
            <p class="update-latest">✓ 已是最新版本</p>
          </template>
        </div>
      </div>

      <div class="modal-footer">
        <p>© 2026 Anti-Power · MIT License</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  show: boolean;
  version: string;
  githubUrl: string;
}>();

defineEmits(['close']);

const isCheckingUpdate = ref(false);
const updateInfo = ref<{ hasUpdate: boolean; latestVersion: string } | null>(null);

// Compare numeric version components
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

async function checkUpdate() {
  isCheckingUpdate.value = true;
  updateInfo.value = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`https://api.github.com/repos/daoif/anti-power/releases/latest`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      const latestVersion = data.tag_name?.replace('v', '') || data.name;
      updateInfo.value = {
        hasUpdate: compareVersions(latestVersion, props.version) > 0,
        latestVersion
      };
    } else {
      updateInfo.value = { hasUpdate: false, latestVersion: '检查失败' };
    }
  } catch (e) {
    console.error("检查更新失败:", e);
    updateInfo.value = { hasUpdate: false, latestVersion: '网络错误' };
  } finally {
    isCheckingUpdate.value = false;
  }
}

async function openGitHub() {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(props.githubUrl);
}

async function openQQGroup() {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl('https://qm.qq.com/q/AHUKoyLVKg');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 12px;
  width: 360px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ag-border);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--ag-text-secondary);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--ag-text);
}

.modal-body {
  padding: 24px 20px;
  text-align: center;
}

.about-logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  border-radius: 16px;
  overflow: hidden;
}

.about-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.about-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
}

.about-version {
  color: var(--ag-text-secondary);
  font-size: 13px;
  margin: 0 0 16px;
}

.about-desc {
  font-size: 13px;
  color: var(--ag-text-secondary);
  line-height: 1.5;
  margin: 0 0 12px;
}

.about-qq {
  font-size: 13px;
  color: var(--ag-text-secondary);
  margin: 0 0 16px;
}

.qq-link {
  color: var(--ag-accent);
  text-decoration: none;
  font-weight: 500;
}

.qq-link:hover {
  text-decoration: underline;
}

.about-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.about-btn {
  padding: 10px 16px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  color: var(--ag-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.about-btn:hover:not(:disabled) {
  background: var(--ag-border);
}

.about-btn:disabled {
  opacity: 0.5;
}

.update-info {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--ag-border);
}

.update-available {
  color: var(--ag-success);
  font-size: 14px;
  margin: 0 0 12px;
}

.update-latest {
  color: var(--ag-text-secondary);
  font-size: 13px;
  margin: 0;
}

.primary-btn {
  padding: 10px 20px;
  background: var(--ag-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.primary-btn:hover {
  background: var(--ag-accent-hover);
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--ag-border);
  text-align: center;
}

.modal-footer p {
  font-size: 11px;
  color: var(--ag-text-secondary);
  margin: 0;
}
</style>
