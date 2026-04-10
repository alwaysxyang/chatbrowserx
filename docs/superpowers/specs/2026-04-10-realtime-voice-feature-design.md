# 实时语音功能设计文档

## 概述

为 ChatBrowserX 添加实时语音识别和翻译功能，使用火山引擎的同声传译 API。用户可以通过语音按钮开启实时语音识别，识别结果和翻译文本会显示在浏览器底部的字幕条中。

## 需求

### 功能需求

1. **设置页面**
   - 新增"语音"tab，与"模型"、"通用"并列
   - 配置项：
     - 源语言：自动、中文、英文、日文
     - 翻译目标语言：无（不翻译）、中文、英文、日文
     - Volcengine AppKey
     - Volcengine AccessKey

2. **语音控制**
   - ShellRail 右侧新增语音按钮
   - 未激活状态：显示播放图标
   - 激活状态：显示停止图标，按钮高亮
   - 点击开始后持续录音，再次点击停止

3. **字幕显示**
   - 固定在浏览器窗口底部
   - 半透明背景（参考音乐软件歌词效果）
   - 可拖动调整位置
   - 上方显示原文（较大字体）
   - 下方显示译文（较小字体，无翻译时隐藏）
   - 整体高度根据是否有翻译自适应

4. **音频源**
   - 捕获当前浏览器标签页的音频（网页播放的声音）

5. **Provider 架构**
   - 语音服务采用 provider 模式，参考现有 chat 的 provider 架构
   - 目前仅实现 Volcengine provider
   - 为未来扩展其他语音服务预留接口

## 架构设计

### 整体分层

采用独立的语音服务层，与现有 chat 功能解耦：

```
src/
├── speech/                    # 语音服务核心层
│   ├── providers/            # Provider 实现
│   ├── services/             # 业务服务
│   └── types/                # 协议类型定义
├── background/speech/         # 后台语音编排
├── ui/content/speech/         # 字幕 UI 组件
└── shared/
    ├── types/speech.ts       # 语音类型定义
    └── storage/speech-settings-repository.ts  # 语音设置存储
```

### 数据流

**语音识别流程：**
1. 用户点击 ShellRail 上的语音按钮
2. UI 通过 runtime message 通知 background 开始语音识别
3. background/speech-orchestrator 捕获标签页音频流
4. 音频数据通过 WebSocket 发送到 Volcengine
5. 识别结果实时返回（原文和译文分别推送）
6. background 转发结果给 UI
7. SubtitleOverlay 组件接收并显示原文和译文
8. 用户再次点击按钮，停止识别并关闭 WebSocket

**翻译机制：**
- 火山引擎的同声传译 API 在识别的同时进行翻译
- 不需要额外调用翻译接口
- 服务端会分别推送原文事件和译文事件

## 组件设计

### Settings 层

**SettingsPanel 修改：**
- 新增 'voice' tab（与 'model'、'general' 并列）
- tab 切换逻辑扩展支持三个 tab

**VoiceSettingsForm 组件（新增）：**
```typescript
interface VoiceSettingsFormProps {
  value: SpeechSettings;
  onChange: (settings: SpeechSettings) => void;
  disabled?: boolean;
}
```

表单字段：
- Provider 选择（目前仅显示 volcengine，禁用状态）
- 源语言下拉框：auto（自动）、zh（中文）、en（英文）、ja（日文）
- 翻译目标语言下拉框：none（不翻译）、zh（中文）、en（英文）、ja（日文）
- AppKey 输入框（type="password"）
- AccessKey 输入框（type="password"）

### ShellRail 层

**ShellRail 修改：**
- 在 Settings 按钮上方添加语音按钮
- 使用 lucide-react 的 `Mic` 图标（未激活）和 `Square` 图标（激活中）
- 按钮状态：
  - 未激活：`rail-button` 样式
  - 激活中：`rail-button rail-button-active` 样式

### 字幕层

