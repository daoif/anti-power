import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  // Vite settings for Tauri development and builds
  //
  // Keep Rust errors visible in the terminal
  clearScreen: false,
  // Vite can fall back if the Tauri devUrl port is busy
  server: {
    port: 5173,
    strictPort: false,
    host: host || false,
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
