# ChatBrowserX 主规范

## 1. 文档身份

- 文档类型：主 spec
- 约束级别：最高
- 适用范围：整个仓库
- 语言要求：规范性描述统一使用简体中文；代码标识符、路径、类型名、函数名使用英文并加反引号

本文件定义当前仓库的目录结构、模块职责、依赖方向、当前阶段范围、文档体系与交付约束。

## 2. 项目目标

ChatBrowserX 是一个面向大模型能力的浏览器增强 Agent 项目。

当前目标不是一次性做全功能产品，而是构建一个：

- 结构清晰
- 边界明确
- 依赖稳定
- 便于持续演进

的浏览器增强骨架。

所有设计、实现、删减与重构，都必须优先服从“维护性优先”。

## 3. 文档体系

### 3.1 文档分层

- 主 spec：定义全局目录结构、一级模块职责、依赖方向与当前阶段范围。
- feature spec / folder spec：补充某一能力或某一文件夹的进一步说明。
- 归档文档：记录历史背景，不直接约束当前实现。

### 3.2 当前文档索引

- `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
  - 类型：主 spec
  - 用途：全局目录、职责、依赖方向、范围约束
- `docs/superpowers/specs/2026-04-22-background-llm-folder-spec.md`
  - 类型：folder spec
  - 用途：`src/background/llm` 的当前实现边界、依赖方向与 session 语义说明
- `docs/superpowers/specs/2026-04-22-selection-bubble-translate-askai-design.md`
  - 类型：feature spec
  - 用途：选中文本“气泡工具条 + 翻译/Ask AI + 流式结果面板”的当前实现边界与链路说明
- `docs/superpowers/specs/2026-04-23-page-interactables-tool-design.md`
  - 类型：feature spec
  - 用途：页面交互元素快照工具 `get_current_page_interactables` 与最小 ref 页面动作工具的当前实现边界与输出规范
- `docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`
  - 类型：feature spec
  - 用途：speech 子域的当前实现与未来设计说明
- `docs/superpowers/specs/2026-04-12-tavily-tools-design.md`
  - 类型：feature spec / folder spec
  - 用途：`src/llm/tools/tavily` 与 Tavily 设置、可见性、调用链路说明
- `docs/superpowers/specs/2026-04-17-pdf-capture-folder-spec.md`
  - 类型：folder spec
  - 用途：`src/ui/content/pdf` 的当前实现边界与依赖方向说明
- `docs/superpowers/specs/2026-04-17-volcengine-speech-provider-folder-spec.md`
  - 类型：folder spec
  - 用途：`src/speech/providers/volcengine` 的当前实现边界与依赖方向说明
- `docs/superpowers/specs/2026-04-10-refactoring-design.md`
  - 类型：归档文档
  - 用途：记录历史重构背景，不作为当前实现约束来源
- `docs/superpowers/specs/2026-04-11-speech-state-persistence-design.md`
  - 类型：归档文档
  - 用途：记录早期 speech 状态持久化设想，不作为当前实现约束来源
- `docs/superpowers/specs/2026-04-12-page-to-pdf-design.md`
  - 类型：归档文档
  - 用途：记录早期页面转 PDF 方案，当前约束以 `2026-04-17-pdf-capture-folder-spec.md` 为准

### 3.3 文档优先级

如果代码、主 spec、feature spec 不一致，默认处理顺序为：

1. 当前代码真实实现
2. 本主 spec
3. 对应 feature spec / folder spec
4. 归档文档

如果确认当前代码是正确方向，必须在同一轮改动中同步更新相关 spec。

## 4. 当前阶段范围

### 4.1 当前阶段保留内容

- 基础聊天能力
- 最小设置能力（model / general / voice）
- provider 抽象
- 聊天输入中的图片能力：
  - 当前可视区域截图
  - 选区截图
  - 选区长截图
  - 剪贴板图片输入
  - 聊天图片预览
- 页面选中文本气泡能力：
  - Translate / Ask AI
  - 结果面板与 Markdown 展示
  - Ask AI 使用已拼入 prompt 的页面文本，不额外调用页面内容读取工具
- `llm/tools` 的接口边界与页面只读快照工具：
  - `get_current_page_content`
  - `get_current_page_interactables`
- 最小 ref 页面动作工具：
  - `page_mouse_move`
  - `page_click`
  - `page_type`
  - `page_scroll`
  - `page_drag`
- 基于 Tavily 的最小网页搜索工具：
  - `tavily_search`
  - `tavily_extract`
  - `tavily_crawl`
- 最小语音骨架：
  - 语音按钮
  - 字幕 overlay
  - background 语音编排
  - tab 音频采集链路
  - 最小 speech provider 接入（当前包含 `volcengine`）
- 设置持久化、聊天历史持久化、多语言 UI
- 基于页面滚动 + 截图拼接的“打印/保存为 PDF”能力（仅用于用户主动触发的页面留存）

### 4.2 当前阶段明确不做内容

- 完整的语音识别 / 同声传译产品化能力
- 独立的图片分析 / 截图分析工具
- PDF 解析/阅读/编辑能力
- 通用滚动捕获能力（聊天输入中的选区长截图与“打印/保存为 PDF”链路除外）
- 网络录制 / 页面流量分析
- 除页面只读快照工具（`get_current_page_content`、`get_current_page_interactables`）、最小 ref 页面动作工具与 Tavily 搜索工具之外的其他具体工具实现

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
    services/
    tools/
      shared/
      tavily/
  shared/
    browser/
    i18n/
    storage/
    types/
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
    popup/
    shared/
    tools/
```

