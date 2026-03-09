<template>
  <div v-if="show" class="sv-overlay" @click.self="$emit('close')">
    <div class="sv-modal">
      <div class="sv-header">
        <h2 class="sv-title">{{ $t('sessionViewer.title') }}</h2>
        <div class="sv-header-actions">
          <select v-model="filterProvider" class="sv-filter-select">
            <option value="">{{ $t('sessionViewer.filterAll') }}</option>
            <option v-for="p in providerIds" :key="p" :value="p">
              {{ $t(`sessionViewer.providers.${p}`) }}
            </option>
          </select>
          <button class="sv-close-btn" @click="$emit('close')">×</button>
        </div>
      </div>

      <div class="sv-body">
        <div class="sv-list-pane">
          <div class="sv-search">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('sessionViewer.searchPlaceholder')"
              class="sv-search-input"
            />
          </div>
          <div class="sv-list-meta">
            <span class="sv-count">{{ $t('sessionViewer.sessionCount', { count: filteredSessions.length }) }}</span>
            <label v-if="filteredSessions.length > 0" class="sv-select-all" @click.stop>
              <input type="checkbox" :checked="isAllChecked" @change="toggleAllChecked" />
              <span>{{ $t('sessionViewer.selectAll') }}</span>
            </label>
          </div>
          <div v-if="isScanning" class="sv-empty">{{ $t('sessionViewer.scanning') }}</div>
          <div v-else-if="filteredSessions.length === 0" class="sv-empty">{{ $t('sessionViewer.noSessions') }}</div>
          <div v-else class="sv-list">
            <button
              v-for="s in filteredSessions"
              :key="s.sourcePath"
              :class="['sv-item', { active: selectedSession?.sourcePath === s.sourcePath, checked: checkedSessions.has(s.sourcePath) }]"
              @click="selectSession(s)"
            >
              <input
                type="checkbox"
                class="sv-item-checkbox"
                :checked="checkedSessions.has(s.sourcePath)"
                @click.stop
                @change="toggleCheck(s.sourcePath)"
              />
              <span :class="['sv-provider-badge', `sv-provider-${s.providerId}`]">
                {{ providerShort(s.providerId) }}
              </span>
              <div class="sv-item-info">
                <div class="sv-item-title">{{ s.title || s.sessionId.slice(0, 12) }}</div>
                <div class="sv-item-time">{{ formatRelativeTime(s.lastActiveAt) }}</div>
              </div>
            </button>
          </div>
          <div v-if="checkedCount > 0" class="sv-batch-bar">
            <span class="sv-batch-count">{{ $t('sessionViewer.selectedCount', { count: checkedCount }) }}</span>
            <button class="sv-batch-delete-btn" :disabled="isDeleting" @click="batchDelete">
              {{ isDeleting ? '...' : $t('sessionViewer.batchDelete') }}
            </button>
          </div>
        </div>

        <div class="sv-msg-pane">
          <template v-if="!selectedSession">
            <div class="sv-empty-msg">{{ $t('sessionViewer.noMessages') }}</div>
          </template>
          <template v-else>
            <div class="sv-msg-header">
              <div class="sv-msg-title-row">
                <span :class="['sv-provider-badge', `sv-provider-${selectedSession.providerId}`]">
                  {{ $t(`sessionViewer.providers.${selectedSession.providerId}`) }}
                </span>
                <span class="sv-msg-session-title">{{ selectedSession.title || selectedSession.sessionId.slice(0, 12) }}</span>
                <button
                  class="sv-delete-btn"
                  :disabled="isDeleting"
                  :title="$t('sessionViewer.deleteSession')"
                  @click="deleteSession"
                >
                  {{ isDeleting ? '...' : '🗑' }}
                </button>
              </div>
              <div class="sv-msg-meta">
                <span v-if="selectedSession.projectDir" class="sv-meta-item" :title="selectedSession.projectDir">
                  {{ $t('sessionViewer.projectDir') }}: {{ pathBasename(selectedSession.projectDir) }}
                </span>
                <span v-if="selectedSession.lastActiveAt" class="sv-meta-item">
                  {{ new Date(selectedSession.lastActiveAt).toLocaleString() }}
                </span>
                <span v-if="messages.length" class="sv-meta-item">
                  {{ $t('sessionViewer.messageCount', { count: messages.length }) }}
                </span>
              </div>
            </div>
            <div v-if="isLoadingMessages" class="sv-empty-msg">{{ $t('sessionViewer.loadingMessages') }}</div>
            <div v-else class="sv-messages">
              <div
                v-for="(msg, idx) in messages"
                :key="idx"
                :class="['sv-message', `sv-role-${msg.role}`]"
              >
                <div class="sv-message-head">
                  <span :class="['sv-role-label', `sv-role-color-${msg.role}`]">
                    {{ $t(`sessionViewer.roles.${msg.role}`, msg.role) }}
                  </span>
                  <span v-if="msg.ts" class="sv-message-time">{{ new Date(msg.ts).toLocaleTimeString() }}</span>
                  <button class="sv-copy-btn" @click="copyText(msg.content)" :title="$t('sessionViewer.copyMessage')">
                    {{ copiedIdx === idx ? '✓' : '⎘' }}
                  </button>
                </div>
                <div class="sv-message-body">{{ msg.content }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  show: boolean;
}>();

