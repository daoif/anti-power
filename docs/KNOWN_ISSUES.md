# 已知问题

## 表格内公式渲染失败

Markdown 表格中的 LaTeX 公式如果包含 `|`，可能无法渲染。

**影响范围**：
- 绝对值：`$|x|$`
- 行列式：`$\left| ... \right|$`
- 其他使用裸露 `|` 的公式

Antigravity 的 Markdown 解析器会把 `|` 当作表格分隔符，导致公式被拆开。

**变通方案**：

1. **LaTeX 公式**：使用不含 `|` 的替代写法
   - 绝对值：`$\lvert x \rvert$` 替代 `$|x|$`
   - 条件符号：`$\mid$` 替代 `$|$`

2. **纯文本**：使用反斜杠转义 `\|` 来显示竖线字符

**详细信息**：[Issue #7](https://github.com/daoif/anti-power/issues/7)

---

## Manager 字号调节暂未生效

**问题描述**：Manager 窗口的字体大小开关与数值目前不会影响实际渲染。

**影响范围**：
- Manager 窗口设置中的「字体大小」

**备注**：该功能保留为占位，后续会在 Manager 渲染链路稳定后补齐。

---

## Manager 补丁导致"安装损坏"提示

**问题描述**：启用 Manager 补丁后，打开 Antigravity 时左下角会弹出"Antigravity 安装似乎损坏。请重新安装。"的提示。

**影响范围**：
- 仅当 Manager 补丁启用时出现
- 侧边栏补丁不受影响

**原因**：Manager 补丁需要修改 `workbench-jetski-agent.html` 文件，Antigravity 启动时会检测该文件的完整性，发现被修改后会弹出此警告。

**说明**：这是**预期行为**，不影响 Antigravity 的正常使用。如果不希望看到此提示，可以在 Patcher 中禁用 Manager 补丁。

**变通方案**：
1. 忽略该提示，点击关闭即可
2. 如确实不需要 Manager 功能增强，在 Patcher 中关闭「Manager 窗口设置 → 启用补丁」开关

