# ChatBrowserX 项目重构设计方案

## 1. 重构目标

本次重构的核心目标：

1. **维持现有功能以及交互不变** - 所有用户可见的功能和交互保持一致
2. **代码简洁明了，可维护** - 提升代码质量，降低维护成本
3. **拆分大文件** - 将功能复杂的大文件按模块进一步拆分
4. **消除冗余代码** - 删除或合并功能类似的代码
5. **合并碎片化 helper** - 整合 ui/chat 中过于分散的 helper 文件
6. **同步更新 spec** - 结构改变时同步更新项目规范文档
7. **优化结构体** - 审查和优化类型定义

## 2. 重构策略

采用**渐进式模块化重构**策略，按以下顺序进行：

1. **第一阶段 - 基础层**：重构 `shared` 层的类型和工具
2. **第二阶段 - LLM 层**：重构 provider 和 services
3. **第三阶段 - UI 层**：重构 chat 相关组件和 helper
4. **第四阶段 - 清理**：删除冗余代码，优化导入关系

**策略优势**：
- 风险可控，每个阶段都可以验证
- 符合依赖方向（从底层到上层）
- 测试失败时容易定位问题
- 可以随时暂停或调整

## 3. 第一阶段：基础层重构（shared 层）

### 3.1 类型系统优化

**目标文件**：
- `shared/types/chat.ts`
- `shared/types/settings.ts`
- `shared/types/runtime-messages.ts`
- `llm/model/chat.ts`

**重构内容**：

#### 3.1.1 消除类型重复
- 检查 `shared/types/chat.ts` 和 `llm/model/chat.ts` 的类型重复
- 将纯 UI 相关的类型保留在 `shared/types/chat.ts`
- 将 LLM 协议相关的类型保留在 `llm/model/chat.ts`
- 共享的基础类型（如 `ChatMessage`）放在 `shared/types/chat.ts`

**当前状态分析**：
- `shared/types/chat.ts`：定义了 UI 层使用的 `ChatMessage`、`ChatMessageContent`
- `llm/model/chat.ts`：定义了 LLM 层使用的 `LlmChatMessage`、`LlmUserMessage` 等
- 两者共享 `ChatContentPart` 类型（多模态内容）
- **结论**：当前类型边界清晰，无需大改，仅需优化类型导出和文档注释

#### 3.1.2 Settings 类型优化
- 确保 provider 专属配置的类型定义清晰
- 添加类型守卫函数，方便运行时判断
- 优化 helper 函数的类型推导

**当前状态分析**：
- `settings.ts` 已经有清晰的 provider 专属配置（`OpenAIModelSettings`、`CodexModelSettings`）
- 已有 helper 函数（`getActiveProviderBaseUrl` 等）
- **优化点**：添加类型守卫函数，如 `isOpenAIProvider()`、`isCodexProvider()`

#### 3.1.3 Runtime Messages 协议优化
- 统一消息类型的命名规范
- 确保类型守卫函数完整
- 添加必要的文档注释

**当前状态分析**：
- `runtime-messages.ts` 已有完整的类型守卫函数
- 命名规范统一（`*Message`、`*Response`）
- **优化点**：添加 JSDoc 注释，说明每个消息类型的用途

**预期产出**：
- 类型定义更清晰，职责边界明确
- 减少类型重复
- 更好的类型推导和 IDE 支持

## 4. 第二阶段：LLM 层重构

### 4.1 Provider 公共逻辑抽取

**目标文件**：
- `llm/providers/codex-provider.ts` (73行)
- `llm/providers/openai-compatible-provider.ts` (60行)
- `llm/providers/codex-responses-stream.ts` (213行) ⚠️
- `llm/providers/openai-compatible-stream.ts` (73行)
- `llm/providers/codex-responses-format.ts` (138行) ⚠️
- `llm/providers/openai-compatible-wire-format.ts` (93行)

**重构内容**：

#### 4.1.1 抽取公共流式处理逻辑
- 创建 `llm/providers/shared/` 目录
- 创建 `llm/providers/shared/stream-processor.ts` - SSE 解析、buffer 管理
- 创建 `llm/providers/shared/provider-errors.ts` - 统一错误处理
- 保留各 provider 特有的协议转换逻辑

#### 4.1.2 拆分大文件

**拆分 `codex-responses-stream.ts` (213行)**：
```
llm/providers/codex/
  ├── codex-provider.ts          # 主入口
  ├── codex-stream-parser.ts     # SSE 解析和 buffer 管理
  ├── codex-stream-assembler.ts  # 消息组装（文本/tool call）
  ├── codex-tool-call-handler.ts # Tool call 状态追踪
  └── codex-message-formatter.ts # 消息格式转换（原 codex-responses-format.ts）
```

