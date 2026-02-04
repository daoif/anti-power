<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header" @click="isCollapsed = !isCollapsed">
      <div class="header-left">
        <span class="collapse-icon" :class="{ collapsed: isCollapsed }">▶</span>
        <h2 class="card-title">{{ $t('featureCard.title') }}</h2>
      </div>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">{{ $t('featureCard.enablePatch') }}</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox">
      </label>
    </div>
    
    <Transition name="collapse">
      <div class="feature-list" v-show="!isCollapsed">
        <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">{{ $t('featureCard.mermaid.title') }}</span>
          <p class="feature-desc">{{ $t('featureCard.mermaid.desc') }}</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox" :disabled="!model.enabled">
      </label>

      <div class="feature-item-group" :class="{ 'item-disabled': !model.enabled }">
        <label class="feature-item">
          <div class="feature-info">
            <span class="feature-name">{{ $t('featureCard.math.title') }}</span>
            <p class="feature-desc">{{ $t('featureCard.math.desc') }}</p>
          </div>
          <input type="checkbox" v-model="model.math" class="checkbox" :disabled="!model.enabled">
        </label>
      </div>

      <div class="feature-item-group" :class="{ 'item-disabled': !model.enabled }">
        <label class="feature-item">
          <div class="feature-info">
            <span class="feature-name">{{ $t('featureCard.copyButton.title') }}</span>
            <p class="feature-desc">{{ $t('featureCard.copyButton.desc') }}</p>
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
          <span>{{ copyOptionsExpanded ? $t('featureCard.copyButton.collapse') : $t('featureCard.copyButton.expand') }}</span>
        </button>
        
        <div v-if="model.copyButton && copyOptionsExpanded" class="sub-options">
          <label class="sub-option">
            <input type="checkbox" v-model="model.copyButtonSmartHover" class="checkbox" :disabled="!model.enabled">
            <span class="sub-option-text">{{ $t('featureCard.copyButton.smartHover') }}</span>
          </label>
          
          <label class="sub-option">
            <input type="checkbox" v-model="showBottomButton" class="checkbox" :disabled="!model.enabled">
            <span class="sub-option-text">{{ $t('featureCard.copyButton.showBottom') }}</span>
          </label>
          
          <div class="sub-option-group">
            <span class="sub-option-label">{{ $t('featureCard.copyButton.styleLabel') }}</span>
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
                <span>{{ $t('featureCard.copyButton.styleChinese') }}</span>
              </label>
              <label class="style-option custom-style">
                <input type="radio" v-model="model.copyButtonStyle" value="custom" :disabled="!model.enabled">
                <input 
                  type="text" 
                  v-model="model.copyButtonCustomText" 
                  class="custom-text-input"
                  :placeholder="$t('featureCard.copyButton.customPlaceholder')"
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
          <span class="feature-name">{{ $t('featureCard.tableColor.title') }}</span>
          <p class="feature-desc">{{ $t('featureCard.tableColor.desc') }}</p>
        </div>
        <input type="checkbox" v-model="model.tableColor" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">{{ $t('featureCard.fontSize.title') }}</span>
          <p class="feature-desc">{{ $t('featureCard.fontSize.desc') }}</p>
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
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

/**
 * Sidebar patch feature flags
 * @property enabled - Enable the sidebar patch
 * @property mermaid - Render Mermaid diagrams
 * @property math - Render LaTeX formulas
 * @property copyButton - Enable message copy controls
 * @property tableColor - Improve table contrast
 * @property fontSizeEnabled - Override the message font size
 * @property fontSize - Custom message font size
 * @property copyButtonSmartHover - Reveal the copy button when the pointer is nearby
 * @property copyButtonShowBottom - Choose the floating or feedback placement
 * @property copyButtonStyle - Choose the copy label or icon style
 * @property copyButtonCustomText - Label for the custom style
 */
