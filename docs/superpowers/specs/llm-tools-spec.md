# LLM 与页面工具规范

## 1. 文档身份

- 文档类型：feature spec / folder spec
- 约束级别：低于主 spec
- 适用范围：`src/llm/tools`、`src/ui/tools`、`src/shared/types/tools`、`src/ui/content/settings`
- 上级文档：`docs/superpowers/specs/browser-agent-project-spec.md`

本文件约束当前 LLM tool 能力、页面 content script 工具执行边界、Tavily 集成与工具协议。它不能覆盖主 spec 对目录职责和依赖方向的规定。

## 2. 当前工具范围

当前允许暴露给模型的工具只有：

- 页面只读工具：
  - `get_current_page_content`
  - `get_current_page_interactables`
- 基于快照 `sid` + `ref` 的页面动作工具：
  - `page_mouse_move`
  - `page_click`
  - `page_type`
  - `page_scroll`
  - `page_drag`
- Tavily 网页检索工具：
  - `tavily_search`
  - `tavily_extract`
  - `tavily_crawl`

当前工具集不扩展为通用浏览器自动化框架，不暴露任意坐标点击，不发送整页 HTML，不提供网络录制、PDF 解析或图片分析能力。

## 3. 目录与职责

### 3.1 `src/llm/tools`

- 负责工具定义、工具注册、工具参数 schema、active tab 解析与向 content script 发送 runtime message。
- `tool-registry.ts` 负责工具注册与 definition 聚合。
- `get-page-content-tool.ts` 定义 `get_current_page_content`。
- `get-page-interactables-tool.ts` 定义 `get_current_page_interactables`。
- `page-action-tools.ts` 定义页面动作工具。
- `shared/active-tab.ts`、`shared/tab-message-tool.ts`、`shared/tool-arguments.ts` 放置多个工具共用的 tab 与参数辅助。
- `tavily/` 放置 Tavily 工具 definition、参数读取与 HTTP 请求。

`src/llm/tools` 可以使用 Chrome tab / message 能力，但不能访问 DOM。

### 3.2 `src/ui/tools`

- 负责 content script 中需要 DOM 的工具执行逻辑。
- `get-page-content-tool.ts` 注册页面内容读取的 content 侧 listener。
- `page-content/content-reader.ts` 负责页面文本读取。
- `page-content/page-scanner.ts` 负责主滚动容器识别与滚动扫描辅助。
- `page-automation/runtime-listeners.ts` 注册交互快照与页面动作 listener。
- `page-automation/interactable-scanner.ts` 编排当前视窗交互元素扫描。
- `page-automation/interactable-support.ts` 承载候选角色推断、几何过滤、元数据与去重。
- `page-automation/interactable-naming.ts` 承载交互候选的可访问名称、短语义 token 与无标签 fallback 命名。
- `page-automation/interactable-diagnostics.ts` 承载交互快照诊断计数与样本采集。
- `page-automation/interactable-text.ts` 承载交互快照内部复用的文本截断辅助。
- `page-automation/dom-targets.ts` 放置快照和动作共用的 DOM 目标判定。
- `page-automation/snapshot-store.ts` 保存最近快照 `sid` 与 `ref -> element` 映射。
- `page-automation/action-executor.ts` 编排页面动作分发。
- `page-automation/action-support.ts` 承载目标解析、状态遥测、滚动执行与鼠标事件几何。
- `page-automation/text-writer.ts` 统一处理 `page_type` 文本写入。
- `page-automation/rich-editor-bridge-main.ts` 是 `MAIN` world 窄桥接，只处理富代码编辑器模型写入。
- `page-automation/virtual-cursor.ts` 只服务页面动作展示。

`src/ui/tools` 不负责 provider 协议、tool loop 或后台调度。

### 3.3 `src/shared/types/tools`

- 只放工具跨层消息协议、payload 类型与类型守卫。
- 当前包括：
  - `page-content.ts`：`chatbrowserx.tool.get-page-content.request` 与 `GetPageContentToolPayload`。
  - `page-interactables.ts`：`chatbrowserx.tool.get-page-interactables.request` 与 `GetPageInteractablesToolPayload`。
  - `page-action.ts`：`chatbrowserx.tool.page-action.request`、`PageActionToolRequestPayload` 与 `PageActionToolResult`。
