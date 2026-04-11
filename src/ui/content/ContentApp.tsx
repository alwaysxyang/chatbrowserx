import { useMemo } from 'react';
import { Pin, Sparkles } from 'lucide-react';
import { ChatPanel } from './chat/ChatPanel';
import { ImagePreviewOverlay } from './chat/ImagePreviewOverlay';
import { ScreenshotOverlay } from './chat/ScreenshotOverlay';
import { useChatController } from './chat/use-chat-controller';
import { SettingsPanel } from './settings/SettingsPanel';
import { ShellRail } from './ShellRail';
import { SubtitleOverlay } from './speech/SubtitleOverlay';
import { useSubtitleController } from './speech/use-subtitle-controller';
import { translateMessage } from '../../shared/i18n/i18n';
import { normalizeHostnameForStorage } from './content-panel-state';
import { requestVisibleTabScreenshot } from './content-screenshot-bridge';
import { useContentShell } from './use-content-shell';

export function ContentApp() {
  const hostname = useMemo(() => normalizeHostnameForStorage(window.location.hostname || 'default'), []);
  const buildLabel = useMemo(() => `Build ${__CHATBROWSERX_BUILD_TIME__}`, []);
  const { messages, isSending, sendMessage, clearHistory, stop } = useChatController(hostname);
  const { subtitle, startRecognition, stopRecognition } = useSubtitleController();
  const {
    isOpen,
    activeView,
    isPinned,
    sidebarWidth,
    hasHydratedLanguage,
    screenshotSession,
    previewImageUrl,
    asideRef,
    setIsOpen,
    setActiveView,
    setIsPinned,
    setPreviewImageUrl,
    handleResizeStart,
    handleUiLanguageChange,
    startScreenshotSession,
    closeScreenshotSession,
    handleScreenshotComplete,
  } = useContentShell(hostname);

  const handleVoiceToggle = async (isActive: boolean) => {
    console.log('[ContentApp] Voice toggle:', isActive);
    try {
      if (isActive) {
        console.log('[ContentApp] Starting recognition...');
        await startRecognition();
      } else {
        console.log('[ContentApp] Stopping recognition...');
        await stopRecognition();
      }
    } catch (error) {
      console.error('Voice toggle error:', error);
    }
  };

  if (!isOpen || !hasHydratedLanguage) {
    return null;
  }

  return (
    <>
      <aside
        ref={asideRef}
        className={`sidebar-shell ${screenshotSession ? 'sidebar-shell-hidden-for-screenshot' : ''}`}
        data-testid="sidebar-shell"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="app-frame">
          <div className="sidebar-resize-handle" data-testid="sidebar-resize-handle" onMouseDown={handleResizeStart} />
          <header className="shell-header">
            <div className="brand-block">
              <div className="brand-mark" aria-hidden="true">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
              </div>
              <div>
                <div className="brand-title">ChatBrowserX</div>
                <div className="brand-subtitle">{buildLabel}</div>
              </div>
            </div>
            <div className="header-actions">
              <button
                aria-label={isPinned ? translateMessage('shell.header.unpin') : translateMessage('shell.header.pin')}
                aria-pressed={isPinned}
                className={`icon-button ${isPinned ? 'icon-button-active' : ''}`}
                data-tooltip={isPinned ? translateMessage('shell.header.unpin') : translateMessage('shell.header.pin')}
                type="button"
                onClick={() => setIsPinned((current) => !current)}
              >
                <Pin className={`h-3.5 w-3.5 ${isPinned ? 'pin-icon-rotated' : ''}`} strokeWidth={2.2} />
              </button>
              <span aria-hidden="true" className="header-divider" />
              <button
                aria-label={translateMessage('shell.header.close')}
                className="icon-button"
                data-tooltip={translateMessage('shell.header.close')}
                type="button"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div className="shell-content">
            <div className="shell-main">
              {activeView === 'chat' ? (
                <ChatPanel
                  isSending={isSending}
                  messages={messages}
                  onSendMessage={sendMessage}
                  onClearHistory={() => {
                    void clearHistory();
                  }}
                  onStop={stop}
                  onStartScreenshot={(onCaptured) => {
                    startScreenshotSession({ onCaptured });
                  }}
                  onPreviewImage={setPreviewImageUrl}
                />
              ) : (
                <SettingsPanel onUiLanguageChange={handleUiLanguageChange} />
              )}
            </div>

            <ShellRail
              activeView={activeView}
              onSelectView={setActiveView}
              onVoiceToggle={handleVoiceToggle}
              isVoiceActive={subtitle.isActive}
            />
          </div>
        </div>
      </aside>
      <SubtitleOverlay
        sourceText={subtitle.sourceText}
        translationText={subtitle.translationText}
        isVisible={subtitle.isActive}
      />
      {screenshotSession ? (
        <ScreenshotOverlay
          onCaptureVisibleTab={requestVisibleTabScreenshot}
          onComplete={handleScreenshotComplete}
          onCancel={closeScreenshotSession}
        />
      ) : null}
      {previewImageUrl ? (
        <ImagePreviewOverlay
          src={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      ) : null}
    </>
  );
}