## 6. 目录职责边界

### 6.1 `src/ui`

`src/ui` 是用户可见界面层，只负责界面、交互壳和 UI 局部状态，不负责 provider 编排、tool loop 或后台长流程。

#### `src/ui/content`

- 负责 content script 场景下的插件主 UI 与注入入口。
- 负责创建 Shadow Root、挂载 React 应用、组织聊天、设置、字幕 overlay 与页面操作入口。
- 允许通过 hook 管理 UI 层局部状态与 background 消息交互。
- 不直接依赖 provider 实现。
- 不直接承担 Chrome 后台任务。

#### `src/ui/content/chat`

- 负责网页内聊天 UI。
- 负责消息展示、输入区、图片输入、截图交互、聊天图片预览与流式文本展示。
- 允许按职责拆分为 `clipboard/`、`message/`、`screenshot/` 等子目录。
- 所有与聊天 provider 的交互必须经由 `background` + `llm/services`。

#### `src/ui/content/settings`

- 负责设置面板与表单交互。
- 负责模型设置、通用设置、语音设置的展示、编辑、保存反馈。
- 模型设置当前包括 provider 配置、system prompt、history 上限与 `Tavily Key`。
- 不直接访问 provider 实现。

#### `src/ui/content/speech`

- 负责语音按钮触发后的字幕 UI 与本地展示状态。
- `use-subtitle-controller` 维护本地字幕状态，并监听 background 回推的 `speechResult`。
- `SubtitleOverlay` 负责 overlay 的 portal 挂载、拖拽与 listening 文案展示。
- 字幕展示状态默认属于 UI 本地状态，不额外经由 background/storage 镜像持久化。

#### `src/ui/content/pdf`

- 负责“打印/保存为 PDF”能力的 UI 侧实现。
- 当前实现基于页面滚动 + 可视区域截图拼接，在新窗口打开预览并调用浏览器打印能力保存为 PDF。
- 不提供 PDF 解析/阅读/编辑能力，不作为 LLM tool 暴露。
- 细化约束见 `docs/superpowers/specs/2026-04-17-pdf-capture-folder-spec.md`。

#### `src/ui/page`

- 负责 content script 中面向宿主网页的用户操作增强。
- 放置需要监听页面 selection、视口、DOM 或页面级用户事件，并直接在宿主网页上渲染浮层的 UI 能力。
- 可以依赖 `src/shared`，可以通过 runtime message 与 `background` 交互。
- 不负责插件侧边栏、设置、聊天等插件主内容 UI；这些能力仍归属 `src/ui/content`。
- 不负责 LLM tool 执行逻辑；模型 tool 需要的 DOM 执行能力仍归属 `src/ui/tools`。
- 不直接依赖 provider 实现，不承担后台长流程。

#### `src/ui/page/selection`

- 负责监听页面 selection，并在选区附近渲染“气泡工具条 + 结果面板”。
- 负责 Ask AI 场景下的页面文本读取（不滚动，仅 `innerText` 的 best-effort 策略）。
- 负责与 `src/background/selection` 通过 runtime message 交互，并展示流式结果。
- 不直接依赖 provider 实现；模型请求必须经由 background。

#### `src/ui/shared`

- 负责多个 UI 子域复用的纯展示组件与样式。
- 当前包括 `MessageMarkdown`，用于聊天消息与页面 selection 结果的 Markdown 渲染。
- 可以依赖通用 UI 库与 `src/shared` 中的基础能力。
- 不负责 runtime message、provider 编排、DOM 工具执行或业务长流程。

#### `src/ui/popup`

- 负责浏览器插件 popup 页面。
- 只承载轻量状态展示或快捷入口。

#### `src/ui/tools`

- 放置需要 content script / DOM 能力的工具执行逻辑。
- 当前包括：
  - 当前页面内容读取工具的 content 侧执行逻辑
  - 当前视窗交互元素快照工具的 content 侧执行逻辑
  - 基于快照 `sid` + `ref` 的最小页面动作执行逻辑与虚拟鼠标展示
  - 页面滚动扫描与截图拼接所需的 DOM 辅助能力
