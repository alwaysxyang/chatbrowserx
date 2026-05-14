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
  - `get_current_page_elements`
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

当前工具集不扩展为通用浏览器自动化框架，不暴露任意坐标点击，不发送整页 HTML，不提供独立页面内容读取工具、自动滚动阅读、网络录制、PDF 解析或图片分析能力。

## 3. 目录与职责

### 3.1 `src/llm/tools`

- 负责工具定义、工具注册、工具参数 schema、active tab 解析与向 content script 发送 runtime message。
- `tool-registry.ts` 负责工具注册与 definition 聚合。
- `get-page-elements-tool.ts` 定义 `get_current_page_elements`。
- `page-action-tools.ts` 定义页面动作工具。
- `shared/active-tab.ts`、`shared/tab-message-tool.ts`、`shared/tool-arguments.ts`、`shared/tool-definition.ts` 放置多个工具共用的 tab、参数与 tool definition 辅助。
- `tavily/` 放置 Tavily 工具 definition、参数读取与 HTTP 请求。

`src/llm/tools` 可以使用 Chrome tab / message 能力，但不能访问 DOM。

### 3.2 `src/ui/tools`

- 负责 content script 中需要 DOM 的工具执行逻辑。
- `page-automation/runtime-listeners.ts` 注册当前视口元素快照与页面动作 listener。
- `page-automation/page-element-scanner.ts` 编排当前视窗页面元素扫描与快照序列化。
- `page-automation/interactable-candidate.ts` 承载候选数据模型、快照元数据与候选上限常量。
- `page-automation/interactable-role.ts` 承载候选 selector、滚动轴读取与候选角色推断。
- `page-automation/interactable-visibility.ts` 承载命中测试与文本输入 surface 可见性放宽规则。
- `page-automation/interactable-textbox-wrapper.ts` 承载紧凑输入包装器判定，供角色推断与命中测试共用。
- `page-automation/interactable-deduplication.ts` 承载父子候选、装饰性图标与代码编辑器辅助节点去重。
- `page-automation/interactable-naming.ts` 承载交互候选的可访问名称、短语义 token 与无标签 fallback 命名。
- `page-automation/interactable-diagnostics.ts` 承载元素快照诊断计数与样本采集。
- `page-automation/interactable-text.ts` 承载元素快照内部复用的文本截断辅助。
- `page-automation/page-text-scanner.ts` 承载当前视口只读正文文本块扫描，输出 `heading` / `text` 角色供页面分析使用。
- `page-automation/dom-targets.ts` 放置快照和动作共用的 DOM 目标判定。
- `page-automation/geometry.ts` 放置页面自动化内部复用的 viewport 点、矩形压缩、中心点、重叠率与可见面积计算。
- `page-automation/snapshot-store.ts` 保存最近快照 `sid` 与 `ref -> element` 映射。
- `page-automation/action-executor.ts` 编排页面动作分发，并保留动作执行所需的局部鼠标事件派发。
- `page-automation/action-targets.ts` 承载动作目标解析与焦点读取。
- `page-automation/action-state.ts` 承载动作前后状态遥测与状态变更判断。
- `page-automation/action-scroll.ts` 承载滚动目标选择、元素滚动与窗口滚动遥测。
- `page-automation/text-writer.ts` 统一处理 `page_type` 文本写入。
- `page-automation/rich-editor-bridge-main.ts` 是 `MAIN` world 窄桥接，只处理富代码编辑器模型写入。
- `page-automation/virtual-cursor-root.ts` 承载虚拟鼠标 overlay root、cursor 图标、移动/隐藏状态与局部 overlay 元素辅助。
- `page-automation/virtual-cursor.ts` 只服务页面动作展示入口，例如 mouse move、click、type、drag 与 scroll 视觉反馈。

`src/ui/tools` 不负责 provider 协议、tool loop 或后台调度。

### 3.3 `src/shared/types/tools`

- 只放工具跨层消息协议、payload 类型与类型守卫。
- 当前包括：
  - `page-elements.ts`：`chatbrowserx.tool.get-page-elements.request` 与 `GetPageElementsToolPayload`。
  - `page-action.ts`：`chatbrowserx.tool.page-action.request`、`PageActionToolRequestPayload`、`PageActionDirection`、`pageActionDirections`、`isPageActionDirection` 与 `PageActionToolResult`。
- 不放工具实现、DOM 逻辑、Chrome 调度或 provider 编排。

## 4. 工具注册与执行链路

1. `ChatCompletionService` 合成内部浏览器 Agent 工具使用约束与用户设置的 `systemPrompt`，再调用 tool call 编排。
2. `ToolRegistry.getDefinitions()` 汇总当前可见工具 definition。
3. 模型返回 tool call 后，tool module 的 `invoke()` 执行工具。
4. 页面工具通过 `tab-message-tool.ts` 向当前 active tab 发送消息。
5. content script 中的 `src/ui/tools` listener 执行当前视口元素快照或动作。
6. tool result 返回给 tool loop，由 tool loop 统一序列化后写回模型。

工具 `invoke()` 允许返回任意可序列化内容；工具模块本身不重复手动 `JSON.stringify`。

