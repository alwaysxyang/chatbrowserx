# ChatBrowserX 浏览器增强 Agent 项目规范

## 1. 背景

ChatBrowserX 是一个面向大模型能力的浏览器增强 Agent 项目。

项目长期目标不是单纯提供一个聊天框，而是围绕“理解页面、与页面交互、逐步接入工具能力”构建可持续演进的浏览器 Agent。

当前阶段并不追求一次性实现完整能力，而是先建立一个**维护性优先**的最小可用骨架，从基础聊天能力起步，再逐步扩展成完整的浏览器增强 Agent。

当前需要重点避免的问题：

- UI、Background、LLM 调用、工具逻辑混在一起。
- 单文件职责失控，后续继续演进会越来越难维护。
- 目录边界不稳定，导致人类开发者与其他 AI 工具都很难快速判断代码应该放在哪里。
- 过早接入复杂能力，会让结构再次回到“大文件 + 混合职责”的状态。

## 2. 项目目标

当前阶段的核心目标按优先级排序如下：

1. **维护性优先**：结构清晰、职责单一、边界稳定。
2. **最小可用**：先落地基础聊天能力与最小设置能力（包括多语言 UI、基础错误提示）。
3. **高质量聊天交互体验**：支持流式输出、用户中断、滚动跟随等基础交互细节。
4. **可扩展**：后续可以逐步扩展 `providers`、`tools` 与更多浏览器增强能力。
5. **易协作**：让后续 AI 工具与新开发者能快速理解目录和命名规则。
6. **渐进演进**：未来增加能力时，不破坏已建立的结构边界。

## 3. 本轮范围

### 3.1 保留范围

- 网页内侧边栏聊天 UI。
- 最小聊天设置：`API Base URL`、`API Key`、`Model`、`System Prompt`、`Max History`。
- `ui` 与 `background` 之间的消息通信。
- `llm/providers` 的抽象与接入边界。
- 用户消息协议支持文本与图片混排输入（`text` / `image_url`），图片来源可为远程 URL 或 Data URL。
- 聊天输入支持由用户主动触发的截图图片输入，包括当前可视窗口截图、选区截图与选区长截图；截图结果作为 Data URL `image_url` 多模态输入发送给模型。
- 聊天输入支持在输入框中直接粘贴图片；粘贴结果作为 Data URL `image_url` 多模态输入发送给模型。
- `llm/tools` 的接口、注册边界与首个页面内容读取工具能力。

### 3.2 当前阶段不做

以下能力不属于当前阶段的首批实现：

- 语音识别 / 同声传译。
- 独立的图片分析 / 截图分析工具。
- PDF / 通用滚动捕获能力（聊天输入中的选区长截图除外）。
- 网络录制 / 页面流量分析。
- 除聊天截图输入、输入框剪贴板粘贴图片输入与聊天消息图片预览外的图片上传、图片预览与图片选择等 UI 交互。
- 除“读取当前网页标题、URL 与 `document.body.innerText`”之外的其他具体工具实现。

## 4. 目标目录结构

本项目采用“运行边界 + 能力边界”优先的目录拆分方式：

```text
src/
  ui/
    content/
      chat/
        clipboard/
        message/
        screenshot/
      settings/
    tools/
    popup/
  background/
    chat/
    messaging/
    index.ts
  llm/
    model/
    providers/
    services/
    tools/
  shared/
    browser/
    i18n/
    storage/
    types/
    utils/
```

## 5. 目录职责说明

### 5.1 `src/ui`

`ui` 是展示层，只负责用户可见界面与交互壳，不负责 LLM 编排与后台长流程。

#### `src/ui/content`

- 内容脚本场景下的 UI 入口。
- 负责创建 Shadow Root、挂载 React 应用、组织聊天与设置界面。
- `ContentApp.tsx` 应保持为视图装配层；与面板开关、持久化、语言 hydration、overlay 会话、宽度拖拽相关的副作用与状态组织，可收敛到独立 hook（如 `use-content-shell`）中。
- 不直接实现 provider 请求逻辑。
- 不直接承担流式解析、tool loop、Chrome 后台任务。
- 允许在轻量控制器（如 `use-chat-controller`）中维护聊天 UI 状态、调用 background 消息接口，以及处理滚动跟随、输入态、流式输出文本展示等交互细节，但不得直接依赖 provider 实现或 Chrome API。

#### `src/ui/content/chat`

