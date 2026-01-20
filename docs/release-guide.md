# Anti-Power Patcher 发布指南

## 版本号同步

| 文件 | 路径 |
|------|------|
| package.json | `patcher/package.json` → `version` |
| Tauri 配置 | `patcher/src-tauri/tauri.conf.json` → `version` |
| Cargo 配置 | `patcher/src-tauri/Cargo.toml` → `version` |
| 前端显示 | `patcher/src/App.vue` → `APP_VERSION` |
| README 版本徽章 | `README.md` → 顶部版本号徽章 |
| README 版本表格 | `README.md` → "📋 版本信息" 表格 |

---

## 编译

```powershell
cd patcher
npm run tauri:build
```

产物位置：`patcher/src-tauri/target/release/anti-power.exe`

### 编译选项

修改 `tauri.conf.json` 中的 `bundle.targets`：

| 值 | 说明 |
|----|------|
| `[]` | 仅生成单体 exe |
| `["nsis"]` | 生成 Windows 安装包 |
| `"all"` | 生成所有格式 |

---

## 发布流程

```powershell
# 1. 提交代码
git add -A
git commit -m "release: vX.Y.Z"

# 2. 创建标签并推送
git tag vX.Y.Z
git push origin master
git push origin vX.Y.Z

# 3. 使用 gh 发布
gh release create vX.Y.Z `
  "patcher/src-tauri/target/release/anti-power.exe" `
  --title "vX.Y.Z" `
  --notes-file release-notes.md

# 4. 清理临时文件
Remove-Item release-notes.md
```

> ⚠️ **关于 release-notes.md**
> 
> 发布说明较长或包含特殊字符时，**手动创建** `release-notes.md` 文件（使用编辑器），
> 避免在命令行中拼接内容导致解析问题。
>
> 模板：
> ```markdown
> ## ✨ 新功能
> - 功能描述
> 
> ## 🐛 修复
> - 修复描述
> 
> ## 📦 安装
> 下载 `anti-power.exe`，双击运行，程序会自动检测 Antigravity 安装路径，选择功能后点击「安装补丁」即可。
> ```

---

## 版本号规范

- **Major**: 不兼容的重大变更
- **Minor**: 新增功能
- **Patch**: Bug 修复
