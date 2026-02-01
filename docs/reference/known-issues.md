# 已知问题

## 表格内公式渲染失败

Markdown 表格中的 LaTeX 公式如果包含 `|`, 可能无法渲染.

**影响范围**:
- 绝对值: `$|x|$`
- 行列式: `$\left| ... \right|$`
- 其他使用裸露 `|` 的公式

Antigravity 的 Markdown 解析器会把 `|` 当作表格分隔符, 导致公式被拆开.

**变通方案**:

1. **LaTeX 公式**: 使用不含 `|` 的替代写法
   - 绝对值: `$\lvert x \rvert$` 替代 `$|x|$`
   - 条件符号: `$\mid$` 替代 `$|$`

2. **纯文本**: 使用反斜杠转义 `\|` 来显示竖线字符

**详细信息**: [Issue #7](https://github.com/daoif/anti-power/issues/7)

---

## ~~Manager 字号调节暂未生效~~ (已修复)

> ✅ **此问题已在 v2.1.0 中修复**。启用字体大小开关后会生效。

如仍未生效, 可检查:
- `manager-panel/config.json` 中 `fontSizeEnabled` 是否为 `true`
- Antigravity 更新后 Manager DOM 结构是否变化 (可能导致样式选择器失效)

---

## ~~Manager 补丁导致 "安装损坏" 提示~~ (已修复)

> ✅ **此问题已在 v2.3.2 中修复**。Patcher 安装补丁时会自动清理 `product.json` 中的相关校验和，不再触发此警告。

**历史问题描述**: 启用 Manager 补丁后, 打开 Antigravity 时左下角会弹出 "Antigravity 安装似乎损坏. 请重新安装." 的提示。

---

## Manager 代码块缺少语言标识

从 Manager 窗口复制的代码块缺少语言标识.

**影响范围**:
- Manager 窗口中的所有代码块 (普通代码块和嵌套列表内的代码块)

**原因**: Manager 窗口的 DOM 结构中不包含 `language-xxx` class, 也没有其他可识别的语言标识信息. 这是 Antigravity 的设计限制, 与侧边栏 (cascade-panel) 的实现不同.

**对比**:
| 特征 | 侧边栏 | Manager |
|------|--------|---------|
| `language-xxx` class | 有 | 无 |
| `.font-sans` 语言标签 | 有 | 无 |

**备注**: 侧边栏 (cascade-panel) 的代码块语言标识正常支持. 这是上游 Antigravity 的限制, 补丁无法从不存在的数据中提取语言信息.