- 负责网页内聊天界面。
- 包含聊天面板、消息列表、输入框、加载态、错误态、侧边栏壳等 UI 组件。
- 包含聊天输入图片交互：截图遮罩、选区框、可视窗口截图、选区截图、选区长截图、输入框内直接粘贴图片、截图/图片预览与删除。
- 包含聊天内图片预览交互：用户消息图片与输入框截图缩略图可在聊天 UI 内预览。
- 允许按职责拆分为更小的子模块，例如：
  - `clipboard/`：图片读写剪贴板能力；
  - `message/`：聊天消息构造、历史裁剪与局部更新；
  - `screenshot/`：截图选区几何、截图裁剪/拼接、长截图会话。
- 通过 `use-chat-controller` 这类 hook，与后台交换消息，并在前端维护：
  - 用户输入草稿、消息历史展示；
  - 聊天请求进行中的流式文本（在 loading 气泡中展示）；
  - 聊天中断状态（例如被用户停止时标记为 `interrupted` 并展示提示图标）；
  - 自动滚动到底的行为。
  - 待发送图片输入状态（截图或剪贴板图片），并在提交时组装为 `text` / `image_url` 多模态 content。
- 不直接依赖具体 provider，实现与 provider 的交互必须经过 `background` + `llm/services`。

#### `src/ui/content/settings`

- 负责网页内设置面板。
- 包含配置表单、基础校验、保存交互反馈（包括“保存成功/失败”提示）。
- 通过 `shared/storage/settings-repository` 读写设置（如 `API Base URL`、`API Key`、`Model`、`System Prompt`、`Max History`、`UI Language`）。
- 语言选择变更只有在“保存设置”成功后才会同步到全局 UI 语言与 i18n 缓存。
- provider 专属配置（如 `openai` / `codex`）是设置结构中的主语义；顶层 `model` 可作为兼容旧结构的镜像字段保留，但不应成为新的主要数据来源。
- 不直接触达 provider 实现。

#### `src/ui/popup`

- 负责浏览器插件 popup 页面。
- 允许放置轻量状态展示或快捷入口。
- 不承载后台编排逻辑。

#### `src/ui/tools`

- 放工具在 content/UI 侧的执行逻辑与可视化交互。
- 无论是否需要用户可见界面，只要工具需要 content script / DOM 能力，都应在这里按工具拆分文件。
- 不同工具使用不同文件，避免多个工具共用一个含混的 UI 文件。
- 可放工具专属的 DOM 读取、页面交互、content 侧消息监听与响应逻辑。
- 公共逻辑放 `ui/tools/shared.ts` 一类共享模块。
- 不负责 tool loop、provider 协议或后台调度。

### 5.2 `src/background`

`background` 是插件后台任务层，负责 Chrome 生命周期、消息分发、会话协调与长流程任务调度。

#### `src/background/index.ts`

- Background 入口。
- 只做初始化、监听注册与模块装配。

#### `src/background/chat`

- 聊天后台任务协调。
- 负责 UI 请求到 LLM service 的衔接。
- 不直接写 provider 细节。
- 负责将 UI 层的“聊天请求”包装为一次 LLM 调用，并：
  - 在流式响应场景下，将 SSE chunk 转换为 `chatStreamChunk` 消息推送给对应 tab；
  - 为每个 tab 维护 `AbortController`，支持 UI 侧发起 `chatCancel` 消息时中断当前请求；
  - 在调用结束后清理控制器，避免泄漏。
- 可为 `llm/tools` 注入工具运行时依赖，例如“当前 tab 对应的 background 工具桥接能力”。
- 负责聊天截图输入所需的后台截图桥接；截图捕获逻辑放在独立文件（如 `screenshot-capture.ts`），`background/index.ts` 只做注册装配。

#### `src/background/tools`

- 放需要 background/runtime 能力的工具执行逻辑。
- 每个工具使用独立文件，避免多个工具共享一份混杂实现。
- 公共 Chrome API / tab 消息桥接逻辑放 `background/tools/shared.ts`。
- 负责把 `llm/tools` 的工具调用，桥接到具体 tab、content script 或后台运行环境。

#### `src/background/messaging`

- UI 与 Background 之间的消息协议与消息桥接。
- 放消息类型、路由器、协议转换。

### 5.3 `src/llm`

`llm` 是模型能力层，负责抽象模型调用、流式处理、tool 接口协议。

#### `src/llm/model`

- 放 LLM 领域类型，例如消息、tool call、stream chunk、request payload、response shape。
- 用户消息内容需支持标准多模态 content 结构：既可为纯字符串，也可为 `text` / `image_url` 的有序列表。

#### `src/llm/providers`