- 不放工具实现、DOM 逻辑、Chrome 调度或 provider 编排。

## 4. 工具注册与执行链路

1. `ChatCompletionService` 调用 tool call 编排。
2. `ToolRegistry.getDefinitions()` 汇总当前可见工具 definition。
3. 模型返回 tool call 后，tool module 的 `invoke()` 执行工具。
4. 页面工具通过 `tab-message-tool.ts` 向当前 active tab 发送消息。
5. content script 中的 `src/ui/tools` listener 执行 DOM 读取或动作。
6. tool result 返回给 tool loop，由 tool loop 统一序列化后写回模型。

工具 `invoke()` 允许返回任意可序列化内容；工具模块本身不重复手动 `JSON.stringify`。

## 5. 页面内容读取工具

### 5.1 `get_current_page_content`

- 读取当前页面内容摘要，不作为 Ask AI selection 的二次页面读取入口。
- LLM 侧工具通过 `chatbrowserx.tool.get-page-content.request` 请求 content script。
- content 侧执行位于 `src/ui/tools/get-page-content-tool.ts` 与 `src/ui/tools/page-content/content-reader.ts`。
- 页面滚动扫描辅助由 `src/ui/tools/page-content/page-scanner.ts` 承载。
- 输出必须有上限，不能发送整页 HTML。

Selection Ask AI 已在 UI 侧把当前页面 `innerText` 拼入 prompt，并在 prompt 中要求模型不要调用页面读取工具。

## 6. 页面交互快照工具

### 6.1 `get_current_page_interactables`

该工具返回当前视窗内可交互元素的结构化快照，目标是在不发送整页 HTML 的前提下，让模型以较低 token 成本理解当前页面可操作目标。

LLM 侧工具通过 `chatbrowserx.tool.get-page-interactables.request` 请求 content script。

工具输出必须满足：

- 仅包含当前视窗内候选。
- 最多输出有界数量的候选，默认上限为 60。
- 文本字段必须截断。
- 不输出 DOM/HTML。
- 正常成功快照不返回诊断字段；只有漏识别风险较高时才返回诊断信息。

当前 payload 结构：

```ts
interface PageInteractablesSnapshot {
  v: [number, number];
  sid: string;
  items: Array<[
    ref: string,
    role: string,
    name: string,
    rect: [number, number, number, number],
    meta?: {
      h?: string;
      t?: string;
      checked?: boolean;
      expanded?: boolean;
      pressed?: boolean;
      s?: "x" | "y" | "xy";
    },
  ]>;
  d?: {
    ver: string;
    q: Record<string, number>;
    samples?: Array<{ tag?: string; id?: string; cls?: string; role?: string; reason?: string; text?: string; rect?: [number, number, number, number] }>;
  };
}
```

### 6.2 候选与命名规则

- 候选包括原生交互元素、`role`、非负 `tabindex`、`contenteditable`、常见可点击容器、富代码编辑器 surface、紧凑输入包装行、可滚动容器。
- 必须过滤隐藏、禁用、视窗外、尺寸过小、明显遮挡、ChatBrowserX 自身 UI 节点。
- 名称优先来自 `computeAccessibleName()`。
- 对无文本图标按钮，可从短 token 推断常见语义，例如 `like`、`dislike`、`comments`、`bookmark`、`favorite`、`share`、`copy`、`menu`、`previous`、`next`。
- 如果图标语义与短可见计数同时存在，名称应合并为 `like 32.2K`、`comments 922` 这类完整语义。
- 如果仍无法推断，输出 `unlabeled <role>`；可以附加相邻短文本上下文，但不得根据页面坐标、元素序号或特定站点硬编码含义。
- 父子候选语义重复时优先保留覆盖语义更完整的候选。
- 复合编辑器内部展示层、辅助可访问性文本框、装饰性图标节点不应暴露为独立控件。

## 7. 页面动作工具

除 `page_scroll` 外，页面动作必须携带同一次 `get_current_page_interactables` 返回的 `sid` 与目标 `ref`。content script 只接受当前最新快照的 `sid`，避免复用滚动或重渲染前的过期目标。

