<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header">
      <h2 class="card-title">Manager 窗口设置</h2>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">启用补丁</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox">
      </label>
    </div>

    <div v-if="model.enabled" class="warning-tip">
      ⚠️ 启用后，Antigravity 左下角会提示"安装似乎损坏"，这是预期行为。
    </div>
    
    <div class="feature-list">
      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">Mermaid 流程图渲染</span>
          <p class="feature-desc">渲染 Mermaid 语法的流程图、时序图等</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">数学公式渲染</span>
          <p class="feature-desc">渲染 LaTeX 数学公式 (KaTeX)</p>
        </div>
        <input type="checkbox" v-model="model.math" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">一键复制按钮</span>
          <p class="feature-desc">在消息区域添加复制按钮</p>
        </div>
        <input type="checkbox" v-model="model.copyButton" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">对话区域最大宽度</span>
          <p class="feature-desc">设置消息区域最大宽度占比 (%)</p>
        </div>
        <div class="feature-controls">
          <input type="checkbox" v-model="model.maxWidthEnabled" class="checkbox" :disabled="!model.enabled">
          <input
            type="number"
            v-model.number="model.maxWidthRatio"
            class="font-size-input"
            min="30"
            max="100"
            step="1"
            :disabled="!model.enabled || !model.maxWidthEnabled"
          >
        </div>
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">Manager 字体大小</span>
          <p class="feature-desc">自定义消息区域的字体大小 (px)</p>
        </div>
        <div class="feature-controls">
          <input type="checkbox" v-model="model.fontSizeEnabled" class="checkbox" :disabled="!model.enabled">
          <input
            type="number"
            v-model.number="model.fontSize"
            class="font-size-input"
            min="10"
            max="40"
            step="1"
            :disabled="!model.enabled || !model.fontSizeEnabled"
          >
        </div>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface ManagerFeatureFlags {
  enabled: boolean;
  mermaid: boolean;
  math: boolean;
  copyButton: boolean;
  maxWidthEnabled: boolean;
  maxWidthRatio: number;
  fontSizeEnabled: boolean;
  fontSize: number;
}

const model = defineModel<ManagerFeatureFlags>({ required: true });
</script>

<style scoped>
.card {
  background: var(--ag-surface);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--ag-border);
  transition: opacity 0.2s;
}

.card.is-disabled {
  opacity: 0.6;
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

.enable-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-label {
  font-size: 12px;
  color: var(--ag-text-secondary);
}

.warning-tip {
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #eab308;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 0;
  transition: opacity 0.2s;
}

.feature-item.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.feature-item.item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feature-item.is-disabled .checkbox,
.feature-item.is-disabled .font-size-input {
  cursor: not-allowed;
}

.feature-info { flex: 1; }

.feature-name {
  font-size: 14px;
  font-weight: 400;
}

.feature-desc {
  font-size: 12px;
  color: var(--ag-text-secondary);
  margin: 2px 0 0;
}

.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--ag-accent);
  cursor: pointer;
}

.checkbox:disabled {
  cursor: not-allowed;
}

.feature-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.font-size-input {
  width: 64px;
  padding: 6px 8px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text);
  text-align: center;
}

.font-size-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
