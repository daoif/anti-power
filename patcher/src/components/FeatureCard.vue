<template>
  <section class="card">
    <h2 class="card-title">侧边栏设置</h2>
    
    <div class="feature-list">
      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">Mermaid 流程图渲染</span>
          <p class="feature-desc">自动渲染 Mermaid 代码块为流程图</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox">
      </label>

      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">数学公式渲染</span>
          <p class="feature-desc">使用 KaTeX/MathJax 渲染 LaTeX 公式</p>
        </div>
        <input type="checkbox" v-model="model.math" class="checkbox">
      </label>

      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">一键复制按钮</span>
          <p class="feature-desc">在内容区域添加复制按钮</p>
        </div>
        <input type="checkbox" v-model="model.copyButton" class="checkbox">
      </label>

      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">表格颜色修复</span>
          <p class="feature-desc">修复深色主题下表格文字不可见问题</p>
        </div>
        <input type="checkbox" v-model="model.tableColor" class="checkbox">
      </label>

      <label class="feature-item">
        <div class="feature-info">
          <span class="feature-name">侧边栏字体大小</span>
          <p class="feature-desc">调整 Cascade 面板整体字体大小</p>
        </div>
        <div class="feature-controls">
          <input type="checkbox" v-model="model.fontSizeEnabled" class="checkbox">
          <input
            type="number"
            v-model.number="model.fontSize"
            class="font-size-input"
            min="10"
            max="40"
            step="1"
            :disabled="!model.fontSizeEnabled"
          >
        </div>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface FeatureFlags {
  mermaid: boolean;
  math: boolean;
  copyButton: boolean;
  tableColor: boolean;
  fontSizeEnabled: boolean;
  fontSize: number;
}

const model = defineModel<FeatureFlags>({ required: true });
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