## 5. 页面阅读边界

### 5.1 当前实现

- LLM 工具不暴露自动滚动页面阅读能力，不提供独立页面内容读取工具。
- `get_current_page_elements` 会在当前视口快照内返回只读 `heading` / `text` 文本块，用于网页内容分析；这些文本块不携带 `op` / `w` 能力标记，不作为动作目标使用。
- Selection Ask AI 已在 UI 侧把当前页面 `innerText` 拼入 prompt，并在 prompt 中要求模型不要调用页面工具重复读取页面。
- 用户主动触发的打印/保存为 PDF 仍需要滚动扫描，但该能力位于 `src/ui/content/pdf/pdf-page-scanner.ts`，只服务 PDF 截图链路，不作为 LLM tool 暴露。

### 5.2 未来设计

- 如需重新引入大模型页面阅读工具，必须先更新主 spec 与本 spec，明确输出上限、是否滚动、与 `get_current_page_elements` 的关系。

## 6. 页面元素快照工具

### 6.1 `get_current_page_elements`

该工具返回当前视窗内页面元素的结构化快照，目标是在不发送整页 HTML、不自动滚动的前提下，让模型以较低 token 成本理解当前页面正文、可操作、可输入与可滚动目标。

LLM 侧工具通过 `chatbrowserx.tool.get-page-elements.request` 请求 content script。

工具输出必须满足：

- 仅包含当前视窗内候选。
- 必须包含当前视窗内可见正文的只读文本块。常见标题输出为 `heading`，普通正文和未知容器兜底文本输出为 `text`。
- 不自动滚动页面；页面分析必须像人类阅读页面一样先基于当前可见区域判断。
- 对整页、文档级或“分析当前页面”类任务，如果页面或 `scrollarea` 仍可能有后续内容，模型不得只根据单个局部视口直接下结论。
- 对只读页面分析，模型不得为了发现内容而点击导航、目录、菜单、工具栏或 AI 摘要控件；如果当前快照只看到导航或目录项且正文不足，应滚动相关 `scrollarea` 后重新获取元素。
- 如果当前可见元素不足以回答问题，且页面或 `scrollarea` 仍可能有后续内容，模型必须显式调用 `page_scroll`，再重新调用 `get_current_page_elements` 后继续分析，直到滚动不再带来新的相关内容或已找到答案。
- 模型应避免在同一未变化视口中不必要地反复调用 `get_current_page_elements`；应在执行 `page_scroll` / `page_click` / `page_type` / `page_drag` 等页面动作后、距离上次快照已有足够时间可能发生异步更新时，或模型判断必须重新获取才能保证正确性时刷新元素快照。
- 对线性页面阅读或分析，模型必须保持稳定扫描方向，通常从当前视口向下阅读；不得在没有用户要求回看、返回已知目标或任务位于上方的情况下上下反复滚动。
- 最多输出有界数量的候选，默认上限为 60。
- 文本字段必须截断。
- 不输出 DOM/HTML。
- 每个可操作、可输入或可滚动目标通过 `meta` 暴露能力标记。
- 正常成功快照不返回诊断字段；只有漏识别风险较高时才返回诊断信息。

当前 payload 结构：

