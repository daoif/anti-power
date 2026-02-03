<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      
      <div class="modal-body">
        <div class="warning-icon">⚠️</div>
        <p class="warning-text">{{ message }}</p>

        <div class="file-changes">
          <div v-if="modifiedFiles.length" class="file-section">
            <h4 class="section-title">
              <span class="badge badge-warning">{{ $t('confirmModal.badgeModified') }}</span>
              {{ $t('confirmModal.modified') }}
            </h4>
            <ul class="file-list">
              <li v-for="file in modifiedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>

          <div v-if="addedFiles.length" class="file-section">
            <h4 class="section-title">
              <span class="badge badge-success">{{ $t('confirmModal.badgeAdded') }}</span>
              {{ $t('confirmModal.added') }}
            </h4>
            <ul class="file-list">
              <li v-for="file in addedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>

          <div v-if="deprecatedFiles.length" class="file-section">
            <h4 class="section-title">
              <span class="badge badge-error">{{ $t('confirmModal.badgeDeprecated') }}</span>
              {{ $t('confirmModal.deprecated') }}
            </h4>
            <ul class="file-list">
              <li v-for="file in deprecatedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>
        </div>

        <p class="note">
          <strong>{{ $t('confirmModal.note') }}</strong>{{ $t('confirmModal.noteContent') }}
        </p>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('cancel')">{{ $t('confirmModal.cancel') }}</button>
        <button class="confirm-btn" @click="$emit('confirm')">{{ $t('confirmModal.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
  title?: string;
  message?: string;
  modifiedFiles: string[];
  addedFiles: string[];
  deprecatedFiles: string[];
}>();

defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.2s ease-out;
}

.modal {
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-xl);
  width: 440px;
  max-width: 95%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--ag-shadow-xl);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  pointer-events: none;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--ag-text-strong);
}

.close-btn {
  background: none;
  border: none;
  color: var(--ag-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--ag-text);
  background: rgba(255, 255, 255, 0.08);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.warning-icon {
  font-size: 32px;
  text-align: center;
  margin-bottom: 12px;
}

.warning-text {
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--ag-text-strong);
  margin: 0 0 20px;
  line-height: 1.5;
}

.file-changes {
  background: var(--ag-surface-2);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 16px;
  border: 1px solid var(--ag-border);
}

.file-section {
  margin-bottom: 14px;
}

.file-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--ag-text-strong);
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-warning {
  background: var(--ag-warning-subtle);
  color: var(--ag-warning);
}

.badge-success {
  background: var(--ag-success-subtle);
  color: var(--ag-success);
}

.badge-error {
  background: var(--ag-error-subtle);
  color: var(--ag-error);
}

.file-list {
  margin: 0;
  padding: 0 0 0 16px;
  font-size: 11px;
  font-family: var(--ag-font-mono);
  color: var(--ag-text-secondary);
  line-height: 1.7;
}

.file-list li {
  margin-bottom: 3px;
}

.file-list li:last-child {
  margin-bottom: 0;
}

.note {
  font-size: 11px;
  color: var(--ag-text-tertiary);
  margin: 0;
  line-height: 1.6;
  padding: 10px 12px;
  background: var(--ag-warning-subtle);
  border-radius: var(--radius-md);
  border: 1px solid rgba(245, 158, 11, 0.15);
}

.note strong {
  color: var(--ag-warning);
  font-weight: 600;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.cancel-btn {
  flex: 1;
  padding: 11px 14px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  color: var(--ag-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cancel-btn:hover {
  background: var(--ag-surface-3);
  border-color: var(--ag-border-hover);
  color: var(--ag-text);
  transform: translateY(-1px);
}

.confirm-btn {
  flex: 1;
  padding: 11px 14px;
  background: var(--ag-accent-gradient);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.confirm-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15), transparent);
  pointer-events: none;
  border-radius: inherit;
}

.confirm-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: var(--ag-shadow-accent-lg);
}
</style>