defineEmits(['close']);

/**
 * Metadata for a local session before its messages are loaded
 */
interface SessionMeta {
  providerId: string;
  sessionId: string;
  title: string | null;
  summary: string | null;
  projectDir: string | null;
  createdAt: number | null;
  lastActiveAt: number | null;
  sourcePath: string;
}

/**
 * Message in a local session
 */
interface SessionMessage {
  role: string;
  content: string;
  ts: number | null;
}

const providerIds = ['claude', 'codex', 'gemini', 'opencode', 'openclaw'];

const sessions = ref<SessionMeta[]>([]);
const messages = ref<SessionMessage[]>([]);
const selectedSession = ref<SessionMeta | null>(null);
const isScanning = ref(false);
const isLoadingMessages = ref(false);
const filterProvider = ref('');
const searchQuery = ref('');
const copiedIdx = ref<number | null>(null);
const isDeleting = ref(false);
const checkedSessions = ref(new Set<string>());

const checkedCount = computed(() => checkedSessions.value.size);

const isAllChecked = computed(() =>
  filteredSessions.value.length > 0 &&
  filteredSessions.value.every(s => checkedSessions.value.has(s.sourcePath))
);

const filteredSessions = computed(() => {
  let list = sessions.value;

  if (filterProvider.value) {
    list = list.filter(s => s.providerId === filterProvider.value);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(s =>
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.summary && s.summary.toLowerCase().includes(q)) ||
      (s.projectDir && s.projectDir.toLowerCase().includes(q)) ||
      s.sessionId.toLowerCase().includes(q)
    );
  }
  return list;
});

// Rescan when the viewer opens and clear selections and messages on close
watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      await loadSessions();
    } else {
      selectedSession.value = null;
      messages.value = [];
      checkedSessions.value = new Set();
    }
  },
);

/**
 * Scan session files for all supported providers
 */
async function loadSessions() {
  isScanning.value = true;
  try {
    sessions.value = await invoke<SessionMeta[]>('scan_sessions', {
      providers: providerIds,
    });
  } catch (e) {
    console.error('scan_sessions failed:', e);
    sessions.value = [];
  } finally {
    isScanning.value = false;
  }
}

/**
 * Load messages for the selected local session
 * @param session - Provider and source path for the selection
 */
async function selectSession(session: SessionMeta) {
  selectedSession.value = session;
  isLoadingMessages.value = true;
  messages.value = [];
  try {
    messages.value = await invoke<SessionMessage[]>('load_session_messages', {
      providerId: session.providerId,
      sourcePath: session.sourcePath,
    });
  } catch (e) {
    console.error('load_session_messages failed:', e);
    messages.value = [];
  } finally {
    isLoadingMessages.value = false;
  }
}

/**
 * Format a timestamp with the viewer's localized relative time labels
 * @param ts - Unix timestamp in milliseconds
 * @returns Relative time text, or an empty string when absent
 */
