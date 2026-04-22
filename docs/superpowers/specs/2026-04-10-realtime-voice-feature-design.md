# Speech 功能规范

## 1. 文档身份

- 文档类型：feature spec
- 约束级别：低于主 spec，高于归档文档
- 适用范围：`src/ui/content/speech`、`src/background/speech`、`src/speech/services`、`src/shared/types/speech.ts`、`src/shared/storage/speech-settings-repository.ts`
- 上级文档：`docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`

本文件只说明 speech 子域的当前实现边界与未来设计方向，不能覆盖主 spec 对一级目录和跨模块职责的约束。

## 2. 当前实现

### 2.1 当前目标

当前 speech 能力处于“最小语音骨架”阶段，目标是：

- 提供语音按钮与字幕 overlay 入口
- 在 background 内按 tab 启停 speech 会话
- 打通 tab 音频采集链路
- 保留 speech service 边界，并提供最小 speech provider 接入以验证端到端链路

当前**不代表**已经完成真实语音识别、真实翻译或完整同声传译产品化。

### 2.2 当前目录与文件职责

#### `src/ui/content/speech`

- `use-subtitle-controller.ts`
  - 负责本地字幕状态
  - 负责挂载时发送 `speechStateQuery`，从 background 内存会话恢复 listening 展示
  - 负责发送 `speechStart` / `speechStop`
  - 负责消费 `speechResult` / `speechError`
- `SubtitleOverlay.tsx`
  - 负责字幕 overlay 的 portal 挂载
  - 负责拖拽位置维护
  - 在无识别文本时显示 listening 文案
- `subtitle-overlay.css`
  - 负责字幕 overlay 样式

#### `src/background/speech`

- `index.ts`
  - 注册 speech runtime message listener
  - 负责 `speechStart` / `speechStop` / `speechStateQuery` 请求入口
- `speech-orchestrator.ts`
  - 按 tab 维护会话
  - 负责创建与清理 `AudioCapture`、`SpeechRecognitionService`
  - 负责 speech 结果转发
- `audio-capture.ts`
  - 负责 tab 音频采集
  - 通过 offscreen document 处理 `getUserMedia` 调用
  - 负责把音频分片以 `ArrayBuffer` 形式交给 orchestrator
- `offscreen.html`
  - offscreen document 的 HTML 入口
- `offscreen.ts`
  - 在 offscreen context 中执行 `getUserMedia`
  - 接收来自 service worker 的 `start-capture` / `stop-capture` 消息
  - 通过 `MediaRecorder` 采集音频并回传给 service worker

#### `src/speech/services`

- `speech-recognition.ts`
  - 负责 speech provider 生命周期的 service 层
  - 负责 `start / sendAudio / stop` 边界
  - 通过构造参数接收 `SpeechSettings`
  - 根据 `SpeechSettings.provider` 创建并管理 provider 实例

#### `src/speech/model`

- `recognition.ts`
  - 定义 `SpeechRecognitionProvider` 抽象接口

#### `src/speech/providers/volcengine`

- 当前实现包含 `volcengine` provider 的最小接入：
  - provider 通过 WebSocket 建立连接并接收字幕类结果
  - provider 负责签名与连接建立，不依赖 Chrome API，不承载 UI 状态
- 细化约束见 `docs/superpowers/specs/2026-04-17-volcengine-speech-provider-folder-spec.md`

#### `src/shared`

- `src/shared/types/speech.ts`
  - 定义 speech runtime 消息协议、`RecognitionResult`、`SpeechRuntimeResponse`、`SpeechStateQueryResponse`
- `src/shared/types/runtime-messages.ts`
  - 提供 `RuntimeMessage`、`RuntimeResponse` 与通用响应解析能力
- `src/shared/storage/speech-settings-repository.ts`
  - 负责语音设置持久化

### 2.3 当前消息协议

```typescript
const speechStartRequestType = 'chatbrowserx.speech.start';
const speechStopRequestType = 'chatbrowserx.speech.stop';
const speechResultType = 'chatbrowserx.speech.result';
const speechErrorType = 'chatbrowserx.speech.error';
const speechStateQueryType = 'chatbrowserx.speech.state.query';

interface SpeechStartRequestMessage {
  type: typeof speechStartRequestType;
}

interface SpeechStopRequestMessage {
  type: typeof speechStopRequestType;
}

interface SpeechResultMessage {
  type: typeof speechResultType;
  payload: RecognitionResult;
}

interface SpeechErrorMessage {
  type: typeof speechErrorType;
  payload: {
    error: string;
  };
}

interface SpeechStateQueryMessage {
  type: typeof speechStateQueryType;
}

type SpeechRuntimeResponse = RuntimeResponse<null>;
type SpeechStateQueryResponse = RuntimeResponse<{
  isRecording: boolean;
}>;
```

说明：

- `speechStart` 当前不携带设置；background 在启动时自行读取 `speech-settings-repository`。
- `speechStop` 当前返回成功响应，UI 收到后清空本地字幕状态。
- `speechStateQuery` 当前只查询 `SpeechOrchestrator.isRecording(tabId)` 的内存状态，用于 content script 重新挂载时恢复本地 listening 展示；它不是 storage 持久化或跨 service worker 生命周期恢复机制。
- `speechError` 是 background 向 UI 推送的错误消息；UI 收到后清空本地字幕状态。

### 2.4 当前数据结构

```typescript
type SpeechProviderId = 'volcengine';
type SourceLanguage = 'auto' | 'zh' | 'en' | 'ja';
type TargetLanguage = 'none' | 'zh' | 'en' | 'ja';

interface VolcengineSettings {
  accessKeyId: string;
  secretAccessKey: string;
}

interface SpeechSettings {
  provider: SpeechProviderId;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  volcengine: VolcengineSettings;
}

interface RecognitionResult {
  sourceText: string;
  translationText?: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}
```

