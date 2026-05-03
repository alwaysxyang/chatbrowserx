# Speech 功能规范

## 1. 文档身份

- 文档类型：feature spec
- 约束级别：低于主 spec
- 适用范围：`src/ui/content/speech`、`src/background/speech`、`src/speech`、`src/shared/types/speech.ts`、`src/shared/types/settings.ts`、`src/shared/storage/settings-repository.ts`
- 上级文档：`docs/superpowers/specs/browser-agent-project-spec.md`

本文件约束 speech 子域的当前实现边界、运行链路、消息协议与 `volcengine` provider。它不能覆盖主 spec 对一级目录和跨模块职责的约束。

## 2. 当前目标

当前 speech 能力处于“最小语音骨架”阶段：

- 提供语音按钮与字幕 overlay。
- 在 background 内按 tab 启停 speech 会话。
- 打通 tab 音频采集链路。
- 保留 speech service 边界。
- 使用 `volcengine` 最小 provider 验证端到端链路。

当前不代表已经完成完整语音识别、真实翻译或同声传译产品化。

## 3. 目录与职责

### 3.1 `src/ui/content/speech`

- `use-subtitle-controller.ts`
  - 维护本地字幕状态。
  - 挂载时发送 `speechStateQuery`，从 background 内存会话恢复 listening 展示。
  - 发送 `speechStart` / `speechStop`。
  - 消费 `speechResult` / `speechError`。
- `SubtitleOverlay.tsx`
  - 负责字幕 overlay portal、拖拽位置与 listening 文案。
- `subtitle-overlay.css`
  - 负责字幕 overlay 样式。

UI 侧字幕展示状态不写入 storage；停止或错误时清空本地状态。

### 3.2 `src/background/speech`

- `index.ts`
  - 注册 speech runtime message listener。
  - 处理 `speechStart`、`speechStop`、`speechStateQuery`。
- `speech-orchestrator.ts`
  - 按 tab 维护 speech session。
  - 启动时调用 `loadSettings()` 读取 `settings.speech`。
  - 创建与清理 `AudioCapture`、`SpeechRecognitionService`。
  - 将识别结果和错误回推给 content script。
- `audio-capture.ts`
  - 负责 tab 音频采集。
  - 通过 offscreen document 处理 `getUserMedia`。
  - 将音频分片以 `ArrayBuffer` 交给 recognition service。
- `audio-config.ts`
  - 定义音频采集配置。
- `offscreen.html`、`offscreen.ts`
  - 在 offscreen context 中执行 `getUserMedia`。
  - `format="webm"` 时使用 `MediaRecorder` 采集。
  - `format="pcm-int16"` 或 `format="pcm-float32"` 时加载 `audio-processor.js` 并使用 `AudioWorkletNode` 采集 PCM 数据。
  - 通过 runtime port 把音频分片转发给 service worker。
- `audio-processor.js`
  - 作为 `AudioWorkletProcessor` 运行，负责把输入音频转换为目标 PCM 格式。

`speechStateQuery` 只查询 `SpeechOrchestrator` 的内存会话状态，不提供 storage 持久化、跨 service worker 生命周期恢复或浏览器重启恢复。

### 3.3 `src/speech`

- `model/recognition.ts`
  - 定义 `SpeechRecognitionProvider` 抽象接口。
- `services/speech-recognition.ts`
  - 管理 provider 生命周期。
  - 提供 `start / sendAudio / stop` service 边界。
  - 根据 `SpeechSettings.provider` 创建 provider。
- `providers/volcengine`
  - `provider.ts` 负责 WebSocket 连接生命周期、音频发送、响应映射为 `RecognitionResult`。
  - `signer.ts` 负责生成连接签名 URL，必须保持浏览器可运行，不依赖 Node 专属 API。
  - `index.ts` 负责导出 provider 与配置类型。

`src/speech/providers/volcengine` 不直接依赖 Chrome API，不依赖 `src/ui`，不承载 background 编排或 UI 状态。

### 3.4 `src/shared`

- `src/shared/types/speech.ts`
  - 定义 speech runtime 消息协议、`RecognitionResult`、响应类型与 type guard。
- `src/shared/types/settings.ts`
  - 定义 `SpeechSettings`、`SpeechProviderId`、语言选项与 `VolcengineSettings`。
- `src/shared/storage/settings-repository.ts`
  - 统一读取和保存设置；speech 启动时通过 `loadSettings()` 读取 `settings.speech`。
- `src/shared/storage/settings-normalizer.ts`
  - 负责 speech 设置默认值与兼容归一化。

## 4. 消息协议

消息常量定义在 `src/shared/types/speech.ts`：

```ts
const speechStartRequestType = 'chatbrowserx.speech.start';
const speechStopRequestType = 'chatbrowserx.speech.stop';
const speechResultType = 'chatbrowserx.speech.result';
const speechErrorType = 'chatbrowserx.speech.error';
const speechStateQueryType = 'chatbrowserx.speech.state.query';
```