export interface FeatureFlags {
  enabled: boolean;
  mermaid: boolean;
  math: boolean;
  copyButton: boolean;
  tableColor: boolean;
  fontSizeEnabled: boolean;
  fontSize: number;
  copyButtonSmartHover: boolean;
  copyButtonShowBottom: 'float' | 'feedback';
  copyButtonStyle: 'arrow' | 'icon' | 'chinese' | 'custom';
  copyButtonCustomText: string;
}

const model = defineModel<FeatureFlags>({ required: true });

const isCollapsed = ref(false);

const copyOptionsExpanded = ref(false);

/**
 * Bind the checkbox to the floating or feedback placement
 */
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
  background-image: var(--ag-gradient-surface);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  border: 1px solid var(--ag-border);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  animation: card-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.15s backwards;
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

.card:hover {
  border-color: var(--ag-border-hover);
}

.card.is-disabled {
  opacity: 0.45;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ag-border);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  margin: -18px -20px 0;
  padding: 18px 20px 14px;
}

.card-header:hover {
  background: var(--ag-surface-3);
}

.card-header:hover .card-title {
  color: var(--ag-text-secondary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-icon {
  font-size: 11px;
  color: var(--ag-accent);
  transition: transform var(--transition-fast);
  transform: rotate(90deg);
  display: inline-block;
}

.collapse-icon.collapsed {
  transform: rotate(0deg);
}

.card-title {
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

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.feature-item:hover {
  background: rgba(51, 118, 205, 0.05);
}

.feature-item.item-disabled,
.feature-item-group.item-disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ag-text-strong);
  line-height: 1.4;
}

.feature-desc {
  font-size: 11px;
  color: var(--ag-text-tertiary);
  margin: 3px 0 0;
  line-height: 1.5;
}

.feature-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.font-size-input {
  width: 60px;
  padding: 6px 8px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text);
  text-align: center;
  transition: all var(--transition-fast);
}

.font-size-input:hover:not(:disabled) {
  border-color: var(--ag-border-hover);
  background: var(--ag-surface-3);
}

.font-size-input:focus {
  border-color: var(--ag-accent);
  box-shadow: var(--ag-ring);
  outline: none;
  background: var(--ag-surface-2);
}

.font-size-input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 6px;
  margin-left: 8px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 500;
  color: var(--ag-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.expand-btn:hover:not(:disabled) {
  background: var(--ag-surface-3);
  border-color: var(--ag-border-hover);
  color: var(--ag-text-secondary);
  transform: translateY(-1px);
}

.expand-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.expand-icon {
  font-size: 9px;
  color: var(--ag-accent);
  transition: transform var(--transition-fast);
}

.sub-options {
  margin-top: 10px;
  margin-left: 8px;
  padding: 14px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sub-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  margin: 0 -6px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.sub-option:hover {
  background: rgba(255, 255, 255, 0.03);
}

.sub-option-text {
  font-size: 12px;
  font-weight: 400;
  color: var(--ag-text-strong);
}

.sub-option-group {
  padding: 10px 0 4px;
}

.sub-option-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ag-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
  display: block;
}

.style-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.style-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  color: var(--ag-text);
  transition: all var(--transition-fast);
}

.style-option:hover {
  border-color: var(--ag-accent);
  background: var(--ag-accent-subtle);
}

.style-option:has(input:checked) {
  border-color: var(--ag-accent);
  background: var(--ag-accent-subtle);
  box-shadow: 0 0 0 1px var(--ag-accent-subtle);
}

.style-option.custom-style {
  flex: 1;
  min-width: 120px;
}

.custom-text-input {
  flex: 1;
  padding: 5px 8px;
  background: var(--ag-bg);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--ag-text);
  min-width: 50px;
  transition: all var(--transition-fast);
}

.custom-text-input:disabled {
  opacity: 0.35;
}

.custom-text-input:focus {
  outline: none;
  border-color: var(--ag-accent);
  box-shadow: var(--ag-ring);
}

.custom-text-input::placeholder {
  color: var(--ag-text-muted);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 500px;
  opacity: 1;
  transform: translateY(0);
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
  margin-top: 0 !important;
}
</style>
