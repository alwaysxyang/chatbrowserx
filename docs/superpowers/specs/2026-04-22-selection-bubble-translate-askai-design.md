# 选区气泡工具条（翻译 / Ask AI）

## 1. 文档身份

- 文档类型：feature spec
- 约束级别：中（受主 spec 约束；不得改变既有跨层边界约束）
- 适用范围：选中文本后出现的“气泡工具条 + 结果面板”能力
- 语言要求：规范性描述统一使用简体中文；代码标识符、路径、类型名、函数名使用英文并加反引号

## 2. 背景与目标

用户在任意网页中用鼠标拖动框选一段文本后，需要立即在选区附近出现一个轻量工具条，提供：

- 翻译：使用当前模型把选中文本翻译到通用设置的目标语言（`general.uiLanguage`，`system` 时跟随系统语言）。
- Ask AI：结合“当前页面文本内容”（不滚动，只取当前 `innerText`）对选中文本做分析。

两者都要求：

- 点击按钮后在页面上出现一个更大的文本框（气泡形式），流式展示输出内容。
- 文本框底部有一个 toolbar（用横线与文本区域分隔），提供复制按钮；复制按钮交互与视觉参考聊天消息的 copy 按钮（`MessageListItem`）。
- 尽可能复用 `src/background/llm` 现有 LLM 调用编排（当前为 `LlmOrchestrator`）。

## 3. 当前实现 / 未来设计

### 3.1 当前实现（本轮交付）

- 在 content script 中常驻启用：不依赖侧边栏是否打开。
- 选区工具条（Translate / Ask AI）出现在选区上方附近，样式为气泡浮层。
- Translate 与 Ask AI 均走 background 调用模型，并使用消息回推实现流式展示。
- Ask AI 获取页面内容时不触发滚动：仅拼接当前页面 `innerText`（并尽量避免把插件 UI 混入）。

### 3.2 未来设计（不在本轮）

- 选区操作历史、结果持久化、多轮追问。
- 自定义 prompt 模板与更复杂的上下文裁剪策略。
- 选区跨 iframe 的完整支持与高级定位策略。

## 4. 目录归属与边界

### 4.1 目录归属

- UI：`src/ui/page/selection`
  - 负责 selection 监听、气泡工具条与结果面板渲染、copy 交互、与 background 消息交互。
- UI shared：`src/ui/shared/MessageMarkdown`
  - 负责 selection 结果与 chat 消息共用的 Markdown 渲染。
- Background：`src/background/selection`
  - 负责 selection 相关 runtime message 处理，调用 `src/background/llm/LlmOrchestrator` 完成请求、取消与流式回推。
- Shared types：`src/shared/types/selection.ts`
  - 负责 selection 模块的消息协议与 type guard。

### 4.2 硬性边界复述

- `src/ui` 不直接依赖 provider 实现，不承担 LLM 编排或长流程。
- LLM 的调用与取消在 background 侧执行；UI 只负责触发与展示。
- Ask AI 的页面内容读取属于 DOM 能力，必须在 `src/ui`（content script）侧完成，background 不读取 DOM。

## 5. UI 交互与状态模型

### 5.1 气泡显示/隐藏

- 触发：用户在页面中完成一次文本选择（典型为 `mouseup` 后），且选中文本非空。
- 排除：如果 selection 发生在 ChatBrowserX 自己的 ShadowRoot 内（例如侧边栏内选中文本），不显示该气泡。
- 隐藏：
  - 用户点击页面空白处导致 selection 为空；
  - 用户按 `Escape`；
  - 用户点击气泡外区域关闭；
  - 用户开始新的 selection（旧的结果面板自动关闭并触发取消）。

关闭气泡时必须向 background 发送取消消息，以停止 in-flight 请求。

### 5.2 气泡位置

- 工具条默认显示在选区上方（距离选区 8px），并进行视口边界 clamp。
- 若上方空间不足，则显示在选区下方。
- 气泡锚点必须根据浮层宽度与预计高度进行视口边界保护，靠近左右边缘、顶部或底部时不能让工具条或结果面板跑出可视区域。
- 结果面板打开后隐藏工具条，整体保持为“靠近选区的气泡”形式，允许覆盖页面内容，但需保证可关闭与可复制。