**拆分 `codex-responses-format.ts` (138行)**：
```
llm/providers/codex/
  ├── codex-message-formatter.ts # 消息格式转换
  └── codex-tool-formatter.ts    # 工具定义格式转换
```

**OpenAI Compatible Provider 保持现状**：
- `openai-compatible-stream.ts` (73行) - 无需拆分
- `openai-compatible-wire-format.ts` (93行) - 无需拆分
- `openai-compatible-provider.ts` (60行) - 无需拆分

#### 4.1.3 目录结构调整

**重构前**：
```
llm/providers/
  ├── codex-provider.ts
  ├── codex-responses-stream.ts
  ├── codex-responses-format.ts
  ├── openai-compatible-provider.ts
  ├── openai-compatible-stream.ts
  └── openai-compatible-wire-format.ts
```

**重构后**：
```
llm/providers/
  ├── shared/
  │   ├── stream-processor.ts
  │   └── provider-errors.ts
  ├── codex/
  │   ├── codex-provider.ts
  │   ├── codex-stream-parser.ts
  │   ├── codex-stream-assembler.ts
  │   ├── codex-tool-call-handler.ts
  │   ├── codex-message-formatter.ts
  │   └── codex-tool-formatter.ts
  └── openai-compatible/
      ├── openai-compatible-provider.ts
      ├── openai-compatible-stream.ts
      └── openai-compatible-wire-format.ts
```

### 4.2 Services 层优化

**目标文件**：
- `llm/services/tool-call-orchestrator.ts` (83行)
- `llm/services/chat-completion.ts` (67行)

**重构内容**：

#### 4.2.1 拆分 tool-call-orchestrator.ts (83行)
```
llm/services/tool-call/
  ├── tool-call-orchestrator.ts  # 编排入口（保持简洁）
  ├── tool-call-executor.ts      # 工具执行逻辑
  └── tool-call-loop.ts           # 工具循环控制
```

#### 4.2.2 优化 chat-completion.ts (67行)
- 提取历史消息转换逻辑到 `message-converter.ts`
- 简化主流程，保持 `chat-completion.ts` 简洁

**重构后目录结构**：
```
llm/services/
  ├── chat-completion.ts
  ├── message-converter.ts
  └── tool-call/
      ├── tool-call-orchestrator.ts
      ├── tool-call-executor.ts
      └── tool-call-loop.ts
```

**预期产出**：
- Provider 代码更简洁
- 公共逻辑复用
- 文件职责更单一
- 目录结构更清晰

## 5. 第三阶段：UI 层重构

### 5.1 Chat Helper 文件合并

**目标文件**：
- `ui/content/chat/chat-composer-content.ts` (18行)
- `ui/content/chat/message/chat-message-state.ts` (90行)
- `ui/content/chat/clipboard/image-clipboard.ts` (83行)

**重构内容**：

#### 5.1.1 合并为 `ui/content/chat/chat-helpers.ts`
将三个小文件合并为一个文件，按功能分组：

```typescript
// ============================================
// 消息内容构造
// ============================================
export function buildComposerContent(...) { ... }

// ============================================
// 消息状态管理
// ============================================
export function createChatMessage(...) { ... }
export function updateChatMessageById(...) { ... }
export function buildChatRequestHistory(...) { ... }
export function buildChatErrorMessage(...) { ... }

// ============================================
// 剪贴板图片处理
// ============================================
export function readImageFromClipboard(...) { ... }
export function writeImageToClipboard(...) { ... }
```

#### 5.1.2 删除原有目录
- 删除 `ui/content/chat/message/` 目录
- 删除 `ui/content/chat/clipboard/` 目录
- 更新所有导入路径

**重构后目录结构**：
```
ui/content/chat/
  ├── chat-helpers.ts          # 合并后的 helper 文件
  ├── screenshot/              # 截图相关（保持独立）
  ├── ChatPanel.tsx
  ├── ChatComposer.tsx
  ├── MessageList.tsx
  └── ...
```

### 5.2 大组件拆分

#### 5.2.1 拆分 ScreenshotOverlay.tsx (293行)

**重构前**：
```
ui/content/chat/ScreenshotOverlay.tsx (293行)
```

