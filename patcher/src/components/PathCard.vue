<template>
  <section class="card">
    <div class="card-header">
      <h2 class="card-title">安装目录</h2>
      <button 
        @click="$emit('detect')"
        :disabled="isDetecting"
        class="link-btn"
      >
        {{ isDetecting ? '检测中...' : '重新检测' }}
      </button>
    </div>
    
    <div class="path-row">
      <input 
        type="text"
        class="path-input"
        :class="{ placeholder: !modelValue }"
        :value="modelValue || ''"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        placeholder="未检测到 Antigravity 安装目录"
      >
      <button class="secondary-btn" @click="$emit('browse')">浏览...</button>
    </div>

    <!-- 折叠区域：目标目录 -->
    <details v-if="modelValue" class="target-details">
      <summary class="details-summary">
        <span class="summary-icon">▶</span>
        查看目标路径
      </summary>
      <div class="target-list">
        <div class="target-item">
          <div class="target-header">
            <span class="target-label">cascade-panel 增强</span>
            <button class="open-btn" @click="openTargetDir(targetPath)" title="打开目录">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          </div>
          <code class="target-path">{{ targetPath }}</code>
        </div>
        <div class="target-item">
          <div class="target-header">
            <span class="target-label">Agent Manager 窗口增强</span>
            <button class="open-btn" @click="openTargetDir(managerTargetPath)" title="打开目录">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          </div>
          <code class="target-path">{{ managerTargetPath }}</code>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { openPath } from '@tauri-apps/plugin-opener';

const props = defineProps<{
  modelValue: string | null;
  isDetecting: boolean;
}>();

defineEmits(['detect', 'browse', 'update:modelValue']);

function normalizeBasePath(path: string): string {
  const sep = path.includes('/') ? '/' : '\\';
  const lower = path.toLowerCase();
  const resourcesAppSuffix = `${sep}resources${sep}app`;
  const resourcesSuffix = `${sep}resources`;

  if (lower.endsWith(resourcesAppSuffix)) {
    return path.slice(0, -resourcesAppSuffix.length);
  }

  if (lower.endsWith(resourcesSuffix)) {
    return path.slice(0, -resourcesSuffix.length);
  }

  if (lower.endsWith('.app')) {
    return `${path}${sep}Contents`;
  }

  return path;
}

function getResourcesDir(basePath: string): string {
  const sep = basePath.includes('/') ? '/' : '\\';
  const lower = basePath.toLowerCase();
  if (lower.includes('.app') || lower.includes(`${sep}contents`)) {
    return 'Resources';
  }
  return 'resources';
}

// 计算目标路径
const targetPath = computed(() => {
  if (!props.modelValue) return '';
  const basePath = normalizeBasePath(props.modelValue);
  const sep = basePath.includes('/') ? '/' : '\\';
  const resourcesDir = getResourcesDir(basePath);
  return `${basePath}${sep}${resourcesDir}${sep}app${sep}extensions${sep}antigravity`;
});

const managerTargetPath = computed(() => {
  if (!props.modelValue) return '';
  const basePath = normalizeBasePath(props.modelValue);
  const sep = basePath.includes('/') ? '/' : '\\';
  const resourcesDir = getResourcesDir(basePath);
  return `${basePath}${sep}${resourcesDir}${sep}app${sep}out${sep}vs${sep}code${sep}electron-browser${sep}workbench`;
});

// 打开目标目录
async function openTargetDir(path: string) {
  if (!path) return;
  try {
    await openPath(path);
  } catch (e) {
    console.error('打开目录失败:', e);
  }
}
</script>

<style scoped>
.card {
  background: var(--ag-surface);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--ag-border);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.link-btn {
  background: none;
  border: none;
  color: var(--ag-accent);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.link-btn:hover {
  color: var(--ag-accent-hover);
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.path-row {
  display: flex;
  gap: 12px;
}

.path-input {
  flex: 1;
  padding: 12px 16px;
  background: var(--ag-surface-2);
  border-radius: 6px;
  border: 1px solid var(--ag-border);
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--ag-text);
  outline: none;
  transition: border-color 0.15s;
}

.path-input:focus {
  border-color: var(--ag-accent);
}

.path-input::placeholder {
  color: var(--ag-text-secondary);
  font-style: italic;
  font-family: inherit;
}

.secondary-btn {
  padding: 12px 16px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  color: var(--ag-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.secondary-btn:hover:not(:disabled) {
  background: var(--ag-border);
}



/* 折叠区域样式 */
.target-details {
  margin-top: 12px;
}

.details-summary {
  font-size: 12px;
  color: var(--ag-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
  list-style: none;
}

.details-summary::-webkit-details-marker {
  display: none;
}

.details-summary:hover {
  color: var(--ag-text);
}

.summary-icon {
  font-size: 8px;
  transition: transform 0.15s;
}

.target-details[open] .summary-icon {
  transform: rotate(90deg);
}

.target-list {
  margin-top: 8px;
  padding: 12px;
  background: var(--ag-surface-2);
  border-radius: 6px;
  border: 1px solid var(--ag-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.target-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.target-label {
  font-size: 11px;
  color: var(--ag-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.target-path {
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--ag-accent);
  word-break: break-all;
  background: transparent;
  padding: 0;
}

.target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.open-btn {
  background: none;
  border: none;
  color: var(--ag-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.open-btn:hover {
  background: var(--ag-border);
  color: var(--ag-accent);
}
</style>
