# ChatBrowserX 主规范

## 1. 文档身份

- 文档类型：主 spec
- 约束级别：最高
- 适用范围：整个仓库

本文件定义当前仓库的目录结构、模块职责、依赖方向、阶段范围与协作约束。规范性描述使用简体中文；代码标识符、路径、类型名、消息名使用英文并加反引号。

## 2. 项目目标

ChatBrowserX 是一个面向大模型能力的浏览器增强 Agent 项目。当前目标是维护一个边界清晰、依赖稳定、便于持续演进的浏览器增强骨架，而不是一次性堆叠完整产品能力。

所有设计、实现、删减与重构都必须优先服从“维护性优先”。

## 3. 当前有效 spec

- `docs/superpowers/specs/browser-agent-project-spec.md`
  - 主 spec：全局目录、职责、依赖方向、阶段范围与交付约束。
- `docs/superpowers/specs/llm-tools-spec.md`
  - feature / folder spec：`llm/tools`、Tavily、页面元素快照与页面动作工具。
- `docs/superpowers/specs/speech-feature-spec.md`
  - feature spec：speech UI、background speech 编排、speech service、`volcengine` provider。
- `docs/superpowers/specs/selection-bubble-feature-spec.md`
  - feature spec：页面选中文本气泡、Translate / Ask AI、selection background 链路。

如果代码、主 spec、feature spec 不一致，默认按以下顺序处理：

1. 当前代码真实实现
2. 本主 spec
3. 对应 feature / folder spec

如果确认当前代码是正确方向，必须在同一轮改动中同步更新相关 spec。

## 4. 当前阶段范围

### 4.1 保留能力

- 基础聊天能力与流式展示。
- 最小设置能力：`model`、`general`、`voice`。
- provider 抽象与当前 `openai`、`codex` 聊天 provider。
- 聊天输入图片能力：当前可视区域截图、选区截图、剪贴板图片、图片预览。
- 页面选中文本气泡能力：Translate、Ask AI、结果面板、Markdown 展示。
- LLM 工具能力：
  - `get_current_page_elements`
  - `page_mouse_move`
  - `page_click`
  - `page_type`
  - `page_scroll`
  - `page_drag`
  - `tavily_search`
  - `tavily_extract`
  - `tavily_crawl`
- 最小 speech 骨架：语音按钮、字幕 overlay、background 语音编排、tab 音频采集、`volcengine` 最小 provider。
- 设置持久化、聊天历史持久化、多语言 UI。
- 用户主动触发的“打印/保存为 PDF”：页面滚动扫描、可视区域截图拼接、新窗口预览、浏览器打印保存。

### 4.2 不做能力

- 完整语音识别 / 同声传译产品化能力。
- 独立图片分析 / 截图分析工具。
- PDF 解析、阅读、编辑能力。
- 通用滚动捕获框架。
- 网络录制 / 页面流量分析。
- 除当前列出的页面工具与 Tavily 工具之外的新具体工具。

如需新增上述能力，必须先更新主 spec 与对应 feature spec。

## 5. 当前目录结构

```text
src/
  assets/
  background/
    chat/
    llm/
    selection/
    speech/
    index.ts
  llm/
    model/
    providers/
      codex/
      openai/
      shared/
    services/
    tools/
      shared/
      tavily/
  shared/
    i18n/
    storage/
    types/
      tools/
  speech/
    model/
    providers/
      volcengine/
    services/
  ui/
    content/
      chat/
      pdf/
      settings/
      speech/
    page/
      selection/
    shared/
    tools/
      page-automation/
```

## 6. 目录职责边界

### 6.1 `src/assets`

`src/assets` 放置扩展 manifest 直接引用的静态资源，例如图标文件与源图标。该目录不承载运行时逻辑、业务状态、provider 配置或 UI 组件。

### 6.2 `src/ui`

`src/ui` 是用户可见界面层，只负责界面、交互壳、DOM 侧能力与 UI 局部状态；不直接承担 provider 编排、tool loop 或后台长流程。

- `src/ui/content`
  - 负责 content script 中的插件主 UI：Shadow Root 挂载、Shell、聊天、设置、字幕入口、PDF 入口、页面 selection 气泡装配。
  - 允许通过 runtime message 与 `background` 交互。
  - 负责本地 panel 状态（如 pinned/open）与 UI 语言水合；panel 状态使用 profile-wide `chatbrowserx.panel` storage key。
  - 负责隔离插件主 UI 的键盘事件，避免宿主页面全局快捷键消费插件输入框内的 `Ctrl+A` / `Meta+A` 等输入快捷键。
  - 不直接依赖 provider 实现。
