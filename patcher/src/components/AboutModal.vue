<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ $t('aboutModal.title') }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div class="about-logo">
          <img src="../assets/logo.png" alt="logo" class="about-icon" />
        </div>
        
        <h3 class="about-name">Anti-Power</h3>
        <p class="about-version">{{ $t('app.version', { version }) }}</p>
        
        <p class="about-desc">
          {{ $t('aboutModal.desc') }}
        </p>

        <div class="about-actions">
          <button 
            class="about-btn"
            @click="checkUpdate"
            :disabled="isCheckingUpdate"
          >
            {{ isCheckingUpdate ? $t('aboutModal.checking') : $t('aboutModal.checkUpdate') }}
          </button>
          <button class="about-btn" @click="openGitHub">
            {{ $t('aboutModal.repo') }}
          </button>
        </div>

        <div v-if="updateInfo" class="update-info">
          <template v-if="updateInfo.hasUpdate">
            <p class="update-available">
              {{ $t('aboutModal.newVersion', { version: updateInfo.latestVersion }) }}
            </p>
            <button class="primary-btn update-btn" @click="openGitHub">
              {{ $t('aboutModal.download') }}
            </button>
          </template>
          <template v-else-if="updateInfo.error">
            <p class="update-error">{{ $t(updateInfo.error) }}</p>
          </template>
          <template v-else>
            <p class="update-latest">{{ $t('aboutModal.latest') }}</p>
          </template>
        </div>
      </div>

      <div class="modal-footer">
        <p>{{ $t('aboutModal.copyright') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const props = defineProps<{
  show: boolean;
  version: string;
  githubUrl: string;
}>();

defineEmits(['close']);

const isCheckingUpdate = ref(false);
const updateInfo = ref<{ hasUpdate: boolean; latestVersion?: string; error?: string } | null>(null);

/**
 * Compare numeric version components
 * @param a - First version
 * @param b - Second version
 * @returns 1 when a is newer, -1 when b is newer, or 0 when equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Check the latest GitHub release against the installed version
 */
async function checkUpdate() {
  isCheckingUpdate.value = true;
  updateInfo.value = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`https://api.github.com/repos/mikessslxxx/anti-power/releases/latest`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      const latestVersion = data.tag_name?.replace('v', '') || data.name;
      updateInfo.value = {
        hasUpdate: compareVersions(latestVersion, props.version) > 0,
        latestVersion
      };
    } else {
      updateInfo.value = { hasUpdate: false, error: 'aboutModal.checkFailed' };
    }
  } catch (e) {
    console.error(t('aboutModal.error.checkUpdate'), e);
    updateInfo.value = { hasUpdate: false, error: 'aboutModal.networkError' };
  } finally {
    isCheckingUpdate.value = false;
  }
}

/**
 * Open the repository in the system browser
 */
async function openGitHub() {
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(props.githubUrl);
}
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
  width: 360px;
  max-width: 90%;
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
  padding: 24px 20px;
  text-align: center;
}

.about-logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 18px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--ag-shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: transform var(--transition-normal);
}

.about-logo:hover {
  transform: scale(1.05);
}

.about-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.about-name {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--ag-text-strong);
  letter-spacing: -0.01em;
}

.about-version {
  color: var(--ag-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  margin: 0 0 16px;
}

.about-desc {
  font-size: 12px;
  color: var(--ag-text-secondary);
  line-height: 1.6;
  margin: 0 0 18px;
}

.about-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.about-btn {
  padding: 9px 16px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: var(--radius-md);
  color: var(--ag-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.about-btn:hover:not(:disabled) {
  background: var(--ag-surface-3);
  border-color: var(--ag-border-hover);
  color: var(--ag-text);
  transform: translateY(-1px);
}

.about-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.update-info {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--ag-border);
}

.update-available {
  color: var(--ag-success);
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 12px;
}

.update-error {
  color: var(--ag-error);
  font-size: 13px;
}

.update-latest {
  color: var(--ag-text-tertiary);
  font-size: 12px;
  margin: 0;
}

.primary-btn {
  padding: 10px 20px;
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

.primary-btn::before {
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

.primary-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: var(--ag-shadow-accent-lg);
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--ag-border);
  text-align: center;
}

.modal-footer p {
  font-size: 10px;
  color: var(--ag-text-muted);
  margin: 0;
  letter-spacing: 0.01em;
}
</style>