- 不负责 provider 协议、tool loop 或后台调度。

### 6.2 `src/background`

`src/background` 是插件后台任务层，负责 Chrome 生命周期、消息分发、跨 tab 协调与长流程任务调度。

#### `src/background/index.ts`

- 只做初始化、监听注册与模块装配。

#### `src/background/chat`

- 负责聊天请求到 `llm/services` 的衔接。
- 负责流式响应转发、取消请求、tab 维度会话控制。
- 负责聊天截图输入所需的后台截图桥接。
- 不直接承载 provider 细节。

#### `src/background/llm`

- 放置 background 层可复用的 LLM 编排与 tab 维度 session 管理实现。
- 允许依赖 `src/llm/services` 与 `src/shared`，并可使用 Chrome API（如 `chrome.tabs`）向 content script 回推流式消息。
- 不直接依赖 `src/ui`，不包含 JSX，不承载 UI 状态。
- 细化约束见 `docs/superpowers/specs/2026-04-22-background-llm-folder-spec.md`。

#### `src/background/selection`

- 负责选中文本相关的 runtime message 处理（`selection.*`）。
- 负责把 selection 请求路由到 `src/background/llm` 的 LLM 编排（如 `LlmOrchestrator`），并将流式 chunk 回推给 content script。
- 不承载 provider 细节，不包含 JSX。

#### `src/background/speech`

- 负责 speech 的 tab 维度编排。
- 负责接收 `speechStart` / `speechStop` / `speechStateQuery` 消息。
- 负责创建和清理每个 tab 对应的 `AudioCapture` 与 `SpeechRecognitionService`。
- 负责把识别结果通过 `speechResult` 回推给 content script，并在识别失败时回推 `speechError`。
- `speechStateQuery` 当前只查询 `SpeechOrchestrator` 的内存会话状态，不引入 storage 或 `webNavigation` 持久化链路。
- 不负责字幕 UI 状态持久化。

### 6.3 `src/llm`

`src/llm` 负责模型协议、provider 接入、聊天完成服务与 tool 协议。

- `src/llm/providers` 与 `src/llm/services` 不直接依赖 Chrome API。
- `src/llm/tools` 允许为少量工具使用 Chrome API 获取 tab 能力，但不得依赖 DOM 能力；DOM 读取与滚动等能力必须留在 `src/ui/tools`。

#### `src/llm/model`

- 负责 LLM 协议层消息模型。

#### `src/llm/providers`

- 负责具体 provider 接入。
- 当前存在 `openai`、`codex` 与 `shared` 子目录。
- provider 特有协议、stream 解析、wire format 必须留在这里。

#### `src/llm/services`

- 负责基于 provider 的高层调用服务。
- 当前包含聊天完成与 tool call 编排。
- tool call 编排在工具执行失败时，会把错误作为 tool result 回传给模型，由模型决定后续处理，而不是直接终止整轮聊天。

#### `src/llm/tools`

- 定义工具抽象、工具注册与工具级接口。
- 当前包括页面内容读取工具、当前视窗交互元素快照工具、最小 `sid` + `ref` 页面动作工具与 Tavily 网页搜索工具。
- `src/llm/tools/shared` 负责多个工具可复用的参数读取、active tab 解析等通用辅助，不承载具体工具 definition 或 provider 专属请求逻辑。
- `src/llm/tools/tavily` 的细化约束见 `docs/superpowers/specs/2026-04-12-tavily-tools-design.md`。
- 工具 `invoke()` 允许返回任意可序列化内容；统一由 tool loop 在写回模型前完成字符串化，工具模块本身不应重复手动序列化 JSON。

### 6.4 `src/shared`

`src/shared` 负责跨层共享的通用类型、存储、i18n 与无业务偏向的基础能力。

#### `src/shared/browser`

- 负责浏览器无业务偏向的能力封装与适配层。
- 用于承载可被多层复用的浏览器相关小能力，避免把业务编排塞进 `shared`。
- 允许使用 Chrome API，但必须保持“无业务偏向”的边界，不得在此层引入跨模块编排逻辑。

#### `src/shared/types`

- 负责跨层共享类型。
- 当前包括聊天类型、设置类型、speech 类型、selection 类型、runtime 消息协议。

#### `src/shared/storage`

- 负责设置、聊天历史等持久化访问层。
- 当前包括 `settings-repository`、`speech-settings-repository`、`chat-history-repository`。

#### `src/shared/i18n`

- 负责消息目录、语言状态与翻译函数。

### 6.5 `src/speech`

`src/speech` 负责 speech 子域的 provider 抽象、provider 实现与 service 层边界，不直接承载 content UI 状态。

#### `src/speech/services`