### 2.5 当前运行链路

1. content script 挂载后，`use-subtitle-controller` 发送 `speechStateQuery`。
2. `background/speech/index.ts` 返回当前 tab 是否存在内存中的 speech 会话。
3. 如果存在会话，UI 恢复 listening 展示；如果不存在，会话仍保持空闲状态。
4. 用户点击 `ShellRail` 语音按钮。
5. `use-subtitle-controller` 更新本地 listening 状态，并发送 `speechStart`。
6. `background/speech/index.ts` 调用 `SpeechOrchestrator.start(tabId)`。
7. `SpeechOrchestrator` 读取 `speech-settings-repository`。
8. `SpeechOrchestrator` 创建 `AudioCapture` 与 `SpeechRecognitionService`。
9. `SpeechRecognitionService.start()` 启动 service 生命周期。
10. `AudioCapture.start(tabId, onAudioData, chunkInterval?)` 执行以下步骤：
   - 通过 `chrome.tabCapture.getMediaStreamId` 获取 stream ID
   - 确保 offscreen document 存在（如不存在则创建）
   - 向 offscreen document 发送 `start-capture` 消息
11. offscreen document 接收消息后：
   - 使用 stream ID 调用 `navigator.mediaDevices.getUserMedia`
   - 创建 `AudioContext` 和 `MediaRecorder`
   - 开始录制音频
12. 音频分片通过 `audio-data` 消息从 offscreen document 发送回 service worker。
13. `AudioCapture` 接收 `audio-data` 消息并调用回调，将 `ArrayBuffer` 交给 `SpeechRecognitionService.sendAudio(...)`。
14. `SpeechRecognitionService` 将音频分片交给 provider，并在收到 provider 回调后产出 `RecognitionResult`。
15. background 通过 `speechResult` 把 `RecognitionResult` 回推给 UI。
16. 若 provider 或采集链路失败，background 通过 `speechError` 把错误回推给 UI，并停止对应 tab 的会话。

### 2.6 当前实现边界

#### 已实现边界

- 语音按钮与字幕 overlay UI
- tab 维度的 speech 会话管理
- tab 音频采集启动与停止（通过 offscreen document）
- offscreen document 用于在 service worker 环境中处理 `getUserMedia`
- speech 设置存储
- speech runtime message 协议
- speech 内存状态查询协议
- speech service 层与 provider 生命周期管理
- `volcengine` 最小 provider 接入（用于验证端到端链路）

#### 未实现边界

- 多 provider 体系化接入（provider 选择、灰度、统一错误码）
- 更完整的识别/翻译结果流（增量结果、分段对齐、去重与稳定性处理）
- 自动重连、鉴权错误细分、provider 级错误码映射

### 2.7 当前错误处理

- `speechStart` 启动失败时，通过 `SpeechRuntimeResponse` 返回错误。
- `speechStop` 当前总是返回成功响应；若无会话，background 静默结束。
- `speechStateQuery` 在缺少 tab ID 时返回错误；正常情况下返回 `{ isRecording }`。
- `AudioCapture.start(...)` 重复启动时抛出 `Audio capture already started`。
- offscreen document 中的 `getUserMedia` 失败时，通过 `audio-error` 消息通知 service worker。
- offscreen document 中的 `MediaRecorder` 错误通过 `audio-error` 消息通知 service worker。
- `SpeechRecognitionService.start()` 重复启动时抛出 `Speech recognition already running`。
- `SpeechRecognitionService.sendAudio(...)` 在 service 未运行时只记录 warning，不抛错。
- UI 在启动失败时回滚 listening 状态；停止时无论成功或失败都会清空本地字幕状态。
- UI 收到 `speechError` 后清空本地字幕状态。

### 2.8 当前 UI 与文案

- `VoiceSettingsForm` 当前提供：
  - provider 展示（当前仅 `volcengine`）
  - `sourceLanguage`
  - `targetLanguage`
  - `accessKeyId`
  - `secretAccessKey`
- `SubtitleOverlay` 当前负责：
  - fixed overlay 展示
  - 拖拽位置交互
  - listening 文案显示

当前相关 i18n key 至少包括：

- `settings.tabs.voice`
- `settings.voice.provider`
- `settings.voice.sourceLanguage`
- `settings.voice.targetLanguage`
- `settings.voice.accessKeyId`
- `settings.voice.secretAccessKey`
- `settings.voice.language.auto`
- `settings.voice.language.none`
- `settings.voice.language.zh`
- `settings.voice.language.en`
- `settings.voice.language.ja`
- `shell.rail.voice`
- `shell.rail.voiceStop`
- `subtitle.waiting`
- `settings.apiKey.show`
- `settings.apiKey.hide`

## 3. 未来设计

以下内容**不是当前实现**，只有在后续进入对应范围后，才允许继续设计与落地：

- 其他 speech provider 接入
- provider 协议封装、消息序列化、wire format
- 真实识别结果流与翻译结果流
- 自动重连、错误码映射、鉴权细分
- 基于 storage 与 `webNavigation` 的 speech 状态持久化和跨导航恢复
- 语音历史记录、字幕导出、样式自定义、VAD、静音自动暂停等高级功能

如果未来要引入上述内容，必须先更新本 feature spec 与主 spec，再改代码。

## 4. 变更要求

当以下任一内容变化时，必须同步更新本文件：

- `src/ui/content/speech` 目录结构
- `src/background/speech` 目录结构
- offscreen document 的实现或消息协议
- `src/speech/services/speech-recognition.ts` 的职责或接口
- `SpeechSettings` 结构
- `RecognitionResult` 结构
- speech runtime message 协议
- speech 启停链路
- speech 当前实现边界
