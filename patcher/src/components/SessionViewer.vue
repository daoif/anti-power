<template>
  <section class="sv-panel" aria-labelledby="sv-title">
    <div class="sv-header">
      <h1 id="sv-title" class="sv-title">{{ $t('sessionViewer.title') }}</h1>
      <div class="sv-header-actions">
        <select
          v-model="filterProvider"
          class="sv-filter-select"
          :aria-label="$t('sessionViewer.filterLabel')"
          :disabled="deletionPending"
        >
          <option value="">{{ $t('sessionViewer.filterAll') }}</option>
          <option v-for="provider in providerIds" :key="provider" :value="provider">
            {{ $t('sessionViewer.providers.' + provider) }}
          </option>
        </select>
        <button class="sv-refresh-btn" :disabled="actionsBusy" @click="scanSessions">
          {{ $t('sessionViewer.refresh') }}
        </button>
      </div>
    </div>

    <div class="sv-options">
      <span>{{ $t('sessionViewer.cleanOptions') }}</span>
      <label class="sv-select-all" :title="$t('sessionViewer.optionCcSwitchHint')">
        <input v-model="cleanOptions.ccSwitch" type="checkbox" :disabled="actionsBusy" />
        <span>{{ $t('sessionViewer.optionCcSwitch') }}</span>
      </label>
      <label class="sv-select-all" :title="$t('sessionViewer.optionAppCacheHint')">
        <input v-model="cleanOptions.appCache" type="checkbox" :disabled="actionsBusy" />
        <span>{{ $t('sessionViewer.optionAppCache') }}</span>
      </label>
    </div>

    <div v-if="scanError" class="sv-feedback sv-error" role="alert">
      {{ $t('sessionViewer.scanFailed', { error: scanError }) }}
    </div>
    <div v-if="scanWarnings.length" class="sv-feedback sv-error" role="alert">
      <div>{{ $t('sessionViewer.recoveryPending') }}</div>
      <ul>
        <li v-for="warning in scanWarnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>
    <div v-if="confirmationError" class="sv-feedback sv-error" role="alert">
      {{ $t('sessionViewer.confirmFailed', { error: confirmationError }) }}
    </div>
    <div
      v-if="deleteResult"
      class="sv-feedback"
      :class="{ 'sv-error': deleteResult.failures.length || deleteResult.warnings.length }"
    >
      <div role="status">
        {{ $t('sessionViewer.deleteResult', { deleted: deleteResult.deleted, failed: deleteResult.failures.length }) }}
      </div>
      <ul v-if="deleteResult.failures.length">
        <li v-for="failure in deleteResult.failures" :key="failure.key" :title="failure.sourcePath">
          {{ $t('sessionViewer.deleteFailed', { name: failure.name, error: failure.error }) }}
        </li>
      </ul>
      <template v-if="deleteResult.warnings.length">
        <div>{{ $t('sessionViewer.deleteWarnings') }}</div>
        <ul>
          <li v-for="warning in deleteResult.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </template>
    </div>

    <div class="sv-body">
      <div class="sv-list-pane" :aria-busy="isScanning">
        <div class="sv-search">
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="$t('sessionViewer.searchPlaceholder')"
            :aria-label="$t('sessionViewer.searchLabel')"
            :disabled="deletionPending"
            class="sv-search-input"
          />
        </div>
        <div class="sv-list-meta">
          <span class="sv-count">{{ $t('sessionViewer.sessionCount', { count: filteredSessions.length }) }}</span>
          <label v-if="filteredSessions.length" class="sv-select-all">
            <input type="checkbox" :checked="isAllChecked" :disabled="actionsBusy" @change="toggleAllChecked" />
            <span>{{ $t('sessionViewer.selectAll') }}</span>
          </label>
        </div>
        <div v-if="isScanning" class="sv-empty" role="status">{{ $t('sessionViewer.scanning') }}</div>
        <div v-else-if="!filteredSessions.length" class="sv-empty">
          <template v-if="!scanError || sessions.length">
            {{ $t(sessions.length ? 'sessionViewer.noMatches' : 'sessionViewer.noSessions') }}
          </template>
        </div>
        <ul v-else class="sv-list">
          <li
            v-for="session in filteredSessions"
            :key="sessionKey(session)"
            class="sv-item"
            :class="{ active: selectedKey === sessionKey(session), checked: checkedSessions.has(sessionKey(session)) }"
          >
            <input
              type="checkbox"
              class="sv-item-checkbox"
              :aria-label="$t('sessionViewer.selectSession', { name: sessionName(session) })"
              :checked="checkedSessions.has(sessionKey(session))"
              :disabled="actionsBusy"
              @change="toggleCheck(sessionKey(session))"
            />
            <button
              class="sv-item-open"
              :aria-current="selectedKey === sessionKey(session) ? 'true' : undefined"
              :title="session.sourcePath"
              :disabled="deletionPending"
              @click="selectSession(session)"
            >
              <span
                :class="['sv-provider-badge', 'sv-provider-' + session.providerId]"
                :title="$t('sessionViewer.providers.' + session.providerId)"
              >
                {{ $t('sessionViewer.providersShort.' + session.providerId) }}
              </span>
              <span class="sv-item-info">
                <span class="sv-item-title" :title="sessionName(session)">{{ sessionName(session) }}</span>
                <span v-if="session.lastActiveAt || session.indexOnly" class="sv-item-time">
                  <template v-if="session.lastActiveAt">{{ formatRelativeTime(session.lastActiveAt) }}</template>
                  <span v-if="session.indexOnly" class="sv-index-only">{{ $t('sessionViewer.indexOnly') }}</span>
                </span>
              </span>
            </button>
          </li>
        </ul>
        <div v-if="checkedCount" class="sv-batch-bar">
          <span class="sv-batch-count">{{ $t('sessionViewer.selectedCount', { count: checkedCount }) }}</span>
          <button class="sv-batch-delete-btn" :disabled="actionsBusy" @click="batchDelete">
            {{ $t(isDeleting ? 'sessionViewer.deleting' : 'sessionViewer.batchDelete') }}
          </button>
        </div>
      </div>

      <div class="sv-msg-pane" :aria-busy="isLoadingMessages">
        <div v-if="!selectedSession" class="sv-empty-msg">
          {{ $t('sessionViewer.selectToView') }}
        </div>
        <template v-else>
          <div class="sv-msg-header">
            <div class="sv-msg-title-row">
              <span :class="['sv-provider-badge', 'sv-provider-' + selectedSession.providerId]">
                {{ $t('sessionViewer.providers.' + selectedSession.providerId) }}
              </span>
              <h2 class="sv-msg-session-title">{{ sessionName(selectedSession) }}</h2>
              <button class="sv-delete-btn" :disabled="actionsBusy" @click="deleteSelectedSession">
                {{ $t(isDeleting ? 'sessionViewer.deleting' : 'sessionViewer.deleteSession') }}
              </button>
            </div>
            <div class="sv-msg-meta">
              <span class="sv-meta-item sv-session-id">
                {{ $t('sessionViewer.sessionId', { id: selectedSession.sessionId }) }}
              </span>
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
          <div class="sv-source-path" :title="selectedSession.sourcePath">
            {{ $t('sessionViewer.sourcePath', { path: selectedSession.sourcePath }) }}
          </div>
          <div v-if="isLoadingMessages" class="sv-empty-msg" role="status">
            {{ $t('sessionViewer.loadingMessages') }}
          </div>
          <div v-else-if="messageError" class="sv-empty-msg sv-error" role="alert">
            {{ $t('sessionViewer.loadFailed', { error: messageError }) }}
          </div>
          <div v-else-if="!messages.length" class="sv-empty-msg" role="status">
            {{ $t(selectedSession.indexOnly ? 'sessionViewer.indexOnlyHint' : 'sessionViewer.noMessages') }}
          </div>
          <div v-else :key="sessionKey(selectedSession)" class="sv-messages">
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              :class="['sv-message', 'sv-role-' + msg.role]"
            >
              <div class="sv-message-head">
                <span :class="['sv-role-label', 'sv-role-color-' + msg.role]">
                  {{ $t('sessionViewer.roles.' + msg.role, msg.role) }}
                </span>
                <span v-if="msg.ts" class="sv-message-time">{{ new Date(msg.ts).toLocaleTimeString() }}</span>
                <button
                  class="sv-copy-btn"
                  :title="$t(copiedIdx === idx ? 'sessionViewer.copied' : 'sessionViewer.copyMessage')"
                  @click="copyText(msg.content, idx)"
                >
                  {{ copiedIdx === idx ? '✓' : '⎘' }}
                </button>
              </div>
              <div class="sv-message-body">{{ msg.content }}</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * Metadata for a local session before its messages are loaded
 */
