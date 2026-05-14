# 全局聊天会话设计

## 1. 文档身份

- 文档类型：design spec
- 适用范围：`src/background/chat`、`src/background/llm`、`src/ui/content/chat`、`src/ui/content`、`src/shared/storage`、`src/shared/types/chat`
- 约束级别：低于 `docs/superpowers/specs/browser-agent-project-spec.md`，高于实施计划

本文定义将 ChatBrowserX 聊天会话从页面 / hostname / tab 维度改为全局维度的目标设计。规范性描述使用简体中文；代码标识符、路径、类型名、消息名使用英文并加反引号。

## 2. 背景与目标

### 2.1 当前实现

- 聊天历史使用按 hostname scope 的 `chatbrowserx.history.<host>` storage key。
- panel pinned/open 状态使用按 hostname scope 的 `chatbrowserx.panel.<host>` storage key。
- `background/chat` 通过 sender `tabId` 调用 `LlmOrchestrator.complete(tabId, ...)`。
- `LlmOrchestrator` 以 `tabId` 为 in-flight session key，同一 tab 同时最多 1 个请求。
- content script 建立 `chatSessionPortName` 生命周期 port，页面刷新或导航导致 port 断开后，`background/chat` 会取消对应 tab 的聊天请求。

### 2.2 目标行为

- 聊天历史、running 状态与 panel pinned/open 状态改为全局维度，不再按域名或 hostname 分片。
- 任意新页面打开或 content script 重新挂载后，都能自动同步当前全局对话和正在运行的任务。
- 页面刷新、同 tab 导航或 content script 重挂载不再中断 chat agent loop。
- 用户主动点击停止或浏览器 / 扩展后台生命周期结束时，当前 chat agent loop 才结束。
- chat agent loop 运行期间，任何 tab 都不能发送新的 chat request；新请求必须等当前任务结束或用户停止后再发送。
- 正在运行的任务的页面工具默认作用于当前 active tab，聊天状态同步到所有可接收 content script 的 tab。

## 3. 推荐架构

采用 `background` 单 owner + content 订阅展示模式。

`background/chat` 负责维护唯一全局聊天会话。content UI 不再持有 authoritative chat 状态，只负责：

- 启动时查询全局聊天状态。
- 展示 background 下发的会话快照与流式增量。
- 发送用户输入、停止、清空历史等命令。

background 内存状态是运行中任务的权威来源，`chrome.storage.local` 是最近聊天历史与 panel 状态的持久化来源。storage 不保存可恢复的 provider stream 或 `AbortController`；浏览器或扩展后台进程结束后，运行中的 HTTP stream 不能继续。

## 4. 模块设计

### 4.1 `src/shared/storage/chat-history-repository.ts`

当前 `loadChatHistory(hostname)`、`saveChatHistory(hostname, messages)`、`clearChatHistory(hostname)` 改为全局 API：

- `loadChatHistory(): Promise<ChatMessage[]>`
- `saveChatHistory(messages: ChatMessage[]): Promise<void>`
- `clearChatHistory(): Promise<void>`

storage key 固定为 `chatbrowserx.history`。

历史迁移不作为当前设计的必做范围。实现可以从新全局 key 开始；旧 hostname key 不主动删除，避免误删用户数据。若后续需要迁移，必须单独设计迁移策略。

### 4.2 `src/ui/content/content-panel-state.ts`

panel 状态改为全局 key：

- `getPanelStateStorageKey(): string`

返回固定 `chatbrowserx.panel`。`normalizeHostnameForStorage()` 不再服务当前 panel 状态，可删除或只在仍有调用时保留。`ContentApp` 与 `useContentShell` 不再传入 hostname。

### 4.3 `src/shared/types/chat.ts`

新增状态同步消息协议：

- `chatbrowserx.chat.state.query`
- `chatbrowserx.chat.state.sync`

建议 payload：

```ts
interface ChatSessionState {
  messages: ChatMessage[];
  isRunning: boolean;
  requestId: number | null;
  activeAssistantMessageId: string | null;
}

interface ChatStateQueryMessage extends RuntimeMessage<typeof chatStateQueryType> {}

interface ChatStateSyncMessage extends RuntimeMessage<typeof chatStateSyncType> {
  payload: ChatSessionState;
}
```

`chatbrowserx.chat.stream.chunk` 建议扩展 payload：

```ts
interface ChatStreamChunkMessage extends RuntimeMessage<typeof chatStreamChunkType> {
  payload: {
    requestId: number;
    messageId: string;
    content: string;
  };
}
```

`requestId` 与 `messageId` 用于避免旧 chunk 写入新 assistant 消息。content 收到 chunk 时，如果当前状态中的 `requestId` 或 `activeAssistantMessageId` 不匹配，应忽略该 chunk 并等待下一次 `chat.state.sync`。

### 4.4 `src/background/chat`

新增全局会话协调器，建议命名为 `ChatSessionCoordinator`。

职责：

- 从 `chatbrowserx.history` hydrate 初始消息。
- 接收 `chat.request` 后创建 user message 与 streaming assistant placeholder。
- 如果已有全局 request 正在运行，拒绝新的 `chat.request`，返回稳定错误码 `CHAT_SESSION_BUSY`，不取消旧 request。
- 调用 `LlmOrchestrator.complete(...)` 或后续改造后的全局完成接口。
- 接收 provider streaming chunk 后更新内存消息、持久化历史，并广播 chunk。
- 请求完成后将 assistant message 标记为 `completed`，持久化历史，并广播完整 `chat.state.sync`。
- 请求失败或被取消后将 assistant message 标记为 `error` 或 `interrupted`，持久化历史，并广播完整 `chat.state.sync`。
- 接收 `chat.state.query` 后返回当前 `ChatSessionState`。
- 接收 `chat.cancel` 后取消当前全局请求。
- 接收清空历史命令后清空内存与 storage，并广播空状态。

