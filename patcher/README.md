# Anti-Power App

基于 Tauri, Vue 和 TypeScript 的桌面应用. 需要 Node.js 22.12+ 和 Rust 1.95+.

```bash
npm install
npm run tauri:dev      # 运行
npm run tauri:build    # 构建, 产物在 src-tauri/target/release/
```

- `src/`: 前端界面
- `src-tauri/`: Rust 后端 (会话扫描和清理)
