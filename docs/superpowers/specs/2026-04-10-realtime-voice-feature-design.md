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
- 保留 speech service 边界，为未来真实 provider 接入预留位置

当前**不代表**已经完成真实语音识别、真实翻译或完整同声传译产品化。

### 2.2 当前目录与文件职责

#### `src/ui/content/speech`

- `use-subtitle-controller.ts`
  - 负责本地字幕状态
  - 负责发送 `speechStart` / `speechStop`
  - 负责消费 `speechResult`
- `SubtitleOverlay.tsx`
  - 负责字幕 overlay 的 portal 挂载
  - 负责拖拽位置维护
  - 在无识别文本时显示 listening 文案
- `subtitle-overlay.css`
  - 负责字幕 overlay 样式

#### `src/background/speech`

- `index.ts`
  - 注册 speech runtime message listener
  - 负责 `speechStart` / `speechStop` 请求入口
- `speech-orchestrator.ts`
  - 按 tab 维护会话
  - 负责创建与清理 `AudioCapture`、`SpeechRecognitionService`
  - 负责 speech 结果转发
- `audio-capture.ts`
  - 负责 tab 音频采集
  - 负责把音频分片以 `ArrayBuffer` 形式交给 orchestrator

#### `src/speech/services`

- `speech-recognition.ts`
  - 当前是 speech provider lifecycle 的占位 service
  - 负责 `start / sendAudio / stop` 边界
  - 通过构造参数接收 `SpeechSettings`、`onResult`、`onError`
  - 当前没有真实 provider 连接能力

#### `src/shared`

- `src/shared/types/speech.ts`
  - 定义 `SpeechSettings`、语言枚举、`RecognitionResult`
- `src/shared/types/runtime-messages.ts`
  - 定义 `speechStartRequestType`、`speechStopRequestType`、`speechResultType`
  - 定义 `SpeechRuntimeResponse = RuntimeResponse<null>`
- `src/shared/storage/speech-settings-repository.ts`
  - 负责语音设置持久化

### 2.3 当前消息协议

```typescript
const speechStartRequestType = 'chatbrowserx.speech.start';
const speechStopRequestType = 'chatbrowserx.speech.stop';
const speechResultType = 'chatbrowserx.speech.result';

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

type SpeechRuntimeResponse = RuntimeResponse<null>;
```

说明：

- `speechStart` 当前不携带设置；background 在启动时自行读取 `speech-settings-repository`。
- `speechStop` 当前返回成功响应，UI 收到后清空本地字幕状态。
- 当前没有单独的 speech runtime error push 消息。

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

1. 用户点击 `ShellRail` 语音按钮。
2. `use-subtitle-controller` 更新本地 listening 状态，并发送 `speechStart`。
3. `background/speech/index.ts` 调用 `SpeechOrchestrator.start(tabId)`。
4. `SpeechOrchestrator` 读取 `speech-settings-repository`。
5. `SpeechOrchestrator` 创建 `AudioCapture` 与 `SpeechRecognitionService`。
6. `SpeechRecognitionService.start()` 启动 service 生命周期。
7. `AudioCapture.start(tabId, onAudioData, chunkInterval?)` 开始 tab 音频采集。
8. 音频分片以 `ArrayBuffer` 形式交给 `SpeechRecognitionService.sendAudio(...)`。
9. 当前 service 尚未连接真实 provider，因此默认不保证产出真实识别结果。
10. 一旦未来产出 `RecognitionResult`，background 再通过 `speechResult` 回推给 UI。

### 2.6 当前实现边界

#### 已实现边界

- 语音按钮与字幕 overlay UI
- tab 维度的 speech 会话管理
- tab 音频采集启动与停止
- speech 设置存储
- speech runtime message 协议
- speech service 占位层

#### 未实现边界

- 真实 provider 连接
- 真实识别结果解析
- 真实翻译结果生成
- provider 协议封装
- 自动重连、鉴权错误细分、provider 级错误码映射

### 2.7 当前错误处理

- `speechStart` 启动失败时，通过 `SpeechRuntimeResponse` 返回错误。
- `speechStop` 当前总是返回成功响应；若无会话，background 静默结束。
- `AudioCapture.start(...)` 重复启动时抛出 `Audio capture already started`。
- `SpeechRecognitionService.start()` 重复启动时抛出 `Speech recognition already running`。
- `SpeechRecognitionService.sendAudio(...)` 在 service 未运行时只记录 warning，不抛错。
- UI 在启动失败时回滚 listening 状态；停止时无论成功或失败都会清空本地字幕状态。

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

- 独立 `providers/` 目录
- 真实 Volcengine provider / 其他 provider 接入
- provider 协议封装、消息序列化、wire format
- 真实识别结果流与翻译结果流
- 自动重连、错误码映射、鉴权细分
- 语音历史记录、字幕导出、样式自定义、VAD、静音自动暂停等高级功能

如果未来要引入上述内容，必须先更新本 feature spec 与主 spec，再改代码。

## 4. 变更要求

当以下任一内容变化时，必须同步更新本文件：

- `src/ui/content/speech` 目录结构
- `src/background/speech` 目录结构
- `src/speech/services/speech-recognition.ts` 的职责或接口
- `SpeechSettings` 结构
- `RecognitionResult` 结构
- speech runtime message 协议
- speech 启停链路
- speech 当前实现边界