LLM 侧页面动作工具统一通过 `chatbrowserx.tool.page-action.request` 请求 content script。`PageActionToolRequestMessage` 的动作字段位于 message 顶层，不再额外包一层 `payload`。

- `page_mouse_move`
  - 参数：`{ sid: string, ref: string }`
  - 行为：移动虚拟鼠标到目标中心，不点击。
- `page_click`
  - 参数：`{ sid: string, ref: string }`
  - 行为：点击目标并返回可测量状态，例如 `checked`、`expanded`、`pressed`。
- `page_type`
  - 参数：`{ sid: string, ref: string, text: string, clear?: boolean }`
  - 行为：先点击聚焦，再优先写入当前深层 `activeElement`；富代码编辑器优先走 `rich-editor-bridge-main.ts`；`clear=true` 表示整体替换。
- `page_scroll`
  - 参数：`{ direction: "up" | "down" | "left" | "right", amount?: number, sid?: string, ref?: string }`
  - 行为：有 `sid` + `ref` 时优先滚动对应 `scrollarea`，否则滚动页面或 content 侧推断出的可见滚动容器。
  - 滚动后模型必须重新调用 `get_current_page_interactables`。
- `page_drag`
  - 参数：`{ sid: string, fromRef: string, toRef: string }`
  - 行为：从起点元素中心拖拽到终点元素中心。

动作返回结构应包含 `ok`、`action`、`changed`、错误码、动作前后状态或滚动前后位置，供模型判断动作是否生效。

## 8. 页面动作约束

- 页面动作不得接受任意 raw 坐标。
- 页面动作不得导航、提交未知后台任务或突破当前页面 DOM 边界。
- 页面动作只能使用 `ref`、滚动方向与有界文本执行当前页面最小操作。
- 执行动作时可以展示不拦截事件的虚拟鼠标 overlay，展示结束后必须自动隐藏。
- 富代码编辑器桥接只允许处理编辑器模型写入，不承载通用页面脚本注入能力。

## 9. Tavily 工具

### 9.1 目录职责

`src/llm/tools/tavily` 负责 Tavily 工具 definition、参数装配、请求执行与 Tavily 专属边界。

- `index.ts` 聚合 Tavily 工具注册。
- `tavily-search-tool.ts` 定义 `tavily_search`。
- `tavily-extract-tool.ts` 定义 `tavily_extract`。
- `tavily-crawl-tool.ts` 定义 `tavily_crawl`。
- `tavily-request.ts` 负责 API key 读取、definition 可见性判断、HTTP 请求与错误处理。

### 9.2 设置与可见性

- Tavily 凭证存放在 `settings.model.tavilyApiKey`。
- `src/ui/content/settings/ChatSettingsForm.tsx` 只负责展示和编辑 `Tavily Key`，不做连通性校验。
- Tavily 工具模块可以无条件注册到 `ToolRegistry`。
- `definition()` 每次生成工具列表时读取最新设置；如果 `tavilyApiKey` 为空，返回 `null`，不暴露给模型。
- `invoke()` 执行时再次读取最新设置，并使用 `Bearer` 方式请求 Tavily。

### 9.3 当前不做

- Tavily base URL 设置项。
- Tavily 请求结果持久化。
- UI 侧独立 Tavily 调试入口。
- Tavily 之外的新网页搜索 provider。
- 将 Tavily 逻辑下沉到 `shared` 或上提到 `ui`。

## 10. 错误边界

- active tab 不可用时返回 `TOOL_TAB_UNAVAILABLE`。
- 页面动作缺少快照或目标时返回对应 `PAGE_ACTION_*` 错误。
- 快照过期时返回 `PAGE_ACTION_SNAPSHOT_EXPIRED`。
- 目标不可用或不是可输入控件时返回对应目标错误。
- content script 不可达时沿用 `chrome.tabs.sendMessage` 的 runtime 错误。
- Tavily 请求失败时在 Tavily 工具内收敛错误信息，不泄露敏感凭证。

## 11. 变更要求

以下变化必须同步更新本文件：

- `src/llm/tools` 工具列表、参数、返回结构或注册规则变化。
- `src/ui/tools` 目录职责、快照输出、页面动作执行语义变化。
- `src/shared/types/tools` 消息协议变化。
- Tavily 设置结构、可见性或调用链路变化。
