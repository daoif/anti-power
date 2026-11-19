<script setup lang="ts">
import { ref } from "vue";
import { version } from "../package.json";
import TitleBar from "./components/TitleBar.vue";
import AboutModal from "./components/AboutModal.vue";
import SessionViewer from "./components/SessionViewer.vue";
import FlowBackground from "./components/FlowBackground.vue";

const GITHUB_URL = "https://github.com/mikessslxxx/anti-power";
const showAbout = ref(false);
</script>

<template>
  <div class="app-wrapper">
    <FlowBackground />
    <TitleBar :title="$t('app.title')" @openAbout="showAbout = true" />

    <main class="app-container">
      <SessionViewer />
    </main>

    <AboutModal
      :show="showAbout"
      :version="version"
      :githubUrl="GITHUB_URL"
      @close="showAbout = false"
    />
  </div>
</template>

<style scoped>
.app-wrapper {
  position: relative;
  height: 100vh;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--ag-bg);
  color: var(--ag-text);
  overflow: hidden;
}

.app-container {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 20px 24px;
}
</style>