**重构后**：
```
ui/content/chat/screenshot-overlay/
  ├── ScreenshotOverlay.tsx           # 主组件（保持简洁）
  ├── screenshot-overlay-state.ts     # 状态管理 hook
  ├── screenshot-overlay-handlers.ts  # 事件处理逻辑
  ├── ScreenshotSelectionBox.tsx      # 选区框子组件
  └── ScreenshotToolbar.tsx           # 工具栏子组件
```

#### 5.2.2 拆分 use-content-shell.ts (181行)

**重构前**：
```
ui/content/use-content-shell.ts (181行)
```

**重构后**：
```
ui/content/content-shell/
  ├── use-content-shell.ts        # 主 hook（保持简洁）
  ├── use-panel-state.ts          # 面板开关/固定状态
  ├── use-sidebar-resize.ts       # 侧边栏宽度调整
  ├── use-screenshot-session.ts   # 截图会话管理
  └── use-language-hydration.ts   # 语言初始化
```

#### 5.2.3 拆分 use-chat-controller.ts (154行)

**重构前**：
```
ui/content/chat/use-chat-controller.ts (154行)
```

**重构后**：
```
ui/content/chat/chat-controller/
  ├── use-chat-controller.ts  # 主 hook（保持简洁）
  ├── use-chat-history.ts     # 历史加载/保存
  ├── use-chat-streaming.ts   # 流式响应处理
  └── use-chat-send.ts        # 消息发送逻辑
```

### 5.3 Screenshot 模块优化

#### 5.3.1 拆分 screenshot-capture.ts (190行)

**重构前**：
```
ui/content/chat/screenshot/screenshot-capture.ts (190行)
```

**重构后**：
```
ui/content/chat/screenshot/capture/
  ├── screenshot-capture.ts      # 统一入口
  ├── screenshot-viewport.ts     # 可视区域截图
  ├── screenshot-selection.ts    # 选区截图
  └── screenshot-long.ts         # 长截图拼接
```

#### 5.3.2 拆分 screenshot-selection-geometry.ts (132行)

**重构前**：
```
ui/content/chat/screenshot/screenshot-selection-geometry.ts (132行)
```

**重构后**：
```
ui/content/chat/screenshot/geometry/
  ├── selection-geometry.ts       # 几何计算
  ├── selection-constraints.ts    # 边界约束
  └── selection-normalization.ts  # 坐标归一化
```

#### 5.3.3 优化 use-long-screenshot-session.ts (120行)

**重构内容**：
- 提取滚动逻辑到独立函数
- 简化状态管理
- 保持在 120 行以内，无需拆分

**重构后目录结构**：
```
ui/content/chat/screenshot/
  ├── capture/
  │   ├── screenshot-capture.ts
  │   ├── screenshot-viewport.ts
  │   ├── screenshot-selection.ts
  │   └── screenshot-long.ts
  ├── geometry/
  │   ├── selection-geometry.ts
  │   ├── selection-constraints.ts
  │   └── selection-normalization.ts
  ├── use-long-screenshot-session.ts
  ├── screenshot-types.ts
  └── screenshot-frame.ts
```

**预期产出**：
- UI 组件职责单一
- Hook 逻辑清晰
- 文件大小合理（<150行）
- 目录结构清晰

## 6. 第四阶段：工具层和清理

### 6.1 工具层优化

#### 6.1.1 拆分 ui/tools/scroll.ts (187行)

**重构前**：
```
ui/tools/scroll.ts (187行)
```

**重构后**：
```
ui/tools/scroll/
  ├── scroll.ts                    # 统一导出
  ├── scroll-container-finder.ts  # 滚动容器查找逻辑
  ├── scroll-executor.ts           # 滚动执行和动画
  └── scroll-toast.ts              # 滚动提示 UI
```

#### 6.1.2 工具注册优化

**保持现有架构**：
- `llm/tools/get-page-content-tool.ts` - LLM 层工具定义
- `ui/tools/get-page-content-tool.ts` - UI 层工具执行
- 两者分离符合架构设计，不需要合并

**优化内容**：
- 优化 `llm/tools/tool-registry.ts` 的类型定义
- 添加工具注册的 JSDoc 文档注释
- 确保工具接口清晰

### 6.2 Background 层优化

**目标文件**：
- `background/chat/chat-orchestrator.ts` (55行)
- `background/chat/screenshot-capture.ts` (32行)
- `background/index.ts`

**重构内容**：
- 保持现有结构（这些文件职责已经清晰，无需拆分）
- 优化导入和类型引用
- 确保与重构后的其他模块对接正确

### 6.3 全局清理

#### 6.3.1 删除冗余代码
- 检查未使用的导出
- 删除重复的类型定义
- 清理注释掉的代码
- 删除未使用的导入

