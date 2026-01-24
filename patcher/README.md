# Anti-Power Patcher

安装器基于 Tauri、Vue 和 TypeScript，可检测 Antigravity 安装目录、安装或卸载补丁并写入配置。

## 运行与构建

```powershell
npm install
npm run tauri:dev
```

```powershell
npm run tauri:build
```

产物输出在 `patcher/src-tauri/target/release/`.

## 目录说明

- `src/`: 安装器前端界面
- `src-tauri/`: Tauri 后端命令与补丁安装逻辑
- `patches/`: 补丁源文件与手动安装材料

## 推荐 IDE

- VS Code + Vue - Official
- Tauri
- rust-analyzer
