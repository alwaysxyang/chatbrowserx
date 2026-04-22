# `src/background/llm` Folder Spec

## 1. 文档身份

- 文档类型：folder spec
- 约束级别：中（受主 spec 约束，不得覆盖主 spec 对一级目录与跨模块边界的规定）
- 适用范围：`src/background/llm`
- 语言要求：规范性描述统一使用简体中文；代码标识符、路径、类型名、函数名使用英文并加反引号

## 2. 目标

`src/background/llm` 用于承载 background 层的“大模型调用编排”相关实现，使其能被 `src/background` 下的多个子模块复用，并保持：

- tab 维度的会话/请求生命周期清晰
- 可取消（cancel）与资源清理行为一致
- 与 `src/llm/services` 的依赖方向稳定
- 不把 provider 细节或 UI 逻辑混入 background 编排层

## 3. 职责边界与依赖方向

### 3.1 允许做的事

- 管理 tab 维度的 LLM in-flight 请求（创建、取消、清理）。
- 将流式增量（chunk）通过 `chrome.tabs.sendMessage` 转发给 content script。
- 读取设置（如 `loadSettings`）并创建 `src/llm/services` 层的调用对象（如 `ChatCompletionService`）。

### 3.2 禁止做的事

- 不直接依赖 `src/ui`，不包含 JSX，不承载 UI 状态。
- 不直接实现 provider 细节（provider wire format、流解析等必须留在 `src/llm/providers`）。
- 不引入与聊天无关的工具 loop / 业务编排逻辑到 `shared`。

### 3.3 依赖约束

- 允许依赖：`src/llm/services/*`、`src/shared/*`、Chrome API（如 `chrome.tabs`）。
- 禁止依赖：`src/ui/*`、DOM 能力（DOM 读取/滚动必须留在 `src/ui/tools`）。

## 4. 关键文件

- `src/background/llm/llm-orchestrator.ts`
  - `LlmOrchestrator`：管理 tab 维度聊天请求与取消，并将流式 chunk 转发到 content script。

## 5. 运行链路（当前实现）

- content script（`src/ui/content/chat`）通过 `chrome.runtime.sendMessage` 发送 `chatRequestType`。
- `src/background/chat/index.ts` 接收消息并调用 `LlmOrchestrator.complete(tabId, payload)`。
- `LlmOrchestrator` 读取设置，调用 `ChatCompletionService.complete(...)`，并在 `onChunk` 回调中转发 `chatStreamChunkType`。
- 取消链路：
  - UI 发送 `chatCancelType`，或
  - content script 断开 `chatSessionPortName` 端口连接，触发 background 侧取消。

## 6. Session 语义（tab 维度）

### 6.1 单 tab 单 in-flight

同一个 `tabId` 在任一时刻最多允许存在 1 个 in-flight 的聊天请求。

### 6.2 新请求到来时的处理

当 `complete(tabId, ...)` 发现已有 session 存在时：

- 必须先 `cancel(tabId)` 停止旧请求；
- 再创建并注册新 session；
- 旧请求的清理逻辑不得误删新 session。

### 6.3 防止“旧请求误删新 session”

`LlmOrchestrator` 必须为每次 `complete()` 生成一个递增的 `requestId`（或等价 token），并将其写入 session。

在 `finally` 清理阶段，只有当 Map 中当前 session 的 `requestId` 与本次请求一致时，才允许删除该 tab 的 session 记录。