- `speech-recognition.ts` 负责 `start / sendAudio / stop` 的 service 边界与 provider 生命周期管理。

#### `src/speech/providers`

- 放置 speech provider 的具体实现。
- 当前存在 `volcengine` 最小接入，细化约束见 `docs/superpowers/specs/2026-04-17-volcengine-speech-provider-folder-spec.md`。

#### `src/speech/model`

- 放置 speech 子域的抽象协议与类型（例如 `SpeechRecognitionProvider`）。

## 7. 关键运行链路

### 7.1 聊天链路

1. `ui/content/chat` 组织输入与图片内容。
2. 通过 runtime message 请求 `background/chat`。
3. `background/chat` 调用 `llm/services/chat-completion.ts`。
4. `llm/providers/*` 负责具体 provider 协议。
5. 流式结果回推到 content UI。

### 7.2 图片输入链路

1. 截图或剪贴板图片在 `ui/content/chat` 内部构造为 Data URL。
2. 作为聊天输入的一部分发送给 background。
3. 不扩展为独立图片分析能力。

### 7.3 Speech 链路

1. content script 挂载后，`use-subtitle-controller` 发送 `speechStateQuery`，用于从 background 内存会话恢复本地 listening 展示。
2. 用户通过 `ShellRail` 触发开始 / 停止。
3. `use-subtitle-controller` 发送 `speechStart` / `speechStop`。
4. `background/speech/index.ts` 调用 `SpeechOrchestrator`。
5. `SpeechOrchestrator` 读取 `speech-settings-repository`，创建 `AudioCapture` 与 `SpeechRecognitionService`。
6. `AudioCapture` 负责 tab 音频采集并把 `ArrayBuffer` 交给 `SpeechRecognitionService.sendAudio(...)`。
7. `SpeechRecognitionService` 负责把音频分片交给 provider，并在产出 `RecognitionResult` 后由 background 通过 `speechResult` 回推给 UI。
8. provider 或采集链路失败时，background 通过 `speechError` 通知 UI，并清理对应 tab 会话。

### 7.4 打印/保存为 PDF 链路

1. 用户在 content UI 中触发“打印/保存为 PDF”入口。
2. content 侧通过滚动扫描逐步采集可视区域截图。
3. content 侧在新窗口打开截图预览页面。
4. 用户在预览页面使用浏览器打印能力保存为 PDF。

### 7.5 页面 selection 气泡链路

1. `ui/page/selection` 监听页面 selection，并在选区附近渲染工具条。
2. 用户触发 Translate 或 Ask AI 后，UI 构造 prompt 并发送 `selectionRequestType` 到 `background/selection`。
3. Ask AI 在 UI 侧读取当前页面 `innerText` 并拼入 prompt，同时明确禁止模型再调用页面内容读取工具。
4. `background/selection` 调用 `background/llm` 的 `LlmOrchestrator`，并通过 `selectionStreamChunkType` 回推流式 chunk。
5. `ui/page/selection` 在结果面板中使用 `ui/shared/MessageMarkdown` 渲染结果。

## 8. 依赖方向

必须遵守以下依赖方向：

- `ui` 可以依赖 `shared`，可以通过消息接口与 `background` 交互，但不能直接依赖 `llm/providers` 或 `speech` provider 细节。
- `background` 可以依赖 `shared`、`llm`、`speech`。
- `llm` 只能依赖 `shared`，不能依赖 `background` 或 `ui`。
- `speech` 可以依赖 `shared`，不能依赖 `ui`。
- `shared` 不依赖业务层。

## 9. 命名与文档规则

- 目录名使用 `kebab-case`。
- React 组件文件使用 `PascalCase.tsx`。
- 非组件文件使用 `kebab-case.ts`。
- 职责型文件优先使用 `*-provider.ts`、`*-orchestrator.ts`、`*-repository.ts` 等显式后缀。
- 所有规范性说明统一使用中文。
- 代码标识符、类型名、路径、协议名统一使用英文并加反引号。
- 所有函数必须有英文 JSDoc 注释，详见 `AGENTS.md`。

## 10. Spec 同步规则

### 10.1 新增文件夹

新增任何文件夹时，必须在同一轮改动中：

- 更新主 spec 中的目录结构与职责边界
- 说明该文件夹的含义、职责边界、依赖方向
- 判断是否需要对应的 feature spec / folder spec

### 10.2 新增文件

新增文件时，如果该文件承担以下任一职责，则必须更新相应 spec：

- 独立模块入口
- 关键运行链路节点
- 对外协议或消息契约
- 配置结构
- 核心 service / orchestrator / repository / provider

### 10.3 变更完成条件

如果代码已经改变，而文档仍停留在旧状态，则任务不能视为完成。

## 11. 历史说明

- 旧的阶段记录可以保留，但必须降级为归档文档。
- 归档文档不能再作为当前实现的直接依据。
