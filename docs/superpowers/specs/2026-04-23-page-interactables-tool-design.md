# 页面交互元素快照与动作工具设计

## 1. 文档身份

- 文档类型：feature spec
- 约束级别：中
- 适用范围：`src/llm/tools`（工具定义与 tab 路由）、`src/ui/tools`（content script 侧 DOM 快照与动作执行）、`src/shared/types`（消息协议）
- 目标读者：本仓库内的 Agent / 维护者

本设计用于在**不发送整页 HTML**的前提下，让大模型以更低 token 成本理解“当前视窗里有哪些可交互元素”，并允许模型通过快照 `ref` 执行最小页面动作。

## 2. 背景与问题

直接把页面 HTML 或全文文本发送给模型会导致：

- token 过大，成本与延迟不可控；
- SPA/虚拟列表/延迟渲染导致“初始 HTML 缺失真实 UI”；
- selector/xpath 不稳定，模型难以可靠选择目标。

因此需要一个**结构化、可截断、语义友好**的页面快照输出。

## 3. 当前阶段约束（重要）

- 本阶段保留只读快照工具：`get_current_page_interactables`。
- 本阶段新增最小页面动作工具：`page_mouse_move`、`page_click`、`page_type`、`page_scroll`、`page_drag`。
- 除 `page_scroll` 外，页面动作工具必须基于快照 `ref` 执行，不暴露任意坐标参数给模型。
- 页面动作工具只覆盖当前阶段的基础交互，不扩展成通用浏览器自动化框架。
- 工具输出必须可控，必须有上限（例如最多 60 个候选）。

## 4. 当前实现（Snapshot -> Ref）

新增 LLM Tool：`get_current_page_interactables`，由 background 侧工具定义与 content script 侧 DOM 快照执行共同组成：

1. `src/llm/tools/get-page-interactables-tool.ts` 通过 `chrome.tabs.query` 获取当前激活 tab。
2. background 侧工具通过 `chrome.tabs.sendMessage` 向当前 tab 发送 `chatbrowserx.tool.get-page-interactables.request`。
3. `src/ui/tools/get-page-interactables-tool.ts` 在 content script 环境扫描当前页面 DOM 候选元素。
4. content 侧使用 `dom-accessibility-api` 的 `computeAccessibleName()` 计算控件名称，并结合原生标签、`role`、`placeholder`、状态属性与几何信息生成快照。
5. content 侧过滤禁用、隐藏、视窗外、尺寸过小、明显被遮挡的元素。
6. content 侧对嵌套候选做去重，避免同一可点击行的父容器、文本层、图标层重复输出。
7. 工具输出 compact payload，并**仅输出当前视窗（viewport）内**的候选。
8. content 侧维护最近一次快照的 `sid` 与 `ref -> element` 映射，供最小动作工具校验快照一致性并解析目标元素。

## 5. Tool 规范

### 5.1 Tool 名称

- `get_current_page_interactables`

### 5.2 Tool 参数

- 无参数（避免模型以参数形式触发不可控扫描或滥用）

### 5.3 Tool 输出（payload）

输出对象必须满足：

- 可被 `JSON.stringify` 序列化；
- 仅包含必要字段；
- 文本字段必须截断（例如 `name` 上限 120 字符）。

当前结构：

```ts
interface PageInteractablesSnapshot {
  v: [number, number]; // `[viewportWidth, viewportHeight]`
  sid: string; // 本次快照的短 ID，用于 action 工具做一致性校验
  items: Array<[
    ref: string,        // 短引用，例如 `"e12"`
    role: string,       // 可交互 role，例如 `"button"`、`"textbox"`
    name: string,       // 由 `computeAccessibleName()` 计算出的 accessible name
    rect: [number, number, number, number], // `[x, y, width, height]`
    meta?: {
      h?: string;       // 输入框/组合框的 value/placeholder 等摘要
      t?: string;       // 输入类型，例如 `"text"`、`"checkbox"`
      checked?: boolean;
      expanded?: boolean;
      pressed?: boolean;
      s?: "x" | "y" | "xy"; // 可滚动区域的滚动方向
    },
  ]>;
  d?: {
    ver: string; // 异常诊断版本
    q: {
      total: number;
      owned: number;
      hidden: number;
      disabled: number;
      noRole: number;
      small: number;
      covered: number;
      kept: number;
      writable: number;
      wrappers: number;
      p: number;
    };
    samples?: Array<{ tag?: string; id?: string; cls?: string; role?: string; reason?: string; text?: string; rect?: [number, number, number, number] }>;
  };
}
```