- 放不同 provider 的实现。
- 命名统一为 `*-provider.ts`。
- provider 只关心请求与响应，不关心 Chrome API 与 UI。

#### `src/llm/services`

- 放 LLM 相关服务，如 chat completion、stream parser、tool loop 编排。
- 是 provider 与 background 之间的能力层。
- 负责将 UI 的“历史 + 当前输入”转换为通用 `ChatCompletionInput`，并在内部处理：
  - 非流式 vs 流式调用的统一接口；
  - 将 provider 的流式增量回调转换为可供 `background` 转发的 chunk 文本；
  - 当模型返回 tool call 时，负责执行工具调用循环：查找工具、执行工具、回填 tool result、再次请求模型；
  - 同时返回最终完整回复文本。

#### `src/llm/tools`

- 放工具接口定义、注册表、协议层。
- 每个工具模块应暴露清晰的最小契约：`name`、`definition`、`invoke`。
- 工具模块应尽量保持独立，除确有 UI 交互需要外，不把展示逻辑放入工具实现中。
- 工具注册表提供全局默认 registry，与 `register` 接口；每个工具模块自行调用 `register` 完成注册。
- 工具注册表负责聚合已注册工具、按名称查找工具实现，并在运行时依赖注入后生成可执行 tool module，不承载 provider 或 UI 逻辑。
- 当前内建工具注册为全局默认 registry 中的 built-in tool；每个工具模块自行调用 `register` 完成注册。
- 当前页面内容读取工具在 `invoke` 内直接完成当前激活 tab 查询与 runtime message 发送，再由 `ui/tools` 返回页面内容结果。
- 当前已实现首个工具：读取当前网页的 `title`、`url` 与 `document.body.innerText`。

### 5.4 `src/shared`

`shared` 是跨层可复用基础设施，只放与某个具体业务无强绑定的模块。

#### `src/shared/browser`

- 浏览器 API 的轻量封装。
- 优先把通用 Chrome 调用收口到这里。

#### `src/shared/storage`

- 配置、聊天历史等持久化访问层。
- `settings-repository`：负责设置的读写与归一化，提供默认值与键名管理。
- 设置归一化应优先以 provider 专属字段为准，并只在兼容旧数据时回填顶层别名字段。
- `chat-history-repository`：按“归一化 hostname”（例如 `www.baidu.com` → `baidu.com`）维度存储与读取聊天历史，保证同一站点下多页面共享历史。

#### `src/shared/types`

- 跨模块共享类型（包括聊天消息结构、runtime 消息协议、设置类型、语言枚举等）。
- 聊天消息类型需要承载图文混排输入协议，供 UI / background / llm 在不引入 provider 细节的前提下共享。
- 设置类型允许提供少量只读 selector/helper，用于统一读取当前激活 provider 的 `baseUrl`、凭证与 `model`，避免在各层重复分支判断。

#### `src/shared/utils`

- 与领域无关的小工具函数。

#### `src/shared/i18n`

- i18n 文本与语言解析逻辑。
- 推荐拆分为“文案目录（message catalog）”与“解析/翻译函数”，避免单文件同时承载所有 key、所有文案与运行时逻辑。
- 负责根据 `UiLanguage` 与浏览器语言选择具体 locale。
- 提供 `translateMessage` 等方法，供 UI 与错误提示统一使用。
- 不直接依赖 UI 层组件，只暴露纯函数与配置。

## 6. 依赖边界规则

必须遵守以下依赖方向：

- `ui` 可以依赖 `shared`。
- `background` 可以依赖 `llm` 与 `shared`。
- `llm` 只能依赖 `shared`。
- `shared` 不能依赖 `ui`、`background`、`llm`。

禁止的依赖示例：

- `ui` 直接 import provider 实现。
- `llm` 直接调用 Chrome API。
- `background` 中直接书写 JSX 组件。
- `shared` 中放业务特定的聊天逻辑。

## 7. 命名规范

### 7.1 目录名

- 一律使用 `kebab-case`。
- 目录名优先表达职责或边界，而非技术噪音。

示例：

- `content`
- `chat`
- `settings`
- `messaging`
- `providers`

### 7.2 文件名

- React 组件文件：`PascalCase.tsx`
- 非组件文件：`kebab-case.ts`

示例：

- `ChatPanel.tsx`
- `SettingsPanel.tsx`
- `session-orchestrator.ts`
- `chat-completion.ts`
- `ark-provider.ts`

### 7.3 标识符命名