当前语义：

- `speechStart` 不携带设置；background 启动时读取 `settings.speech`。
- `speechStop` 停止当前 tab 的内存会话；若无会话，静默成功。
- `speechStateQuery` 返回当前 tab 是否存在内存会话。
- `speechResult` 是 background 推送给 UI 的识别结果。
- `speechError` 是 background 推送给 UI 的错误消息；UI 收到后清空本地字幕状态。

## 5. 设置与数据结构

Speech 设置是全局 `Settings` 的一部分，保存在 `settings.speech`：

```ts
type SpeechProviderId = 'volcengine';
type SourceLanguage = 'auto' | 'zh' | 'en' | 'ja';
type TargetLanguage = 'none' | 'zh' | 'en' | 'ja';

interface SpeechSettings {
  provider: SpeechProviderId;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  volcengine: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

interface RecognitionResult {
  sourceText: string;
  translationText?: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}
```

`VoiceSettingsForm` 当前提供 provider 展示、源语言、目标语言、`accessKeyId`、`secretAccessKey` 编辑。

## 6. 当前运行链路

1. content script 挂载后，`use-subtitle-controller` 发送 `speechStateQuery`。
2. `background/speech/index.ts` 返回当前 tab 是否有内存中的 speech session。
3. 用户点击 `ShellRail` 语音按钮。
4. `use-subtitle-controller` 更新本地 listening 状态并发送 `speechStart`。
5. `SpeechOrchestrator.start(tabId)` 调用 `loadSettings()`，读取 `settings.speech`。
6. `SpeechOrchestrator` 创建 `AudioCapture` 与 `SpeechRecognitionService`。
7. `SpeechRecognitionService.start()` 根据 settings 创建 `VolcengineProvider`。
8. `AudioCapture.start()` 获取 tab capture stream id，并启动 offscreen document。
9. offscreen document 调用 `getUserMedia`；根据格式选择 `MediaRecorder` 或 `AudioWorkletNode`，再把音频分片发回 service worker。
10. `AudioCapture` 把 `ArrayBuffer` 交给 `SpeechRecognitionService.sendAudio(...)`。
11. provider 返回结果后，background 通过 `speechResult` 推送给 UI。
12. provider 或采集链路失败时，background 通过 `speechError` 通知 UI，并清理对应 tab 会话。

## 7. Volcengine 边界

### 7.1 已实现

- 基于 WebSocket 的最小连接能力。
- 音频分片发送。
- provider 响应到 `RecognitionResult` 的映射。
- 浏览器环境可运行的签名 URL 生成。

### 7.2 安全约束

- 凭证来自 `SpeechSettings.volcengine`。
- 禁止在日志中输出 `accessKeyId`、`secretAccessKey` 等敏感字段。
- provider 错误可以包含排查提示，但不得包含敏感字段。

### 7.3 当前不做

- 自动重连与网络抖动恢复。
- provider 统一错误码体系。
- 细分鉴权错误处理。
- 结果稳定性增强、分段对齐、去重、增量结果合并。
- 多 provider 灰度策略。

## 8. 当前错误处理

- `speechStart` 启动失败时返回错误，并由 UI 回滚 listening 状态。
- `speechStop` 无会话时静默成功。
- `speechStateQuery` 缺少 tab ID 时返回错误。
- UI 初始 `speechStateQuery` 只用于刷新后的展示水合；无响应、空响应或扩展重载导致的查询失败会被静默忽略，不影响主 UI 挂载。
- `AudioCapture.start(...)` 重复启动时抛出错误。
- offscreen document 中的 `getUserMedia` 或 `MediaRecorder` 错误通过 `audio-error` 回推。
- `SpeechRecognitionService.start()` 重复启动时抛出错误。
- `SpeechRecognitionService.sendAudio(...)` 在 service 未运行时只记录 warning。
- UI 收到 `speechError` 后清空本地字幕状态。

## 9. 未来设计

以下内容不是当前实现：

- 其他 speech provider 接入。
- 真实产品级识别/翻译结果流。
- 自动重连、错误码映射、鉴权细分。
- 基于 storage 与 `webNavigation` 的 speech 状态持久化和跨导航恢复。
- 语音历史记录、字幕导出、样式自定义、VAD、静音自动暂停。

如需引入上述内容，必须先更新主 spec 与本文件。

## 10. 变更要求

以下变化必须同步更新本文件：

- `src/ui/content/speech`、`src/background/speech` 或 `src/speech` 目录结构变化。
- offscreen document 实现或消息协议变化。
- `SpeechRecognitionService` 职责或接口变化。
- `SpeechSettings`、`RecognitionResult` 或 speech runtime message 协议变化。
- speech 启停链路、错误处理或当前实现边界变化。
