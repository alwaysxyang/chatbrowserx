# 页面转 PDF 早期设计归档记录

## 1. 文档身份

- 文档类型：归档文档
- 约束级别：不直接约束当前实现
- 适用范围：仅用于保留早期页面转 PDF 方案背景
- 上级文档：`docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- 当前约束来源：`docs/superpowers/specs/2026-04-17-pdf-capture-folder-spec.md`

本文件记录早期“页面转 PDF”方案。当前实现约束以 `2026-04-17-pdf-capture-folder-spec.md` 为准。

## 2. 归档原因

早期方案曾设想使用独立预览页面文件：

- `src/ui/content/pdf/pdf-preview.html`
- `src/ui/content/pdf/pdf-preview-page.ts`

当前代码没有这些文件。当前实现集中在 `src/ui/content/pdf/pdf-capture.ts`，通过页面滚动扫描、可视区域截图采集和新窗口内联预览完成“打印/保存为 PDF”链路。

## 3. 当前使用规则

- 当前页面打印/保存为 PDF 的边界、关键文件和依赖方向，以 `2026-04-17-pdf-capture-folder-spec.md` 为准。
- 如果本文件与当前代码、主 spec 或 PDF folder spec 不一致，必须忽略本文件。
- 如需重新引入独立预览页面、真实 PDF 生成、导出历史或 PDF 解析能力，必须先更新主 spec 与 PDF folder spec，再进入实现。

## 4. 历史保留内容

本归档文档保留的历史意图是：提供一个由用户主动触发的页面留存能力，隐藏插件 UI 后采集页面内容，并允许用户在预览后调用浏览器打印保存。

该意图已由当前 `src/ui/content/pdf` folder spec 重新收敛和约束。
