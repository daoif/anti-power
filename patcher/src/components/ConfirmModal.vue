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
              <span class="badge badge-warning">覆盖</span>
              将修改的原始文件
            </h4>
            <ul class="file-list">
              <li v-for="file in modifiedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>

          <div v-if="addedFiles.length" class="file-section">
            <h4 class="section-title">
              <span class="badge badge-success">新增</span>
              将添加的文件/目录
            </h4>
            <ul class="file-list">
              <li v-for="file in addedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>

          <div v-if="deprecatedFiles.length" class="file-section">
            <h4 class="section-title">
              <span class="badge badge-error">清理</span>
              将删除的废弃文件
            </h4>
            <ul class="file-list">
              <li v-for="file in deprecatedFiles" :key="file">{{ file }}</li>
            </ul>
          </div>
        </div>

        <p class="note">
          <strong>注意：</strong>如果你对上述原始文件进行过自定义修改，这些修改将被覆盖。
          首次安装时会自动备份原文件（.bak）。
        </p>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('cancel')">取消</button>
        <button class="confirm-btn" @click="$emit('confirm')">确认安装</button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 12px;
  width: 440px;
  max-width: 95%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  font-size: 14px;
  color: var(--ag-text);
  margin: 0 0 20px;
}

.file-changes {
  background: var(--ag-surface-2);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.file-section {
  margin-bottom: 12px;
}

.file-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text);
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.badge-success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.file-list {
  margin: 0;
  padding: 0 0 0 16px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--ag-text-secondary);
}

.file-list li {
  margin-bottom: 4px;
}

.note {
  font-size: 12px;
  color: var(--ag-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.note strong {
  color: var(--ag-warning);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.cancel-btn {
  flex: 1;
  padding: 12px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  color: var(--ag-text);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.cancel-btn:hover {
  background: var(--ag-border);
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  background: var(--ag-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.confirm-btn:hover {
  background: var(--ag-accent-hover);
}
</style>
