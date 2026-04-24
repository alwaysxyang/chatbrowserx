# Tavily 工具设计说明

## 1. 文档身份

- 文档类型：feature spec / folder spec
- 约束级别：中
- 适用范围：`src/llm/tools/tavily`、`src/llm/tools/shared`、`src/shared/types/settings.ts`、`src/shared/storage/settings-*`、`src/ui/content/settings`
- 语言要求：规范性描述统一使用简体中文；代码标识符、路径、类型名、函数名使用英文并加反引号

本文档说明 Tavily 搜索工具的当前实现边界，用于约束 `Tavily` 相关设置、工具注册与运行时调用方式。

## 2. 当前实现目标

当前 Tavily 集成只提供最小网页搜索能力补充，包括：

- `tavily_search`
- `tavily_extract`
- `tavily_crawl`

实现目标是为 `llm/tools` 增加可维护的外部网页检索能力，同时保持：

- 工具能力集中在 `src/llm/tools/tavily`
- 设置入口仍归 `settings -> model`
- 工具可见性与调用凭证均依赖最新设置

## 3. 目录与职责

### 3.1 `src/llm/tools/tavily`

该文件夹负责 Tavily 工具本身的 definition、参数装配、请求执行与 Tavily 专属工具边界。

当前关键文件：

- `src/llm/tools/tavily/index.ts`
  - 负责聚合 Tavily 工具模块注册
- `src/llm/tools/tavily/tavily-search-tool.ts`
  - 负责 `tavily_search`
- `src/llm/tools/tavily/tavily-extract-tool.ts`
  - 负责 `tavily_extract`
- `src/llm/tools/tavily/tavily-crawl-tool.ts`
  - 负责 `tavily_crawl`
- `src/llm/tools/tavily/tavily-request.ts`
  - 负责 Tavily API key 读取
  - 负责 Tavily 工具 definition 可见性判断
  - 负责 Tavily HTTP 请求与错误处理

### 3.2 `src/llm/tools/shared`

该文件夹负责多个 tool module 可复用的辅助能力，不承载某个具体工具的 definition 或 provider 专属请求逻辑。

当前关键文件：

- `src/llm/tools/shared/tool-arguments.ts`
  - 负责通用参数读取与基础校验

### 3.3 依赖方向

`src/llm/tools/tavily`：

- 可以依赖 `src/shared/storage`
- 可以依赖 `src/shared/types`
- 可以依赖 `src/llm/tools/tool-registry.ts`
- 可以依赖 `src/llm/tools/shared`
- 可以依赖 `src/shared/storage`
- 不直接依赖 `src/ui`
- 不直接依赖 Chrome tab / DOM 能力

`src/llm/tools/shared`：

- 可以依赖 `src/shared/storage`
- 可以依赖 `src/llm/tools/tool-registry.ts`
- 不直接依赖 `src/ui`
- 不直接依赖 Chrome tab / DOM 能力

## 4. 设置模型约束

### 4.1 `settings.model.tavilyApiKey`

`Tavily` 凭证放在 `settings.model.tavilyApiKey`，原因如下：

- 它属于模型侧工具调用配置，而不是 `general` 或 `speech`
- 当前设置面板中的模型页已经承担 provider 与 system prompt 编辑职责
- 该字段不绑定某个具体聊天 provider，但服务于 `llm/tools`

### 4.2 UI 约束

`src/ui/content/settings/ChatSettingsForm.tsx` 负责展示 `Tavily Key` 输入框。

该输入框：

- 只负责读取与编辑 `settings.model.tavilyApiKey`
- 不负责任何 Tavily 请求连通性校验
- 不负责决定工具最终是否被调用

## 5. 工具注册与可见性

### 5.1 当前实现

三个 Tavily 工具在模块加载时无条件注册到 `ToolRegistry`。

这样做的目的：

- 保持工具模块结构稳定
- 避免把设置读取放进 import / register 阶段
- 允许后续继续沿用统一 registry 注册模式

### 5.2 可见性规则

`ToolRegistry.getDefinitions()` 在每次生成工具列表时调用各工具的 `definition()`。

如果当前 `settings.model.tavilyApiKey` 为空，则 Tavily 工具的 `definition()` 返回 `null`，registry 负责过滤，不把 Tavily 工具暴露给模型。

因此：

- 注册存在，不代表模型可见
- 模型可见性取决于每次请求时的最新设置

## 6. 调用链路

### 6.1 工具列表生成

1. `ChatCompletionService` 发起模型请求
2. `tool-call-orchestrator` 调用 `ToolRegistry.getDefinitions()`
3. Tavily 工具读取最新设置
4. 如果 `tavilyApiKey` 为空，则不进入本轮 `tools`

### 6.2 工具执行

1. 模型返回 `tavily_search` / `tavily_extract` / `tavily_crawl`
2. 对应工具的 `invoke()` 再次调用 `loadSettings()`
3. 读取最新 `settings.model.tavilyApiKey`
4. 使用 `Bearer` 方式请求 Tavily 官方接口

这种双阶段读取是当前硬约束：

- definition 阶段决定是否暴露工具
- invoke 阶段决定实际请求使用的最新凭证

## 7. 参数边界

当前 Tavily 工具遵循“最小参数面”原则：

- 只暴露高频、可稳定被模型理解的参数
- 不追求完整镜像 Tavily 全部原始参数
- 默认值在工具模块内部收敛
- 通用参数读取逻辑应优先收敛在 `src/llm/tools/shared`

如果后续需要扩展参数，必须满足：

- 能明显提升模型调用效果
- 不破坏当前工具描述清晰度
- 仍然保持 `shared.ts` 里的复用边界清晰

## 8. 当前明确不做

当前 Tavily 集成不包含：

- Tavily base URL 设置项
- Tavily 请求结果持久化
- UI 侧独立 Tavily 调试入口
- Tavily 之外的新网页搜索 provider
- 将 Tavily 逻辑下沉到 `shared` 或上提到 `ui`
