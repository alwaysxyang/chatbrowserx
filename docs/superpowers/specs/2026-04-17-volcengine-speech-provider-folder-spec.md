# Volcengine Speech Provider 文件夹规范

## 1. 文档身份

- 文档类型：folder spec
- 约束级别：低于主 spec，高于归档文档
- 适用范围：`src/speech/providers/volcengine`、`src/speech/services/speech-recognition.ts`
- 上级文档：`docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- 相关文档：`docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`

本文档约束 `volcengine` speech provider 的当前实现边界与依赖方向。该 provider 的定位是“最小接入”，用于验证端到端语音链路，不代表语音识别/同声传译已经完成产品化。

## 2. 当前实现

### 2.1 目录与关键文件

#### `src/speech/providers/volcengine`

- `provider.ts`
  - 负责 WebSocket 连接生命周期（连接、收发、关闭）。
  - 负责把 provider 的响应映射为 `RecognitionResult` 回调。
  - 不直接依赖 Chrome API，不承载 UI 状态，不做 background 编排。
- `signer.ts`
  - 负责生成用于连接的签名 URL。
  - 必须是浏览器可运行实现（不依赖 Node 专属 API）。
- `index.ts`
  - 负责导出 provider 与 config 类型。

### 2.2 依赖方向

- `src/speech/providers/volcengine`：
  - 可以依赖 `src/shared/types`
  - 可以依赖最小的加密/签名依赖（当前为 `crypto-js`）
  - 不直接依赖 `src/ui`
  - 不直接依赖 `src/background`
  - 不直接依赖 Chrome API（例如 `chrome.*`）
- `src/speech/services/speech-recognition.ts`：
  - 负责根据 `SpeechSettings` 选择 provider 并管理生命周期
  - 不承载具体 provider 的协议细节（协议细节必须留在 provider 目录）

### 2.3 配置与安全约束

- provider 所需凭证来自 `SpeechSettings`。
- 禁止在日志中输出 `accessKeyId`、`secretAccessKey` 等敏感字段。
- provider 侧错误信息允许包含可操作的排查提示，但不得包含敏感字段。

### 2.4 当前实现边界

#### 已实现边界

- 基于 WebSocket 的最小连接能力与音频分片发送。
- 将 provider 响应映射为 `RecognitionResult` 并回调给 service 层。

#### 未实现边界

- 自动重连与网络抖动恢复策略。
- provider 统一错误码体系与细分鉴权错误处理。
- 结果稳定性增强（分段对齐、去重、增量结果合并）。

## 3. 未来设计

以下内容不是当前实现：

- 多 provider 的统一抽象与运行时灰度策略。
- 更完整的结果流模型（例如更细粒度的 partial/final 语义、时间轴对齐策略）。
- 端到端可观测性（结构化日志、请求链路追踪、错误统计上报）。

如需引入上述内容，必须先更新上级文档中的当前阶段范围与本 folder spec，再扩展实现。