`d` 是异常诊断字段，只在“页面存在可写控件但当前快照未输出任何 `textbox` / `searchbox` 且候选很少”时返回，用于定位真实页面中的漏识别原因；正常成功快照不应返回该字段。

### 5.4 候选过滤与排序（必须）

- 仅保留“交互相关”的 DOM 候选：`button`、`a[href]`、`input`、`textarea`、`select`、`summary`、`label`、`[role]`、`[tabindex]`、`[contenteditable]` 等。
- 对非原生点击容器，允许扫描常见承载元素（例如 `div`、`span`、`li`、`td`、`th`），但必须继续依赖点击线索过滤，例如 `onclick`、`aria-controls`、`aria-haspopup`、`aria-expanded`、非负 `tabindex` 或计算后的 `cursor:pointer`。
- 对常见富代码编辑器容器（例如 `monaco-editor`、`cm-editor`、`CodeMirror`、`ace_editor`），允许将外层可见编辑器区域识别为 `textbox`，并用 `meta.t="code"` 标记。
- 对真实可写 `input` 被透明化、零尺寸化或由外层视觉表单行代理的页面，允许将包含可写控件的紧凑可见包装容器（例如 `p.pass-form-item`）识别为 `textbox`，并从内部控件读取名称、`placeholder` / `value` 作为输出；宽泛页面容器不得因此被识别为输入框。
- 对视窗内可滚动容器，允许识别为 `scrollarea`，并用 `meta.s` 标记可滚动方向，供 `page_scroll` 指定目标区域。
- 名称必须优先来自 accessible name 计算；对于无原生语义但有点击线索的容器，允许使用可见文本作为短名称 fallback。允许使用 `placeholder`、`title`、当前值作为辅助 `meta.h`，但不能用整页 DOM 文本替代结构化输出。
- 对父子嵌套候选，如果父候选已经覆盖同一语义区域（同 role 且名称相同、包含子名称或子名称为空），必须优先保留父候选，减少重复 ref。
- 对包含 `checkbox` / `radio` 的可点击选项行，必须优先保留整行可点击目标，并把内部勾选状态合并到整行 `meta.checked`，避免同一选项暴露多个容易混淆的 ref。
- 必须过滤：
  - `disabled=true` 的节点（或降低优先级）
  - ChatBrowserX 注入 UI 节点，包括 `chatbrowserx-root`、`chatbrowserx-page-action-overlay`、`chatbrowserx-subtitle-container`
  - 无几何信息或 `rect` 面积过小的节点
  - 不在当前视窗内的节点
  - 被其他元素明显遮挡的节点；若命中测试返回的是目标元素的祖先可见包装容器，不应视为遮挡；若紧凑表单行代理内部可写控件，也允许通过遮挡检查，以兼容真实 `input` 嵌在视觉外框内的登录/注册表单
- 必须排序并截断：默认最多 60 条（保证 token 上限稳定）。

## 6. 权限与隐私

- 当前实现不使用 `debugger` 权限。
- content script 已随扩展注入目标页面，工具通过既有 runtime message 链路触发 DOM 侧只读快照。
- 工具只输出结构化“控件语义 + 几何”，不输出整页文本，不输出 DOM/HTML。

## 7. 失败模式与错误码（最小集合）

- `TOOL_TAB_UNAVAILABLE`：找不到激活 tab
- `PAGE_ACTION_SNAPSHOT_REQUIRED`：基于 `ref` 的页面动作未携带 `sid`
- `PAGE_ACTION_SNAPSHOT_EXPIRED`：页面动作携带的 `sid` 已不是当前最新快照
- `PAGE_ACTION_REF_REQUIRED`：基于 `ref` 的页面动作未携带目标 `ref`
- `PAGE_ACTION_REF_NOT_FOUND`：目标 `ref` 不存在于当前最新快照
- `PAGE_ACTION_TARGET_UNAVAILABLE`：目标元素几何信息不可用或尺寸过小
- `PAGE_ACTION_TARGET_NOT_TEXT_INPUT`：`page_type` 的目标不是可输入控件
- content script 不可达时沿用 `chrome.tabs.sendMessage` 的 runtime 错误。

