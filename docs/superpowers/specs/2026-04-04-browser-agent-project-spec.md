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
- `docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`
  - 类型：feature spec
  - 用途：speech 子域的当前实现与未来设计说明
- `docs/superpowers/specs/2026-04-12-tavily-tools-design.md`
  - 类型：feature spec / folder spec
  - 用途：`src/llm/tools/tavily` 与 Tavily 设置、可见性、调用链路说明
- `docs/superpowers/specs/2026-04-10-refactoring-design.md`
  - 类型：归档文档
  - 用途：记录历史重构背景，不作为当前实现约束来源

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
- `llm/tools` 的接口边界与首个页面内容读取工具
- 基于 Tavily 的最小网页搜索工具：
  - `tavily_search`
  - `tavily_extract`
  - `tavily_crawl`
- 最小语音骨架：
  - 语音按钮
  - 字幕 overlay
  - background 语音编排
  - tab 音频采集链路
  - `src/speech/services/speech-recognition.ts` 的占位 service
- 设置持久化、聊天历史持久化、多语言 UI

### 4.2 当前阶段明确不做内容

- 完整的语音识别 / 同声传译产品化能力
- 独立的图片分析 / 截图分析工具
- PDF 能力
- 通用滚动捕获能力（聊天输入中的选区长截图除外）
- 网络录制 / 页面流量分析
- 除当前页面内容读取工具与 Tavily 搜索工具之外的其他具体工具实现

## 5. 当前目录结构

```text
src/
  assets/
  background/
    chat/
    messaging/
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
    i18n/
    storage/
    types/
  speech/
    services/
  ui/
    content/
      chat/
      settings/
      speech/
    popup/
    tools/
```

## 6. 目录职责边界

### 6.1 `src/ui`

`src/ui` 是用户可见界面层，只负责界面、交互壳和 UI 局部状态，不负责 provider 编排、tool loop 或后台长流程。

#### `src/ui/content`

- 负责 content script 场景下的主 UI。
- 负责创建 Shadow Root、挂载 React 应用、组织聊天、设置和字幕 overlay 入口。
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

#### `src/ui/popup`

- 负责浏览器插件 popup 页面。
- 只承载轻量状态展示或快捷入口。

#### `src/ui/tools`

- 放置需要 content script / DOM 能力的工具执行逻辑。
- 当前只保留首个页面内容读取工具的 content 侧执行逻辑。
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

#### `src/background/speech`

- 负责 speech 的 tab 维度编排。
- 负责接收 `speechStart` / `speechStop` 消息。
- 负责创建和清理每个 tab 对应的 `AudioCapture` 与 `SpeechRecognitionService`。
- 负责把识别结果通过 `speechResult` 回推给 content script。
- 不负责字幕 UI 状态持久化。

#### `src/background/messaging`

- 放置 background 侧消息契约的再导出或兼容桥接。
- 不应演化为新的业务编排层。

### 6.3 `src/llm`

`src/llm` 负责模型协议、provider 接入、聊天完成服务与 tool 协议，不直接依赖 Chrome API。

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
- 当前包括首个页面内容读取工具与 Tavily 网页搜索工具。
- `src/llm/tools/shared` 负责多个工具可复用的参数读取与请求辅助，不承载具体工具 definition。
- `src/llm/tools/tavily` 的细化约束见 `docs/superpowers/specs/2026-04-12-tavily-tools-design.md`。
- 工具 `invoke()` 允许返回任意可序列化内容；统一由 tool loop 在写回模型前完成字符串化，工具模块本身不应重复手动序列化 JSON。

### 6.4 `src/shared`

`src/shared` 负责跨层共享的通用类型、存储、i18n 与无业务偏向的基础能力。

#### `src/shared/types`

- 负责跨层共享类型。
- 当前包括聊天类型、设置类型、speech 类型、runtime 消息协议。

#### `src/shared/storage`

- 负责设置、聊天历史等持久化访问层。
- 当前包括 `settings-repository`、`speech-settings-repository`、`chat-history-repository`。

#### `src/shared/i18n`

- 负责消息目录、语言状态与翻译函数。

### 6.5 `src/speech`

`src/speech` 当前只保留 speech provider lifecycle 的占位 service 层。

#### `src/speech/services`

- 当前仅有 `speech-recognition.ts`。
- 该文件负责 `start / sendAudio / stop` 的 service 边界与回调注入。
- 该层当前仍是 mock / placeholder，不代表真实 provider 已接入。

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

1. 用户通过 `ShellRail` 触发开始 / 停止。
2. `use-subtitle-controller` 发送 `speechStart` / `speechStop`。
3. `background/speech/index.ts` 调用 `SpeechOrchestrator`。
4. `SpeechOrchestrator` 读取 `speech-settings-repository`，创建 `AudioCapture` 与 `SpeechRecognitionService`。
5. `AudioCapture` 负责 tab 音频采集并把 `ArrayBuffer` 交给 `SpeechRecognitionService.sendAudio(...)`。
6. 当前 `SpeechRecognitionService` 仍是占位实现；未来若产出真实 `RecognitionResult`，background 再通过 `speechResult` 回推给 UI。

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