```ts
interface PageElementsSnapshot {
  v: [number, number];
  sid: string;
  items: Array<[
    ref: string,
    role: string, // 例如 "heading"、"text"、"button"、"link"、"textbox"、"scrollarea"
    name: string,
    rect: [number, number, number, number],
    meta?: {
      h?: string;
      t?: string;
      op?: boolean;
      w?: boolean;
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

`meta` 字段约定：

- `op: true` 表示适合 `page_click`、`page_mouse_move` 或 `page_drag` 的可操作目标。
- `w: true` 表示适合 `page_type` 的可输入目标。
- `s` 表示可滚动区域方向，可配合 `sid` + `ref` 调用 `page_scroll`。
- `h` / `t` / `checked` / `expanded` / `pressed` 是辅助模型理解与验证动作的紧凑语义。
- `heading` / `text` 只用于阅读分析，不应携带 `op` / `w`，模型不得把它们作为点击或输入目标。

### 6.2 候选与命名规则

- 结构化候选包括原生交互元素、`role`、非负 `tabindex`、`contenteditable`、常见可点击容器、富代码编辑器 surface、紧凑输入包装行、可滚动容器；结构化候选 selector 不全量枚举普通 `div` / `span` / `section` / `p` 等布局节点，只保留显式语义、内联样式、常见 class token 或表单包装器信号；包含输入框的全页壳、宽问题区或宽表单容器不得仅因存在后代输入框而暴露为 `textbox`。
- 正文文本通过 text node 扫描补充：常见标题、段落、列表、表格单元格等按最近可见文本块输出；未知可见容器中的剩余文本兜底输出为 `text`，以覆盖当前视口可见 `innerText`。
- `scrollarea` 仅表示可滚动能力，不代表其内部正文已经被表达；文本扫描必须继续保留 `scrollarea` 内部可见正文。
- 单个正文块超过字段上限时必须拆成多个连续 `heading` / `text` 项，不能直接截断丢失尾部内容。
- 正文文本必须跳过已由按钮、链接、输入框 label 或其他结构化元素名称表达的重复内容。
- 必须过滤隐藏、禁用、视窗外、尺寸过小、明显遮挡、ChatBrowserX 自身 UI 节点。
- 名称优先来自 `computeAccessibleName()`。
- 对无文本图标按钮，可从短 token 推断常见语义，例如 `like`、`dislike`、`comments`、`bookmark`、`favorite`、`share`、`copy`、`menu`、`previous`、`next`。
- 如果图标语义与短可见计数同时存在，名称应合并为 `like 32.2K`、`comments 922` 这类完整语义。
- 如果仍无法推断，输出 `unlabeled <role>`；可以附加相邻短文本上下文，但不得根据页面坐标、元素序号或特定站点硬编码含义。
- 父子候选语义重复时优先保留覆盖语义更完整的候选。
- 复合编辑器内部展示层、辅助可访问性文本框、装饰性图标节点不应暴露为独立控件。

## 7. 页面动作工具

除 `page_scroll` 外，页面动作必须携带同一次 `get_current_page_elements` 返回的 `sid` 与目标 `ref`。content script 只接受当前最新快照的 `sid`，避免复用滚动或重渲染前的过期目标。

LLM 侧页面动作工具统一通过 `chatbrowserx.tool.page-action.request` 请求 content script。`PageActionToolRequestMessage` 的动作字段位于 message 顶层，不再额外包一层 `payload`。

- `page_mouse_move`
  - 参数：`{ sid: string, ref: string }`
  - 行为：移动虚拟鼠标到目标中心，不点击。
- `page_click`
  - 参数：`{ sid: string, ref: string }`
  - 行为：点击目标并返回可测量状态，例如 `checked`、`expanded`、`pressed`。
  - 只读页面分析不得用 `page_click` 点击导航、目录、菜单、工具栏或 AI 摘要控件来发现内容；遇到 `PAGE_ACTION_SNAPSHOT_EXPIRED` 时必须先重新调用 `get_current_page_elements`，并且只有动作仍然必要时才用最新 `sid` / `ref` 重试。
- `page_type`
  - 参数：`{ sid: string, ref: string, text: string, clear?: boolean }`
  - 行为：先点击目标；若点击后产生新的深层 `activeElement`，优先写入该焦点目标，否则写入由快照 `ref` 解析出的文本目标，避免旧焦点输入框被误写；富代码编辑器优先走 `rich-editor-bridge-main.ts`；`clear=true` 表示整体替换。
  - 对原生 `input` / `textarea` 执行 `clear=true` 时，清空选择必须限定在目标控件内部，不得通过页面级 `Ctrl+A` / `Meta+A` 或 `document.execCommand("selectAll")` 触发整页选择。
- `page_scroll`
  - 参数：`{ direction: "up" | "down" | "left" | "right", amount?: number, sid?: string, ref?: string }`
  - 行为：有 `sid` + `ref` 时优先滚动对应 `scrollarea`，否则滚动 viewport 中心命中的可滚动祖先或 window。
  - content 侧 fallback 必须模拟人类滚轮冒泡：有 `ref` 时只沿目标元素祖先链寻找可滚动容器，无 `ref` 时只沿 viewport 中心元素祖先链寻找可滚动容器；不得切换到无关的可见 `scrollarea`。
  - `amount` 默认应省略；如果模型主动提供，应根据当前 viewport 或目标 `scrollarea` 的可见高度推断人类操作尺度，避免一次滚过多内容。
  - content 侧执行必须按实际滚动目标的可见高度限制显式 `amount`，避免模型给出过大的距离时跳过内容。
  - 返回的滚动遥测必须包含 `scrolled=true/false` 与当前方向的 `canScrollMore=true/false`。
  - 如果返回 `scrolled=true`，模型不得基于滚动前快照回答，必须重新调用 `get_current_page_elements`。
  - 如果返回 `scrolled=false`，通常不需要立即调用 `get_current_page_elements` 重复读取同一视口；但如果页面可能异步更新、距离上次快照已有足够时间、另一个动作导致页面可见内容变化，或模型判断必须重新获取才能保证正确性，可以再次刷新元素快照。
  - 对整页或文档级分析，模型必须在 `canScrollMore=true` 且新视口仍有相关内容时继续 `page_scroll` + `get_current_page_elements`，直到 `canScrollMore=false` 或已找到答案。
  - 对线性页面阅读或分析，模型必须保持稳定扫描方向；除非用户明确要求回看、需要返回先前已见目标或任务明确位于上方，否则不得在 `down` 与 `up` 之间来回切换。
- `page_drag`
  - 参数：`{ sid: string, fromRef: string, toRef: string }`
  - 行为：从起点元素中心拖拽到终点元素中心。

动作返回结构应包含 `ok`、`action`、`changed`、错误码、动作前后状态或滚动前后位置，供模型判断动作是否生效。
页面动作必须尽量保持人类操作节奏：虚拟鼠标或提示动画应先移动/展示到位，再触发真实 DOM 事件、文本写入、滚动或拖拽遥测。

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
