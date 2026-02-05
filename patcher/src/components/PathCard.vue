<template>
  <section class="card">
    <div class="card-header">
      <h2 class="card-title">{{ $t('pathCard.title') }}</h2>
      <button 
        @click="$emit('detect')"
        :disabled="isDetecting"
        class="link-btn"
      >
        {{ isDetecting ? $t('pathCard.detecting') : $t('pathCard.detectButton') }}
      </button>
    </div>
    
    <div class="path-row">
      <input 
        type="text"
        class="path-input"
        :class="{ placeholder: !modelValue }"
        :value="modelValue || ''"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :placeholder="$t('pathCard.placeholder')"
      >
      <button class="secondary-btn" @click="$emit('browse')">{{ $t('actions.browse') }}</button>
    </div>

    <!-- 折叠区域：目标目录 -->
    <details v-if="modelValue" class="target-details">
      <summary class="details-summary">
        <span class="summary-icon">▶</span>
        {{ $t('pathCard.viewTarget') }}
      </summary>
      <div class="target-list">
        <div class="target-item">
          <div class="target-header">
            <span class="target-label">{{ $t('pathCard.targetLabelCascade') }}</span>
            <button class="open-btn" @click="openTargetDir(targetPath)" :title="$t('pathCard.openDir')">
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
            <span class="target-label">{{ $t('pathCard.targetLabelManager') }}</span>
            <button class="open-btn" @click="openTargetDir(managerTargetPath)" :title="$t('pathCard.openDir')">
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
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  modelValue: string | null;
  isDetecting: boolean;
}>();

defineEmits(['detect', 'browse', 'update:modelValue']);

/**
 * 规范化基础路径
 * 处理不同格式的路径，统一转换为标准格式
 * @param path - 原始路径
 * @returns 规范化后的路径
 */
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

/**
 * 获取资源目录名称
 * macOS 使用 "Resources"，其他平台使用 "resources"
 * @param basePath - 基础路径
 * @returns 资源目录名称
 */
function getResourcesDir(basePath: string): string {
  const sep = basePath.includes('/') ? '/' : '\\';
  const lower = basePath.toLowerCase();
  if (lower.includes('.app') || lower.includes(`${sep}contents`)) {
    return 'Resources';
  }
  return 'resources';
}

/**
 * 侧边栏补丁目标路径
 * 计算 cascade-panel 的安装目标目录
 */
const targetPath = computed(() => {
  if (!props.modelValue) return '';
  const basePath = normalizeBasePath(props.modelValue);
  const sep = basePath.includes('/') ? '/' : '\\';
  const resourcesDir = getResourcesDir(basePath);
  return `${basePath}${sep}${resourcesDir}${sep}app${sep}extensions${sep}antigravity`;
});

/**
 * Manager 补丁目标路径
 * 计算 manager-panel 的安装目标目录
 */
const managerTargetPath = computed(() => {
  if (!props.modelValue) return '';
  const basePath = normalizeBasePath(props.modelValue);
  const sep = basePath.includes('/') ? '/' : '\\';
  const resourcesDir = getResourcesDir(basePath);
  return `${basePath}${sep}${resourcesDir}${sep}app${sep}out${sep}vs${sep}code${sep}electron-browser${sep}workbench`;
});

/**
 * 打开目标目录
 * 使用系统默认文件管理器打开指定路径
 * @param path - 要打开的目录路径
 */
async function openTargetDir(path: string) {
  if (!path) return;
  try {
    await openPath(path);
  } catch (e) {
    console.error(t('pathCard.error.openDir'), e);
  }
}
</script>

<style scoped>
.card {
  background: var(--ag-surface);
  background-image: var(--ag-gradient-surface);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  border: 1px solid var(--ag-border);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  animation: card-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  pointer-events: none;
}

.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 50%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.card:hover {
  border-color: var(--ag-border-hover);
}

.card:hover::after {
  opacity: 1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -18px -20px 0;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--ag-border);
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--ag-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.link-btn {
  background: none;
  border: none;
  color: var(--ag-accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
}

.link-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--ag-accent);
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.link-btn:hover {
  color: var(--ag-accent-hover);
}

.link-btn:hover::before {
  opacity: 0.1;
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.path-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.path-input {
  flex: 1;
  padding: 12px 16px;
  background: var(--ag-surface-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--ag-border);
  font-size: 13px;
  font-family: var(--ag-font-mono);
  color: var(--ag-text-strong);
  outline: none;
  transition: all var(--transition-fast);
}

.path-input:hover {
  border-color: var(--ag-border-hover);
  background: var(--ag-surface-3);
}

.path-input:focus {
  border-color: var(--ag-accent);
  box-shadow: var(--ag-ring);
  background: var(--ag-surface-2);
}

.path-input::placeholder {
  color: var(--ag-text-muted);
  font-style: italic;
  font-family: var(--ag-font-sans);
}

.secondary-btn {
  padding: 12px 18px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  color: var(--ag-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.secondary-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%);
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

/* 目标目录折叠区域 */
.target-details {
  margin-top: 14px;
}

.details-summary {
  font-size: 11px;
  color: var(--ag-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  list-style: none;
  padding: 8px 0;
  transition: color var(--transition-fast);
}

.details-summary::-webkit-details-marker {
  display: none;
}

.details-summary:hover {
  color: var(--ag-text-secondary);
}

.summary-icon {
  font-size: 11px;
  transition: transform var(--transition-fast);
  color: var(--ag-accent);
}

.target-details[open] .summary-icon {
  transform: rotate(90deg);
}

.target-list {
  margin-top: 12px;
  padding: 14px 16px;
  background: var(--ag-surface-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--ag-border);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.target-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.target-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ag-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.target-path {
  font-size: 11px;
  font-family: var(--ag-font-mono);
  color: var(--ag-accent);
  word-break: break-all;
  background: transparent;
  padding: 0;
  line-height: 1.5;
}

.target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.open-btn {
  background: none;
  border: none;
  color: var(--ag-text-muted);
  cursor: pointer;
  padding: 5px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.open-btn:hover {
  background: var(--ag-surface-3);
  color: var(--ag-accent);
  transform: scale(1.05);
}
</style>