interface SessionMeta {
  providerId: string;
  sessionId: string;
  title: string | null;
  summary: string | null;
  projectDir: string | null;
  lastActiveAt: number | null;
  sourcePath: string;
  indexOnly: boolean;
}

/**
 * Message in a local session
 */
interface SessionMessage {
  role: string;
  content: string;
  ts: number | null;
}

interface DeleteResult {
  deleted: number;
  failures: { key: string; name: string; sourcePath: string; error: string }[];
  warnings: string[];
}

interface CleanOptions {
  ccSwitch: boolean;
  appCache: boolean;
}

const CLEAN_OPTIONS_KEY = 'anti-power-clean-options';

function loadCleanOptions(): CleanOptions {
  const options: CleanOptions = { ccSwitch: false, appCache: false };
  try {
    const saved = JSON.parse(localStorage.getItem(CLEAN_OPTIONS_KEY) ?? '{}');
    options.ccSwitch = saved?.ccSwitch === true;
    options.appCache = saved?.appCache === true;
  } catch {
    // Keep defaults
  }
  return options;
}

const providerIds = ['antigravity', 'agy'];
const sessions = ref<SessionMeta[]>([]);
const messages = ref<SessionMessage[]>([]);
const selectedSession = ref<SessionMeta | null>(null);
const checkedSessions = ref(new Set<string>());
const filterProvider = ref('');
const searchQuery = ref('');
const isScanning = ref(false);
const isLoadingMessages = ref(false);
const deletionPending = ref(false);
const isDeleting = ref(false);
const scanError = ref('');
const scanWarnings = ref<string[]>([]);
const messageError = ref('');
const confirmationError = ref('');
const deleteResult = ref<DeleteResult | null>(null);
const copiedIdx = ref<number | null>(null);
const cleanOptions = ref(loadCleanOptions());
watch(cleanOptions, options => {
  localStorage.setItem(CLEAN_OPTIONS_KEY, JSON.stringify(options));
}, { deep: true });
let detailRequest = 0;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