- React 组件：`PascalCase`
- Hook：`useXxx`
- 普通函数：`camelCase`
- Type / Interface / Enum：`PascalCase`
- 模块内普通常量：`camelCase`
- 跨模块共享常量：`SCREAMING_SNAKE_CASE`

### 7.4 职责型后缀

为增强可读性，职责明确的模块应带后缀：

- provider：`*-provider.ts`
- orchestrator：`*-orchestrator.ts`
- repository：`*-repository.ts`
- registry：`*-registry.ts`
- parser：`*-parser.ts`
- bridge / bus：`*-bridge.ts` / `*-bus.ts`

### 7.5 `index.ts` 规则

- `index.ts` 只做导出聚合或入口装配。
- 不在 `index.ts` 中编写主要业务逻辑。

## 8. 代码组织原则

### 8.1 单文件单职责

- 一个文件只负责一类事情。
- 超过单一职责边界时应优先拆分，而不是继续追加分支逻辑。

### 8.2 先边界、后复用

- 不要为了“看起来复用”把不同层的逻辑提前揉在一起。
- 只有在职责一致时才抽共享模块。

### 8.3 UI 不承担后台与模型细节

- UI 组件不直接写 provider 请求。
- UI 组件不直接承担 tool loop。
- UI 组件不直接依赖后台实现细节。

### 8.4 LLM 模块独立性

- `llm` 是模型能力层，不应感知 Chrome 生命周期。
- 若需要运行环境能力，必须由 `background` 或 `shared/browser` 注入。

### 8.5 维护性优先于短期便利

- 若一个实现“更快写完”但会破坏结构边界，应拒绝该实现。
- 新功能进入代码库时，必须先判断归属目录，再写实现。

## 9. 重构落地原则

### 9.1 第一阶段策略

- 先落地最小可用聊天能力，作为浏览器增强 Agent 的起点（当前已包括流式输出、用户中断、滚动跟随、多语言 UI）。
- 先删调用链，再删实现，再删配置字段。
- 对 `tools` 只保留接口和注册边界。

### 9.2 恢复功能的顺序

后续扩展能力时，推荐顺序：

1. provider 扩展。
2. tool 协议完善。
3. 单个工具能力恢复。
4. 更复杂的浏览器增强 UI 能力。

### 9.3 不允许的演进方式

- 为了快速接入新能力，把逻辑塞回 `background/index.ts`。
- 为了快速展示结果，把请求逻辑写回 React 组件。
- 在 `shared` 放入“暂时先放这里”的业务代码。

## 10. AI 协作说明

本规范不仅服务于人类开发者，也服务于后续参与本项目的其他 AI 工具。

因此，所有后续变更应遵守以下约定：

- 先读取本 spec，再开始结构性修改。
- 若任务涉及目录调整、边界变化、命名规则变化，应先更新 spec，再执行代码修改。
- 功能开发完成后，Agent 需要检查本轮改动是否影响目录职责、依赖边界或交互约定；如有影响，应同步更新本 spec 与相关文档（例如新增/调整模块职责说明）。
- 若实现与 spec 冲突，以“维护性优先、边界稳定优先”为默认决策原则。
- 若某项需求会明显破坏边界，应拆成更小的子任务，而不是直接绕过规范。

## 11. 本 spec 的角色

此文件是当前阶段的结构性约束文档，不是产品 PRD，也不是实施 checklist。

它负责回答以下问题：

- 项目的长期定位是什么。
- 当前阶段的目标是什么。
- 每个一级目录负责什么。
- 新代码应该放到哪里。
- 命名应该怎么统一。
- 后续 AI 与开发者应如何继续协作。

若未来项目目标发生显著变化，应基于新目标更新此 spec，而不是默默偏离。

## 12. Refactoring History

### Phase 1: Shared Layer Refactoring (2026-04-10)

- Completed items
  - Added provider type guard functions `isOpenAIProvider` and `isCodexProvider` in `/src/shared/types/settings.ts` to centralize provider narrowing logic.
  - Added comprehensive JSDoc documentation to shared/LLM core type modules:
    - `/src/shared/types/settings.ts`
    - `/src/shared/types/runtime-messages.ts`
    - `/src/shared/types/chat.ts`
    - `/src/llm/model/chat.ts`
  - Completed verification for this phase: build, tests, and typecheck all pass.

- Benefits
  - Reduced repeated provider branch checks across layers by reusing shared type guards.
  - Improved type readability and maintainability through explicit type-level documentation.
  - Lowered onboarding and cross-module collaboration cost by making shared contracts easier to understand.

- Next Phase
  - Continue with the planned provider/service layer refactoring tasks on top of the stabilized shared type contracts.