广播方式：

1. 使用 `chrome.tabs.query({})` 枚举当前窗口中扩展可发消息的 tab。
2. 对每个有 `tab.id` 的 tab 调用 `chrome.tabs.sendMessage(tab.id, message)`。
3. 对无法接收 content script 的 tab 忽略发送错误。

这里允许广播给所有 tab，因为 content UI 是被动订阅者；不会因为多个 tab 存在而产生多个 agent loop。

### 4.5 `src/background/llm/llm-orchestrator.ts`

`LlmOrchestrator` 当前使用 `tabId` 作为 session key。chat 全局化后有两种实现方式：

- 推荐：为 chat 使用固定 scope，例如 `global-chat`，让 orchestrator 支持 string scope。
- 或者：新增 chat 专用全局 orchestrator，不影响 selection 的 tab 维度语义。

selection 仍保留当前 tab 维度取消语义，不随本设计一起全局化。

### 4.6 `src/ui/content/chat/use-chat-controller.ts`

`useChatController` 不再接收 hostname，也不再把本地 React state 当作唯一事实来源。

启动流程：

1. 注册 `chat.state.sync` 与 `chat.stream.chunk` listener。
2. 发送 `chat.state.query`。
3. 用返回的 `ChatSessionState` 初始化 `messages`、`isSending`、`requestId` 与 `activeAssistantMessageId`。

发送消息流程：

- 如果当前 `isRunning=true`，UI 禁用 composer 并且不发送 `chat.request`。
- UI 发送 `chat.request`，不再先在本地构造最终权威历史。
- background 返回或广播状态后，UI 以 background 状态为准。
- 为保持输入即时反馈，UI 可以先显示本地 optimistic message，但必须在收到 `chat.state.sync` 后以 background 状态覆盖。

停止流程：

- `stop()` 发送 `chat.cancel`。
- UI 等待 `chat.state.sync` 更新为非 running 状态。

清空流程：

- 应新增后台清空消息，例如 `chatbrowserx.chat.clear`，由 background 清空全局历史并广播状态。
- content 不再直接写 `chat-history-repository`。

### 4.7 `src/ui/content/index.tsx`

chat 不再依赖 `chatSessionPortName` 的 disconnect 来取消请求。

页面刷新或 `pagehide` 不应触发 chat cancel。若该 port 仍被 selection 复用，则需要拆分语义：

- selection 可以保留页面生命周期取消。
- chat 不监听该 port disconnect 或使用新的明确 chat sync port。

## 5. 页面工具目标

正在运行的全局 chat agent loop 调用页面工具时，工具作用于当前 active tab。

当前 `src/llm/tools/shared/active-tab.ts` 已按 active tab 解析工具目标，该行为符合本设计。新页面打开或用户切换 tab 后，后续工具调用会自然指向当前 active tab。聊天状态仍广播到所有 tab。

如果未来需要把工具固定到某个 tab，必须新增明确的 task target 选择协议，不能隐式复用旧 sender tab。

## 6. 生命周期与错误语义

- 页面刷新：content script 断开和重挂载，chat agent loop 继续运行；新 content 通过 `chat.state.query` 同步当前状态。
- 新页面打开：content script 挂载后查询并展示当前全局状态。
- tab 关闭：不取消 chat agent loop。
- 用户停止：取消当前全局请求，assistant message 标记为 `interrupted`。
- 运行期间新请求：background 返回 `CHAT_SESSION_BUSY`，不取消旧全局请求。
- 非运行期间新请求：启动新的全局 request。
- 浏览器关闭或扩展后台生命周期结束：运行中请求自然结束。下次启动时，如果 storage 中存在 `streaming` assistant message，应转为 error 或 interrupted，并展示“后台会话已结束，当前请求已中断”类信息。

## 7. 测试要求

必须覆盖以下行为：

- `chat-history-repository` 使用固定 `chatbrowserx.history` key。
- `content-panel-state` 使用固定 `chatbrowserx.panel` key。
- content mount 时发送 `chat.state.query` 并渲染 running 状态。
- stream chunk 带 `requestId` / `messageId`，不匹配时被忽略。
- background 收到 chunk 后广播给所有 tabs，并忽略不可达 tab 的发送错误。
- content disconnect 或 `pagehide` 不再触发 chat cancel。
- `chat.cancel` 会取消当前全局请求。
- running 期间新 tab 的 composer 保持禁用，background 对并发 `chat.request` 返回 `CHAT_SESSION_BUSY`。
- 新 content 在 running 期间查询状态后显示已有 streaming 内容。
- 页面工具仍使用 current active tab。

## 8. Spec 同步要求

实施本设计时必须同步更新：

- `docs/superpowers/specs/browser-agent-project-spec.md`
  - `src/ui/content` panel 状态说明。
  - `src/background/chat` 与 `src/background/llm` 职责说明。
  - 关键运行链路。
  - 消息与 storage 协议。
- `docs/superpowers/specs/selection-bubble-feature-spec.md`
  - 如果拆分或改变 `chatSessionPortName` 生命周期语义，必须同步说明 selection 仍按页面生命周期取消。

本设计不改变 `docs/superpowers/specs/llm-tools-spec.md` 的工具列表、参数或页面动作语义。
