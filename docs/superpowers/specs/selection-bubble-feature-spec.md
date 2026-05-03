# 选中文本气泡功能规范

## 1. 文档身份

- 文档类型：feature spec
- 约束级别：低于主 spec
- 适用范围：`src/ui/page/selection`、`src/background/selection`、`src/shared/types/selection.ts`、`src/ui/shared/MessageMarkdown`
- 上级文档：`docs/superpowers/specs/browser-agent-project-spec.md`

本文件约束页面选中文本后的 Translate / Ask AI 气泡能力。它不能覆盖主 spec 对 UI、background、LLM 与 shared 的边界约束。

## 2. 当前目标

用户在任意网页中选中文本后，页面附近出现轻量气泡工具条：

- Translate：使用当前模型把选中文本翻译到 UI 目标语言。
- Ask AI：结合当前页面文本内容对选中文本做分析。

两种模式都通过 background 调用模型，并在页面浮层中流式展示结果。

## 3. 目录与职责

- `src/ui/page/selection`
  - 负责监听页面 selection。
  - 负责工具条、结果面板、复制按钮、定位与关闭交互。
  - 负责 Ask AI 所需的页面 `innerText` 读取。
  - 负责 prompt 组装和 runtime message 发送。
- `src/background/selection`
  - 负责 selection runtime message 处理。
  - 负责调用 `src/background/llm/LlmOrchestrator`。
  - 负责把流式 chunk 回推给 content script。
- `src/shared/types/selection.ts`
  - 负责 selection message 常量、payload 类型、响应类型与 type guard。
- `src/ui/shared/MessageMarkdown`
  - 负责 selection 结果与聊天消息共用的 Markdown 渲染。

## 4. 边界

- UI 不直接依赖 provider，不承担 LLM 编排。
- Ask AI 的页面文本读取属于 DOM 能力，必须在 content script 侧完成。
- Ask AI 只读取当前页面 `innerText`，不滚动页面，不调用 `get_current_page_content`。
- Prompt 必须明确说明页面内容已经包含在请求中，禁止模型再调用页面读取工具。
- 关闭气泡或开始新 selection 时必须取消当前 in-flight selection 请求。

## 5. UI 状态与交互

- 触发：用户完成非空文本选择，且 selection 不在 ChatBrowserX 自身 UI 内。
- 工具条：显示 Translate 与 Ask AI。
- 位置：默认在选区上方，空间不足时显示在下方，并进行视口边界保护。
- 结果面板：工具条隐藏，面板流式展示 Markdown 内容，底部提供复制按钮。
- 隐藏与取消：
  - 点击页面空白导致 selection 为空。
  - 按 `Escape`。
  - 点击气泡外区域。
  - 开始新的 selection。

关闭时发送 `selectionCancelType`，background 停止当前 tab 内 selection orchestrator 的 in-flight 请求。

## 6. Prompt 规则

### 6.1 目标语言

读取 `settings.general.uiLanguage`：

- `zh`、`en`、`ja`：直接作为输出语言。
- `system`：根据 `navigator.language` 解析，`zh*` -> `zh`，`ja*` -> `ja`，其他 -> `en`。

### 6.2 Translate

Translate prompt 要求：

- 只输出译文，不解释，不添加额外前缀。
- 尽量保持原文段落与换行结构。

### 6.3 Ask AI

Ask AI prompt 要求：

- 页面内容由 UI 侧读取并拼入 prompt。
- 页面内容不滚动，只使用当前页面 `innerText`。
- 页面文本必须截断，避免 token 与延迟不可控。
- 明确禁止模型调用 `get_current_page_content` 或任何页面读取工具。
- 输出语言与目标语言一致。

## 7. 消息协议

消息常量定义在 `src/shared/types/selection.ts`：

```ts
const selectionRequestType = 'chatbrowserx.selection.request';
const selectionStreamChunkType = 'chatbrowserx.selection.stream.chunk';
const selectionCancelType = 'chatbrowserx.selection.cancel';
```

`selectionRequestType.payload`：

- `requestId: string`
- `mode: 'translate' | 'ask_ai'`
- `prompt: string`

`selectionStreamChunkType.payload`：

- `requestId: string`
- `content: string`

取消语义：

- UI 关闭面板或新请求开始前发送 `selectionCancelType`。
- background 调用 `LlmOrchestrator.cancel(tabId)`。
- UI 使用 `requestId` 防止旧 chunk 写入新面板。

## 8. Background 链路

- `src/background/selection` 持有独立 `LlmOrchestrator` 实例。
- selection 模块内部同一 tab 同时最多 1 个 in-flight 请求。
- 该限制不代表 chat 与 selection 共享全局锁。
- content script 断开 `chatSessionPortName` 端口时，background 会取消 selection 请求，用于页面生命周期清理。

## 9. 未来设计

以下内容不是当前实现：

- 选区操作历史或结果持久化。
- 多轮追问。
- 自定义 prompt 模板。
- 更复杂的上下文裁剪策略。
- 跨 iframe 的完整 selection 支持。

## 10. 变更要求

以下变化必须同步更新本文件：

- selection UI 目录结构或交互语义变化。
- selection prompt 规则变化。
- selection runtime message 协议变化。
- `background/selection` 与 `LlmOrchestrator` 的调用链路变化。