function sessionKey(session: SessionMeta): string {
  return JSON.stringify([session.providerId, session.sourcePath]);
}

function sessionName(session: SessionMeta): string {
  return session.title || session.sessionId.slice(0, 12);
}

const selectedKey = computed(() => selectedSession.value ? sessionKey(selectedSession.value) : null);
const checkedCount = computed(() => checkedSessions.value.size);
const actionsBusy = computed(() => isScanning.value || deletionPending.value);

const filteredSessions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const matchesId = query && sessions.value.some(session => session.sessionId.toLowerCase() === query);
  return sessions.value.filter(session => {
    if (filterProvider.value && session.providerId !== filterProvider.value) return false;
    if (!query) return true;
    if (matchesId) return session.sessionId.toLowerCase() === query;
    return [session.title, session.summary, session.projectDir, session.sessionId]
      .some(value => value?.toLowerCase().includes(query));
  });
});

const isAllChecked = computed(() =>
  filteredSessions.value.length > 0 &&
  filteredSessions.value.every(session => checkedSessions.value.has(sessionKey(session))),
);

watch([filterProvider, searchQuery], () => {
  checkedSessions.value.clear();
  if (selectedKey.value && !filteredSessions.value.some(session => sessionKey(session) === selectedKey.value)) {
    void selectSession(null);
  }
}, { flush: 'sync' });

onMounted(() => void scanSessions());
onUnmounted(() => {
  detailRequest++;
  clearTimeout(copyTimer);
});

function errorMessage(error: unknown): string {
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error &&
      typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return t('app.error.unknown');
}

async function scanSessions() {
  if (isScanning.value) return;
  isScanning.value = true;
  scanError.value = '';
  try {
    const result = await invoke<{ sessions: SessionMeta[]; warnings: string[] }>('scan_sessions');
    sessions.value = result.sessions;
    scanWarnings.value = result.warnings;

    const byKey = new Map(sessions.value.map(session => [sessionKey(session), session]));
    for (const key of checkedSessions.value) {
      if (!byKey.has(key)) checkedSessions.value.delete(key);
    }
    if (selectedKey.value) {
      void selectSession(byKey.get(selectedKey.value) ?? null);
    }
  } catch (error) {
    scanError.value = errorMessage(error);
  } finally {
    isScanning.value = false;
  }
}

