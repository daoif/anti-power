<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header">
      <h2 class="card-title">侧边栏设置</h2>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">启用补丁</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox">
      </label>
    </div>
    
    <div class="feature-list">
      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">Mermaid 流程图渲染</span>
          <p class="feature-desc">自动渲染 Mermaid 代码块为流程图</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox" :disabled="!model.enabled">
      </label>

      <div class="feature-item-group" :class="{ 'item-disabled': !model.enabled }">
        <label class="feature-item">
          <div class="feature-info">
            <span class="feature-name">数学公式渲染</span>
            <p class="feature-desc">使用 KaTeX/MathJax 渲染 LaTeX 公式</p>
          </div>
          <input type="checkbox" v-model="model.math" class="checkbox" :disabled="!model.enabled">
        </label>
        
        <div v-if="model.math" class="sub-options math-mode-options">
          <span class="sub-option-label">渲染模式（测试用）</span>
          <div class="style-options">
            <label class="style-option">
              <input type="radio" v-model="model.mathRenderMode" value="classic" :disabled="!model.enabled">
              <span>经典模式 (v2.0.1)</span>
            </label>
            <label class="style-option">
              <input type="radio" v-model="model.mathRenderMode" value="deferred" :disabled="!model.enabled">
              <span>延迟模式 (当前)</span>
            </label>
          </div>
          <p class="mode-hint">经典模式立即渲染，延迟模式等待内容稳定后渲染</p>
        </div>
      </div>

      <div class="feature-item-group" :class="{ 'item-disabled': !model.enabled }">
        <label class="feature-item">
          <div class="feature-info">
            <span class="feature-name">一键复制按钮</span>
            <p class="feature-desc">在内容区域添加复制按钮</p>
          </div>
          <input type="checkbox" v-model="model.copyButton" class="checkbox" :disabled="!model.enabled">
        </label>
        
        <button 
          v-if="model.copyButton" 
          type="button"
          class="expand-btn"
          @click="copyOptionsExpanded = !copyOptionsExpanded"
          :disabled="!model.enabled"
        >
          <span class="expand-icon">{{ copyOptionsExpanded ? '▼' : '▶' }}</span>
          <span>{{ copyOptionsExpanded ? '收起选项' : '展开选项' }}</span>
        </button>
        
        <div v-if="model.copyButton && copyOptionsExpanded" class="sub-options">
          <label class="sub-option">
            <input type="checkbox" v-model="model.copyButtonSmartHover" class="checkbox" :disabled="!model.enabled">
            <span class="sub-option-text">智能感应（鼠标在按钮附近才显示）</span>
          </label>
          
          <label class="sub-option">
            <input type="checkbox" v-model="copyBottomToFeedback" class="checkbox" :disabled="!model.enabled">
            <span class="sub-option-text">将底部按钮移动到反馈区</span>
          </label>
          
          <div class="sub-option-group">
            <span class="sub-option-label">按钮样式</span>
            <div class="style-options">
              <label class="style-option">
                <input type="radio" v-model="model.copyButtonStyle" value="arrow" :disabled="!model.enabled">
                <span>↓Copy 📋</span>
              </label>
              <label class="style-option">
                <input type="radio" v-model="model.copyButtonStyle" value="icon" :disabled="!model.enabled">
                <span>📋</span>
              </label>
              <label class="style-option">
                <input type="radio" v-model="model.copyButtonStyle" value="chinese" :disabled="!model.enabled">
                <span>复制 📋</span>
              </label>
              <label class="style-option custom-style">
                <input type="radio" v-model="model.copyButtonStyle" value="custom" :disabled="!model.enabled">
                <input 
                  type="text" 
                  v-model="model.copyButtonCustomText" 
                  class="custom-text-input"
                  placeholder="自定义文字"
                  :disabled="!model.enabled"
                  @click="model.copyButtonStyle = 'custom'"
                  @focus="model.copyButtonStyle = 'custom'"
                >
              </label>
            </div>
          </div>
        </div>
      </div>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">表格颜色修复</span>
          <p class="feature-desc">修复深色主题下表格文字不可见问题</p>
        </div>
        <input type="checkbox" v-model="model.tableColor" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">侧边栏字体大小</span>
          <p class="feature-desc">调整 Cascade 面板整体字体大小</p>
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
import { ref, computed } from 'vue';

export interface FeatureFlags {
  enabled: boolean;
  mermaid: boolean;
  math: boolean;
  mathRenderMode: 'classic' | 'deferred';
  copyButton: boolean;
  tableColor: boolean;
  fontSizeEnabled: boolean;
  fontSize: number;
  copyButtonSmartHover: boolean;
  copyButtonBottomPosition: 'float' | 'feedback';
  copyButtonStyle: 'arrow' | 'icon' | 'chinese' | 'custom';
  copyButtonCustomText: string;
}

const model = defineModel<FeatureFlags>({ required: true });

const copyOptionsExpanded = ref(false);

const copyBottomToFeedback = computed({
  get: () => model.value.copyButtonBottomPosition === 'feedback',
  set: (val: boolean) => {
    model.value.copyButtonBottomPosition = val ? 'feedback' : 'float';
  }
});
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

.card.is-disabled { opacity: 0.6; }

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

.feature-item.item-disabled,
.feature-item-group.item-disabled { opacity: 0.5; cursor: not-allowed; }

.feature-info { flex: 1; }

.feature-name { font-size: 14px; font-weight: 400; }

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

.checkbox:disabled { cursor: not-allowed; }

.feature-controls { display: flex; align-items: center; gap: 8px; }

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

.font-size-input:disabled { opacity: 0.5; cursor: not-allowed; }

.expand-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 4px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.expand-btn:hover:not(:disabled) {
  background: var(--ag-border);
  color: var(--ag-text);
}

.expand-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.expand-icon { font-size: 10px; }

.sub-options {
  margin-top: 12px;
  padding: 12px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
}

.sub-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
}

.sub-option-text { font-size: 13px; color: var(--ag-text); }

.sub-option-group { padding: 8px 0; }

.sub-option-label {
  font-size: 12px;
  color: var(--ag-text-secondary);
  margin-bottom: 8px;
  display: block;
}

.style-options { display: flex; flex-wrap: wrap; gap: 8px; }

.style-option {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s;
}

.style-option:hover { border-color: var(--ag-accent); }

.style-option input[type="radio"] {
  width: 14px;
  height: 14px;
  accent-color: var(--ag-accent);
}

.style-option.custom-style { flex: 1; min-width: 120px; }

.custom-text-input {
  flex: 1;
  padding: 4px 8px;
  background: var(--ag-bg);
  border: 1px solid var(--ag-border);
  border-radius: 4px;
  font-size: 12px;
  color: var(--ag-text);
  min-width: 60px;
}

.custom-text-input:disabled { opacity: 0.5; }

.custom-text-input:focus {
  outline: none;
  border-color: var(--ag-accent);
}

.math-mode-options {
  margin-top: 8px;
}

.mode-hint {
  font-size: 11px;
  color: var(--ag-text-secondary);
  margin: 8px 0 0;
  opacity: 0.8;
}
</style>