- `src/ui/content/chat`
  - 负责聊天 UI、输入区、消息展示、图片输入、截图交互、图片预览与流式文本展示。
  - 与模型交互必须经由 `background/chat`。
- `src/ui/content/settings`
  - 负责模型、通用、语音设置的展示、编辑与保存反馈。
  - `model` 设置包含 provider 配置、system prompt、history 上限、`tavilyApiKey`；`codex` provider 额外包含 `effort`。
- `src/ui/content/speech`
  - 负责字幕 overlay、语音按钮触发后的本地展示状态，以及 `speechResult` / `speechError` 消费。
  - 字幕展示状态默认不写入 storage。
- `src/ui/content/pdf`
  - 负责 PDF 截图链路的滚动扫描、截图采集、预览窗口与 `window.print()` 调用。
  - `pdf-page-scanner.ts` 仅服务用户主动触发的打印/保存为 PDF，不作为 LLM tool 的页面阅读能力暴露。
  - 不作为 LLM tool 暴露，不提供 PDF 解析/阅读/编辑能力。
- `src/ui/page`
  - 负责面向宿主网页的页面级增强，例如 selection 监听、视口定位、页面浮层。
  - 不放插件侧边栏、聊天、设置等主 UI。
- `src/ui/page/selection`
  - 负责选中文本气泡、Translate / Ask AI 入口、页面 `innerText` 读取、结果面板展示。
  - 模型请求必须经由 `background/selection`。
- `src/ui/shared`
  - 只放多个 UI 子域复用的展示组件与样式，例如 `MessageMarkdown`。
  - 不放 runtime message、provider 编排、DOM tool 执行或业务长流程。
- `src/ui/tools`
  - 负责需要 content script / DOM 能力的工具执行逻辑。
  - `page-automation` 负责当前视口元素快照、快照存储、页面动作执行、富代码编辑器窄桥接与虚拟鼠标。

### 6.3 `src/background`

`src/background` 是插件后台任务层，负责 Chrome 生命周期、消息分发、跨 tab 协调与长流程任务调度。

- `src/background/index.ts` 只做初始化、监听注册、模块装配与浏览器 action 点击到 panel command 的转发。
- `src/background/runtime-message.ts` 放置 background 内部复用的 runtime message 辅助，例如 sender tab 校验与 async response 包装；不承载具体业务编排。
- `src/background/chat` 负责 profile-wide 聊天会话控制、聊天请求路由、流式响应广播、显式取消请求、全局状态查询 / 清空与截图后台桥接。
  - `ChatSessionCoordinator` 是聊天 transcript 与 running 状态的唯一 owner；content UI 只通过 runtime message 查询或订阅状态。
  - 同一 profile 同时最多 1 个 chat in-flight 请求；running 期间新的 `chatbrowserx.chat.request` 返回 `CHAT_SESSION_BUSY`，不会取消旧请求。
  - 聊天流式 chunk 与完整状态会广播给所有可接收 content script 的 tab。
- `src/background/llm` 负责可复用的 LLM 编排和 scoped in-flight session 管理。
  - 当前 `LlmOrchestrator` 被 `background/chat` 与 `background/selection` 分别持有。
  - 同一 orchestrator 实例内，同一 scope 同时最多 1 个 in-flight 请求；chat 使用固定 `global-chat` scope，selection 使用 `tabId` scope；新请求先取消同 scope 旧请求。
  - `LlmOrchestrator` 允许依赖 `src/llm/services`、`src/shared` 与 Chrome API，不依赖 `src/ui`。
- `src/background/selection` 负责 selection runtime message 处理、调用 `LlmOrchestrator`、回推 `selectionStreamChunkType`。
- `src/background/speech` 负责 `speechStart`、`speechStop`、`speechStateQuery`，创建和清理 `AudioCapture` 与 `SpeechRecognitionService`，并回推 `speechResult` / `speechError`。

### 6.4 `src/llm`

`src/llm` 负责模型协议、provider 接入、聊天完成服务与 tool 协议。

- `src/llm/model` 放置 LLM 协议层消息模型。
- `src/llm/providers` 放置 provider 具体实现与 wire format；当前包含 `openai`、`codex`、`shared`。
- `src/llm/services` 放置聊天完成服务与 tool call 编排。
  - `ChatCompletionService` 发送请求时必须加入内部浏览器 Agent 工具使用约束，并保留用户设置里的 `systemPrompt` 作为附加系统提示。
