<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header">
      <h2 class="card-title">Manager 窗口设置</h2>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">启用补丁</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox">
      </label>
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

      <div class="feature-item-group" :class="{ 'item-disabled': !model.enabled }">
        <label class="feature-item">
          <div class="feature-info">
            <span class="feature-name">一键复制按钮</span>
            <p class="feature-desc">在消息区域添加复制按钮</p>
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
            <input type="checkbox" v-model="showBottomButton" class="checkbox" :disabled="!model.enabled">
            <span class="sub-option-text">显示底部按钮</span>
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
import { ref, computed } from 'vue';

export interface ManagerFeatureFlags {
  enabled: boolean;
  mermaid: boolean;
  math: boolean;
  copyButton: boolean;
  maxWidthEnabled: boolean;
  maxWidthRatio: number;
  fontSizeEnabled: boolean;
  fontSize: number;
  copyButtonSmartHover: boolean;
  copyButtonShowBottom: 'float' | 'feedback';
  copyButtonStyle: 'arrow' | 'icon' | 'chinese' | 'custom';
  copyButtonCustomText: string;
}

const model = defineModel<ManagerFeatureFlags>({ required: true });

const copyOptionsExpanded = ref(false);

const showBottomButton = computed({
  get: () => model.value.copyButtonShowBottom === 'float',
  set: (val: boolean) => {
    model.value.copyButtonShowBottom = val ? 'float' : 'feedback';
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
</style>
