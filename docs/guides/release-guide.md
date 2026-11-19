# Anti-Power 发布指南

## 版本号同步

| 文件 | 位置 |
|------|------|
| `patcher/package.json` | `version` (界面显示的版本号取自这里) |
| `patcher/src-tauri/tauri.conf.json` | `version` |
| `patcher/src-tauri/Cargo.toml` | `version` |
| `README.md`, `README_EN.md` | 版本徽章, 已核对的 Antigravity App 和 Antigravity CLI 版本 |
| `CHANGELOG.md`, `CHANGELOG_EN.md` | 新版本记录 |
| `release-notes.md` | 本次发布说明 |

改完版本号后在 `patcher/` 运行 `npm install`, 在 `patcher/src-tauri/` 运行 `cargo check`, 让两个 lock 文件同步.

## 发布流程

1. 按上表同步版本号, 在 `release-notes.md` 写好发布说明.
2. 提交并推送标签:

```bash
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push origin master vX.Y.Z
```

3. 标签会触发 GitHub Actions, 在 Windows, macOS, Linux 上构建并创建 Release, 说明取自 `release-notes.md`. 进度见仓库的 **Actions** 页面.

产物: `anti-power-windows.exe`, `anti-power-macos-universal.dmg`, `anti-power-linux.AppImage`.

macOS 构建未签名, 首次打开若提示 "已损坏", 运行 `xattr -cr /Applications/Anti-Power.app`.

## 本地构建

```bash
cd patcher
npm run tauri:build
```

产物在 `patcher/src-tauri/target/release/`. `tauri.conf.json` 的 `bundle.targets` 为 `[]` 时只生成可执行文件, 用 `--bundles dmg` 等参数生成安装包.

## 版本号规范

- **Major**: 不兼容的重大变更
- **Minor**: 新增功能
- **Patch**: 问题修复
