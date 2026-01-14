# 已知问题

本文档记录 anti-power 的已知问题和限制。

---

## 表格内公式渲染失败

**问题描述**：在 Markdown 表格中使用包含 `|` 字符的 LaTeX 公式时，公式可能无法正常渲染。

**影响范围**：
- 绝对值：`$|x|$`
- 行列式：`$\left| ... \right|$`
- 其他使用裸露 `|` 的公式

**原因**：Antigravity 官方 Markdown 解析器会将 `|` 字符误认为表格分隔符，破坏公式结构。

**变通方案**：使用不含 `|` 的替代写法：
- 绝对值：`$\lvert x \rvert$` 替代 `$|x|$`
- 条件符号：`$\mid$` 替代 `$|$`

**详细信息**：[Issue #7](https://github.com/daoif/anti-power/issues/7)