async function selectSession(session: SessionMeta | null) {
  // Only the most recent detail request can update the pane
  const request = ++detailRequest;
  selectedSession.value = session;
  messages.value = [];
  messageError.value = '';
  copiedIdx.value = null;
  clearTimeout(copyTimer);
  isLoadingMessages.value = session !== null;
  if (!session) return;

  try {
    const loaded = await invoke<SessionMessage[]>('load_session_messages', {
      providerId: session.providerId,
      sourcePath: session.sourcePath,
    });
    if (request === detailRequest) messages.value = loaded;
  } catch (error) {
    if (request === detailRequest) messageError.value = errorMessage(error);
  } finally {
    if (request === detailRequest) isLoadingMessages.value = false;
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
 * Handle both Windows and Unix path separators
 * @param p - Session file or directory path
 * @returns Final path component, or the original path if empty
 */
function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

async function copyText(text: string, index: number) {
  const request = detailRequest;
  try {
    await navigator.clipboard.writeText(text);
    if (request !== detailRequest) return;

    copiedIdx.value = index;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedIdx.value = null;
    }, 1500);
  } catch {
    // Ignore clipboard failures so the viewer stays usable
  }
}

function toggleCheck(key: string) {
  if (checkedSessions.value.has(key)) {
    checkedSessions.value.delete(key);
  } else {
    checkedSessions.value.add(key);
  }
}

function toggleAllChecked() {
  checkedSessions.value = isAllChecked.value
    ? new Set()
    : new Set(filteredSessions.value.map(sessionKey));
}

function deleteSelectedSession() {
  if (!selectedSession.value) return;
  const session = selectedSession.value;
  const hasOtherSources = sessions.value.some(other =>
    other.sessionId === session.sessionId && other.sourcePath !== session.sourcePath,
  );
  const message = t('sessionViewer.deleteConfirmMessage', {
    name: sessionName(session),
    path: session.sourcePath,
  });
  const scope = hasOtherSources
    ? [message, t('sessionViewer.deleteOtherSources')].join('\n\n')
    : message;
  void deleteSessions([session], scope);
}

function batchDelete() {
  const selected = filteredSessions.value.filter(session => checkedSessions.value.has(sessionKey(session)));
  if (!selected.length) return;
  void deleteSessions(selected, t('sessionViewer.batchDeleteConfirmMessage', { count: selected.length }));
}

async function deleteSessions(targets: SessionMeta[], message: string) {
  if (actionsBusy.value) return;
  deletionPending.value = true;
  confirmationError.value = '';
  try {
    const options = { ...cleanOptions.value };
    const extras = [
      options.ccSwitch && t('sessionViewer.confirmCcSwitch'),
      options.appCache && t('sessionViewer.confirmAppCache'),
    ].filter(Boolean);
    let confirmed: boolean;
    try {
      confirmed = await ask([message, ...extras].join('\n\n'), {
        title: t('sessionViewer.deleteConfirmTitle'),
        kind: 'warning',
        okLabel: t('sessionViewer.confirmDelete'),
        cancelLabel: t('sessionViewer.cancel'),
      });
    } catch (error) {
      confirmationError.value = errorMessage(error);
      return;
    }
    if (!confirmed) return;

    isDeleting.value = true;
    deleteResult.value = null;
    const deleted = new Set<string>();
    const failures: DeleteResult['failures'] = [];
    // The backend cleans each store in one pass and reports an error per session
    let errors: (string | null)[];
    let warnings: string[] = [];
    try {
      ({ errors, warnings } = await invoke<{ errors: (string | null)[]; warnings: string[] }>('delete_sessions', {
        sessions: targets.map(({ providerId, sourcePath, sessionId }) => ({ providerId, sourcePath, sessionId })),
        options,
      }));
    } catch (error) {
      errors = targets.map(() => errorMessage(error));
    }
    targets.forEach((session, index) => {
      const key = sessionKey(session);
      const error = errors[index];
      if (error) {
        failures.push({ key, name: sessionName(session), sourcePath: session.sourcePath, error });
      } else {
        deleted.add(key);
      }
    });

    sessions.value = sessions.value.filter(session => !deleted.has(sessionKey(session)));
    for (const key of deleted) checkedSessions.value.delete(key);
    if (selectedKey.value && deleted.has(selectedKey.value)) void selectSession(null);

    deleteResult.value = { deleted: deleted.size, failures, warnings };
    await scanSessions();
  } finally {
    isDeleting.value = false;
    deletionPending.value = false;
  }
}
</script>

