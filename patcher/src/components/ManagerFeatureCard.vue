<template>
  <section class="card">
    <h2 class="card-title">Manager 窗口设置</h2>
    
    <div class="feature-list">
      <label class="feature-item is-disabled">
        <div class="feature-info">
          <span class="feature-name">Mermaid 流程图渲染</span>
          <p class="feature-desc">暂未支持，后续开放</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox" disabled>
      </label>

      <label class="feature-item is-disabled">
        <div class="feature-info">
          <span class="feature-name">数学公式渲染</span>
          <p class="feature-desc">暂未支持，后续开放</p>
        </div>
        <input type="checkbox" v-model="model.math" class="checkbox" disabled>
      </label>

      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">一键复制按钮</span>
          <p class="feature-desc">在消息区域添加复制按钮</p>
        </div>
        <input type="checkbox" v-model="model.copyButton" class="checkbox">
      </label>

      <label class="feature-item is-disabled">
        <div class="feature-info">
          <span class="feature-name">Manager 字体大小</span>
          <p class="feature-desc">暂未支持，后续开放</p>
        </div>
        <div class="feature-controls">
          <input type="checkbox" v-model="model.fontSizeEnabled" class="checkbox" disabled>
          <input
            type="number"
            v-model.number="model.fontSize"
            class="font-size-input"
            min="10"
            max="40"
            step="1"
            disabled
          >
        </div>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface ManagerFeatureFlags {
  mermaid: boolean;
  math: boolean;
  copyButton: boolean;
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
}

.card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
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
}

.feature-item.is-disabled {
  opacity: 0.45;
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