## 8. 与目录边界一致性

- 工具定义与 active tab 路由放在 `src/llm/tools`。
- DOM 快照执行逻辑放在 `src/ui/tools`，因为该部分需要 content script / DOM 能力。
- DOM 动作执行逻辑放在 `src/ui/tools`，因为该部分需要 content script / DOM 能力。
- 虚拟鼠标 overlay 放在 `src/ui/tools` 内部，只服务工具执行展示，不作为插件主 UI 或页面 selection 能力。
- 动作工具不得导航、提交未知后台任务或突破当前页面 DOM 边界。
- 输出用于模型“目标选择”，动作工具只能使用 `ref` 或滚动方向执行当前页面最小操作。

## 9. 页面动作工具

### 9.1 Tool 名称与参数

- `page_mouse_move`
  - 参数：`{ sid: string, ref: string }`
  - 行为：移动虚拟鼠标到目标元素中心，不触发真实点击。
- `page_click`
  - 参数：`{ sid: string, ref: string }`
  - 行为：移动虚拟鼠标到目标元素中心，展示点击波纹，并触发真实点击；返回可测量的点击前后状态，例如 `checked`、`expanded`、`pressed`，供模型判断点击是否生效。若 ref 指向控件内部文本层，content 侧应读取最近的有状态父控件或关联表单控件状态。
- `page_type`
  - 参数：`{ sid: string, ref: string, text: string, clear?: boolean }`
  - 行为：聚焦输入控件，必要时清空，再写入文本并派发 `input` / `change` 事件；返回输入前后的 `value` 或可编辑文本状态，供模型判断写入是否生效。若 ref 指向复合编辑器容器或表单包装行，content 侧应优先写入内部可见、未禁用的 `input`、`textarea`、`select` 或 `contenteditable` 节点，并跳过隐藏的占位输入与非文本输入。
- `page_scroll`
  - 参数：`{ direction: "up" | "down" | "left" | "right", amount?: number, sid?: string, ref?: string }`
  - 行为：如果提供 `sid` + `ref`，优先滚动对应 `scrollarea`；如果该目标在执行时已经不可继续滚动，则回退为滚动当前页面或 content 侧推断出的可见滚动容器；未提供目标时也使用该推断逻辑。默认滚动量由 content 侧限制。返回实际滚动目标、滚动前后位置与 `scrolled`，供模型判断滚动是否生效。
  - 模型约束：滚动成功后必须重新调用 `get_current_page_interactables` 获取新的视窗快照，再选择后续点击、输入或拖拽目标；`page_scroll` 本身不自动触发快照重算。
- `page_drag`
  - 参数：`{ sid: string, fromRef: string, toRef: string }`
  - 行为：从起点元素中心拖拽到终点元素中心，派发鼠标事件。

除 `page_scroll` 外，所有基于 `ref` 的动作必须携带同一次 `get_current_page_interactables` 返回的 `sid`。content script 只接受当前最新快照的 `sid`，避免页面滚动、重渲染或重新扫描后复用过期 `ref`。

### 9.2 返回结构

```ts
interface PageActionResult {
  ok: boolean;
  action: string;
  ref?: string;
  error?: string;
  changed?: boolean;
  stateBefore?: {
    checked?: boolean;
    expanded?: boolean;
    pressed?: boolean;
    value?: string;
    text?: string;
  };
  stateAfter?: {
    checked?: boolean;
    expanded?: boolean;
    pressed?: boolean;
    value?: string;
    text?: string;
  };
  scroll?: {
    target: "window" | "element";
    ref?: string;
    fallback?: boolean;
    leftBefore: number;
    leftAfter: number;
    topBefore: number;
    topAfter: number;
    scrolled: boolean;
  };
}
```

### 9.3 虚拟鼠标展示

- 执行动作时，页面上必须出现一个不拦截事件的虚拟鼠标 overlay。
- 动作展示完成后，虚拟鼠标必须自动隐藏，避免长期遮挡宿主页面。
- `page_mouse_move` 展示可见的虚拟鼠标指针，并通过位置过渡表现移动。
- `page_click` 展示醒目的按下态、双层点击波纹与中心闪点。
- `page_type` 展示移动、聚焦描边与短暂输入状态。
- `page_drag` 展示虚拟手形光标、拖拽路径、按下、移动、释放。
- `page_scroll` 展示方向提示，并与真实滚动同步。
