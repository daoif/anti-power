/**
 * Vite settings for the Tauri app
 */

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a Node.js global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Keep Rust errors visible in the terminal
  clearScreen: false,

  server: {
    // Vite can fall back if the Tauri devUrl port is busy
    port: 5173,
    strictPort: false,
    // Bind to the Tauri host for remote development
    host: host || false,
    // Enable remote hot reload when a Tauri host is set
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // Exclude backend changes from Vite's file watcher
      ignored: ["**/src-tauri/**"],
    },
  },
}));
