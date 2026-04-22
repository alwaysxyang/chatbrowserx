# Speech 状态持久化设计归档记录

## 1. 文档身份

- 文档类型：归档文档
- 约束级别：不直接约束当前实现
- 适用范围：仅用于保留早期 speech 状态持久化设计背景
- 上级文档：`docs/superpowers/specs/2026-04-04-browser-agent-project-spec.md`
- 当前约束来源：`docs/superpowers/specs/2026-04-10-realtime-voice-feature-design.md`

本文件记录早期关于 speech 状态持久化与生命周期管理的设想。它不是当前实现的依据。

## 2. 归档原因

早期方案曾设想引入以下能力：

- `src/shared/storage/speech-state-repository.ts`
- 基于 `chrome.webNavigation` 的页面导航监听
- 录音状态写入 `chrome.storage.local`
- 页面刷新或导航后的自动恢复

这些能力当前没有作为完整实现落地，也不属于主 spec 当前阶段的硬性范围。

当前代码中仅保留了一个轻量的 `speechStateQuery` 协议：content script 挂载后查询 `SpeechOrchestrator` 内存中的 tab 会话状态，用于恢复本地 listening 展示。该协议不提供 storage 持久化，不保证跨 service worker 生命周期或浏览器重启恢复。

## 3. 当前使用规则

- 当前 speech 约束以 `2026-04-10-realtime-voice-feature-design.md` 为准。
- 如果本文件与当前代码、主 spec 或 speech feature spec 不一致，必须忽略本文件。
- 如需重新引入持久化、导航恢复或跨生命周期恢复能力，必须先更新主 spec 与 speech feature spec，再进入实现。

## 4. 历史保留内容

本归档文档保留的历史意图是：让 speech 会话在页面刷新、聊天面板关闭或 tab 切换时拥有更明确的生命周期语义。

这些方向可以作为后续讨论背景，但不能直接作为实现任务或测试依据。
