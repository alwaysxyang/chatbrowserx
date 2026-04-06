import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Pin, Sparkles } from 'lucide-react';
import { isPanelCommandMessage } from '../../shared/types/runtime-messages';
import { ChatPanel } from './chat/ChatPanel';
import { useChatController } from './chat/use-chat-controller';
import { SettingsPanel } from './settings/SettingsPanel';
import { ShellRail } from './ShellRail';
import type { UiLanguage } from '../../shared/types/settings';
import { defaultSettings, loadSettings } from '../../shared/storage/settings-repository';
import { setCurrentUiLanguage } from '../../shared/i18n/current-language';
import { translateMessage } from '../../shared/i18n/i18n';

const getPanelStateStorageKey = (hostname: string) => `chatbrowserx.panel.${hostname || 'default'}`;

// 将完整 hostname 归一化为“二级域名”级别的标识，用于缓存键：
// - www.baidu.com   -> baidu.com
// - news.qq.com     -> qq.com
// - baidu.com       -> baidu.com
// - localhost / IP  -> 原样返回
function normalizeHostnameForStorage(hostname: string): string {
  const raw = (hostname || '').trim().toLowerCase();
  if (!raw) return 'default';

  const parts = raw.split('.');
  if (parts.length <= 2) {
    return raw;
  }

  const secondLevel = parts[parts.length - 2];
  const topLevel = parts[parts.length - 1];
  return `${secondLevel}.${topLevel}`;
}

export function ContentApp() {
  const hostname = useMemo(() => normalizeHostnameForStorage(window.location.hostname || 'default'), []);
  const panelStateStorageKey = useMemo(() => getPanelStateStorageKey(hostname), [hostname]);
  const buildLabel = useMemo(() => `Build ${__CHATBROWSERX_BUILD_TIME__}`, []);
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [isPinned, setIsPinned] = useState(false);
  const [hasHydratedPinned, setHasHydratedPinned] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(460);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(defaultSettings.general.uiLanguage);
  const [hasHydratedLanguage, setHasHydratedLanguage] = useState(false);
  const { messages, isSending, streamingContent, sendMessage, clearHistory, stop } =
    useChatController(hostname);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    chrome.storage.local.get(panelStateStorageKey).then((result) => {
      const persistedState = result[panelStateStorageKey] as { pinned?: boolean; open?: boolean } | undefined;
      const persistedPinned = persistedState?.pinned === true;
      const persistedOpen = persistedState?.open === true;

      setIsPinned(persistedPinned);
      if (persistedPinned && persistedOpen) {
        setIsOpen(true);
      }
      setHasHydratedPinned(true);
    });
  }, [panelStateStorageKey]);

  // 加载用户保存的 UI 语言设置
  useEffect(() => {
    loadSettings()
      .then((settings) => {
        // 先同步当前语言缓存，再更新本地 state，确保首次渲染就使用用户配置的语言
        setCurrentUiLanguage(settings.general.uiLanguage);
        setUiLanguage(settings.general.uiLanguage);
        setHasHydratedLanguage(true);
      })
      .catch(() => {
        // 读取失败时保持默认语言，不打断主流程
        setHasHydratedLanguage(true);
      });
  }, []);

  useEffect(() => {
    setCurrentUiLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    if (!hasHydratedPinned) {
      return;
    }

    void chrome.storage.local.set({
      [panelStateStorageKey]: {
        pinned: isPinned,
        open: isOpen,
      },
    });
  }, [hasHydratedPinned, isOpen, isPinned, panelStateStorageKey]);

  useEffect(() => {
    const listener: typeof chrome.runtime.onMessage.addListener extends (callback: infer T) => unknown ? T : never = (message) => {
      if (!isPanelCommandMessage(message)) {
        return undefined;
      }

      if (message.payload.command === 'toggle-chat') {
        setIsOpen((current) => !current);
        setActiveView('chat');
        return undefined;
      }

      setIsOpen(true);
      setActiveView(message.payload.command === 'open-settings' ? 'settings' : 'chat');
      return undefined;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || isPinned) {
      return;
    }

    const handlePointerDownOutside = (event: MouseEvent) => {
      const asideElement = asideRef.current;
      if (!asideElement) {
        return;
      }

      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (path.includes(asideElement)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [isOpen, isPinned]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) {
        return;
      }

      const nextWidth = resizeStateRef.current.startWidth + (resizeStateRef.current.startX - event.clientX);
      const clampedWidth = Math.max(380, Math.min(640, nextWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
  };

  if (!isOpen || !hasHydratedLanguage) {
    return null;
  }

  return (
    <aside ref={asideRef} className="sidebar-shell" data-testid="sidebar-shell" style={{ width: `${sidebarWidth}px` }}>
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
                streamingContent={streamingContent}
                onSendMessage={sendMessage}
                onClearHistory={() => {
                  void clearHistory();
                }}
                onStop={stop}
              />
            ) : (
              <SettingsPanel
                onUiLanguageChange={(next) => {
                  setUiLanguage(next);
                  // 语言在设置页变更时同步更新当前语言缓存，以便 ShellRail 等使用默认语言的模块立即生效
                  setCurrentUiLanguage(next);
                }}
              />
            )}
          </div>

          <ShellRail activeView={activeView} onSelectView={setActiveView} />
        </div>
      </div>
    </aside>
  );
}