function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return '';

  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return t('sessionViewer.timeAgo.justNow');
  if (minutes < 60) return t('sessionViewer.timeAgo.minutesAgo', { n: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('sessionViewer.timeAgo.hoursAgo', { n: hours });

  const days = Math.floor(hours / 24);
  if (days < 7) return t('sessionViewer.timeAgo.daysAgo', { n: days });

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t('sessionViewer.timeAgo.weeksAgo', { n: weeks });

  const months = Math.floor(days / 30);
  return t('sessionViewer.timeAgo.monthsAgo', { n: months });
}

/**
 * Use a short badge label for each provider
 * @param id - Session provider ID
 * @returns Provider abbreviation or the first two letters of its ID in capitals
 */
function providerShort(id: string): string {
  const map: Record<string, string> = {
    claude: 'CC',
    codex: 'CX',
    gemini: 'GM',
    opencode: 'OC',
    openclaw: 'OW',
  };

  return map[id] || id.slice(0, 2).toUpperCase();
}

/**
 * Handle both Windows and Unix path separators
 * @param p - Session file or directory path
 * @returns Final path component, or the original path if empty
 */
function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

/**
 * Update the copied indicator only after a successful clipboard write
 * @param text - Message to copy
 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    const idx = messages.value.findIndex(m => m.content === text);
    copiedIdx.value = idx;
    setTimeout(() => {
      copiedIdx.value = null;
    }, 1500);
  } catch {
    // Ignore clipboard failures so the viewer stays usable
  }
}

/**
 * Confirm deletion before removing the selected session
 */
async function deleteSession() {
  if (!selectedSession.value || isDeleting.value) return;

  const session = selectedSession.value;
  const displayName = session.title || session.sessionId.slice(0, 12);

  const confirmed = await ask(
    t('sessionViewer.deleteConfirmMessage', { name: displayName }),
    { title: t('sessionViewer.deleteConfirmTitle'), kind: 'warning' }
  );
  if (!confirmed) return;

  isDeleting.value = true;
  try {
    await invoke('delete_session', {
      providerId: session.providerId,
      sourcePath: session.sourcePath,
      sessionId: session.sessionId,
    });
    sessions.value = sessions.value.filter(s => s.sourcePath !== session.sourcePath);
    selectedSession.value = null;
    messages.value = [];
  } catch (e) {
    console.error('delete_session failed:', e);
  } finally {
    isDeleting.value = false;
  }
}

/**
 * Use the source path as the checkbox key
 * @param sourcePath - Session file path
 */
function toggleCheck(sourcePath: string) {
  const next = new Set(checkedSessions.value);

  if (next.has(sourcePath)) {
    next.delete(sourcePath);
  } else {
    next.add(sourcePath);
  }

  checkedSessions.value = next;
}

/**
 * Limit select all to the current filter
 */
function toggleAllChecked() {
  if (isAllChecked.value) {
    checkedSessions.value = new Set();
  } else {
    checkedSessions.value = new Set(filteredSessions.value.map(s => s.sourcePath));
  }
}

/**
 * Confirm before deleting the checked session files
 */
async function batchDelete() {
  if (checkedCount.value === 0 || isDeleting.value) return;

  const confirmed = await ask(
    t('sessionViewer.batchDeleteConfirmMessage', { count: checkedCount.value }),
    { title: t('sessionViewer.batchDeleteConfirmTitle'), kind: 'warning' }
  );
  if (!confirmed) return;

  isDeleting.value = true;
  const toDelete = sessions.value.filter(s => checkedSessions.value.has(s.sourcePath));
  const failed: string[] = [];

  for (const session of toDelete) {
    try {
      await invoke('delete_session', {
        providerId: session.providerId,
        sourcePath: session.sourcePath,
        sessionId: session.sessionId,
      });
    } catch (e) {
      console.error('delete_session failed:', session.sourcePath, e);
      failed.push(session.sourcePath);
    }
  }

  // Keep failed sessions available for another delete attempt
  const failedSet = new Set(failed);
  sessions.value = sessions.value.filter(
    s => !checkedSessions.value.has(s.sourcePath) || failedSet.has(s.sourcePath),
  );

  // Clear the detail pane if its session was deleted
  if (
    selectedSession.value &&
    checkedSessions.value.has(selectedSession.value.sourcePath) &&
    !failedSet.has(selectedSession.value.sourcePath)
  ) {
    selectedSession.value = null;
    messages.value = [];
  }

  checkedSessions.value = new Set(failed);
  isDeleting.value = false;
}
</script>

<style scoped>
.sv-overlay {
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

.sv-modal {
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-xl);
  width: 90vw;
  height: 85vh;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--ag-shadow-xl);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.sv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.sv-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--ag-text-strong);
}

.sv-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sv-filter-select {
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-sm);
  color: var(--ag-text);
  font-size: 12px;
  padding: 5px 8px;
  cursor: pointer;
  outline: none;
}

.sv-filter-select:focus {
  border-color: var(--ag-accent);
}