### 5.3 结果面板

- 文本区域：
  - 默认空白，占位为“Loading/Generating”风格（与 chat 的 loading 文案保持一致风格即可）。
  - 流式接收 chunk 并 append 展示，文本内容使用与 chat 消息一致的 Markdown 组件渲染。
  - 收到最终结果时以最终文本为准（可选择覆盖或保持 append 的结果一致）。
- 底部 toolbar：
  - 上方一条分隔横线。
  - 右侧复制按钮：使用与 `MessageListItem` 相同的图标（`Copy` / `Check`）与“Copied”反馈样式。

## 6. 翻译与 Ask AI 的 prompt 规则

### 6.1 目标语言解析

读取 `settings.general.uiLanguage`：

- `zh` / `en` / `ja`：直接作为输出语言。
- `system`：跟随 `navigator.language`：
  - `zh*` -> `zh`
  - `ja*` -> `ja`
  - 其他 -> `en`

### 6.2 Translate prompt（用户消息拼装）

要求：

- 只输出译文，不要解释，不要额外前缀。
- 保持原文本的段落与换行结构（尽量）。

推荐结构（示例，非字面固定）：

- system: “You are a translation engine.”
- user:
  - “Translate the text below into <targetLanguageName>. Output only the translation.”
  - `---`
  - `<selectedText>`

### 6.3 Ask AI prompt（用户消息拼装）

要求：

- 分析选中文本时，必须结合页面内容（本轮策略为：把页面文本拼进 prompt）。
- 页面内容不滚动：直接抓取当前页面 `innerText`。
- prompt 必须明确说明页面内容已经包含在请求中，禁止模型调用 `get_current_page_content` 或任何页面内容读取工具，避免 Ask AI 再次触发页面滚动读取。
- 为控制 token 与延迟，需要对页面文本做截断（默认 40k 字符，超出截断）。
- 输出语言与 6.1 的目标语言一致。

推荐结构（示例，非字面固定）：

- system: “You are a helpful assistant.”
- user:
  - “Do not call `get_current_page_content` or any page reading tools. The current page content is already included below.”
  - “Analyze the Selected Text using the Page Content as context. Answer in <targetLanguageName>.”
  - “Page Title: …”
  - “Page URL: …”
  - “Page Content: …(truncated)…”
  - “Selected Text: …”

## 7. 消息协议（UI <-> Background）

### 7.1 消息类型

在 `src/shared/types/selection.ts` 定义：

- `selectionRequestType`: `chatbrowserx.selection.request`
- `selectionStreamChunkType`: `chatbrowserx.selection.stream.chunk`
- `selectionCancelType`: `chatbrowserx.selection.cancel`

### 7.2 请求 payload（建议）

`selectionRequestType.payload`：

- `requestId: string`：由 UI 生成（用于 UI 侧防串流）。
- `mode: 'translate' | 'ask_ai'`
- `prompt: string`

`selectionStreamChunkType.payload`：

- `requestId: string`
- `content: string`

### 7.3 取消语义

- UI 在关闭气泡或开始新请求前，发送 `selectionCancelType`。
- background 收到取消后停止 tab 维度 in-flight 请求（复用 `LlmOrchestrator.cancel(tabId)`）。

## 8. Background 复用策略（`LlmOrchestrator`）

为同时支持 chat 与 selection 的流式回推，本轮将 `LlmOrchestrator` 调整为“可注入 stream 回调”的形式：

- `complete(tabId, payload, onChunk?)`
- orchestrator 内部仍保证“同一实例内单 tab 单 in-flight + 新请求先 cancel + requestId 防误删”。
- orchestrator 内部需在回调触发时校验当前 session 是否仍为该请求，避免旧请求残余 chunk 误回推。

当前 `src/background/selection` 持有独立的 `LlmOrchestrator` 实例；该约束表示 selection 模块内部的 tab 维度请求互斥，不表示 chat 与 selection 之间共享一个全局锁。

## 9. 测试策略（最小集）

- `src/shared/types/selection.ts` 的 type guard 单测。
- prompt 组装与语言映射的单测（不依赖 DOM）。
- UI 侧状态更新（chunk append / copied 状态）做轻量单测（按现有 vitest/react testing library 模式）。