**SubtitleOverlay 组件（新增）：**
```typescript
interface SubtitleOverlayProps {
  sourceText: string;
  translationText?: string;
  isVisible: boolean;
}
```

样式特性：
- `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);`
- 半透明背景：`background: rgba(0, 0, 0, 0.7);`
- 可拖动：使用 `draggable` 属性或鼠标事件实现
- 原文字体：`font-size: 1.25rem; font-weight: 500;`
- 译文字体：`font-size: 1rem; font-weight: 400; opacity: 0.9;`
- 无译文时：减小整体高度，隐藏译文行

**use-subtitle-controller.ts（新增）：**
- 管理字幕状态（sourceText、translationText）
- 监听 background 推送的识别结果
- 处理字幕的显示/隐藏逻辑

## 类型设计

### src/shared/types/speech.ts

```typescript
/** 语音 provider 标识 */
export type SpeechProviderId = 'volcengine';

/** 源语言选项 */
export type SourceLanguage = 'auto' | 'zh' | 'en' | 'ja';

/** 翻译目标语言 */
export type TargetLanguage = 'none' | 'zh' | 'en' | 'ja';

/** Volcengine provider 配置 */
export interface VolcengineSettings {
  appKey: string;      // X-Api-App-Key
  accessKey: string;   // X-Api-Access-Key
}

/** 语音设置 */
export interface SpeechSettings {
  provider: SpeechProviderId;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  volcengine: VolcengineSettings;
}

/** 识别结果 */
export interface RecognitionResult {
  sourceText: string;       // 原文
  translationText?: string; // 译文（targetLanguage 为 'none' 时不存在）
  startTime: number;        // 毫秒
  endTime: number;          // 毫秒
  isFinal: boolean;         // 是否是最终结果
}
```

### src/shared/types/runtime-messages.ts

新增消息类型：
```typescript
// 开始语音识别
interface StartSpeechRecognitionMessage {
  type: 'START_SPEECH_RECOGNITION';
  settings: SpeechSettings;
}

// 停止语音识别
interface StopSpeechRecognitionMessage {
  type: 'STOP_SPEECH_RECOGNITION';
}

// 语音识别结果（background -> UI）
interface SpeechRecognitionResultMessage {
  type: 'SPEECH_RECOGNITION_RESULT';
  result: RecognitionResult;
}

// 语音识别错误
interface SpeechRecognitionErrorMessage {
  type: 'SPEECH_RECOGNITION_ERROR';
  error: string;
}
```

## Provider 架构

### src/speech/providers/

**volcengine-provider.ts：**
```typescript
interface SpeechProvider {
  connect(config: VolcengineSettings, sourceLanguage: SourceLanguage, targetLanguage: TargetLanguage): Promise<void>;
  sendAudio(audioData: ArrayBuffer): void;
  onResult(callback: (result: RecognitionResult) => void): void;
  onError(callback: (error: string) => void): void;
  disconnect(): void;
}

class VolcengineProvider implements SpeechProvider {
  // WebSocket 连接管理
  // 音频数据发送
  // 识别结果接收和解析
}
```

**volcengine-wire-format.ts：**
- WebSocket 消息的序列化和反序列化
- Protobuf 消息格式转换
- Event 类型映射（StartSession=100, TaskRequest=200 等）

**provider-response.ts：**
- 统一的识别结果格式
- 原文和译文的合并逻辑
- 时间戳处理

### src/speech/services/

**speech-recognition.ts：**
```typescript
class SpeechRecognitionService {
  private provider: SpeechProvider;
  
  async start(settings: SpeechSettings): Promise<void>;
  sendAudio(audioData: ArrayBuffer): void;
  onResult(callback: (result: RecognitionResult) => void): void;
  onError(callback: (error: string) => void): void;
  stop(): void;
}
```

### src/speech/types/

**volcengine-protocol.ts：**
- Protobuf 消息类型定义
- Event 枚举
- 请求和响应结构

## Background 层

### src/background/speech/