.sv-close-btn {
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

.sv-close-btn:hover {
  color: var(--ag-text);
  background: rgba(255, 255, 255, 0.08);
}

.sv-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sv-list-pane {
  width: 300px;
  min-width: 240px;
  border-right: 1px solid var(--ag-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sv-search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--ag-border);
}

.sv-search-input {
  width: 100%;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-sm);
  color: var(--ag-text);
  font-size: 12px;
  padding: 7px 10px;
  outline: none;
  box-sizing: border-box;
}

.sv-search-input:focus {
  border-color: var(--ag-accent);
}

.sv-search-input::placeholder {
  color: var(--ag-text-muted);
}

.sv-list-meta {
  padding: 6px 12px;
  border-bottom: 1px solid var(--ag-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sv-select-all {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ag-text-tertiary);
  cursor: pointer;
}

.sv-select-all input {
  margin: 0;
  accent-color: var(--ag-accent);
}

.sv-count {
  font-size: 11px;
  color: var(--ag-text-tertiary);
}

.sv-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--ag-text-muted);
  font-size: 13px;
}

.sv-list {
  flex: 1;
  overflow-y: auto;
}

.sv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid var(--ag-border);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
  color: var(--ag-text);
}

.sv-item-checkbox {
  margin: 0;
  accent-color: var(--ag-accent);
  flex-shrink: 0;
}

.sv-item.checked {
  background: rgba(51, 118, 205, 0.05);
}

.sv-item:hover {
  background: var(--ag-surface-2);
}

.sv-item.active {
  background: var(--ag-accent-subtle, rgba(51, 118, 205, 0.1));
  border-left: 3px solid var(--ag-accent);
}

.sv-item-info {
  flex: 1;
  min-width: 0;
}

.sv-item-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ag-text-strong);
}

.sv-item-time {
  font-size: 11px;
  color: var(--ag-text-tertiary);
  margin-top: 2px;
}

.sv-provider-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.sv-provider-claude { background: rgba(204, 120, 50, 0.15); color: #cc7832; }
.sv-provider-codex { background: rgba(16, 163, 127, 0.15); color: #10a37f; }
.sv-provider-gemini { background: rgba(66, 133, 244, 0.15); color: #4285f4; }
.sv-provider-opencode { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.sv-provider-openclaw { background: rgba(236, 72, 153, 0.15); color: #ec4899; }

.sv-msg-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.sv-empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ag-text-muted);
  font-size: 14px;
}

.sv-msg-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.sv-msg-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.sv-msg-session-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ag-text-strong);
}

.sv-delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--ag-text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.sv-delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.sv-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sv-msg-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sv-meta-item {
  font-size: 11px;
  color: var(--ag-text-tertiary);
}

.sv-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sv-message {
  border-radius: var(--radius-md);
  padding: 10px 14px;
  border-left: 3px solid transparent;
}

.sv-role-user {
  background: rgba(34, 197, 94, 0.06);
  border-left-color: #22c55e;
}

.sv-role-assistant {
  background: rgba(51, 118, 205, 0.06);
  border-left-color: var(--ag-accent);
}

.sv-role-system {
  background: var(--ag-surface-2);
  border-left-color: var(--ag-warning, #f59e0b);
}

.sv-role-tool {
  background: var(--ag-surface-2);
  border-left-color: #8b5cf6;
}

.sv-message-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sv-role-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.sv-role-color-user { color: #22c55e; }
.sv-role-color-assistant { color: var(--ag-accent); }
.sv-role-color-system { color: var(--ag-warning, #f59e0b); }
.sv-role-color-tool { color: #8b5cf6; }

.sv-message-time {
  font-size: 10px;
  color: var(--ag-text-muted);
}

.sv-copy-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--ag-text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.sv-message:hover .sv-copy-btn {
  opacity: 1;
}

.sv-copy-btn:hover {
  color: var(--ag-text);
  background: rgba(255, 255, 255, 0.08);
}

.sv-message-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--ag-text);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.sv-batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--ag-border);
  background: var(--ag-surface-2);
  flex-shrink: 0;
}

.sv-batch-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-accent);
}

.sv-batch-delete-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: #ef4444;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sv-batch-delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.sv-batch-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 700px) {
  .sv-modal {
    width: 98vw;
    height: 95vh;
  }

  .sv-body {
    flex-direction: column;
  }

  .sv-list-pane {
    width: 100%;
    height: 40%;
    border-right: none;
    border-bottom: 1px solid var(--ag-border);
  }

  .sv-msg-pane {
    height: 60%;
  }
}
</style>
