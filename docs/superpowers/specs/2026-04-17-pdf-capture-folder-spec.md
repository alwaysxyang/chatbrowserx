# 页面打印/保存为 PDF 文件夹规范

## 1. 文档身份

- 文档类型：folder spec
- 约束级别：低于主 spec，高于归档文档
- 适用范围：`src/ui/content/pdf`、`src/ui/tools/scroll.ts`、`src/ui/content/content-screenshot-bridge.ts`、`src/background/chat/screenshot-capture.ts`
- 上级文档：`docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

本文档约束“打印/保存为 PDF”能力的当前实现边界与依赖方向。该能力用于用户主动留存当前页面，不扩展为 PDF 解析/阅读/编辑能力。

## 2. 当前实现

### 2.1 目标

- 为用户提供一个在网页中触发的页面留存能力：滚动扫描页面、采集截图、在新窗口打开预览，并由用户使用浏览器打印能力保存为 PDF。
- 保持能力收敛在 UI 侧，不引入新的 background 长流程编排。

### 2.2 目录与关键文件

#### `src/ui/content/pdf`

- `pdf-capture.ts`
  - 负责编排滚动扫描与截图采集。
  - 负责打开预览窗口与渲染截图列表。
  - 预览窗口内只提供“打印/保存为 PDF”按钮，调用 `window.print()`。

#### `src/ui/tools`

- `scroll.ts`
  - 负责寻找主滚动容器与执行滚动扫描（`scanPage`）。
  - 只提供 DOM 侧辅助能力，不包含与 background/LLM 相关的业务编排。

#### `src/ui/content`

- `content-screenshot-bridge.ts`
  - 负责向 background 请求“当前可视区域截图”，并解析 `RuntimeResponse`。

#### `src/background/chat`

- `screenshot-capture.ts`
  - 负责响应截图请求并返回 `dataUrl`。

### 2.3 边界与约束

- 该能力不属于 `llm/tools`，不得作为模型可调用工具暴露。
- 该能力不解析 PDF，不读取 PDF 内容，不管理 PDF 文件，不提供导出历史。
- 该能力允许使用页面滚动扫描，但不把扫描能力抽象为通用滚动捕获框架；仅用于当前链路与聊天输入的选区长截图。
- 该能力的截图采集应遵守上限，避免对页面与性能造成不可控影响（当前实现存在最大截图数量限制）。

### 2.4 错误处理

- 若截图请求失败，应在控制台记录错误，并向用户显示明确失败提示。
- 若页面结构导致无法滚动或无法稳定采集，应允许提前结束扫描并保留已采集结果。

## 3. 未来设计

以下内容不是当前实现：

- PDF 解析/阅读/编辑能力（例如加载现有 PDF 并做页面内容识别）。
- 通用滚动捕获框架（可配置策略、跨页面类型适配、复杂 DOM 稳定性保证）。
- 与 chat/tool loop 结合的自动化“保存/归档”工作流。

如需引入上述内容，必须先更新主 spec 的当前阶段范围，再扩展本 folder spec。