#### 6.3.2 优化导入路径
- 统一使用相对路径（避免配置复杂的路径别名）
- 避免循环依赖
- 优化导入顺序（外部依赖 → 内部依赖 → 类型导入）

#### 6.3.3 更新测试文件
- 同步更新所有测试的导入路径
- 确保测试覆盖重构后的模块
- 修复因重构导致的测试失败
- 保持测试文件与源文件的对应关系

#### 6.3.4 文档同步
- 更新 `docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- 记录新的文件结构和模块划分
- 更新目录职责说明
- 添加重构决策记录

## 7. 重构原则

在整个重构过程中，严格遵守以下原则：

### 7.1 功能保持原则
- **维持功能不变**：每个阶段完成后运行测试，确保功能正常
- **交互不变**：所有用户可见的交互保持一致
- **性能不降低**：重构不应导致性能下降

### 7.2 架构原则
- **保持依赖方向**：shared → llm → background → ui
- **单一职责**：每个文件只负责一类事情
- **边界清晰**：模块间接口明确，职责不重叠

### 7.3 实施原则
- **最小改动**：每次只重构一个模块，避免大爆炸式修改
- **测试先行**：重构前确保测试覆盖，重构后立即验证
- **渐进式**：按阶段进行，每个阶段可独立验证
- **可回滚**：每个阶段完成后提交，便于回滚

### 7.4 代码质量原则
- **消除重复**：抽取公共逻辑，避免代码重复
- **命名清晰**：文件名和函数名准确反映职责
- **文档完整**：关键模块添加 JSDoc 注释
- **类型安全**：充分利用 TypeScript 类型系统

### 7.5 协作原则
- **文档同步**：结构变化时同步更新 spec
- **提交规范**：每个阶段完成后提交，commit message 清晰
- **向后兼容**：尽量保持导出接口不变，减少影响范围

## 8. 文件大小标准

重构后的文件大小标准：

- **组件文件**：< 150 行
- **Hook 文件**：< 100 行
- **工具函数文件**：< 150 行
- **类型定义文件**：< 200 行
- **Provider 实现**：< 100 行

超过标准的文件应考虑拆分。

## 9. 目录结构对比

### 9.1 重构前

```
src/
  ├── ui/
  │   ├── content/
  │   │   ├── chat/
  │   │   │   ├── clipboard/
  │   │   │   │   └── image-clipboard.ts (83行)
  │   │   │   ├── message/
  │   │   │   │   └── chat-message-state.ts (90行)
  │   │   │   ├── screenshot/
  │   │   │   │   ├── screenshot-capture.ts (190行) ⚠️
  │   │   │   │   ├── screenshot-selection-geometry.ts (132行) ⚠️
  │   │   │   │   └── use-long-screenshot-session.ts (120行)
  │   │   │   ├── chat-composer-content.ts (18行)
  │   │   │   ├── use-chat-controller.ts (154行) ⚠️
  │   │   │   └── ScreenshotOverlay.tsx (293行) ⚠️
  │   │   ├── use-content-shell.ts (181行) ⚠️
  │   │   └── ...
  │   └── tools/
  │       └── scroll.ts (187行) ⚠️
  ├── llm/
  │   ├── providers/
  │   │   ├── codex-provider.ts (73行)
  │   │   ├── codex-responses-stream.ts (213行) ⚠️
  │   │   ├── codex-responses-format.ts (138行) ⚠️
  │   │   └── ...
  │   └── services/
  │       ├── tool-call-orchestrator.ts (83行)
  │       └── chat-completion.ts (67行)
  └── ...