- `src/llm/tools` 放置工具定义、工具注册、active tab 路由与工具级接口。
  - chat agent loop 内的页面工具优先使用请求发起时绑定的 tab id，不因用户手动切换 active tab 而漂移；未提供请求级 tab 上下文的工具调用才回退到 active tab 路由。
  - `src/llm/tools` 可使用 Chrome API 获取 tab 能力。
  - `src/llm/tools` 不依赖 DOM；DOM 读取、滚动、点击、输入必须留在 `src/ui/tools`。
  - 细化约束见 `docs/superpowers/specs/llm-tools-spec.md`。

### 6.5 `src/shared`

`src/shared` 只放跨层共享的通用类型、存储、i18n 与无业务偏向基础能力；不放具体业务编排。

- `src/shared/types` 放置聊天、设置、speech、selection、UI panel command、runtime message 与工具协议类型。
- `src/shared/types/tools` 只放工具跨层协议类型与类型守卫。
- `src/shared/storage` 放置 `settings-repository`、`settings-normalizer`、`chat-history-repository`、`chrome-local-storage`。
  - 全局设置使用 `chatbrowserx.settings`。
  - 聊天历史使用 profile-wide `chatbrowserx.history`。
  - content panel 状态由 `src/ui/content/content-panel-state.ts` 生成 profile-wide `chatbrowserx.panel` key。
- `src/shared/i18n` 放置消息目录、语言状态与翻译函数。

### 6.6 `src/speech`

`src/speech` 负责 speech 子域的 provider 抽象、provider 实现与 service 层边界，不承载 content UI 状态。

- `src/speech/model` 放置 speech provider 抽象。
- `src/speech/services` 管理 provider 生命周期与 `start / sendAudio / stop` 边界。
- `src/speech/providers/volcengine` 放置 `volcengine` 最小 provider、WebSocket 生命周期与签名逻辑。
  - 细化约束见 `docs/superpowers/specs/speech-feature-spec.md`。

## 7. 关键运行链路

- Content script 挂载：manifest 注入 `src/ui/tools/page-automation/rich-editor-bridge-main.ts` 到 `MAIN` world，再注入 `src/ui/content/index.tsx` 到 isolated world；后者挂载 Shadow Root、建立供页面级功能使用的 `chatSessionPortName` 生命周期端口，并注册 content 侧工具 listener。
- 聊天：`ui/content/chat` 启动时通过 `chatbrowserx.chat.state.query` 同步 background 全局会话；用户请求通过 `chatbrowserx.chat.request` 只发送当前 `input`，历史 transcript 由 `ChatSessionCoordinator` 读取、过滤并注入 LLM 请求；请求经 `background/chat` -> `llm/services`（合成内部浏览器工具约束与用户 `systemPrompt`）-> `llm/providers/*`；`background/chat` 在 `chrome.runtime.onMessage` 入口使用请求来源 `sender.tab.id` 创建本轮 chat agent loop 的页面工具 tab 上下文，并将同一个 context 对象继续传入 `ChatSessionCoordinator`、`LlmOrchestrator`、`ChatCompletionService.complete` 与 tool loop，中间层不得重新包装或派生等价 context；用户在响应过程中手动切换 active tab 不改变该上下文；流式 chunk 与完整状态由 `background/chat` 广播回所有 content UI。页面刷新、同 tab 导航或 content script 重挂载不取消 chat agent loop，只有用户显式停止或后台生命周期结束才结束。
- 图片输入：截图或剪贴板图片在 `ui/content/chat` 内构造为 Data URL，并作为聊天输入发送。
- 页面工具：`llm/tools` 定义稳定的工具集合；`llm/services` 在每次 tool invocation 时传入请求级 `InvokeContext`，页面工具优先使用其中的 `pageToolTabId`，没有上下文时才 fallback 到 active tab。background 到 LLM/tool 链路中携带请求上下文的函数统一使用 context-first 参数顺序，例如 `ChatSessionCoordinator.request(context, payload)`、`LlmOrchestrator.complete(context, scope, payload, onChunk)`、`ChatCompletionService.complete(context, history, input, onChunk, signal)`、`runToolCallOrchestrator(context, input, options)` 与 `tool.invoke(context, argumentsObject)`；`context` 不放入生命周期更长的 service config 或 options。chat agent loop 使用请求发起 tab 作为页面工具目标，避免用户手动切 tab 影响后台进行中的页面分析。同一轮 assistant message 中的多个 tool call 按模型给出的顺序串行执行，避免页面滚动、点击、输入与快照状态竞态。`ui/tools` 在 content script 中执行当前视口元素快照或动作。LLM 页面工具不做自动滚动阅读，模型需要更多内容时应显式调用 `page_scroll` 后重新获取元素；对整页、文档级或“分析当前页面 / 总结当前页面”类请求，模型在最新 `page_scroll` 结果仍为 `canScrollMore=true` 时不得输出最终答案，必须继续滚动并刷新快照，直到拿到 `canScrollMore=false` 或 `scrolled=false` 的底部证明，除非用户明确只询问当前视口或某个已可见的特定答案；只读页面分析不得为了发现内容而点击导航、目录、工具栏或 AI 摘要控件。
- Selection 气泡：`ui/page/selection` 构造 prompt -> `background/selection` -> `background/llm` -> 流式回推结果面板。
- Speech：`ui/content/speech` 发起启停 -> `background/speech` -> `AudioCapture` + `SpeechRecognitionService` -> `speech/providers/volcengine` -> 结果回推 UI。
- 打印/保存为 PDF：`ui/content/pdf` 使用 `scanPage` 滚动扫描，通过 `content-screenshot-bridge` 请求截图，在新窗口预览并由用户调用浏览器打印。