**speech-orchestrator.ts：**
```typescript
class SpeechOrchestrator {
  private recognitionService: SpeechRecognitionService;
  private audioCapture: AudioCapture;
  
  async start(settings: SpeechSettings, tabId: number): Promise<void>;
  stop(): void;
  private handleRecognitionResult(result: RecognitionResult): void;
  private handleError(error: string): void;
}
```

职责：
- 接收 UI 的开始/停止消息
- 调用 AudioCapture 捕获标签页音频
- 将音频数据传递给 SpeechRecognitionService
- 将识别结果转发给 UI

**audio-capture.ts：**
```typescript
class AudioCapture {
  async captureTabAudio(tabId: number): Promise<MediaStream>;
  onAudioData(callback: (data: ArrayBuffer) => void): void;
  stop(): void;
}
```

职责：
- 使用 Chrome API 捕获标签页音频
- 将音频流转换为 PCM 格式（16kHz, 16bit, 单声道）
- 按 80ms 分包发送

### src/background/index.ts

注册语音消息处理：
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SPEECH_RECOGNITION') {
    speechOrchestrator.start(message.settings, sender.tab.id);
  } else if (message.type === 'STOP_SPEECH_RECOGNITION') {
    speechOrchestrator.stop();
  }
  // ... 其他消息处理
});
```

## 错误处理

### WebSocket 连接层
- 连接失败：显示错误提示，禁用语音按钮
- 鉴权失败（401）：提示"AppKey 或 AccessKey 错误，请检查设置"
- 网络断开：自动重连（最多3次），失败后提示用户手动重试

### 音频捕获层
- 浏览器不支持音频捕获：提示"您的浏览器不支持音频捕获功能，请升级浏览器"
- 权限被拒绝：提示"需要音频权限才能使用语音功能"
- 标签页无音频：显示"未检测到音频输入"

### 服务端错误
根据火山引擎错误码显示对应提示：
- 20000000：成功
- 45000001：提示"请求参数无效，请检查语言设置"
- 45000002：提示"未检测到有效音频"
- 45000081：提示"等待超时，请重试"
- 45000151：提示"音频格式不正确"
- 55000031：提示"服务器繁忙，请稍后重试"
- 550xxxxx：提示"服务内部错误，请稍后重试"

### 字幕显示
- 识别结果为空时不显示字幕条
- 长时间无结果（超过10秒）显示"等待语音输入..."
- 网络延迟导致结果延迟时显示加载指示器

## 国际化

### src/shared/i18n/message-catalog.ts

新增翻译 key：
```typescript
// Settings
'settings.tabs.voice'
'settings.voice.provider'
'settings.voice.sourceLanguage'
'settings.voice.targetLanguage'
'settings.voice.appKey'
'settings.voice.accessKey'
'settings.voice.sourceLanguage.auto'
'settings.voice.sourceLanguage.zh'
'settings.voice.sourceLanguage.en'
'settings.voice.sourceLanguage.ja'
'settings.voice.targetLanguage.none'
'settings.voice.targetLanguage.zh'
'settings.voice.targetLanguage.en'
'settings.voice.targetLanguage.ja'

// Shell Rail
'shell.rail.voice'

// Subtitle
'subtitle.waiting'
'subtitle.noAudio'