```

### 9.2 重构后

```
src/
  ├── ui/
  │   ├── content/
  │   │   ├── chat/
  │   │   │   ├── chat-helpers.ts                    # 合并后
  │   │   │   ├── chat-controller/                   # 拆分后
  │   │   │   │   ├── use-chat-controller.ts
  │   │   │   │   ├── use-chat-history.ts
  │   │   │   │   ├── use-chat-streaming.ts
  │   │   │   │   └── use-chat-send.ts
  │   │   │   ├── screenshot/
  │   │   │   │   ├── capture/                       # 拆分后
  │   │   │   │   │   ├── screenshot-capture.ts
  │   │   │   │   │   ├── screenshot-viewport.ts
  │   │   │   │   │   ├── screenshot-selection.ts
  │   │   │   │   │   └── screenshot-long.ts
  │   │   │   │   ├── geometry/                      # 拆分后
  │   │   │   │   │   ├── selection-geometry.ts
  │   │   │   │   │   ├── selection-constraints.ts
  │   │   │   │   │   └── selection-normalization.ts
  │   │   │   │   └── use-long-screenshot-session.ts
  │   │   │   └── screenshot-overlay/                # 拆分后
  │   │   │       ├── ScreenshotOverlay.tsx
  │   │   │       ├── screenshot-overlay-state.ts
  │   │   │       ├── screenshot-overlay-handlers.ts
  │   │   │       ├── ScreenshotSelectionBox.tsx
  │   │   │       └── ScreenshotToolbar.tsx
  │   │   ├── content-shell/                         # 拆分后
  │   │   │   ├── use-content-shell.ts
  │   │   │   ├── use-panel-state.ts
  │   │   │   ├── use-sidebar-resize.ts
  │   │   │   ├── use-screenshot-session.ts
  │   │   │   └── use-language-hydration.ts
  │   │   └── ...
  │   └── tools/
  │       └── scroll/                                # 拆分后
  │           ├── scroll.ts
  │           ├── scroll-container-finder.ts
  │           ├── scroll-executor.ts
  │           └── scroll-toast.ts
  ├── llm/
  │   ├── providers/
  │   │   ├── shared/                                # 新增
  │   │   │   ├── stream-processor.ts
  │   │   │   └── provider-errors.ts
  │   │   ├── codex/                                 # 重组后
  │   │   │   ├── codex-provider.ts
  │   │   │   ├── codex-stream-parser.ts
  │   │   │   ├── codex-stream-assembler.ts
  │   │   │   ├── codex-tool-call-handler.ts
  │   │   │   ├── codex-message-formatter.ts
  │   │   │   └── codex-tool-formatter.ts
  │   │   └── openai-compatible/                     # 重组后
  │   │       ├── openai-compatible-provider.ts
  │   │       ├── openai-compatible-stream.ts
  │   │       └── openai-compatible-wire-format.ts
  │   └── services/
  │       ├── chat-completion.ts
  │       ├── message-converter.ts                   # 新增
  │       └── tool-call/                             # 拆分后
  │           ├── tool-call-orchestrator.ts
  │           ├── tool-call-executor.ts
  │           └── tool-call-loop.ts
  └── ...
```

## 10. 预期成果

重构完成后，项目将达到以下状态：

### 10.1 代码结构
- ✅ 所有文件职责单一，边界清晰
- ✅ 大文件（>150行）已拆分为多个小文件
- ✅ Helper 文件已合并，减少碎片化
- ✅ 目录结构更清晰，易于导航

### 10.2 代码质量
- ✅ 消除重复代码
- ✅ 公共逻辑已抽取
- ✅ 类型定义清晰完整
- ✅ 命名规范统一

### 10.3 可维护性
- ✅ 新功能容易添加
- ✅ 问题容易定位
- ✅ 测试覆盖完整
- ✅ 代码易于理解

### 10.4 文档
- ✅ Spec 与实现保持同步
- ✅ 目录结构文档化
- ✅ 重要决策有记录
- ✅ 关键模块有注释

## 11. 风险控制

### 11.1 技术风险
- **风险**：重构可能引入 bug
- **控制**：每个阶段完成后运行完整测试套件

### 11.2 进度风险
- **风险**：重构耗时可能超出预期
- **控制**：采用渐进式策略，可随时暂停

### 11.3 兼容性风险
- **风险**：导入路径变化可能影响其他模块
- **控制**：使用 TypeScript 编译器检查，确保无遗漏

### 11.4 测试风险
- **风险**：测试可能无法覆盖所有场景
- **控制**：重构前检查测试覆盖率，补充缺失的测试

## 12. 实施检查清单

每个阶段完成后，检查以下项目：

- [ ] 所有测试通过
- [ ] TypeScript 编译无错误
- [ ] 无 ESLint 警告
- [ ] 功能手动验证通过
- [ ] 导入路径已更新
- [ ] 文档已同步更新
- [ ] Git commit 已提交
- [ ] 代码已 review

## 13. 后续维护

重构完成后，为保持代码质量：

1. **代码审查**：新增代码必须符合重构后的结构规范
2. **文件大小监控**：定期检查文件大小，及时拆分过大文件
3. **依赖方向检查**：确保新代码不违反依赖方向
4. **文档更新**：结构变化时及时更新 spec
5. **测试维护**：保持测试覆盖率，及时补充测试

---

**文档版本**：v1.0  
**创建日期**：2026-04-10  
**最后更新**：2026-04-10  
**状态**：待审核