## 8. 关键消息与存储协议

- UI panel：`chatbrowserx.panel.command`，用于 background action 点击或其他入口控制 content panel。
- Chat：`chatbrowserx.chat.request`、`chatbrowserx.chat.stream.chunk`、`chatbrowserx.chat.state.query`、`chatbrowserx.chat.state.sync`、`chatbrowserx.chat.cancel`、`chatbrowserx.chat.clear`、`chatbrowserx.chat.session`、`chatbrowserx.chat.screenshot.capture`。其中 `chatbrowserx.chat.request` 的 payload 只包含当前 `input`，不携带历史消息。
- Selection：`chatbrowserx.selection.request`、`chatbrowserx.selection.stream.chunk`、`chatbrowserx.selection.cancel`。
- Speech：`chatbrowserx.speech.start`、`chatbrowserx.speech.stop`、`chatbrowserx.speech.result`、`chatbrowserx.speech.error`、`chatbrowserx.speech.state.query`。
- Page tools：`chatbrowserx.tool.get-page-elements.request`、`chatbrowserx.tool.page-action.request`。
- Rich editor bridge：`chatbrowserx.rich-editor-write.request`、`chatbrowserx.rich-editor-write.result`，仅用于 isolated world 与 `MAIN` world 的富代码编辑器写入桥接。
- Storage：`chatbrowserx.settings` 存放全局设置；`chatbrowserx.history` 存放 profile-wide 聊天历史；`chatbrowserx.panel` 存放 profile-wide panel pinned/open 状态。

## 9. 依赖方向

- `ui` 可以依赖 `shared`，可以通过消息接口与 `background` 交互，不能直接依赖 `llm/providers` 或 `speech/providers`。
- `background` 可以依赖 `shared`、`llm`、`speech`，不能包含 JSX。
- `llm/providers` 与 `llm/services` 不能直接依赖 Chrome API；`llm/tools` 只允许使用 tab/message 能力，不能依赖 DOM。
- `speech` 可以依赖 `shared`，不能依赖 `ui`。
- `shared` 不依赖业务层。
- `index.ts` 仅用于入口装配或导出聚合，不承载主要业务逻辑。

## 10. 命名与文档规则

- 目录名使用 `kebab-case`。
- React 组件文件使用 `PascalCase.tsx`。
- 非组件文件使用 `kebab-case.ts`。
- 组件名使用 `PascalCase`。
- 普通函数使用 `camelCase`。
- Hook 使用 `useXxx`。
- 职责型文件优先使用 `*-provider.ts`、`*-orchestrator.ts`、`*-repository.ts`。
- 所有函数必须有英文 JSDoc 注释，注释描述职责、行为与边界，不逐行翻译实现。

## 11. Spec 同步规则

以下变化必须在同一轮改动中同步更新相关 spec：

- 一级目录结构变化。
- 文件夹新增、删除、移动、合并。
- 模块职责或关键文件职责变化。
- 当前阶段范围变化。
- 消息协议、设置结构、运行链路变化。
- AI 协作边界变化。

如果代码实现已经改变，而 spec 仍停留在旧状态，则任务不能视为完成。
