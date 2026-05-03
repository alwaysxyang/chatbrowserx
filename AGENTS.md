# AGENTS.md

本文件定义本仓库内 Agent / AI 工具的协作规则。

## 0. 必须遵守

- 所有回复的第一句话必须以 `AGENTS_OK` 开头。
- 只允许修改工作区文件，不允许创建任何 git commit。
- 开始任何回复、澄清、设计、实现或调研前，必须先检查并加载适用 skill。
- 开始结构性任务、跨模块改动、目录变更、文件新增、重构、设计或规范调整前，必须先阅读 `docs/superpowers/specs/browser-agent-project-spec.md`。

## 1. 核心目标

ChatBrowserX 当前追求的是“最容易长期维护的大模型浏览器增强 Agent 骨架”，不是最快堆功能。

所有实现、重构、删减、命名与结构决策都必须优先满足：

1. 维护性优先。
2. 模块边界清晰。
3. 依赖方向稳定。
4. 文档与实现同步。
5. 改动小、可回滚、不提前实现未进入当前范围的能力。

## 2. 必读 spec

主 spec：

- `docs/superpowers/specs/browser-agent-project-spec.md`

子领域 spec：

- LLM / Tavily / 页面工具：`docs/superpowers/specs/llm-tools-spec.md`
- Speech / Volcengine：`docs/superpowers/specs/speech-feature-spec.md`
- 页面选中文本气泡：`docs/superpowers/specs/selection-bubble-feature-spec.md`

如果任务涉及某个子领域，必须同时阅读主 spec 与对应子领域 spec。

## 3. Spec 优先级

当文档与代码冲突时，默认按以下顺序处理：

1. 当前代码真实实现。
2. 主 spec。
3. 对应 feature / folder spec。

如果确认当前代码是正确方向，必须在同一轮改动中把相关 spec 更新到一致状态。

## 4. Spec 同步硬规则

以下变化必须同步更新 spec：

- 一级目录结构变化。
- 文件夹新增、删除、移动、合并。
- 模块职责或关键文件职责变化。
- 命名规范变化。
- 当前阶段范围变化。
- 消息协议变化。
- 设置结构变化。
- 运行链路变化。
- AI 协作边界变化。

如果代码已经改变，而 spec 仍停留在旧状态，则任务不能视为完成。

## 5. 目录归属

- 用户可见界面：`src/ui`
- 插件主 UI 壳、侧边栏、聊天、设置、字幕入口：`src/ui/content`
- 面向宿主网页的 selection、viewport、DOM 事件与页面级浮层：`src/ui/page`
- 多个 UI 子域复用的纯展示组件与样式：`src/ui/shared`
- 需要 content script / DOM 能力的工具执行逻辑：`src/ui/tools`
- Chrome 后台任务、消息路由、调度：`src/background`
- LLM provider、stream、service、tool 协议：`src/llm`
- 语音 provider lifecycle 与 service：`src/speech`
- 跨层共享类型、存储、i18n、无业务偏向基础能力：`src/shared`

如果一个模块同时像 `ui` 又像 `background`，或同时像 `shared` 又像业务层，应继续拆分职责。

## 6. 当前硬性边界

- `ui` 不直接依赖 provider 实现。
- `ui` 不直接承担 LLM 编排、tool loop 或后台长流程。
- `background` 不直接书写 JSX。
- `llm/providers` 与 `llm/services` 不直接依赖 Chrome API。
- `llm/tools` 可使用 tab/message 能力，但不得依赖 DOM；DOM 读取、滚动、点击、输入必须留在 `ui/tools`。
- `speech` 不直接承载 content UI 状态。
- `shared` 不放具体业务编排逻辑。
- `ui/page` 不放插件侧边栏、设置、聊天等插件主内容 UI。
- `ui/shared` 只放可复用展示组件与样式。
- `index.ts` 仅用于入口装配或导出聚合，不承载主要业务逻辑。

## 7. 当前阶段范围

当前阶段保留内容以 `docs/superpowers/specs/browser-agent-project-spec.md` 为准，主要包括：

- 基础聊天、最小设置、provider 抽象。
- 聊天输入图片能力。
- 页面选中文本气泡。
- 当前允许的 LLM / Tavily / 页面工具。
- 最小 speech 骨架与 `volcengine` 最小接入。
- 用户主动触发的打印/保存为 PDF。

当前阶段明确不做：

- 完整语音识别 / 同声传译产品化能力。
- 独立图片分析 / 截图分析工具。
- PDF 解析/阅读/编辑能力。
- 通用滚动捕获框架。
- 网络录制 / 页面流量分析。
- 当前 spec 未列出的新具体工具。

## 8. 命名与注释

- 目录名使用 `kebab-case`。
- React 组件文件使用 `PascalCase.tsx`。
- 非组件文件使用 `kebab-case.ts`。
- 组件名使用 `PascalCase`。
- 普通函数使用 `camelCase`。
- Hook 使用 `useXxx`。
- 职责型文件优先使用显式后缀，例如 `*-provider.ts`、`*-orchestrator.ts`、`*-repository.ts`。
- 禁止引入 `utils2.ts`、`commonService.ts`、`temp.ts`、`AppHelpers.ts` 这类模糊命名。
- 所有函数必须有英文 JSDoc 注释。
- 注释应描述职责、行为和边界，不逐行翻译实现。
- 修改函数行为时必须同步更新注释。

## 9. 文档书写

- 规范性描述使用简体中文。
- 代码标识符、路径、类型名、消息名使用英文并加反引号。
- 文档必须标注自身类型、适用范围与约束级别。
- 文档必须区分“当前实现”和“未来设计”。
- 文档中的目录树、运行链路、字段结构、消息协议、职责边界必须映射到当前代码。
- 不再保留只记录历史的 plan 或归档 spec；无当前约束价值的文档应删除或并入有效 spec。

## 10. 变更原则

- 先确认边界，再写实现。
- 先删废弃调用链，再删旧实现。
- 不要把逻辑塞回超级文件。
- 不要把“暂时没地方放”的代码放进 `shared`。
- 不要仅因为测试失败而修改主逻辑；先确认是测试过期还是需求改变。
- 大范围改动必须先给出设计或规划，再开始实现。
- 不允许 revert 用户或其他工具已经做出的无关改动。
