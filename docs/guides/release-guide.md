# Anti-Power Patcher 发布指南

## 版本号同步

发布前确保以下文件版本号一致:

| 文件 | 路径 |
|------|------|
| package.json | `patcher/package.json` -> `version` |
| Tauri 配置 | `patcher/src-tauri/tauri.conf.json` -> `version` |
| Cargo 配置 | `patcher/src-tauri/Cargo.toml` -> `version` |
| 前端显示 | `patcher/src/App.vue` -> `APP_VERSION` |
| README 版本徽章 | `README.md` -> 顶部版本号徽章 |
| README_EN 版本徽章 | `README_EN.md` -> 顶部版本号徽章 |
| 更新日志 | `CHANGELOG.md` -> 添加新版本记录 |

---

## 发布流程 (GitHub Actions 自动化)

### 1. 更新版本号

按上表同步所有文件中的版本号。

### 2. 编写发布说明

创建或更新 `release-notes.md` 文件:

```markdown
## 新功能
- 功能描述

## 修复
- 修复描述

## 致谢
- 感谢 @mikessslxxx

## 安装
- **Windows**: 下载 `anti-power-windows.exe`
- **macOS (Universal)**: 下载 `anti-power-macos-universal.dmg`
- **Linux**: 下载 `anti-power-linux.AppImage` 或 `.deb`
- **手动安装**: 下载 `anti-power-patches.zip`
```

### 3. 提交并打 Tag

```powershell
# 提交代码
git add -A
git commit -m "release: vX.Y.Z"

# 创建标签并推送
git tag vX.Y.Z
git push origin master
git push origin vX.Y.Z
```

### 4. 等待 CI 自动构建

推送 tag 后，GitHub Actions 会自动:
1. 在 Windows、macOS、Linux 三平台并行编译
2. 生成补丁压缩包
3. 创建 GitHub Release 并上传所有产物

你可以在仓库的 **Actions** 页面查看构建进度。

### 5. 完善 Release 说明 (可选)

CI 创建的 Release 使用 `release-notes.md` 的内容。
如需修改，可在 GitHub Release 页面直接编辑。

---

## 手动构建 (本地调试用)

如需在本地编译，仍可使用以下命令:

```powershell
cd patcher
npm run tauri:build
```

产物位置: `patcher/src-tauri/target/release/anti-power.exe`

### 编译选项

修改 `tauri.conf.json` 中的 `bundle.targets`:

| 值 | 说明 |
|----|------|
| `[]` | 仅生成单体 exe |
| `["nsis"]` | 生成 Windows 安装包 |
| `"all"` | 生成所有格式 |

---

## 手动生成补丁压缩包

```powershell
# 以项目根目录执行
Compress-Archive -Path patcher\patches\* -DestinationPath anti-power-patches.zip -Force
```

---

## 版本号规范

- **Major**: 不兼容的重大变更
- **Minor**: 新增功能
- **Patch**: Bug 修复

---

## 故障排除

### CI 构建失败

1. 查看 Actions 页面的错误日志
2. 常见问题:
   - 依赖安装失败：检查 `package.json` 和 `Cargo.toml`
   - 签名问题：macOS 构建可能需要配置签名证书（当前跳过签名）

### 手动发布

如 CI 不可用，参考旧版流程手动发布:

```powershell
# 1. 本地编译
cd patcher
npm run tauri:build

# 2. 生成补丁包
cd ..
Compress-Archive -Path patcher\patches\* -DestinationPath anti-power-patches.zip -Force

# 3. 使用 gh 发布
gh release create vX.Y.Z `
  "patcher/src-tauri/target/release/anti-power.exe" `
  "anti-power-patches.zip" `
  --title "vX.Y.Z" `
  --notes-file release-notes.md
```