<style scoped>
.sv-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--ag-shadow-xl);
}

.sv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  gap: 8px 12px;
  flex-wrap: wrap;
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

.sv-filter-select,
.sv-refresh-btn {
  height: 30px;
  background-color: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-sm);
  color: var(--ag-text);
  font-size: 12px;
  line-height: 1;
  padding: 0 10px;
  cursor: pointer;
  outline: none;
}

/* Drop the native control so the filter matches the button beside it */
.sv-filter-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--ag-text-tertiary) 50%),
    linear-gradient(135deg, var(--ag-text-tertiary) 50%, transparent 50%);
  background-position: right 14px center, right 9px center;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.sv-filter-select:focus,
.sv-filter-select:hover:not(:disabled),
.sv-refresh-btn:hover:not(:disabled) {
  border-color: var(--ag-accent);
}

.sv-refresh-btn:hover:not(:disabled) {
  color: var(--ag-text-strong);
}

.sv-panel button:focus-visible,
.sv-panel input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--ag-accent);
  outline-offset: -2px;
}

.sv-panel button:disabled,
.sv-panel input:disabled,
.sv-panel select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sv-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--ag-border);
  font-size: 11px;
  color: var(--ag-text-tertiary);
  flex-shrink: 0;
}

.sv-feedback {
  flex-shrink: 0;
  max-height: 20%;
  overflow: auto;
  border-bottom: 1px solid var(--ag-border);
  background: var(--ag-success-subtle);
  color: var(--ag-text-strong);
  font-size: 12px;
  padding: 8px 16px;
  overflow-wrap: anywhere;
}

.sv-feedback ul {
  list-style: disc;
  padding-left: 20px;
  margin: 4px 0 0;
}

.sv-error {
  background: var(--ag-error-subtle);
  color: var(--ag-text-strong);
}

.sv-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sv-list-pane {
  width: 42%;
  max-width: 320px;
  min-width: 225px;
  min-height: 0;
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
  padding: 0;
  margin: 0;
  list-style: none;
}

.sv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-bottom: 1px solid var(--ag-border);
  transition: background var(--transition-fast);
}

.sv-item-open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
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
  box-shadow: inset 3px 0 0 var(--ag-accent);
}

.sv-item-info {
  flex: 1;
  min-width: 0;
}

.sv-item-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ag-text-strong);
}

.sv-item-time {
  display: block;
  font-size: 11px;
  color: var(--ag-text-tertiary);
  margin-top: 2px;
}

.sv-index-only {
  white-space: nowrap;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--ag-warning-subtle);
  color: var(--ag-warning);
}

.sv-item-time:has(> .sv-index-only:first-child) .sv-index-only {
  margin-left: 0;
}

.sv-provider-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.sv-item .sv-provider-badge {
  min-width: 34px;
  text-align: center;
}

.sv-provider-antigravity { background: var(--ag-accent-subtle); color: var(--ag-accent); }
.sv-provider-agy { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

.sv-msg-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.sv-empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px 16px;
  overflow-wrap: anywhere;
  color: var(--ag-text-muted);
  font-size: 14px;
}

.sv-empty-msg.sv-error {
  color: var(--ag-text-strong);
}

.sv-msg-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.sv-msg-title-row {
  display: flex;
  align-items: center;
  gap: 6px 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.sv-msg-session-title {
  flex: 1 1 100px;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
  color: var(--ag-text-strong);
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

.sv-session-id {
  user-select: text;
  overflow-wrap: anywhere;
}

.sv-source-path {
  flex-shrink: 0;
  min-width: 0;
  padding: 6px 16px;
  border-bottom: 1px solid var(--ag-border);
  color: var(--ag-text-tertiary);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: text;
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
  flex-wrap: wrap;
  gap: 4px 8px;
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

.sv-delete-btn,
.sv-batch-delete-btn {
  background: var(--ag-error-subtle);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: var(--ag-error);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sv-delete-btn:hover:not(:disabled),
.sv-batch-delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

@media (max-width: 620px) {
  .sv-body {
    flex-direction: column;
    overflow-y: auto;
  }

  .sv-list-pane {
    flex: 1 0 180px;
    width: 100%;
    max-width: none;
    border-right: none;
    border-bottom: 1px solid var(--ag-border);
  }

  .sv-msg-pane {
    flex: 1 0 170px;
  }
}
</style>