// Errors
'voice.error.connectionFailed'
'voice.error.authFailed'
'voice.error.noAudioPermission'
'voice.error.browserNotSupported'
'voice.error.serverBusy'
'voice.error.invalidParams'
'voice.error.emptyAudio'
'voice.error.timeout'
'voice.error.invalidFormat'
'voice.error.internalError'
```

## 测试策略

### 单元测试
- `speech-settings-repository.ts` - 设置的加载、保存、默认值
- `volcengine-wire-format.ts` - WebSocket 消息格式转换
- `provider-response.ts` - 识别结果格式化
- `audio-capture.ts` - 音频格式转换逻辑

### 集成测试
- VoiceSettingsForm - 表单编辑和提交
- SubtitleOverlay - 字幕显示和拖动
- WebSocket 连接流程（使用 mock WebSocket）
- 识别结果的接收和显示

### 手动测试
- 实际音频捕获和识别
- 不同语言组合的翻译效果（中英、英中、中日等）
- 字幕条在不同网页上的显示效果
- 长时间运行的稳定性（30分钟以上）
- 网络异常情况下的重连机制
- 错误提示的准确性

## 文件清单

### 新增文件

```
src/speech/
├── providers/
│   ├── volcengine-provider.ts          # Volcengine WebSocket 实现
│   ├── volcengine-wire-format.ts       # Protobuf 消息格式转换
│   └── provider-response.ts            # 统一识别结果格式
├── services/
│   └── speech-recognition.ts           # 语音识别服务
└── types/
    └── volcengine-protocol.ts          # Volcengine 协议类型定义

src/background/speech/
├── speech-orchestrator.ts              # 语音编排器
└── audio-capture.ts                    # 音频捕获

src/shared/
├── types/
│   └── speech.ts                       # 语音类型定义
└── storage/
    └── speech-settings-repository.ts   # 语音设置存储

src/ui/content/speech/
├── SubtitleOverlay.tsx                 # 字幕条组件
├── subtitle-overlay.css                # 字幕条样式
└── use-subtitle-controller.ts          # 字幕控制器

src/ui/content/settings/
└── VoiceSettingsForm.tsx               # 语音设置表单
```

### 修改文件

```
src/ui/content/
├── ShellRail.tsx                       # 添加语音按钮
├── ContentApp.tsx                      # 集成字幕条组件
└── settings/
    └── SettingsPanel.tsx               # 添加 voice tab

src/shared/
├── types/
│   ├── settings.ts                     # 添加 SpeechSettings
│   └── runtime-messages.ts             # 添加语音相关消息
└── i18n/
    └── message-catalog.ts              # 添加语音相关翻译 key

src/background/
└── index.ts                            # 注册语音消息处理
```

## 实现注意事项

1. **音频格式要求**
   - 必须是 16kHz, 16bit, 单声道 PCM/WAV
   - 建议每包 80ms 音频数据
   - 需要在 audio-capture.ts 中进行格式转换

2. **WebSocket 连接**
   - 使用 Protobuf 进行消息序列化
   - 需要等待 SessionStarted 响应后再发送音频
   - 连接时在 HTTP Header 中添加鉴权信息

3. **识别结果处理**
   - 原文和译文是分别推送的（不同的 Event）
   - 需要根据 startTime 和 endTime 匹配原文和译文
   - isFinal 标志区分中间结果和最终结果

4. **字幕条实现**
   - 使用 CSS `position: fixed` 固定在底部
   - 拖动功能使用 `onMouseDown` + `onMouseMove` + `onMouseUp`
   - 半透明效果使用 `rgba(0, 0, 0, 0.7)`

5. **Provider 扩展性**
   - 接口设计要考虑未来支持其他语音服务
   - 配置字段使用 provider 命名空间（如 volcengine.appKey）
   - 错误处理要统一，不暴露 provider 特定的错误码

6. **性能优化**
   - 音频数据使用 ArrayBuffer 传输，避免字符串转换
   - 字幕更新使用防抖，避免频繁渲染
   - WebSocket 消息使用二进制格式（Protobuf）

## 未来扩展

1. **多 Provider 支持**
   - 添加其他语音识别服务（如 Google Speech、Azure Speech）
   - 在设置中允许用户选择 provider

2. **高级功能**
   - 语音识别历史记录
   - 字幕导出（SRT、VTT 格式）
   - 自定义字幕样式（字体、颜色、大小）
   - 热词和术语词表支持

3. **性能优化**
   - 音频数据压缩
   - WebSocket 连接池
   - 识别结果缓存

4. **用户体验**
   - 语音活动检测（VAD）
   - 静音自动暂停
   - 快捷键控制
   - 字幕位置记忆
